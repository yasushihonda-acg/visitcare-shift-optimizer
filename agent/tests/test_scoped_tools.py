"""ヘルパー支援AIスコープ付きツールのテスト。

セキュリティ: ヘルパーが自分以外のデータにアクセスできないことを検証。
"""

from unittest.mock import MagicMock

from src.helper_support.tools.scoped_tools import (
    get_my_customer_info,
    get_my_orders,
    get_my_profile,
    get_my_schedule,
)


def _make_tool_context(helper_id: str | None = None) -> MagicMock:
    """ADK ToolContext のモック生成。"""
    ctx = MagicMock()
    state = {}
    if helper_id:
        state["user:helper_id"] = helper_id
    ctx.state.get = lambda key, default=None: state.get(key, default)
    return ctx


class TestGetMyProfile:
    """get_my_profile のテスト"""

    def test_returns_own_profile(self, seed_helper):
        ctx = _make_tool_context("test-helper-1")
        result = get_my_profile(ctx)
        assert result["id"] == "test-helper-1"
        assert "佐藤花子" in result["name"]
        assert result["can_physical_care"] is True

    def test_no_helper_id_returns_error(self):
        ctx = _make_tool_context(None)
        result = get_my_profile(ctx)
        assert "error" in result
        assert "ヘルパーID" in result["error"]

    def test_nonexistent_helper_returns_error(self):
        ctx = _make_tool_context("nonexistent-helper")
        result = get_my_profile(ctx)
        assert "error" in result


class TestGetMySchedule:
    """get_my_schedule のテスト"""

    def test_returns_own_schedule(self, seed_helper):
        ctx = _make_tool_context("test-helper-1")
        result = get_my_schedule(ctx)
        assert result["id"] == "test-helper-1"
        assert "monday" in result["weekly_availability"]

    def test_no_helper_id_returns_error(self):
        ctx = _make_tool_context(None)
        result = get_my_schedule(ctx)
        assert "error" in result


class TestGetMyOrders:
    """get_my_orders のテスト"""

    def test_returns_only_own_orders(self, seed_helper, seed_order):
        """自分が担当するオーダーのみ返す"""
        ctx = _make_tool_context("test-helper-1")
        results = get_my_orders(ctx, week_start_date="2026-03-30")
        assert len(results) >= 1
        assert all(
            "test-helper-1" in doc.get("assigned_staff_ids", [])
            or doc.get("id") == "test-order-1"
            for doc in results
            if "error" not in doc
        )

    def test_other_helper_sees_no_orders(self, seed_order):
        """他のヘルパーのオーダーは見えない"""
        ctx = _make_tool_context("other-helper-999")
        results = get_my_orders(ctx, week_start_date="2026-03-30")
        # test-order-1 は test-helper-1 に割り当てられているので見えない
        order_ids = [r.get("id") for r in results if "error" not in r]
        assert "test-order-1" not in order_ids

    def test_no_helper_id_returns_error(self):
        ctx = _make_tool_context(None)
        results = get_my_orders(ctx)
        assert len(results) == 1
        assert "error" in results[0]


class TestGetMyCustomerInfo:
    """get_my_customer_info のテスト"""

    def test_can_access_assigned_customer(self, seed_customer, seed_helper, seed_order):
        """担当利用者の情報にアクセスできる"""
        ctx = _make_tool_context("test-helper-1")
        result = get_my_customer_info(ctx, customer_id="test-customer-1")
        assert result["id"] == "test-customer-1"
        assert "田中太郎" in result["name"]
        # ヘルパー向けなのでNGスタッフ情報は含まない
        assert "ng_staff_ids" not in result

    def test_cannot_access_unassigned_customer(self, seed_customer, seed_helper):
        """担当外の利用者にはアクセスできない"""
        ctx = _make_tool_context("other-helper-999")
        result = get_my_customer_info(ctx, customer_id="test-customer-1")
        assert "error" in result
        assert "権限" in result["error"]

    def test_no_helper_id_returns_error(self):
        ctx = _make_tool_context(None)
        result = get_my_customer_info(ctx, customer_id="test-customer-1")
        assert "error" in result

    def test_ng_staff_ids_not_exposed(self, seed_customer, seed_helper, seed_order):
        """NGスタッフ情報がヘルパーに漏洩しない"""
        ctx = _make_tool_context("test-helper-1")
        result = get_my_customer_info(ctx, customer_id="test-customer-1")
        assert "ng_staff_ids" not in result
        assert "allowed_staff_ids" not in result
        assert "preferred_staff_ids" not in result


class TestAgentDefinition:
    """ヘルパー支援AIエージェント定義のセキュリティテスト"""

    def test_helper_support_uses_scoped_tools_only(self):
        """ヘルパー支援AIがスコープ付きツールのみ使用していること"""
        from src.helper_support.agent import root_agent

        tool_names = [t.__name__ if callable(t) else str(t) for t in root_agent.tools]
        # フルアクセスツールが含まれていないことを確認
        assert "get_customers" not in tool_names
        assert "get_customer_detail" not in tool_names
        assert "get_helpers" not in tool_names
        assert "get_helper_availability" not in tool_names
        assert "get_weekly_orders" not in tool_names
        assert "check_constraints" not in tool_names
        # スコープ付きツールが含まれていることを確認
        assert "get_my_profile" in tool_names
        assert "get_my_schedule" in tool_names
        assert "get_my_orders" in tool_names
        assert "get_my_customer_info" in tool_names

    def test_shift_manager_retains_full_access(self):
        """シフト管理AIはフルアクセスを維持していること"""
        from src.shift_manager.agent import root_agent

        tool_names = [t.__name__ if callable(t) else str(t) for t in root_agent.tools]
        assert "get_customers" in tool_names
        assert "get_helpers" in tool_names
        assert "check_constraints" in tool_names
