"""オーダーデータ参照ツール"""

from google.adk.tools import FunctionTool

from src.shared.firestore_client import get_firestore_client


def get_weekly_orders(
    week_start_date: str,
    customer_id: str = "",
    helper_id: str = "",
    status_filter: str = "",
) -> list[dict]:
    """指定週のオーダー一覧を取得する。

    Args:
        week_start_date: 週開始日（YYYY-MM-DD形式）
        customer_id: 利用者IDで絞り込み（省略時は全件）
        helper_id: ヘルパーIDで絞り込み（省略時は全件）
        status_filter: ステータスで絞り込み（pending/assigned/completed/cancelled）

    Returns:
        オーダーリスト
    """
    db = get_firestore_client()
    query = db.collection("orders").where("week_start_date", "==", week_start_date)

    if status_filter:
        query = query.where("status", "==", status_filter)

    docs = query.stream()

    results = []
    for doc in docs:
        data = doc.to_dict()
        if not data:
            continue

        if customer_id and data.get("customer_id") != customer_id:
            continue

        assigned_ids = data.get("assigned_staff_ids", [])
        if helper_id and helper_id not in assigned_ids:
            continue

        results.append({
            "id": doc.id,
            "customer_id": data.get("customer_id", ""),
            "date": str(data.get("date", "")),
            "start_time": data.get("start_time", ""),
            "end_time": data.get("end_time", ""),
            "service_type": data.get("service_type", ""),
            "assigned_staff_ids": assigned_ids,
            "status": data.get("status", ""),
            "manually_edited": data.get("manually_edited", False),
        })

    return results


get_weekly_orders_tool = FunctionTool(get_weekly_orders)
