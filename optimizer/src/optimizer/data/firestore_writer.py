"""最適化結果のFirestore書き戻し"""

import logging

from google.cloud import firestore  # type: ignore[attr-defined]
from google.cloud.firestore_v1 import SERVER_TIMESTAMP  # type: ignore[import-untyped]

from optimizer.models import Assignment

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
