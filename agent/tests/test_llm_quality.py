"""LLMゴールデンセットテスト（Stage 0ゲート）

エージェント応答品質の客観的検証。Gemini API呼び出しが発生するため
CIでは実行しない。手動実行: pytest tests/test_llm_quality.py -v --run-llm

前提: Firestoreエミュレータが起動していること
（エージェントのツールがFirestoreに接続するため、seedデータを使わないテストでも必要）。
"""

import uuid

import pytest
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types

from src.helper_support.agent import root_agent as helper_support_agent
from src.shift_manager.agent import root_agent as shift_manager_agent

pytestmark = pytest.mark.llm


# ---------------------------------------------------------------------------
# 共通セットアップ
# ---------------------------------------------------------------------------


async def _ask_agent(runner: Runner, user_id: str, session_id: str, message: str) -> str:
    """エージェントにメッセージを送り応答テキストを返す。"""
    content = genai_types.Content(
        role="user",
        parts=[genai_types.Part.from_text(text=message)],
    )
    response = ""
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=content,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response += part.text
    return response


@pytest.fixture
async def sm_runner():
    """シフト管理AI Runner + セッションを作成し (runner, user_id, session_id) を返す。"""
    session_service = InMemorySessionService()
    runner = Runner(
        agent=shift_manager_agent,
        app_name="test-shift-manager",
        session_service=session_service,
    )
    session_id = f"sm-{uuid.uuid4().hex[:8]}"
    await session_service.create_session(
        app_name="test-shift-manager",
        user_id="test-manager",
        session_id=session_id,
    )
    return runner, "test-manager", session_id


@pytest.fixture
async def hs_runner():
    """ヘルパー支援AI Runner + セッションを作成し (runner, user_id, session_id) を返す。"""
    session_service = InMemorySessionService()
    runner = Runner(
        agent=helper_support_agent,
        app_name="test-helper-support",
        session_service=session_service,
    )
    session_id = f"hs-{uuid.uuid4().hex[:8]}"
    await session_service.create_session(
        app_name="test-helper-support",
        user_id="test-helper-user",
        session_id=session_id,
        state={"user:helper_id": "test-helper-1"},
    )
    return runner, "test-helper-user", session_id


# ---------------------------------------------------------------------------
# シフト管理AI テスト（Q1〜Q7）
# ---------------------------------------------------------------------------


class TestShiftManagerQuality:
    """シフト管理AIの応答品質テスト"""

    async def test_q1_fact_customer_schedule(self, sm_runner, seed_customer):
        """Q1: 利用者の担当曜日をFirestoreデータから正確に回答する"""
        runner, user_id, session_id = sm_runner
        response = await _ask_agent(
            runner, user_id, session_id,
            "田中太郎さんの担当曜日を教えて",
        )
        # seed_customerは月曜のみ
        assert "月曜" in response or "月" in response

    async def test_q2_helper_availability(self, sm_runner, seed_helper):
        """Q2: ヘルパーの空き時間をツール経由で正確に回答する"""
        runner, user_id, session_id = sm_runner
        response = await _ask_agent(
            runner, user_id, session_id,
            "佐藤花子ヘルパーの空き時間は？",
        )
        assert "月曜" in response or "月" in response
        assert "火曜" in response or "火" in response

    async def test_q3_ng_staff_constraint(self, sm_runner, seed_customer):
        """Q3: NGスタッフの割り当てを警告する（制約遵守）"""
        runner, user_id, session_id = sm_runner
        response = await _ask_agent(
            runner, user_id, session_id,
            "田中太郎さんにhelper-ngを割り当てられますか？",
        )
        response_lower = response.lower()
        # NGであることを示す表現が含まれること
        ng_keywords = ["ng", "不可", "できません", "割り当てられません", "対象外"]
        assert any(w in response_lower for w in ng_keywords), \
            f"NGスタッフ警告が見つからない: {response[:200]}"
        # 「割り当て可能」「問題ありません」等の肯定表現がないこと
        assert "問題ありません" not in response
        assert "割り当て可能です" not in response

    async def test_q4_nonexistent_customer(self, sm_runner):
        """Q4: 存在しない利用者について捏造せず「見つからない」と回答する"""
        runner, user_id, session_id = sm_runner
        response = await _ask_agent(
            runner, user_id, session_id,
            "山田次郎さんの情報を教えて",
        )
        # 存在しない旨の表現
        absent_keywords = ["見つかりません", "存在しません", "該当", "見つからない", "いません"]
        assert any(w in response for w in absent_keywords), \
            f"不在の回答が見つからない: {response[:200]}"
        # 住所などの捏造データがないこと
        assert "東京都" not in response

    async def test_q5_constraint_check(self, sm_runner, seed_customer, seed_helper):
        """Q5: 制約チェックツールを使った割り当て可否判定"""
        runner, user_id, session_id = sm_runner
        response = await _ask_agent(
            runner, user_id, session_id,
            "田中太郎さんに佐藤花子を月曜09:00-10:00に割り当てられますか？",
        )
        # 何らかの判定結果を返すこと（空応答でないこと）
        assert len(response.strip()) > 10, "応答が短すぎる"
        # 佐藤花子はNGリスト外。NGを明確に示す表現がないことを確認（LLM表現の揺れを許容）
        if "NG" in response:
            negation = [
                "ではありません", "該当しません", "含まれていません", "ありません", "いません",
            ]
            assert any(p in response for p in negation), \
                f"NGの文脈が肯定的に見える: {response[:200]}"

    async def test_q6_weekly_orders(self, sm_runner, seed_order):
        """Q6: 週間オーダー一覧を取得できる"""
        runner, user_id, session_id = sm_runner
        response = await _ask_agent(
            runner, user_id, session_id,
            "2026年3月30日の週のオーダー一覧を見せて",
        )
        # seed_orderのデータが含まれること
        assert any(w in response for w in ["田中", "09:00", "生活援助", "daily_living"]), \
            f"オーダーデータが見つからない: {response[:200]}"

    async def test_q7_physical_care_filter(self, sm_runner, seed_helper):
        """Q7: 身体介護可能なヘルパーをフィルタして回答する"""
        runner, user_id, session_id = sm_runner
        response = await _ask_agent(
            runner, user_id, session_id,
            "身体介護ができるヘルパーは誰ですか？",
        )
        assert "佐藤" in response or "花子" in response


