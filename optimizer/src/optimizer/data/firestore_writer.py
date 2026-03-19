"""最適化結果のFirestore書き戻し"""

import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

from google.cloud import firestore  # type: ignore[attr-defined]
from google.cloud.firestore_v1 import SERVER_TIMESTAMP  # type: ignore[import-untyped]

from optimizer.models import Assignment, OptimizationRunRecord

logger = logging.getLogger(__name__)

_FIRESTORE_BATCH_LIMIT = 500


def write_assignments(
    db: firestore.Client,
    assignments: list[Assignment],
) -> int:
    """Assignment[] → orders.assigned_staff_ids + status='assigned' を一括更新

    Returns:
        更新したオーダー数
    """
    if not assignments:
        return 0

    # Firestore batch write（最大500件/batch）
    BATCH_LIMIT = _FIRESTORE_BATCH_LIMIT
    updated = 0

    for i in range(0, len(assignments), BATCH_LIMIT):
        batch = db.batch()
        chunk = assignments[i : i + BATCH_LIMIT]

        for assignment in chunk:
            order_ref = db.collection("orders").document(assignment.order_id)
            batch.update(
                order_ref,
                {
                    "assigned_staff_ids": assignment.staff_ids,
                    "status": "assigned",
                    "updated_at": SERVER_TIMESTAMP,
                },
            )

        batch.commit()
        updated += len(chunk)

    return updated


def save_optimization_run(
    db: firestore.Client,
    record: OptimizationRunRecord,
) -> str:
    """最適化実行記録をFirestoreに保存

    Returns:
        作成されたドキュメントのID
    """
    run_id = str(uuid.uuid4())
    doc_ref = db.collection("optimization_runs").document(run_id)

    doc_data = record.model_dump()
    doc_data["id"] = run_id
    # executed_at はサーバータイムスタンプで上書き
    doc_data["executed_at"] = SERVER_TIMESTAMP
    # assignments を dict リストに変換
    doc_data["assignments"] = [a.model_dump() for a in record.assignments]
    doc_data["parameters"] = record.parameters.model_dump()

    doc_ref.set(doc_data)
    logger.info("最適化実行記録を保存: id=%s", run_id)
    return run_id


def reset_assignments(
    db: firestore.Client,
    week_start: date,
) -> int:
    """対象週のオーダー割当をリセット（assigned_staff_ids=[], status=pending）

    Returns:
        リセットしたオーダー数
    """
    JST = timezone(timedelta(hours=9))
    week_start_dt = datetime(
        week_start.year, week_start.month, week_start.day, tzinfo=JST
    )

    # pending/assigned のみ対象（completed/cancelled は業務実績のため除外）
    docs = list(
        db.collection("orders")
        .where("week_start_date", "==", week_start_dt)
        .where("status", "in", ["pending", "assigned"])
        .stream()
    )

    if not docs:
        return 0

    BATCH_LIMIT = _FIRESTORE_BATCH_LIMIT
    reset_count = 0

    for i in range(0, len(docs), BATCH_LIMIT):
        batch = db.batch()
        chunk = docs[i : i + BATCH_LIMIT]

        for doc in chunk:
            batch.update(
                doc.reference,
                {
                    "assigned_staff_ids": [],
                    "status": "pending",
                    "manually_edited": False,
                    "updated_at": SERVER_TIMESTAMP,
                },
            )

        batch.commit()
        reset_count += len(chunk)

    logger.info("オーダーリセット完了: %d件 (week=%s)", reset_count, week_start)
    return reset_count


