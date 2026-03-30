"""ヘルパーデータ参照ツール"""

from google.adk.tools import FunctionTool

from src.shared.firestore_client import get_firestore_client


def get_helpers(name_query: str = "", qualification_filter: str = "") -> list[dict]:
    """ヘルパー一覧を取得する。名前や資格で絞り込み可能。

    Args:
        name_query: 名前による絞り込み（部分一致、省略時は全件）
        qualification_filter: 資格フィルター（例: "physical_care" で身体介護資格保持者のみ）

    Returns:
        ヘルパーリスト
    """
    db = get_firestore_client()
    docs = db.collection("helpers").stream()

    results = []
    for doc in docs:
        data = doc.to_dict()
        if not data:
            continue

        name = data.get("name", {})
        full_name = f"{name.get('last_name', '')}{name.get('first_name', '')}"

        if name_query and name_query not in full_name:
            continue

        if qualification_filter == "physical_care" and not data.get("can_physical_care", False):
            continue

        results.append({
            "id": doc.id,
            "name": full_name,
            "can_physical_care": data.get("can_physical_care", False),
            "transportation": data.get("transportation", ""),
            "employment_type": data.get("employment_type", ""),
            "gender": data.get("gender", ""),
            "preferred_hours": data.get("preferred_hours", {}),
        })

    return results


def get_helper_availability(helper_id: str, week_start_date: str = "") -> dict:
    """ヘルパーの空き時間と希望休を取得する。

    Args:
        helper_id: ヘルパーのドキュメントID
        week_start_date: 週開始日（YYYY-MM-DD形式、省略時は週次スケジュールのみ）

    Returns:
        週次スケジュール + 希望休情報
    """
    db = get_firestore_client()

    helper_doc = db.collection("helpers").document(helper_id).get()
    if not helper_doc.exists:
        return {"error": f"ヘルパー {helper_id} が見つかりません"}

    data = helper_doc.to_dict()
    if not data:
        return {"error": "データが空です"}

    name = data.get("name", {})
    result: dict = {
        "id": helper_id,
        "name": f"{name.get('last_name', '')}{name.get('first_name', '')}",
        "weekly_availability": data.get("weekly_availability", {}),
        "preferred_hours": data.get("preferred_hours", {}),
        "available_hours": data.get("available_hours", {}),
        "unavailable_dates": [],
    }

    if week_start_date:
        unavail_docs = (
            db.collection("staff_unavailability")
            .where("staff_id", "==", helper_id)
            .where("week_start_date", "==", week_start_date)
            .stream()
        )
        for udoc in unavail_docs:
            udata = udoc.to_dict()
            if udata:
                result["unavailable_dates"].append({
                    "date": udata.get("date", ""),
                    "reason": udata.get("reason", ""),
                })

    return result


get_helpers_tool = FunctionTool(get_helpers)
get_helper_availability_tool = FunctionTool(get_helper_availability)
