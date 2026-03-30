"""シフト管理AIエージェントのツールテスト"""

import pytest

from src.shift_manager.tools.customer_tools import get_customer_detail, get_customers
from src.shift_manager.tools.helper_tools import get_helper_availability, get_helpers
from src.shift_manager.tools.order_tools import get_weekly_orders
from src.shift_manager.tools.schedule_tools import check_constraints


class TestCustomerTools:
    """利用者ツールのテスト"""

    def test_get_customers_returns_all(self, seed_customer):
        results = get_customers()
        assert len(results) >= 1
        assert any(c["id"] == "test-customer-1" for c in results)

    def test_get_customers_name_filter(self, seed_customer):
        results = get_customers(name_query="田中")
        assert len(results) >= 1
        assert all("田中" in c["name"] for c in results)

    def test_get_customers_name_filter_no_match(self, seed_customer):
        results = get_customers(name_query="存在しない名前xyz")
        assert not any(c["id"] == "test-customer-1" for c in results)

    def test_get_customer_detail(self, seed_customer):
        detail = get_customer_detail("test-customer-1")
        assert detail["id"] == "test-customer-1"
        assert "田中太郎" in detail["name"]
        assert detail["ng_staff_ids"] == ["helper-ng"]
        assert detail["preferred_staff_ids"] == ["helper-preferred"]
        assert "monday" in detail["weekly_services"]

    def test_get_customer_detail_not_found(self):
        detail = get_customer_detail("nonexistent-id")
        assert "error" in detail


class TestHelperTools:
    """ヘルパーツールのテスト"""

    def test_get_helpers_returns_all(self, seed_helper):
        results = get_helpers()
        assert len(results) >= 1
        assert any(h["id"] == "test-helper-1" for h in results)

    def test_get_helpers_name_filter(self, seed_helper):
        results = get_helpers(name_query="佐藤")
        assert len(results) >= 1

    def test_get_helpers_qualification_filter(self, seed_helper):
        results = get_helpers(qualification_filter="physical_care")
        assert all(h["can_physical_care"] for h in results)

    def test_get_helper_availability(self, seed_helper):
        result = get_helper_availability("test-helper-1")
        assert result["id"] == "test-helper-1"
        assert "monday" in result["weekly_availability"]

    def test_get_helper_availability_not_found(self):
        result = get_helper_availability("nonexistent-id")
        assert "error" in result


class TestOrderTools:
    """オーダーツールのテスト"""

    def test_get_weekly_orders(self, seed_order):
        results = get_weekly_orders("2026-03-30")
        assert len(results) >= 1
        assert any(o["id"] == "test-order-1" for o in results)

    def test_get_weekly_orders_customer_filter(self, seed_order):
        results = get_weekly_orders("2026-03-30", customer_id="test-customer-1")
        assert all(o["customer_id"] == "test-customer-1" for o in results)

    def test_get_weekly_orders_no_results(self):
        results = get_weekly_orders("1999-01-01")
        assert len(results) == 0


class TestConstraintCheck:
    """制約チェックのテスト"""

    @pytest.mark.asyncio
    async def test_ng_staff_violation(self, seed_customer, seed_helper):
        """NGスタッフを割り当てた場合に違反が検出される"""
        # helper-ng はテスト利用者のNGリスト
        # seed_helperとは別IDなので、helper-ngをヘルパーとして登録
        from src.shared.firestore_client import get_firestore_client

        db = get_firestore_client()
        ng_ref = db.collection("helpers").document("helper-ng")
        ng_ref.set({
            "name": {"last_name": "NG", "first_name": "スタッフ"},
            "can_physical_care": False,
            "gender": "male",
        })

        try:
            result = await check_constraints(
                customer_id="test-customer-1",
                helper_id="helper-ng",
                date="2026-03-30",
                start_time="09:00",
                end_time="10:00",
            )
            assert result["is_valid"] is False
            assert any("NG" in v for v in result["violations"])
        finally:
            ng_ref.delete()

    @pytest.mark.asyncio
    async def test_valid_assignment(self, seed_customer, seed_helper):
        """制約を満たすヘルパーの割り当てが有効"""
        result = await check_constraints(
            customer_id="test-customer-1",
            helper_id="test-helper-1",
            date="2026-03-30",
            start_time="09:00",
            end_time="10:00",
        )
        assert result["is_valid"] is True
        assert len(result["violations"]) == 0

    @pytest.mark.asyncio
    async def test_customer_not_found(self):
        """存在しない利用者でエラー"""
        result = await check_constraints(
            customer_id="nonexistent",
            helper_id="test-helper-1",
            date="2026-03-30",
            start_time="09:00",
            end_time="10:00",
        )
        assert "error" in result
