"""ヘルパー支援AI専用のスコープ付きツール関数。

ヘルパーは自分に関連するデータのみアクセス可能:
- 自分のスケジュール・空き時間
- 自分が担当する利用者の情報
- 自分が割り当てられたオーダー

セキュリティ: プロンプトインジェクション対策として、データスコーピングは
LLMのシステムプロンプトではなくツール関数レベルで強制する。
"""

import logging

from google.adk.tools import ToolContext

from src.shared.firestore_client import get_firestore_client

logger = logging.getLogger(__name__)

# ADK State key: ヘルパーIDは認証時にuser:スコープに格納される
HELPER_ID_STATE_KEY = "helper_id"


def get_my_profile(tool_context: ToolContext) -> dict:
    """自分（ログイン中のヘルパー）のプロフィールを取得する。

    Returns:
        自分の名前、資格、勤務時間、交通手段等
    """
    helper_id = tool_context.state.get(f"user:{HELPER_ID_STATE_KEY}")
    if not helper_id:
        return {"error": "ヘルパーIDが設定されていません。管理者にお問い合わせください。"}

    try:
        db = get_firestore_client()
        doc = db.collection("helpers").document(helper_id).get()
    except Exception as e:
        logger.error("ヘルパープロフィール取得失敗 [id=%s]: %s", helper_id, e)
        return {"error": f"データの取得に失敗しました: {type(e).__name__}"}

    if not doc.exists:
        return {"error": f"ヘルパー {helper_id} のデータが見つかりません"}

    data = doc.to_dict() or {}
    name = data.get("name", {})

    return {
        "id": helper_id,
        "name": f"{name.get('family', '')}{name.get('given', '')}",
        "can_physical_care": data.get("can_physical_care", False),
        "transportation": data.get("transportation", ""),
        "employment_type": data.get("employment_type", ""),
        "qualifications": data.get("qualifications", []),
        "preferred_hours": data.get("preferred_hours", {}),
        "available_hours": data.get("available_hours", {}),
        "weekly_availability": data.get("weekly_availability", {}),
    }


def get_my_schedule(tool_context: ToolContext, week_start_date: str = "") -> dict:
    """自分のスケジュール（空き時間 + 希望休）を取得する。

    Args:
        week_start_date: 週開始日（YYYY-MM-DD形式、省略時は週次スケジュールのみ）

    Returns:
        自分の週次スケジュール + 希望休情報
    """
    helper_id = tool_context.state.get(f"user:{HELPER_ID_STATE_KEY}")
    if not helper_id:
        return {"error": "ヘルパーIDが設定されていません。"}

    try:
        db = get_firestore_client()
        doc = db.collection("helpers").document(helper_id).get()
    except Exception as e:
        logger.error("スケジュール取得失敗 [id=%s]: %s", helper_id, e)
        return {"error": f"データの取得に失敗しました: {type(e).__name__}"}

    if not doc.exists:
        return {"error": "ヘルパーデータが見つかりません"}

    data = doc.to_dict() or {}
    name = data.get("name", {})
    result: dict = {
        "id": helper_id,
        "name": f"{name.get('family', '')}{name.get('given', '')}",
        "weekly_availability": data.get("weekly_availability", {}),
        "preferred_hours": data.get("preferred_hours", {}),
        "unavailable_dates": [],
    }

    if week_start_date:
        try:
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
        except Exception as e:
            logger.error("希望休データ取得失敗 [helper=%s]: %s", helper_id, e)
            result["unavailable_dates_error"] = str(e)

    return result


def get_my_orders(tool_context: ToolContext, week_start_date: str = "") -> list[dict]:
    """自分が担当するオーダーを取得する。

    Args:
        week_start_date: 週開始日（YYYY-MM-DD形式、省略時は全期間）

    Returns:
        自分が割り当てられたオーダーのリスト
    """
    helper_id = tool_context.state.get(f"user:{HELPER_ID_STATE_KEY}")
    if not helper_id:
        return [{"error": "ヘルパーIDが設定されていません。"}]

    try:
        db = get_firestore_client()
        query = db.collection("orders")

        if week_start_date:
            query = query.where("week_start_date", "==", week_start_date)

        docs = query.stream()
    except Exception as e:
        logger.error("オーダー取得失敗 [helper=%s]: %s", helper_id, e)
        return [{"error": f"データの取得に失敗しました: {type(e).__name__}"}]

    results = []
    for doc in docs:
        data = doc.to_dict()
        if not data:
            continue

        # 自分が担当するオーダーのみ
        assigned_ids = data.get("assigned_staff_ids", [])
        if helper_id not in assigned_ids:
            continue

        results.append({
            "id": doc.id,
            "customer_id": data.get("customer_id", ""),
            "date": str(data.get("date", "")),
            "start_time": data.get("start_time", ""),
            "end_time": data.get("end_time", ""),
            "service_type": data.get("service_type", ""),
            "status": data.get("status", ""),
        })

    return results


def get_my_customer_info(
    tool_context: ToolContext, customer_id: str
) -> dict:
    """自分が担当する利用者の情報を取得する。

    セキュリティ: 自分が担当していない利用者の情報は取得不可。

    Args:
        customer_id: 利用者のドキュメントID

    Returns:
        利用者の基本情報（担当に必要な範囲のみ）
    """
    helper_id = tool_context.state.get(f"user:{HELPER_ID_STATE_KEY}")
    if not helper_id:
        return {"error": "ヘルパーIDが設定されていません。"}

    try:
        db = get_firestore_client()

        # まず、この利用者に自分が担当として割り当てられているか確認
        orders = (
            db.collection("orders")
            .where("customer_id", "==", customer_id)
            .where("status", "in", ["pending", "assigned"])
            .limit(1)
            .stream()
        )

        is_assigned = False
        for order_doc in orders:
            order_data = order_doc.to_dict()
            if order_data and helper_id in order_data.get("assigned_staff_ids", []):
                is_assigned = True
                break

        if not is_assigned:
            return {
                "error": "この利用者の情報にアクセスする権限がありません。"
                "ご自身が担当する利用者の情報のみ閲覧可能です。"
            }

        # 担当利用者の情報を取得（業務に必要な範囲のみ）
        doc = db.collection("customers").document(customer_id).get()
    except Exception as e:
        logger.error("利用者情報取得失敗 [customer=%s, helper=%s]: %s", customer_id, helper_id, e)
        return {"error": f"データの取得に失敗しました: {type(e).__name__}"}

    if not doc.exists:
        return {"error": f"利用者 {customer_id} が見つかりません"}

    data = doc.to_dict() or {}
    name = data.get("name", {})

    # ヘルパーに必要な情報のみ返す（NGスタッフ等の管理情報は除外）
    return {
        "id": doc.id,
        "name": f"{name.get('family', '')}{name.get('given', '')}",
        "address": data.get("address", ""),
        "gender_requirement": data.get("gender_requirement", "any"),
        "weekly_services": {
            day: [
                {
                    "start_time": s.get("start_time", ""),
                    "end_time": s.get("end_time", ""),
                    "service_type": s.get("service_type", ""),
                }
                for s in (slots if isinstance(slots, list) else [])
            ]
            for day, slots in data.get("weekly_services", {}).items()
        },
    }
