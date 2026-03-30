"""スケジュール関連ツール（既存最適化エンジン連携）"""

from google.adk.tools import FunctionTool


async def check_constraints(
    customer_id: str,
    helper_id: str,
    date: str,
    start_time: str,
    end_time: str,
) -> dict:
    """指定のヘルパーを利用者に割り当てた場合の制約チェックを行う。

    Args:
        customer_id: 利用者ID
        helper_id: ヘルパーID
        date: 日付（YYYY-MM-DD形式）
        start_time: 開始時刻（HH:MM形式）
        end_time: 終了時刻（HH:MM形式）

    Returns:
        制約チェック結果（violations: 違反リスト、warnings: 警告リスト）
    """
    from src.shared.firestore_client import get_firestore_client

    db = get_firestore_client()

    customer_doc = db.collection("customers").document(customer_id).get()
    helper_doc = db.collection("helpers").document(helper_id).get()

    if not customer_doc.exists:
        return {"error": f"利用者 {customer_id} が見つかりません"}
    if not helper_doc.exists:
        return {"error": f"ヘルパー {helper_id} が見つかりません"}

    customer = customer_doc.to_dict() or {}
    helper = helper_doc.to_dict() or {}

    violations: list[str] = []
    warnings: list[str] = []

    # NGスタッフチェック
    if helper_id in customer.get("ng_staff_ids", []):
        violations.append(f"ヘルパー {helper_id} は利用者 {customer_id} のNGスタッフです")

    # ホワイトリストチェック
    allowed = customer.get("allowed_staff_ids", [])
    if allowed and helper_id not in allowed:
        violations.append(
            f"ヘルパー {helper_id} は利用者 {customer_id} の許可スタッフリストに含まれていません"
        )

    # 資格チェック（サービス種別による）
    # TODO: service_type から身体介護かどうか判定するロジック追加

    # 性別要件チェック
    gender_req = customer.get("gender_requirement", "any")
    if gender_req != "any" and helper.get("gender") != gender_req:
        warnings.append(
            f"利用者の希望性別: {gender_req}、ヘルパーの性別: {helper.get('gender', '不明')}"
        )

    # 推奨スタッフチェック
    preferred = customer.get("preferred_staff_ids", [])
    if preferred and helper_id not in preferred:
        warnings.append(f"ヘルパー {helper_id} は推奨スタッフではありません")

    return {
        "is_valid": len(violations) == 0,
        "violations": violations,
        "warnings": warnings,
    }


async def suggest_assignment(
    customer_id: str,
    date: str,
    start_time: str,
    end_time: str,
) -> dict:
    """既存最適化エンジンを呼び出し、制約を満たすスタッフ候補を取得する。

    Args:
        customer_id: 利用者ID
        date: 日付（YYYY-MM-DD形式）
        start_time: 開始時刻（HH:MM形式）
        end_time: 終了時刻（HH:MM形式）

    Returns:
        候補スタッフリスト（スコア付き）
    """
    # NOTE: optimizer APIに/api/suggestエンドポイントを追加予定
    # 現時点ではスタブ実装
    return {
        "note": "最適化エンジン連携は Phase 2 で実装予定",
        "customer_id": customer_id,
        "date": date,
        "time_slot": f"{start_time}-{end_time}",
        "candidates": [],
    }


check_constraints_tool = FunctionTool(check_constraints)
suggest_assignment_tool = FunctionTool(suggest_assignment)
