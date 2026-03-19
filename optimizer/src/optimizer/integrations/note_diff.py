"""CURAノート差分検出モジュール

解析済みノート（ParsedNote）と Firestore の既存オーダーを突き合わせ、
実行すべきアクションのリストを生成する。
"""

from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta
from enum import Enum
from typing import Any

from google.cloud import firestore  # type: ignore[attr-defined]
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from pydantic import BaseModel, Field

from optimizer.integrations.note_parser import NoteActionType, ParsedNote, TimeRange

logger = logging.getLogger(__name__)

BATCH_LIMIT = 500


# ---------------------------------------------------------------------------
# 出力モデル
# ---------------------------------------------------------------------------


class ImportActionStatus(str, Enum):
    """インポートアクションの状態"""

    READY = "ready"  # 自動適用可能
    NEEDS_REVIEW = "needs_review"  # 人間の確認が必要
    UNMATCHED = "unmatched"  # 利用者/オーダーが見つからない
    SKIPPED = "skipped"  # スキップ（ヘルパー休み等、別処理）


class MatchedOrder(BaseModel):
    """マッチしたFirestoreオーダー"""

    order_id: str
    customer_id: str
    customer_name: str
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    service_type: str
    status: str


class NoteImportAction(BaseModel):
    """個別のインポートアクション"""

    post_id: str
    action_type: NoteActionType
    status: ImportActionStatus
    customer_name: str | None = None
    matched_customer_id: str | None = None
    matched_order: MatchedOrder | None = None
    description: str = Field(description="アクションの説明（UI表示用）")
    raw_content: str = Field(description="元のノートテキスト")
    date_from: str
    date_to: str = ""
    time_range: TimeRange | None = None
    new_time_range: TimeRange | None = None
    confidence: float = 1.0

    # 適用時に使う詳細
    new_order_data: dict[str, Any] | None = Field(
        default=None, description="新規オーダー作成時のデータ"
    )
    update_fields: dict[str, Any] | None = Field(
        default=None, description="オーダー更新時のフィールド"
    )


class NoteImportPreview(BaseModel):
    """ノートインポートのプレビュー（dry-run結果）"""

    spreadsheet_id: str
    total_notes: int = Field(description="読み取ったノート数")
    actions: list[NoteImportAction]
    ready_count: int = Field(description="自動適用可能な件数")
    review_count: int = Field(description="要確認の件数")
    unmatched_count: int = Field(description="未マッチの件数")
    skipped_count: int = Field(description="スキップの件数")


# ---------------------------------------------------------------------------
# 共通ユーティリティ
# ---------------------------------------------------------------------------


def _normalize_name(name: str) -> str:
    """名前を正規化（空白除去）"""
    return name.replace(" ", "").replace("\u3000", "")


def _customer_full_name(customer: dict[str, Any]) -> str:
    """顧客dictからフルネームを生成"""
    return f"{customer.get('family_name', '')}{customer.get('given_name', '')}"


def _build_unmatched_action(
    note: ParsedNote, action_type: NoteActionType,
) -> NoteImportAction:
    """利用者が見つからない場合のUNMATCHEDアクションを生成"""
    return NoteImportAction(
        post_id=note.post_id,
        action_type=action_type,
        status=ImportActionStatus.UNMATCHED,
        customer_name=note.customer_name,
        description=f"利用者「{note.customer_name}」が見つかりません",
        raw_content=note.raw_content,
        date_from=note.date_from,
        date_to=note.date_to,
        confidence=note.confidence,
    )


# ---------------------------------------------------------------------------
# 利用者マッチング（インデックスベース）
# ---------------------------------------------------------------------------


