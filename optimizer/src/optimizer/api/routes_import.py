"""CURAノート インポート ルート"""

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from google.cloud import firestore as firestore_client  # type: ignore[import-untyped]
from googleapiclient.discovery import build  # type: ignore[import-untyped]

from optimizer.api.auth import require_manager_or_above
from optimizer.api.routes_common import _get_sheets_credentials
from optimizer.api.schemas import (
    ErrorResponse,
    NoteImportActionResponse,
    NoteImportApplyRequest,
    NoteImportApplyResponse,
    NoteImportMatchedOrder,
    NoteImportPreviewResponse,
    NoteImportRequest,
    NoteImportTimeRange,
)
from optimizer.data.firestore_loader import get_firestore_client, load_all_customers
from optimizer.integrations.note_diff import (
    ImportActionStatus,
    NoteImportAction,
    apply_import_actions,
    build_import_preview,
)
from optimizer.integrations.note_parser import ParsedNote, TimeRange, parse_notes
from optimizer.integrations.sheets_reader import mark_notes_as_handled, read_note_rows

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# ヘルパー関数
# ---------------------------------------------------------------------------


def _action_to_response(action: NoteImportAction) -> NoteImportActionResponse:
    """NoteImportAction → NoteImportActionResponse 変換"""

    matched = None
    if action.matched_order is not None:
        mo = action.matched_order
        matched = NoteImportMatchedOrder(
            order_id=mo.order_id,
            customer_id=mo.customer_id,
            customer_name=mo.customer_name,
            date=mo.date,
            start_time=mo.start_time,
            end_time=mo.end_time,
            service_type=mo.service_type,
            status=mo.status,
        )

    def _tr(tr: TimeRange | None) -> NoteImportTimeRange | None:
        if tr is None:
            return None
        return NoteImportTimeRange(start=tr.start, end=tr.end)

    return NoteImportActionResponse(
        post_id=action.post_id,
        action_type=action.action_type.value,
        status=action.status.value,
        customer_name=action.customer_name,
        matched_customer_id=action.matched_customer_id,
        matched_order=matched,
        description=action.description,
        raw_content=action.raw_content,
        date_from=action.date_from,
        date_to=action.date_to,
        time_range=_tr(action.time_range),
        new_time_range=_tr(action.new_time_range),
        confidence=action.confidence,
    )


def _customers_to_dicts(customers_raw: list) -> list[dict[str, object]]:
    """Customer Pydanticモデルを辞書リストに変換"""
    return [
        {
            "id": c.id,
            "family_name": c.family_name,
            "given_name": c.given_name,
            "short_name": getattr(c, "short_name", ""),
        }
        for c in customers_raw
    ]


def _orders_to_dicts(orders_raw: list[dict[str, object]]) -> list[dict[str, object]]:
    """Firestoreオーダーdictのフィールドを正規化"""
    return [
        {
            "id": o.get("id", ""),
            "customer_id": o.get("customer_id", ""),
            "date": o.get("date", ""),
            "start_time": o.get("start_time", ""),
            "end_time": o.get("end_time", ""),
            "service_type": o.get("service_type", ""),
            "status": o.get("status", ""),
        }
        for o in orders_raw
    ]


def _load_orders_for_notes(
    db: firestore_client.Client,
    parsed_notes: list[ParsedNote],
) -> list[dict[str, object]]:
    """ノートの日付範囲に該当するオーダーをFirestoreから取得する"""
    if not parsed_notes:
        return []

    # 全ノートの日付範囲を算出
    all_dates: list[str] = []
    for note in parsed_notes:
        all_dates.append(note.date_from)
        if note.date_to:
            all_dates.append(note.date_to)

    if not all_dates:
        return []

    min_date = min(all_dates)
    max_date = max(all_dates)

    start_dt = datetime.fromisoformat(min_date)
    end_dt = datetime.fromisoformat(max_date) + timedelta(days=1)

    orders_ref = db.collection("orders")
    query = (
        orders_ref
        .where("date", ">=", start_dt)
        .where("date", "<=", end_dt)
    )

    orders: list[dict] = []
    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        # 日付をISO形式に変換
        if hasattr(data.get("date"), "isoformat"):
            data["date"] = data["date"].strftime("%Y-%m-%d")
        elif hasattr(data.get("date"), "date_string"):
            data["date"] = str(data["date"])
        orders.append(data)

    return orders


# ---------------------------------------------------------------------------
# エンドポイント
# ---------------------------------------------------------------------------