def duplicate_week_orders(
    db: firestore.Client,
    source_week_start: date,
    target_week_start: date,
) -> tuple[int, int]:
    """ソース週のオーダーをターゲット週に一括複製する

    Args:
        db: Firestoreクライアント
        source_week_start: コピー元の週開始日（月曜日）
        target_week_start: コピー先の週開始日（月曜日）

    Returns:
        (created_count, skipped_count) タプル
    """
    JST = timezone(timedelta(hours=9))
    source_dt = datetime(
        source_week_start.year, source_week_start.month, source_week_start.day,
        tzinfo=JST,
    )
    target_dt = datetime(
        target_week_start.year, target_week_start.month, target_week_start.day,
        tzinfo=JST,
    )

    # ソース週のオーダーを取得（cancelled以外）
    source_docs = list(
        db.collection("orders")
        .where("week_start_date", "==", source_dt)
        .where("status", "in", ["pending", "assigned"])
        .stream()
    )

    if not source_docs:
        logger.info("複製元オーダーが0件 (source_week=%s)", source_week_start)
        return 0, 0

    # ターゲット週に既存オーダーがあるか確認
    existing_target = list(
        db.collection("orders")
        .where("week_start_date", "==", target_dt)
        .where("status", "in", ["pending", "assigned"])
        .stream()
    )
    if existing_target:
        logger.warning(
            "ターゲット週に既存オーダー %d件あり、スキップ (target_week=%s)",
            len(existing_target),
            target_week_start,
        )
        return 0, len(source_docs)

    # 日付差分を計算
    day_offset = (target_week_start - source_week_start).days

    # linked_order_id のリマッピング用: old_id → new_id
    id_mapping: dict[str, str] = {}
    new_orders: list[tuple[str, dict[str, Any]]] = []

    for doc in source_docs:
        d = doc.to_dict()
        if d is None:
            continue
        new_id = str(uuid.uuid4())
        id_mapping[doc.id] = new_id

        # 日付をオフセット
        source_date = d["date"]
        if hasattr(source_date, "to_pydatetime"):
            source_date_dt = source_date.to_pydatetime()
        elif isinstance(source_date, datetime):
            source_date_dt = source_date
        else:
            source_date_dt = datetime.fromisoformat(str(source_date))

        target_date_dt = source_date_dt + timedelta(days=day_offset)

        new_order: dict[str, Any] = {
            "customer_id": d["customer_id"],
            "week_start_date": target_dt,
            "date": target_date_dt,
            "start_time": d["start_time"],
            "end_time": d["end_time"],
            "service_type": d["service_type"],
            "assigned_staff_ids": [],
            "status": "pending",
            "manually_edited": False,
            "created_at": SERVER_TIMESTAMP,
            "updated_at": SERVER_TIMESTAMP,
        }
        # オプショナルフィールド
        if d.get("staff_count") is not None:
            new_order["staff_count"] = d["staff_count"]
        if d.get("linked_order_id"):
            # 後でリマッピング
            new_order["_original_linked_order_id"] = d["linked_order_id"]
        if d.get("companion_staff_id"):
            # OJTスタッフは複製しない（再割当が必要）
            pass

        new_orders.append((new_id, new_order))

    # linked_order_id をリマッピング
    for _, order_data in new_orders:
        original_linked = order_data.pop("_original_linked_order_id", None)
        if original_linked and original_linked in id_mapping:
            order_data["linked_order_id"] = id_mapping[original_linked]

    # バッチ書き込み
    BATCH_LIMIT = _FIRESTORE_BATCH_LIMIT
    created = 0
    for i in range(0, len(new_orders), BATCH_LIMIT):
        batch = db.batch()
        chunk = new_orders[i : i + BATCH_LIMIT]
        for new_id, order_data in chunk:
            doc_ref = db.collection("orders").document(new_id)
            batch.set(doc_ref, order_data)
        batch.commit()
        created += len(chunk)

    logger.info(
        "オーダー複製完了: %d件 (source=%s → target=%s)",
        created, source_week_start, target_week_start,
    )
    return created, 0


@dataclass
class UnavailabilityRemoval:
    """休み希望による割当解除1件の情報"""
    order_id: str
    staff_id: str
    customer_id: str
    date: str
    start_time: str
    end_time: str


@dataclass
class ApplyUnavailabilityResult:
    """休み希望反映の結果"""
    orders_modified: int
    removals_count: int
    reverted_to_pending: int
    removals: list[UnavailabilityRemoval]


def _times_overlap(
    order_start: str, order_end: str,
    unavail_start: str, unavail_end: str,
) -> bool:
    """HH:MM形式の時間範囲が重複するか判定"""
    return order_start < unavail_end and order_end > unavail_start


