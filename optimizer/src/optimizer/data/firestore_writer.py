"""最適化結果のFirestore書き戻し"""

import logging
import uuid
from datetime import date, datetime, timedelta, timezone

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

    docs = list(
        db.collection("orders")
        .where("week_start_date", "==", week_start_dt)
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