@router.post(
    "/import/notes",
    response_model=NoteImportPreviewResponse,
    responses={500: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
def import_notes_preview(
    req: NoteImportRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> NoteImportPreviewResponse:
    """CURAノートを読み取り、差分プレビューを返す（dry-run）"""
    # Google Sheets APIクライアント
    try:
        credentials = _get_sheets_credentials()
        sheets_service = build("sheets", "v4", credentials=credentials)
    except Exception as e:
        logger.error("Google Sheets API接続失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=503, detail=f"Google Sheets APIに接続できませんでした: {e}"
        ) from e

    # ノート読み取り
    try:
        note_rows = read_note_rows(sheets_service, req.spreadsheet_id)
    except Exception as e:
        logger.error("ノート読み取り失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"スプレッドシートの読み取りに失敗しました: {e}"
        ) from e

    if not note_rows:
        return NoteImportPreviewResponse(
            spreadsheet_id=req.spreadsheet_id,
            total_notes=0,
            actions=[],
            ready_count=0,
            review_count=0,
            unmatched_count=0,
            skipped_count=0,
        )

    # テキスト解析
    parsed_notes = parse_notes(note_rows)

    # Firestoreから顧客・オーダー取得
    try:
        db = get_firestore_client()
        customers_raw = load_all_customers(db)
        # 全オーダーを取得（日付範囲でフィルタ）
        all_orders_raw = _load_orders_for_notes(db, parsed_notes)
    except Exception as e:
        logger.error("Firestore読み込み失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Firestoreデータの読み込みに失敗しました: {e}"
        ) from e

    customers_list = _customers_to_dicts(customers_raw)
    orders_list = _orders_to_dicts(all_orders_raw)

    # プレビュー構築
    preview = build_import_preview(
        req.spreadsheet_id, parsed_notes, customers_list, orders_list
    )

    # レスポンスに変換
    return NoteImportPreviewResponse(
        spreadsheet_id=preview.spreadsheet_id,
        total_notes=preview.total_notes,
        actions=[
            _action_to_response(a) for a in preview.actions
        ],
        ready_count=preview.ready_count,
        review_count=preview.review_count,
        unmatched_count=preview.unmatched_count,
        skipped_count=preview.skipped_count,
    )


@router.post(
    "/import/notes/apply",
    response_model=NoteImportApplyResponse,
    responses={500: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
def import_notes_apply(
    req: NoteImportApplyRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> NoteImportApplyResponse:
    """プレビュー確認後、選択したノートアクションをFirestoreに反映する"""

    # Google Sheets APIクライアント
    try:
        credentials = _get_sheets_credentials()
        sheets_service = build("sheets", "v4", credentials=credentials)
    except Exception as e:
        logger.error("Google Sheets API接続失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=503, detail=f"Google Sheets APIに接続できませんでした: {e}"
        ) from e

    # ノート再読み取り（最新の状態を取得）
    try:
        note_rows = read_note_rows(sheets_service, req.spreadsheet_id)
    except Exception as e:
        logger.error("ノート読み取り失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"スプレッドシートの読み取りに失敗しました: {e}"
        ) from e

    # 指定された投稿IDのみフィルタ
    post_id_set = set(req.post_ids)
    filtered_rows = [r for r in note_rows if r.post_id in post_id_set]

    if not filtered_rows:
        return NoteImportApplyResponse(
            applied_count=0,
            marked_count=0,
            total_requested=len(req.post_ids),
        )

    # 解析・マッチング
    parsed_notes = parse_notes(filtered_rows)

    try:
        db = get_firestore_client()
        customers_raw = load_all_customers(db)
        all_orders_raw = _load_orders_for_notes(db, parsed_notes)
    except Exception as e:
        logger.error("Firestore読み込み失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Firestoreデータの読み込みに失敗しました: {e}"
        ) from e

    customers_list = _customers_to_dicts(customers_raw)
    orders_list = _orders_to_dicts(all_orders_raw)

    preview = build_import_preview(
        req.spreadsheet_id, parsed_notes, customers_list, orders_list
    )

    # READY なアクションのみ適用
    ready_actions = [
        a for a in preview.actions if a.status == ImportActionStatus.READY
    ]

    applied_count = 0
    if ready_actions:
        try:
            applied_count = apply_import_actions(db, ready_actions)
        except Exception as e:
            logger.error("Firestore反映失敗: %s", e, exc_info=True)
            raise HTTPException(
                status_code=500, detail=f"Firestoreへの反映に失敗しました: {e}"
            ) from e

    # スプレッドシートの対応可否を更新
    marked_count = 0
    if req.mark_as_handled and ready_actions:
        try:
            handled_post_ids = [a.post_id for a in ready_actions]
            marked_count = mark_notes_as_handled(
                sheets_service, req.spreadsheet_id, handled_post_ids
            )
        except Exception as e:
            # スプレッドシート更新失敗は致命的ではないのでログのみ
            logger.warning("スプレッドシート更新失敗（非致命的）: %s", e)

    return NoteImportApplyResponse(
        applied_count=applied_count,
        marked_count=marked_count,
        total_requested=len(req.post_ids),
    )