def apply_unavailability_to_orders(
    db: firestore.Client,
    week_start: date,
) -> ApplyUnavailabilityResult:
    """対象週の休み希望をオーダーに反映し、該当スタッフの割当を解除する

    Args:
        db: Firestoreクライアント
        week_start: 対象週の開始日（月曜日）

    Returns:
        ApplyUnavailabilityResult
    """
    JST = timezone(timedelta(hours=9))
    week_start_dt = datetime(
        week_start.year, week_start.month, week_start.day, tzinfo=JST,
    )

    # 休み希望を取得
    unavail_docs = list(
        db.collection("staff_unavailability")
        .where("week_start_date", "==", week_start_dt)
        .stream()
    )

    if not unavail_docs:
        logger.info("休み希望が0件 (week=%s)", week_start)
        return ApplyUnavailabilityResult(0, 0, 0, [])

    # 休み希望をパース: {(staff_id, date_str)} → list[slot]
    from optimizer.data.firestore_loader import ts_to_date_str

    staff_unavail: dict[str, list[dict[str, Any]]] = {}  # staff_id → slots
    for doc in unavail_docs:
        d = doc.to_dict()
        if d is None:
            continue
        staff_id = d["staff_id"]
        for slot in d.get("unavailable_slots", []):
            slot_date = ts_to_date_str(slot["date"])
            staff_unavail.setdefault(staff_id, []).append({
                "date": slot_date,
                "all_day": slot.get("all_day", True),
                "start_time": slot.get("start_time"),
                "end_time": slot.get("end_time"),
            })

    # 対象週のオーダーを取得（assigned のみ: 割当済みで解除対象）
    order_docs = list(
        db.collection("orders")
        .where("week_start_date", "==", week_start_dt)
        .where("status", "==", "assigned")
        .stream()
    )

    if not order_docs:
        logger.info("assigned オーダーが0件 (week=%s)", week_start)
        return ApplyUnavailabilityResult(0, 0, 0, [])

    # マッチング: 各オーダーのassigned_staff_idsから休み希望のスタッフを除外
    removals: list[UnavailabilityRemoval] = []
    updates: dict[str, dict[str, Any]] = {}  # order_id → update fields

    for doc in order_docs:
        d = doc.to_dict()
        if d is None:
            continue
        order_id = doc.id
        order_date = ts_to_date_str(d["date"])
        assigned = list(d.get("assigned_staff_ids", []))
        order_start = d.get("start_time", "")
        order_end = d.get("end_time", "")

        staff_to_remove: list[str] = []
        for staff_id in assigned:
            if staff_id not in staff_unavail:
                continue
            for slot in staff_unavail[staff_id]:
                if slot["date"] != order_date:
                    continue
                # 終日 or 時間帯重複チェック
                if slot["all_day"] or _times_overlap(
                    order_start, order_end,
                    slot.get("start_time", "00:00"),
                    slot.get("end_time", "23:59"),
                ):
                    staff_to_remove.append(staff_id)
                    break

        if not staff_to_remove:
            continue

        new_assigned = [s for s in assigned if s not in staff_to_remove]
        new_status = "pending" if not new_assigned else "assigned"

        updates[order_id] = {
            "assigned_staff_ids": new_assigned,
            "status": new_status,
            "updated_at": SERVER_TIMESTAMP,
        }

        for sid in staff_to_remove:
            removals.append(UnavailabilityRemoval(
                order_id=order_id,
                staff_id=sid,
                customer_id=d.get("customer_id", ""),
                date=order_date,
                start_time=order_start,
                end_time=order_end,
            ))

    if not updates:
        return ApplyUnavailabilityResult(0, 0, 0, [])

    # バッチ書き込み
    BATCH_LIMIT = _FIRESTORE_BATCH_LIMIT
    modified = 0
    reverted = 0
    update_list = list(updates.items())

    for i in range(0, len(update_list), BATCH_LIMIT):
        batch = db.batch()
        chunk = update_list[i : i + BATCH_LIMIT]
        for order_id, fields in chunk:
            ref = db.collection("orders").document(order_id)
            batch.update(ref, fields)
            if fields["status"] == "pending":
                reverted += 1
        batch.commit()
        modified += len(chunk)

    logger.info(
        "休み希望反映完了: modified=%d, removals=%d, reverted=%d (week=%s)",
        modified, len(removals), reverted, week_start,
    )
    return ApplyUnavailabilityResult(
        orders_modified=modified,
        removals_count=len(removals),
        reverted_to_pending=reverted,
        removals=removals,
    )


@dataclass
class IrregularPatternExclusionInfo:
    """不定期パターンによる除外1件の情報"""
    customer_id: str
    customer_name: str
    pattern_type: str
    description: str


@dataclass
class ApplyIrregularPatternsResult:
    """不定期パターン適用の結果"""
    cancelled_count: int
    excluded_customers: list[IrregularPatternExclusionInfo]


