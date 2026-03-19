"""最適化結果のFirestore書き戻し"""

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from google.cloud import firestore  # type: ignore[attr-defined]
from google.cloud.firestore_v1 import SERVER_TIMESTAMP  # type: ignore[import-untyped]

from optimizer.models import Assignment, OptimizationRunRecord

logger = logging.getLogger(__name__)


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
    BATCH_LIMIT = 500
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

    BATCH_LIMIT = 500
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
    BATCH_LIMIT = 500
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
