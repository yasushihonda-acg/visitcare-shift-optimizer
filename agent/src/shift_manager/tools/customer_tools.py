"""利用者データ参照ツール"""

from google.adk.tools import FunctionTool

from src.shared.firestore_client import get_firestore_client


def get_customers(name_query: str = "") -> list[dict]:
    """利用者一覧を取得する。名前で絞り込み可能。

    Args:
        name_query: 名前による絞り込み（部分一致、省略時は全件）

    Returns:
        利用者リスト（id, 名前, 住所を含む）
    """
    db = get_firestore_client()
    docs = db.collection("customers").stream()

    results = []
    for doc in docs:
        data = doc.to_dict()
        if not data:
            continue

        name = data.get("name", {})
        full_name = f"{name.get('last_name', '')}{name.get('first_name', '')}"

        if name_query and name_query not in full_name:
            continue

        results.append({
            "id": doc.id,
            "name": full_name,
            "address": data.get("address", ""),
            "has_ng_staff": len(data.get("ng_staff_ids", [])) > 0,
            "has_whitelist": len(data.get("allowed_staff_ids", [])) > 0,
            "gender_requirement": data.get("gender_requirement", "any"),
        })

    return results


def get_customer_detail(customer_id: str) -> dict:
    """利用者の詳細情報を取得する（制約情報含む）。

    Args:
        customer_id: 利用者のドキュメントID

    Returns:
        利用者の詳細情報（名前、住所、制約、週間サービス等）
    """
    db = get_firestore_client()
    doc = db.collection("customers").document(customer_id).get()

    if not doc.exists:
        return {"error": f"利用者 {customer_id} が見つかりません"}

    data = doc.to_dict()
    if not data:
        return {"error": "データが空です"}

    name = data.get("name", {})

    weekly_services = {}
    for day, slots in data.get("weekly_services", {}).items():
        weekly_services[day] = [
            {
                "start_time": s.get("start_time", ""),
                "end_time": s.get("end_time", ""),
                "service_type": s.get("service_type", ""),
            }
            for s in (slots if isinstance(slots, list) else [])
        ]

    return {
        "id": doc.id,
        "name": f"{name.get('last_name', '')}{name.get('first_name', '')}",
        "address": data.get("address", ""),
        "ng_staff_ids": data.get("ng_staff_ids", []),
        "allowed_staff_ids": data.get("allowed_staff_ids", []),
        "preferred_staff_ids": data.get("preferred_staff_ids", []),
        "gender_requirement": data.get("gender_requirement", "any"),
        "weekly_services": weekly_services,
        "same_household_customer_ids": data.get("same_household_customer_ids", []),
        "same_facility_customer_ids": data.get("same_facility_customer_ids", []),
    }


get_customers_tool = FunctionTool(get_customers)
get_customer_detail_tool = FunctionTool(get_customer_detail)
