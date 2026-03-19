"""APIルーティング"""

import logging
import os
import re
from datetime import UTC, date, datetime, timedelta, timezone

import google.auth  # type: ignore[import-untyped]
from google.cloud import firestore as firestore_client  # type: ignore[import-untyped]
import google.auth.compute_engine  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, Query
from googleapiclient.discovery import build  # type: ignore[import-untyped]

_SHEETS_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def _get_sheets_credentials() -> object:
    """Sheets/Drive API用の認証情報を取得する。

    ローカル開発: ADC（gcloud auth application-default login --scopes=... で設定済み）をそのまま使用。
    Cloud Run: Compute Engine Credentials は cloud-platform スコープしか持てないため、
    IAM Credentials API を経由した SA self-impersonation でSheets/Drive スコープのトークンを取得する。
    """
    creds, _ = google.auth.default()

    if isinstance(creds, google.auth.compute_engine.Credentials):
        from google.auth import impersonated_credentials  # type: ignore[import-untyped]

        sa_email = os.getenv(
            "SHEETS_SA_EMAIL",
            "1045989697649-compute@developer.gserviceaccount.com",
        )
        creds = impersonated_credentials.Credentials(
            source_credentials=creds,
            target_principal=sa_email,
            target_scopes=_SHEETS_SCOPES,
        )

    return creds


from optimizer.api.auth import require_manager_or_above
from optimizer.api.schemas import (
    ApplyIrregularPatternsRequest,
    ApplyIrregularPatternsResponse,
    ApplyUnavailabilityRequest,
    ApplyUnavailabilityResponse,
    AssignmentResponse,
    ChecklistOrderItem,
    DailyChecklistResponse,
    DuplicateWeekRequest,
    DuplicateWeekResponse,
    ErrorResponse,
    ExportReportRequest,
    ExportReportResponse,
    NoteImportActionResponse,
    NoteImportApplyRequest,
    NoteImportApplyResponse,
    NoteImportMatchedOrder,
    NoteImportPreviewResponse,
    NoteImportRequest,
    NoteImportTimeRange,
    OptimizationParametersResponse,
    OptimizationRunDetailResponse,
    OptimizationRunListResponse,
    OptimizationRunResponse,
    OptimizeRequest,
    OptimizeResponse,
    ResetAssignmentsRequest,
    ResetAssignmentsResponse,
    ChatReminderRequest,
    ChatReminderResponse,
    ChatReminderResultItem,
    IrregularPatternExclusion,
    OrderChangeNotifyRequest,
    OrderChangeNotifyResponse,
    OrderChangeNotifyResultItem,
    StaffChecklist,
    UnavailabilityRemovalItem,
)
from optimizer.data.firestore_loader import (
    get_firestore_client,
    load_all_customers,
    load_all_helpers,
    load_all_service_types,
    load_monthly_orders,
    load_optimization_input,
)
from optimizer.data.firestore_writer import (
    apply_irregular_patterns,
    apply_unavailability_to_orders,
    duplicate_week_orders,
    reset_assignments,
    save_optimization_run,
    write_assignments,
)
from optimizer.engine.solver import SoftWeights, diagnose_infeasibility, solve
from optimizer.integrations.note_diff import (
    ImportActionStatus,
    NoteImportAction,
    apply_import_actions,
    build_import_preview,
)
from optimizer.integrations.note_parser import ParsedNote, TimeRange, parse_notes
from optimizer.integrations.sheets_reader import mark_notes_as_handled, read_note_rows
from optimizer.models import Assignment, OptimizationParameters, OptimizationRunRecord
from optimizer.notification.chat_sender import send_chat_dms
from optimizer.report.aggregation import (
    aggregate_customer_summary,
    aggregate_service_type_summary,
    aggregate_staff_summary,
    aggregate_status_summary,
)
from optimizer.report.sheets_writer import create_monthly_report_spreadsheet

logger = logging.getLogger(__name__)