def _get_week_of_month(d: date) -> int:
    """日付の月内週番号（0-based）を返す。seedスクリプトと同じロジック。"""
    return (d.day - 1) // 7


def _should_exclude_customer(
    patterns: list[dict[str, Any]],
    target_week_start: date,
) -> tuple[bool, str, str]:
    """不定期パターンに基づき、対象週でサービスを除外すべきか判定。

    Returns:
        (exclude, pattern_type, description) タプル
    """
    for p in patterns:
        ptype = p.get("type", "")
        desc = p.get("description", "")

        if ptype == "temporary_stop":
            return True, ptype, desc

        if ptype in ("biweekly", "monthly"):
            active_weeks = p.get("active_weeks", [])
            if isinstance(active_weeks, str):
                active_weeks = [int(w.strip()) for w in active_weeks.split(",") if w.strip()]
            if not active_weeks:
                continue
            week_of_month = _get_week_of_month(target_week_start)
            if week_of_month not in active_weeks:
                return True, ptype, desc

    return False, "", ""


def apply_irregular_patterns(
    db: firestore.Client,
    week_start: date,
) -> ApplyIrregularPatternsResult:
    """対象週の不定期パターンを評価し、該当オーダーをキャンセルする

    Args:
        db: Firestoreクライアント
        week_start: 対象週の開始日（月曜日）

    Returns:
        ApplyIrregularPatternsResult
    """
    JST = timezone(timedelta(hours=9))
    week_start_dt = datetime(
        week_start.year, week_start.month, week_start.day, tzinfo=JST,
    )

    # TODO: 全利用者フルスキャン。利用者数が増えた場合、
    # irregular_patternsの有無でフィルタするComposite Indexの追加を検討。
    customer_docs = list(db.collection("customers").stream())

    # customer_id → (exclude, pattern_type, description, customer_name)
    exclude_map: dict[str, tuple[str, str, str]] = {}
    for doc in customer_docs:
        d = doc.to_dict()
        if d is None:
            continue
        patterns = d.get("irregular_patterns", [])
        if not patterns:
            continue
        exclude, ptype, desc = _should_exclude_customer(patterns, week_start)
        if exclude:
            name = d.get("name", {})
            customer_name = f"{name.get('family', '')} {name.get('given', '')}"
            exclude_map[doc.id] = (ptype, desc, customer_name)

    if not exclude_map:
        logger.info("不定期パターンによる除外対象なし (week=%s)", week_start)
        return ApplyIrregularPatternsResult(0, [])

    # 対象週のオーダーを取得
    order_docs = list(
        db.collection("orders")
        .where("week_start_date", "==", week_start_dt)
        .where("status", "in", ["pending", "assigned"])
        .stream()
    )

    # 除外対象のオーダーをフィルタ
    orders_to_cancel: list[Any] = []
    for doc in order_docs:
        d = doc.to_dict()
        if d is None:
            continue
        cid = d.get("customer_id", "")
        if cid in exclude_map:
            orders_to_cancel.append(doc)

    if not orders_to_cancel:
        exclusions = [
            IrregularPatternExclusionInfo(
                customer_id=cid, customer_name=name,
                pattern_type=ptype, description=desc,
            )
            for cid, (ptype, desc, name) in exclude_map.items()
        ]
        return ApplyIrregularPatternsResult(0, exclusions)

    # バッチキャンセル
    BATCH_LIMIT = _FIRESTORE_BATCH_LIMIT
    cancelled = 0
    for i in range(0, len(orders_to_cancel), BATCH_LIMIT):
        batch = db.batch()
        chunk = orders_to_cancel[i : i + BATCH_LIMIT]
        for doc in chunk:
            batch.update(doc.reference, {
                "status": "cancelled",
                "updated_at": SERVER_TIMESTAMP,
            })
        batch.commit()
        cancelled += len(chunk)

    exclusions = [
        IrregularPatternExclusionInfo(
            customer_id=cid, customer_name=name,
            pattern_type=ptype, description=desc,
        )
        for cid, (ptype, desc, name) in exclude_map.items()
    ]

    logger.info(
        "不定期パターン適用完了: cancelled=%d, excluded_customers=%d (week=%s)",
        cancelled, len(exclusions), week_start,
    )
    return ApplyIrregularPatternsResult(cancelled, exclusions)