def _build_customer_index(
    customers: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """顧客リストからO(1)検索用インデックスを構築"""
    idx: dict[str, dict[str, Any]] = {}
    for cust in customers:
        # フルネーム
        full = _normalize_name(_customer_full_name(cust))
        if full:
            idx[full] = cust
        # short名
        short = _normalize_name(str(cust.get("short_name", "")))
        if short:
            idx[short] = cust
    return idx


def _match_customer(
    customer_name: str, customer_index: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    """利用者名からFirestoreの顧客を特定する（インデックスベース）"""
    normalized = _normalize_name(customer_name)

    # 完全一致（フルネーム or short名）
    if normalized in customer_index:
        return customer_index[normalized]

    # 部分一致（姓で始まり名が前方一致）
    for key, cust in customer_index.items():
        family = _normalize_name(str(cust.get("family_name", "")))
        if family and normalized.startswith(family):
            remaining = normalized[len(family):]
            given = _normalize_name(str(cust.get("given_name", "")))
            if given and given.startswith(remaining):
                return cust

    return None


# ---------------------------------------------------------------------------
# オーダーインデックス
# ---------------------------------------------------------------------------


def _build_order_index(
    orders: list[dict[str, Any]],
) -> dict[tuple[str, str], list[dict[str, Any]]]:
    """オーダーリストから (customer_id, date) → orders のインデックスを構築"""
    idx: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for order in orders:
        if order.get("status") == "cancelled":
            continue
        cid = str(order.get("customer_id", ""))
        d = str(order.get("date", ""))
        idx[(cid, d)].append(order)
    return idx


def _find_matching_orders(
    customer_id: str,
    target_date: str,
    order_index: dict[tuple[str, str], list[dict[str, Any]]],
    time_range: TimeRange | None = None,
) -> list[dict[str, Any]]:
    """指定顧客・日付のオーダーをインデックスから検索する"""
    candidates = order_index.get((customer_id, target_date), [])
    if not time_range:
        return list(candidates)

    # start_time完全一致で絞り込む
    filtered = [
        o for o in candidates
        if not o.get("start_time") or o["start_time"] == time_range.start
    ]
    return filtered if filtered else list(candidates)


def _generate_date_range(date_from: str, date_to: str) -> list[str]:
    """日付範囲から日付リストを生成する"""
    start = date.fromisoformat(date_from)
    if not date_to:
        return [date_from]
    end = date.fromisoformat(date_to)
    dates: list[str] = []
    current = start
    while current <= end:
        dates.append(current.isoformat())
        current += timedelta(days=1)
    return dates


# ---------------------------------------------------------------------------
# アクション生成
# ---------------------------------------------------------------------------


def _build_cancel_action(
    note: ParsedNote,
    customer: dict[str, Any] | None,
    order_index: dict[tuple[str, str], list[dict[str, Any]]],
) -> NoteImportAction:
    """キャンセルアクションを生成"""
    if customer is None:
        return _build_unmatched_action(note, NoteActionType.CANCEL)

    dates = _generate_date_range(note.date_from, note.date_to)
    matched_orders: list[dict[str, Any]] = []
    for d in dates:
        matched_orders.extend(
            _find_matching_orders(customer["id"], d, order_index, note.time_range)
        )

    if not matched_orders:
        return NoteImportAction(
            post_id=note.post_id,
            action_type=NoteActionType.CANCEL,
            status=ImportActionStatus.NEEDS_REVIEW,
            customer_name=note.customer_name,
            matched_customer_id=customer["id"],
            description=f"{note.customer_name}様の{note.date_from}のオーダーが見つかりません（キャンセル対象）",
            raw_content=note.raw_content,
            date_from=note.date_from,
            date_to=note.date_to,
            time_range=note.time_range,
            confidence=note.confidence,
        )

    if len(matched_orders) > 1 and note.time_range is None:
        return NoteImportAction(
            post_id=note.post_id,
            action_type=NoteActionType.CANCEL,
            status=ImportActionStatus.NEEDS_REVIEW,
            customer_name=note.customer_name,
            matched_customer_id=customer["id"],
            description=(
                f"{note.customer_name}様の{note.date_from}に{len(matched_orders)}件のオーダーがあります。"
                "キャンセル対象を確認してください"
            ),
            raw_content=note.raw_content,
            date_from=note.date_from,
            date_to=note.date_to,
            confidence=note.confidence,
        )

    order = matched_orders[0]
    return NoteImportAction(
        post_id=note.post_id,
        action_type=NoteActionType.CANCEL,
        status=ImportActionStatus.READY,
        customer_name=note.customer_name,
        matched_customer_id=customer["id"],
        matched_order=MatchedOrder(
            order_id=order["id"],
            customer_id=customer["id"],
            customer_name=_customer_full_name(customer),
            date=note.date_from,
            start_time=order.get("start_time", ""),
            end_time=order.get("end_time", ""),
            service_type=order.get("service_type", ""),
            status=order.get("status", ""),
        ),
        description=f"{note.customer_name}様の{note.date_from} {order.get('start_time', '')}〜のオーダーをキャンセル",
        raw_content=note.raw_content,
        date_from=note.date_from,
        date_to=note.date_to,
        time_range=note.time_range,
        update_fields={"status": "cancelled"},
        confidence=note.confidence,
    )


def _build_update_time_action(
    note: ParsedNote,
    customer: dict[str, Any] | None,
    order_index: dict[tuple[str, str], list[dict[str, Any]]],
) -> NoteImportAction:
    """時間変更アクションを生成"""
    if customer is None:
        return _build_unmatched_action(note, NoteActionType.UPDATE_TIME)

    dates = _generate_date_range(note.date_from, note.date_to)
    matched_orders: list[dict[str, Any]] = []
    for d in dates:
        matched_orders.extend(
            _find_matching_orders(customer["id"], d, order_index, note.time_range)
        )

    if not matched_orders:
        return NoteImportAction(
            post_id=note.post_id,
            action_type=NoteActionType.UPDATE_TIME,
            status=ImportActionStatus.NEEDS_REVIEW,
            customer_name=note.customer_name,
            matched_customer_id=customer["id"],
            description=f"{note.customer_name}様の対象オーダーが見つかりません（時間変更）",
            raw_content=note.raw_content,
            date_from=note.date_from,
            date_to=note.date_to,
            time_range=note.time_range,
            new_time_range=note.new_time_range,
            confidence=note.confidence,
        )

    order = matched_orders[0]
    update_fields: dict[str, Any] = {}
    desc_parts: list[str] = []

    if note.new_time_range:
        update_fields["start_time"] = note.new_time_range.start
        if note.new_time_range.end:
            update_fields["end_time"] = note.new_time_range.end
        desc_parts.append(
            f"{note.new_time_range.start}"
            + (f"〜{note.new_time_range.end}" if note.new_time_range.end else "〜")
        )
    else:
        desc_parts.append("時間変更（詳細要確認）")

    return NoteImportAction(
        post_id=note.post_id,
        action_type=NoteActionType.UPDATE_TIME,
        status=ImportActionStatus.READY if note.new_time_range else ImportActionStatus.NEEDS_REVIEW,
        customer_name=note.customer_name,
        matched_customer_id=customer["id"],
        matched_order=MatchedOrder(
            order_id=order["id"],
            customer_id=customer["id"],
            customer_name=_customer_full_name(customer),
            date=note.date_from,
            start_time=order.get("start_time", ""),
            end_time=order.get("end_time", ""),
            service_type=order.get("service_type", ""),
            status=order.get("status", ""),
        ),
        description=f"{note.customer_name}様の{note.date_from}を{' '.join(desc_parts)}に変更",
        raw_content=note.raw_content,
        date_from=note.date_from,
        date_to=note.date_to,
        time_range=note.time_range,
        new_time_range=note.new_time_range,
        update_fields=update_fields if update_fields else None,
        confidence=note.confidence,
    )


# TODO: service_type値はFirestoreのservice_typesマスタに未登録。
# 本番運用開始時にマスタへの追加、または既存値へのマッピングが必要。
_ADD_ACTION_CONFIG: dict[NoteActionType, tuple[str, str]] = {
    NoteActionType.ADD_VISIT: ("hospital_visit", "受診同行"),
    NoteActionType.ADD_MEETING: ("meeting", "担当者会議"),
    NoteActionType.ADD: ("other", "新規"),
}


def _build_add_action(
    note: ParsedNote,
    customer: dict[str, Any] | None,
    action_type: NoteActionType,
) -> NoteImportAction:
    """追加系アクションを生成（受診同行、担当者会議、新規）"""
    if customer is None:
        return _build_unmatched_action(note, action_type)

    service_type, type_label = _ADD_ACTION_CONFIG.get(action_type, ("other", ""))

    new_order: dict[str, Any] = {
        "customer_id": customer["id"],
        "date": note.date_from,
        "service_type": service_type,
        "status": "pending",
        "assigned_staff_ids": [],
        "manually_edited": False,
        "staff_count": 1,
    }

    time_desc = ""
    if note.time_range:
        new_order["start_time"] = note.time_range.start
        if note.time_range.end:
            new_order["end_time"] = note.time_range.end
        time_desc = f" {note.time_range.start}" + (
            f"〜{note.time_range.end}" if note.time_range.end else "〜"
        )

    needs_review = note.time_range is None

    return NoteImportAction(
        post_id=note.post_id,
        action_type=action_type,
        status=ImportActionStatus.NEEDS_REVIEW if needs_review else ImportActionStatus.READY,
        customer_name=note.customer_name,
        matched_customer_id=customer["id"],
        description=f"{note.customer_name}様の{note.date_from}{time_desc}に{type_label}を追加",
        raw_content=note.raw_content,
        date_from=note.date_from,
        date_to=note.date_to,
        time_range=note.time_range,
        new_order_data=new_order,
        confidence=note.confidence,
    )


def _build_staff_unavailability_action(note: ParsedNote) -> NoteImportAction:
    """ヘルパー休みアクション（別処理のためスキップ）"""
    return NoteImportAction(
        post_id=note.post_id,
        action_type=NoteActionType.STAFF_UNAVAILABILITY,
        status=ImportActionStatus.SKIPPED,
        customer_name=note.staff_name,
        description=f"ヘルパー「{note.staff_name}」の休み情報（staff_unavailabilityで別途管理）",
        raw_content=note.raw_content,
        date_from=note.date_from,
        date_to=note.date_to,
        confidence=note.confidence,
    )


def _build_unknown_action(note: ParsedNote) -> NoteImportAction:
    """判定不能アクション"""
    name = note.customer_name or "（不明）"
    return NoteImportAction(
        post_id=note.post_id,
        action_type=NoteActionType.UNKNOWN,
        status=ImportActionStatus.NEEDS_REVIEW,
        customer_name=note.customer_name,
        description=f"{name}様の{note.date_from} — 自動判定不可。内容を確認してください",
        raw_content=note.raw_content,
        date_from=note.date_from,
        date_to=note.date_to,
        confidence=note.confidence,
    )


# ---------------------------------------------------------------------------
# メイン処理
# ---------------------------------------------------------------------------


def generate_import_actions(
    parsed_notes: list[ParsedNote],
    customers: list[dict[str, Any]],
    orders: list[dict[str, Any]],
) -> list[NoteImportAction]:
    """解析済みノートから実行アクションリストを生成する。"""
    # インデックスを先にビルド（O(N)→O(1)検索）
    customer_index = _build_customer_index(customers)
    order_index = _build_order_index(orders)

    actions: list[NoteImportAction] = []

    for note in parsed_notes:
        if note.action_type == NoteActionType.STAFF_UNAVAILABILITY:
            actions.append(_build_staff_unavailability_action(note))
            continue

        if note.action_type == NoteActionType.UNKNOWN:
            actions.append(_build_unknown_action(note))
            continue

        customer = None
        if note.customer_name:
            customer = _match_customer(note.customer_name, customer_index)

        if note.action_type == NoteActionType.CANCEL:
            actions.append(_build_cancel_action(note, customer, order_index))
        elif note.action_type == NoteActionType.UPDATE_TIME:
            actions.append(_build_update_time_action(note, customer, order_index))
        elif note.action_type in (
            NoteActionType.ADD_VISIT,
            NoteActionType.ADD_MEETING,
            NoteActionType.ADD,
        ):
            actions.append(_build_add_action(note, customer, note.action_type))
        else:
            actions.append(_build_unknown_action(note))

    return actions


def build_import_preview(
    spreadsheet_id: str,
    parsed_notes: list[ParsedNote],
    customers: list[dict[str, Any]],
    orders: list[dict[str, Any]],
) -> NoteImportPreview:
    """インポートプレビューを構築する。"""
    actions = generate_import_actions(parsed_notes, customers, orders)

    ready = sum(1 for a in actions if a.status == ImportActionStatus.READY)
    review = sum(1 for a in actions if a.status == ImportActionStatus.NEEDS_REVIEW)
    unmatched = sum(1 for a in actions if a.status == ImportActionStatus.UNMATCHED)
    skipped = sum(1 for a in actions if a.status == ImportActionStatus.SKIPPED)

    return NoteImportPreview(
        spreadsheet_id=spreadsheet_id,
        total_notes=len(parsed_notes),
        actions=actions,
        ready_count=ready,
        review_count=review,
        unmatched_count=unmatched,
        skipped_count=skipped,
    )


# ---------------------------------------------------------------------------
# Firestore 反映（バッチ書き込み）
# ---------------------------------------------------------------------------


def apply_import_actions(
    db: firestore.Client,
    actions: list[NoteImportAction],
) -> int:
    """承認済みアクションをFirestoreにバッチ反映する。

    Args:
        db: Firestore クライアント
        actions: 適用するアクションのリスト（status=READYのもののみ処理）

    Returns:
        反映したアクション数
    """
    ready_actions = [a for a in actions if a.status == ImportActionStatus.READY]
    if not ready_actions:
        return 0

    applied = 0
    for i in range(0, len(ready_actions), BATCH_LIMIT):
        batch = db.batch()
        chunk = ready_actions[i : i + BATCH_LIMIT]
        chunk_count = 0

        for action in chunk:
            try:
                if action.action_type == NoteActionType.CANCEL and action.matched_order:
                    order_ref = db.collection("orders").document(action.matched_order.order_id)
                    batch.update(order_ref, {
                        "status": "cancelled",
                        "updated_at": SERVER_TIMESTAMP,
                    })

                elif action.action_type == NoteActionType.UPDATE_TIME and action.matched_order and action.update_fields:
                    order_ref = db.collection("orders").document(action.matched_order.order_id)
                    batch.update(order_ref, {
                        **action.update_fields,
                        "updated_at": SERVER_TIMESTAMP,
                    })

                elif action.action_type in (
                    NoteActionType.ADD_VISIT, NoteActionType.ADD_MEETING, NoteActionType.ADD,
                ) and action.new_order_data:
                    doc_id = str(uuid.uuid4())
                    order_ref = db.collection("orders").document(doc_id)
                    batch.set(order_ref, {
                        **action.new_order_data,
                        "created_at": SERVER_TIMESTAMP,
                        "updated_at": SERVER_TIMESTAMP,
                    })

                else:
                    continue

                chunk_count += 1

            except Exception:
                logger.exception("Failed to prepare action post_id=%s", action.post_id)

        try:
            batch.commit()
            applied += chunk_count  # commit成功後にカウント
        except Exception:
            logger.exception("Failed to commit batch (chunk %d)", i // BATCH_LIMIT)

    return applied