def _serialize_executed_at(value: object) -> str:
    """Firestore Timestamp/datetimeをISO 8601文字列に変換"""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value) if value else ""

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post(
    "/optimize",
    response_model=OptimizeResponse,
    responses={409: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def optimize(req: OptimizeRequest, _auth: dict | None = Depends(require_manager_or_above)) -> OptimizeResponse:
    """シフト最適化を実行し、結果をFirestoreに書き戻す"""
    # 日付パース
    try:
        week_start = date.fromisoformat(req.week_start_date)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    # 月曜日チェック
    if week_start.weekday() != 0:
        raise HTTPException(
            status_code=422,
            detail=f"{req.week_start_date} は月曜日ではありません"
            f"（weekday={week_start.weekday()}）",
        )

    # Firestoreからデータ読み込み
    try:
        db = get_firestore_client()
        inp = load_optimization_input(db, week_start)
    except Exception as e:
        logger.error("Firestore読み込み失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Firestore読み込みエラー: {e}"
        ) from e

    if not inp.orders:
        raise HTTPException(
            status_code=409,
            detail=f"対象週 {req.week_start_date} に最適化対象のオーダーがありません",
        )

    logger.info(
        "最適化開始: orders=%d, helpers=%d, customers=%d",
        len(inp.orders),
        len(inp.helpers),
        len(inp.customers),
    )

    # ソルバー実行
    weights = SoftWeights(
        travel=req.w_travel,
        preferred_staff=req.w_preferred_staff,
        workload_balance=req.w_workload_balance,
        continuity=req.w_continuity,
    )
    result = solve(inp, time_limit_seconds=req.time_limit_seconds, weights=weights)

    if result.status == "Infeasible":
        # 診断を実行してどのオーダーが問題かをログに記録
        detail_msg = "制約を満たす割当が見つかりません"
        try:
            diagnosis = diagnose_infeasibility(inp, time_limit_seconds=30)
            problem_orders = diagnosis.zero_feasible_orders + diagnosis.unassigned_orders + diagnosis.partially_assigned_orders
            if problem_orders:
                detail_msg = (
                    f"制約を満たす割当が見つかりません。"
                    f"問題のあるオーダー: {problem_orders}"
                )
        except Exception as diag_err:
            logger.warning("Infeasibility診断でエラー: %s", diag_err)
        raise HTTPException(status_code=409, detail=detail_msg)

    # Firestore書き戻し
    orders_updated = 0
    if not req.dry_run and result.assignments:
        try:
            orders_updated = write_assignments(db, result.assignments)
        except Exception as e:
            logger.error("Firestore書き戻し失敗: %s", e, exc_info=True)
            raise HTTPException(
                status_code=500, detail="割当の保存に失敗しました"
            ) from e
        logger.info("Firestore書き戻し完了: %d件", orders_updated)

    # 最適化実行記録を保存
    executed_by = ""
    if _auth:
        executed_by = _auth.get("uid", "")

    run_record = OptimizationRunRecord(
        id="",  # save_optimization_run内で生成
        week_start_date=req.week_start_date,
        executed_at=datetime.now(UTC),
        executed_by=executed_by,
        dry_run=req.dry_run,
        status=result.status,
        objective_value=result.objective_value,
        solve_time_seconds=result.solve_time_seconds,
        total_orders=len(inp.orders),
        assigned_count=len(result.assignments),
        assignments=result.assignments,
        parameters=OptimizationParameters(
            time_limit_seconds=req.time_limit_seconds,
            w_travel=req.w_travel,
            w_preferred_staff=req.w_preferred_staff,
            w_workload_balance=req.w_workload_balance,
            w_continuity=req.w_continuity,
        ),
    )

    try:
        run_id = save_optimization_run(db, run_record)
        logger.info("最適化実行記録保存完了: id=%s", run_id)
    except Exception as e:
        logger.error("最適化実行記録の保存失敗: %s", e, exc_info=True)
        # 実行記録の保存失敗はAPIレスポンスには影響させない

    return OptimizeResponse(
        assignments=[
            AssignmentResponse(order_id=a.order_id, staff_ids=a.staff_ids)
            for a in result.assignments
        ],
        objective_value=result.objective_value,
        solve_time_seconds=result.solve_time_seconds,
        status=result.status,
        orders_updated=orders_updated,
        total_orders=len(inp.orders),
        assigned_count=len(result.assignments),
    )


@router.get(
    "/optimization-runs",
    response_model=OptimizationRunListResponse,
)
def list_optimization_runs(
    week_start_date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    limit: int = Query(20, ge=1, le=100),
    _auth: dict | None = Depends(require_manager_or_above),
) -> OptimizationRunListResponse:
    """最適化実行履歴一覧を取得"""
    db = get_firestore_client()
    query = db.collection("optimization_runs").order_by(
        "executed_at", direction="DESCENDING"
    )

    if week_start_date:
        query = query.where("week_start_date", "==", week_start_date)

    query = query.limit(limit)

    try:
        docs = list(query.stream())
    except Exception as e:
        logger.warning("Failed to query optimization_runs: %s", e)
        return OptimizationRunListResponse(runs=[])

    runs = []
    for doc in docs:
        data = doc.to_dict()
        params = data.get("parameters", {})

        runs.append(
            OptimizationRunResponse(
                id=data.get("id", doc.id),
                week_start_date=data.get("week_start_date", ""),
                executed_at=_serialize_executed_at(data.get("executed_at")),
                executed_by=data.get("executed_by", ""),
                dry_run=data.get("dry_run", False),
                status=data.get("status", ""),
                objective_value=data.get("objective_value", 0.0),
                solve_time_seconds=data.get("solve_time_seconds", 0.0),
                total_orders=data.get("total_orders", 0),
                assigned_count=data.get("assigned_count", 0),
                parameters=OptimizationParametersResponse(
                    time_limit_seconds=params.get("time_limit_seconds", 180),
                    w_travel=params.get("w_travel", 1.0),
                    w_preferred_staff=params.get("w_preferred_staff", 5.0),
                    w_workload_balance=params.get("w_workload_balance", 10.0),
                    w_continuity=params.get("w_continuity", 3.0),
                ),
            )
        )

    return OptimizationRunListResponse(runs=runs)


@router.get(
    "/optimization-runs/{run_id}",
    response_model=OptimizationRunDetailResponse,
    responses={404: {"model": ErrorResponse}},
)
def get_optimization_run(
    run_id: str,
    _auth: dict | None = Depends(require_manager_or_above),
) -> OptimizationRunDetailResponse:
    """最適化実行記録の詳細を取得"""
    db = get_firestore_client()
    doc = db.collection("optimization_runs").document(run_id).get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="実行記録が見つかりません")

    data = doc.to_dict()
    params = data.get("parameters", {})

    assignments = [
        AssignmentResponse(
            order_id=a.get("order_id", ""),
            staff_ids=a.get("staff_ids", []),
        )
        for a in data.get("assignments", [])
    ]

    return OptimizationRunDetailResponse(
        id=data.get("id", doc.id),
        week_start_date=data.get("week_start_date", ""),
        executed_at=_serialize_executed_at(data.get("executed_at")),
        executed_by=data.get("executed_by", ""),
        dry_run=data.get("dry_run", False),
        status=data.get("status", ""),
        objective_value=data.get("objective_value", 0.0),
        solve_time_seconds=data.get("solve_time_seconds", 0.0),
        total_orders=data.get("total_orders", 0),
        assigned_count=data.get("assigned_count", 0),
        parameters=OptimizationParametersResponse(
            time_limit_seconds=params.get("time_limit_seconds", 180),
            w_travel=params.get("w_travel", 1.0),
            w_preferred_staff=params.get("w_preferred_staff", 5.0),
            w_workload_balance=params.get("w_workload_balance", 10.0),
            w_continuity=params.get("w_continuity", 3.0),
        ),
        assignments=assignments,
    )


@router.post(
    "/reset-assignments",
    response_model=ResetAssignmentsResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
def reset_assignments_endpoint(
    req: ResetAssignmentsRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> ResetAssignmentsResponse:
    """対象週のオーダー割当をすべてリセット"""
    # 日付パース
    try:
        week_start = date.fromisoformat(req.week_start_date)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    # 月曜日チェック
    if week_start.weekday() != 0:
        raise HTTPException(
            status_code=422,
            detail=f"{req.week_start_date} は月曜日ではありません"
            f"（weekday={week_start.weekday()}）",
        )

    try:
        db = get_firestore_client()
        orders_reset = reset_assignments(db, week_start)
    except Exception as e:
        logger.error("リセット失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"リセットエラー: {e}"
        ) from e

    return ResetAssignmentsResponse(
        orders_reset=orders_reset,
        week_start_date=req.week_start_date,
    )


@router.post(
    "/export-report",
    response_model=ExportReportResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def export_report(
    req: ExportReportRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> ExportReportResponse:
    """月次レポートをGoogle Sheetsにエクスポートし、スプレッドシートURLを返す"""
    # フォーマット検証（patternで既にチェック済みだが念のため）
    if not re.match(r"^\d{4}-\d{2}$", req.year_month):
        raise HTTPException(status_code=400, detail="year_month は YYYY-MM 形式で指定してください")

    # Firestoreからデータ読み込み
    try:
        db = get_firestore_client()
        orders = load_monthly_orders(db, req.year_month)
        helpers = load_all_helpers(db)
        customers = load_all_customers(db)
        service_type_configs = load_all_service_types(db)
    except Exception as e:
        logger.error("Firestore読み込み失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Firestore読み込みエラー: {e}"
        ) from e

    if not orders:
        raise HTTPException(
            status_code=404,
            detail=f"{req.year_month} のオーダーデータが見つかりません",
        )

    # 集計
    status_summary = aggregate_status_summary(orders)
    service_type_summary = aggregate_service_type_summary(orders, service_type_configs=service_type_configs)
    staff_summary = aggregate_staff_summary(orders, helpers)
    customer_summary = aggregate_customer_summary(orders, customers)

    # Google Sheets APIクライアント構築
    try:
        credentials = _get_sheets_credentials()
        sheets_service = build("sheets", "v4", credentials=credentials)
        drive_service = build("drive", "v3", credentials=credentials)
    except Exception as e:
        logger.error("Google API クライアント構築失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=503, detail=f"Google Sheets API に接続できませんでした: {e}"
        ) from e

    # スプレッドシート作成
    try:
        result = create_monthly_report_spreadsheet(
            service=sheets_service,
            drive_service=drive_service,
            year_month=req.year_month,
            status_summary=status_summary.model_dump(),
            service_type_summary=[item.model_dump() for item in service_type_summary],
            staff_summary=[row.model_dump() for row in staff_summary],
            customer_summary=[row.model_dump() for row in customer_summary],
            share_with_email=req.user_email,
        )
    except Exception as e:
        logger.error("スプレッドシート作成失敗: %s", e, exc_info=True)
        detail = f"スプレッドシートの作成に失敗しました: {e}"
        if "403" in str(e) or "permission" in str(e).lower():
            detail += (
                "\n\nヒント: ローカル開発では ADC に Sheets/Drive スコープが必要です。"
                "\ngcloud auth application-default login "
                "--scopes=openid,https://www.googleapis.com/auth/userinfo.email,"
                "https://www.googleapis.com/auth/cloud-platform,"
                "https://www.googleapis.com/auth/spreadsheets,"
                "https://www.googleapis.com/auth/drive"
            )
        raise HTTPException(status_code=500, detail=detail) from e

    year, month = req.year_month.split("-")
    title = f"月次レポート {year}年{int(month)}月"

    logger.info(
        "スプレッドシート作成完了: id=%s, year_month=%s",
        result["spreadsheet_id"],
        req.year_month,
    )

    return ExportReportResponse(
        spreadsheet_id=result["spreadsheet_id"],
        spreadsheet_url=result["spreadsheet_url"],
        title=title,
        year_month=req.year_month,
        sheets_created=4,
        shared_with=req.user_email,
    )


# ---------------------------------------------------------------------------
# Google Chat DM 催促
# ---------------------------------------------------------------------------


APP_URL = os.getenv("APP_URL", "https://visitcare-shift-optimizer.web.app")

_CHAT_REMINDER_TEMPLATE = (
    "[VisitCare] 希望休提出のお願い\n\n"
    "{target_week}週 の希望休がまだ提出されていません。\n"
    "お手数ですが、以下のリンクから提出をお願いします。\n\n"
    "{app_url}/masters/unavailability"
)


@router.post(
    "/notify/chat-reminder",
    response_model=ChatReminderResponse,
    responses={500: {"model": ErrorResponse}},
)
def notify_chat_reminder(
    req: ChatReminderRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> ChatReminderResponse:
    """希望休催促を Google Chat DM で個別送信する"""
    message_text = req.message or _CHAT_REMINDER_TEMPLATE.format(
        target_week=req.target_week_start,
        app_url=APP_URL,
    )

    emails = [t.email for t in req.targets]
    sent_count, raw_results = send_chat_dms(emails, message_text)

    # raw_results を staff_id 付きに変換
    email_to_staff = {t.email: t.staff_id for t in req.targets}
    results = [
        ChatReminderResultItem(
            staff_id=email_to_staff.get(r["email"], ""),
            email=str(r["email"]),
            success=bool(r["success"]),
        )
        for r in raw_results
    ]

    logger.info(
        "Chat DM 催促送信: sent=%d/%d",
        sent_count,
        len(req.targets),
    )

    return ChatReminderResponse(
        messages_sent=sent_count,
        total_targets=len(req.targets),
        results=results,
    )


# ---------------------------------------------------------------------------
# CURAノート インポート
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

    # READY状態のアクションのみ適用
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
    if req.mark_as_handled and applied_count > 0:
        applied_post_ids = [a.post_id for a in ready_actions]
        try:
            marked_count = mark_notes_as_handled(
                sheets_service, req.spreadsheet_id, applied_post_ids
            )
        except Exception as e:
            logger.error("スプレッドシート更新失敗: %s", e, exc_info=True)
            # スプレッドシート更新失敗はAPIレスポンスには影響させない

    logger.info(
        "ノートインポート適用: applied=%d, marked=%d, requested=%d",
        applied_count,
        marked_count,
        len(req.post_ids),
    )

    return NoteImportApplyResponse(
        applied_count=applied_count,
        marked_count=marked_count,
        total_requested=len(req.post_ids),
    )


# ---------------------------------------------------------------------------
# オーダー一括複製
# ---------------------------------------------------------------------------


@router.post(
    "/orders/duplicate-week",
    response_model=DuplicateWeekResponse,
    responses={409: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def duplicate_week(
    req: DuplicateWeekRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> DuplicateWeekResponse:
    """基本シフト（ソース週）のオーダーをターゲット週に一括複製"""
    # 日付パース
    try:
        source_week = date.fromisoformat(req.source_week_start)
        target_week = date.fromisoformat(req.target_week_start)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    # 月曜日チェック
    if source_week.weekday() != 0:
        raise HTTPException(
            status_code=422,
            detail=f"{req.source_week_start} は月曜日ではありません"
            f"（weekday={source_week.weekday()}）",
        )
    if target_week.weekday() != 0:
        raise HTTPException(
            status_code=422,
            detail=f"{req.target_week_start} は月曜日ではありません"
            f"（weekday={target_week.weekday()}）",
        )

    # 同一週チェック
    if source_week == target_week:
        raise HTTPException(
            status_code=422,
            detail="コピー元とコピー先が同じ週です",
        )

    try:
        db = get_firestore_client()
        created, skipped = duplicate_week_orders(db, source_week, target_week)
    except Exception as e:
        logger.error("オーダー複製失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"オーダー複製エラー: {e}"
        ) from e

    if skipped > 0:
        raise HTTPException(
            status_code=409,
            detail=f"ターゲット週 {req.target_week_start} に既存オーダーが"
            f"あるため複製をスキップしました（{skipped}件）",
        )

    return DuplicateWeekResponse(
        created_count=created,
        skipped_count=skipped,
        target_week_start=req.target_week_start,
    )


# ---------------------------------------------------------------------------
# 休み希望の自動反映
# ---------------------------------------------------------------------------


@router.post(
    "/orders/apply-unavailability",
    response_model=ApplyUnavailabilityResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
def apply_unavailability_endpoint(
    req: ApplyUnavailabilityRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> ApplyUnavailabilityResponse:
    """対象週の休み希望をオーダーに反映し、該当スタッフの割当を解除"""
    try:
        week_start = date.fromisoformat(req.week_start_date)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    if week_start.weekday() != 0:
        raise HTTPException(
            status_code=422,
            detail=f"{req.week_start_date} は月曜日ではありません"
            f"（weekday={week_start.weekday()}）",
        )

    try:
        db = get_firestore_client()
        result = apply_unavailability_to_orders(db, week_start)
    except Exception as e:
        logger.error("休み希望反映失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"休み希望反映エラー: {e}"
        ) from e

    return ApplyUnavailabilityResponse(
        orders_modified=result.orders_modified,
        removals_count=result.removals_count,
        reverted_to_pending=result.reverted_to_pending,
        removals=[
            UnavailabilityRemovalItem(
                order_id=r.order_id,
                staff_id=r.staff_id,
                customer_id=r.customer_id,
                date=r.date,
                start_time=r.start_time,
                end_time=r.end_time,
            )
            for r in result.removals
        ],
    )


# ---------------------------------------------------------------------------
# 不定期パターン自動判定
# ---------------------------------------------------------------------------


@router.post(
    "/orders/apply-irregular-patterns",
    response_model=ApplyIrregularPatternsResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
def apply_irregular_patterns_endpoint(
    req: ApplyIrregularPatternsRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> ApplyIrregularPatternsResponse:
    """対象週の不定期パターンを評価し、該当オーダーをキャンセル"""
    try:
        week_start = date.fromisoformat(req.week_start_date)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    if week_start.weekday() != 0:
        raise HTTPException(
            status_code=422,
            detail=f"{req.week_start_date} は月曜日ではありません"
            f"（weekday={week_start.weekday()}）",
        )

    try:
        db = get_firestore_client()
        result = apply_irregular_patterns(db, week_start)
    except Exception as e:
        logger.error("不定期パターン適用失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"不定期パターン適用エラー: {e}"
        ) from e

    return ApplyIrregularPatternsResponse(
        cancelled_count=result.cancelled_count,
        excluded_customers=[
            IrregularPatternExclusion(
                customer_id=ex.customer_id,
                customer_name=ex.customer_name,
                pattern_type=ex.pattern_type,
                description=ex.description,
            )
            for ex in result.excluded_customers
        ],
    )


# ---------------------------------------------------------------------------
# オーダー変更通知
# ---------------------------------------------------------------------------

_CHANGE_TYPE_LABELS = {
    "reassigned": "担当変更",
    "time_changed": "時間変更",
    "cancelled": "キャンセル",
}

_ORDER_CHANGE_TEMPLATE = (
    "[VisitCare] 【シフト変更】\n\n"
    "日付: {date}\n"
    "利用者: {customer_name}\n"
    "変更内容: {change_type_label}\n\n"
    "詳細はシフト管理画面をご確認ください。\n"
    "{app_url}"
)


@router.post(
    "/notify/order-change",
    response_model=OrderChangeNotifyResponse,
    responses={500: {"model": ErrorResponse}},
)
def notify_order_change(
    req: OrderChangeNotifyRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> OrderChangeNotifyResponse:
    """オーダー変更を影響スタッフにGoogle Chat DMで通知"""
    # ヘルパーのメールアドレスを取得
    try:
        db = get_firestore_client()
        staff_emails: dict[str, str] = {}
        for sid in req.affected_staff_ids:
            doc = db.collection("helpers").document(sid).get()
            if doc.exists:
                d = doc.to_dict()
                email = (d or {}).get("email", "")
                if email:
                    staff_emails[sid] = email
    except Exception as e:
        logger.error("ヘルパー情報取得失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"ヘルパー情報取得エラー: {e}"
        ) from e

    if not staff_emails:
        return OrderChangeNotifyResponse(
            messages_sent=0,
            total_targets=len(req.affected_staff_ids),
            results=[
                OrderChangeNotifyResultItem(
                    staff_id=sid, email="", success=False,
                )
                for sid in req.affected_staff_ids
            ],
        )

    change_label = _CHANGE_TYPE_LABELS.get(req.change_type, req.change_type)
    message_text = req.message or _ORDER_CHANGE_TEMPLATE.format(
        date=req.date,
        customer_name=req.customer_name,
        change_type_label=change_label,
        app_url=APP_URL,
    )

    emails = list(staff_emails.values())
    sent_count, raw_results = send_chat_dms(emails, message_text)

    # email → staff_id の逆引き
    email_to_staff = {v: k for k, v in staff_emails.items()}
    results = [
        OrderChangeNotifyResultItem(
            staff_id=email_to_staff.get(str(r["email"]), ""),
            email=str(r["email"]),
            success=bool(r["success"]),
        )
        for r in raw_results
    ]

    # email未登録のスタッフも結果に含める
    notified_staff = {r.staff_id for r in results}
    for sid in req.affected_staff_ids:
        if sid not in notified_staff:
            results.append(
                OrderChangeNotifyResultItem(
                    staff_id=sid, email="", success=False,
                )
            )

    logger.info(
        "オーダー変更通知: sent=%d/%d (order=%s, change=%s)",
        sent_count, len(req.affected_staff_ids), req.order_id, req.change_type,
    )

    return OrderChangeNotifyResponse(
        messages_sent=sent_count,
        total_targets=len(req.affected_staff_ids),
        results=results,
    )


# ---------------------------------------------------------------------------
# 翌日チェックリスト
# ---------------------------------------------------------------------------


@router.get(
    "/checklist/next-day",
    response_model=DailyChecklistResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
def get_daily_checklist(
    date_param: str = Query(
        ..., alias="date",
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="チェックリスト対象日 YYYY-MM-DD",
    ),
    _auth: dict | None = Depends(require_manager_or_above),
) -> DailyChecklistResponse:
    """指定日のオーダーをヘルパー別にグルーピングしたチェックリストを返す"""
    from optimizer.data.firestore_loader import _ts_to_date_str

    try:
        target_date = date.fromisoformat(date_param)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    JST = timezone(timedelta(hours=9))
    target_dt = datetime(target_date.year, target_date.month, target_date.day, tzinfo=JST)
    # 翌日の00:00まで
    target_dt_end = target_dt + timedelta(days=1)

    try:
        db = get_firestore_client()

        # 対象日のオーダーを取得（pending + assigned）
        order_docs = list(
            db.collection("orders")
            .where("date", ">=", target_dt)
            .where("date", "<", target_dt_end)
            .where("status", "in", ["pending", "assigned"])
            .stream()
        )

        if not order_docs:
            return DailyChecklistResponse(
                date=date_param,
                total_orders=0,
                staff_checklists=[],
            )

        # ヘルパー名とcustomer名の取得
        helper_names: dict[str, str] = {}
        customer_names: dict[str, str] = {}

        # ヘルパー名キャッシュ
        helper_ids_needed: set[str] = set()
        customer_ids_needed: set[str] = set()

        orders_data: list[dict] = []
        for doc in order_docs:
            d = doc.to_dict()
            if d is None:
                continue
            d["_id"] = doc.id
            orders_data.append(d)
            for sid in d.get("assigned_staff_ids", []):
                helper_ids_needed.add(sid)
            customer_ids_needed.add(d.get("customer_id", ""))

        # ヘルパー名を一括取得
        for sid in helper_ids_needed:
            hdoc = db.collection("helpers").document(sid).get()
            if hdoc.exists:
                hd = hdoc.to_dict() or {}
                name = hd.get("name", {})
                helper_names[sid] = f"{name.get('family', '')} {name.get('given', '')}"

        # 利用者名を一括取得
        for cid in customer_ids_needed:
            if not cid:
                continue
            cdoc = db.collection("customers").document(cid).get()
            if cdoc.exists:
                cd = cdoc.to_dict() or {}
                name = cd.get("name", {})
                customer_names[cid] = f"{name.get('family', '')} {name.get('given', '')}"

        # ヘルパー別にグルーピング
        staff_orders: dict[str, list[ChecklistOrderItem]] = {}
        unassigned_orders: list[ChecklistOrderItem] = []

        for d in orders_data:
            cid = d.get("customer_id", "")
            item = ChecklistOrderItem(
                order_id=d["_id"],
                customer_id=cid,
                customer_name=customer_names.get(cid, ""),
                start_time=d.get("start_time", ""),
                end_time=d.get("end_time", ""),
                service_type=d.get("service_type", ""),
                status=d.get("status", ""),
            )

            assigned = d.get("assigned_staff_ids", [])
            if not assigned:
                unassigned_orders.append(item)
            else:
                for sid in assigned:
                    staff_orders.setdefault(sid, []).append(item)

        # 時間順ソート
        checklists: list[StaffChecklist] = []
        for sid in sorted(staff_orders.keys()):
            orders = sorted(staff_orders[sid], key=lambda o: o.start_time)
            checklists.append(StaffChecklist(
                staff_id=sid,
                staff_name=helper_names.get(sid, sid),
                orders=orders,
            ))

        # 未割当オーダー
        if unassigned_orders:
            checklists.append(StaffChecklist(
                staff_id="",
                staff_name="未割当",
                orders=sorted(unassigned_orders, key=lambda o: o.start_time),
            ))

    except Exception as e:
        logger.error("チェックリスト生成失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"チェックリスト生成エラー: {e}"
        ) from e

    return DailyChecklistResponse(
        date=date_param,
        total_orders=len(orders_data),
        staff_checklists=checklists,
    )