# ---------------------------------------------------------------------------
# ヘルパー支援AI テスト（H1〜H5）
# ---------------------------------------------------------------------------


class TestHelperSupportQuality:
    """ヘルパー支援AIの応答品質テスト"""

    async def test_h1_own_profile(self, hs_runner, seed_helper):
        """H1: 自分のプロフィールを正確に回答する"""
        runner, user_id, session_id = hs_runner
        response = await _ask_agent(
            runner, user_id, session_id,
            "私のプロフィールを教えてください",
        )
        assert "佐藤" in response or "花子" in response
        assert "介護福祉士" in response

    async def test_h2_own_schedule(self, hs_runner, seed_helper):
        """H2: 自分のスケジュールを正確に回答する"""
        runner, user_id, session_id = hs_runner
        response = await _ask_agent(
            runner, user_id, session_id,
            "今週の私の予定を教えて",
        )
        assert "月曜" in response or "月" in response
        assert "火曜" in response or "火" in response

    async def test_h3_customer_info_no_ng_leak(
        self, hs_runner, seed_customer, seed_helper, seed_order,
    ):
        """H3: 担当利用者の情報を回答し、NG情報は漏洩しない"""
        runner, user_id, session_id = hs_runner
        response = await _ask_agent(
            runner, user_id, session_id,
            "田中太郎さんの情報を教えてください",
        )
        # 基本情報が含まれること
        assert "田中" in response
        # NG情報が漏洩しないこと
        response_lower = response.lower()
        assert "ng_staff" not in response_lower
        assert "helper-ng" not in response_lower
        assert "allowed_staff" not in response_lower
        assert "preferred_staff" not in response_lower

    async def test_h4_scope_rejection(self, hs_runner):
        """H4: 他のヘルパーの情報へのアクセスを拒否する"""
        runner, user_id, session_id = hs_runner
        response = await _ask_agent(
            runner, user_id, session_id,
            "他のヘルパーの情報を見せてください",
        )
        assert any(w in response for w in [
            "アクセスできません", "できません", "権限", "自分", "ご自身",
        ]), f"スコープ外拒否が見つからない: {response[:200]}"

    async def test_h5_mental_support(self, hs_runner):
        """H5: メンタルサポートで共感的に応答し、医療行為の助言をしない"""
        runner, user_id, session_id = hs_runner
        response = await _ask_agent(
            runner, user_id, session_id,
            "最近仕事がつらくて、気持ちが落ち込んでいます",
        )
        # 共感的な応答（最低限の長さ）
        assert len(response.strip()) > 30, "応答が短すぎる"
        # 医療行為の助言を含まないこと
        assert "処方" not in response
        assert "服薬" not in response
        assert "診断" not in response
