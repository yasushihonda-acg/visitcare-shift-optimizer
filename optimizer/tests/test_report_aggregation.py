"""月次レポート集計ロジックのテスト"""

import pytest

from optimizer.report.aggregation import (
    aggregate_customer_summary,
    aggregate_service_type_summary,
    aggregate_staff_summary,
    aggregate_status_summary,
    order_duration_minutes,
    time_to_minutes,
)
from optimizer.report.models import (
    CustomerSummaryRow,
    ServiceTypeSummaryItem,
    StaffSummaryRow,
    StatusSummary,
)


# ---------------------------------------------------------------------------
# ヘルパー: テスト用データファクトリ
# ---------------------------------------------------------------------------
def _order(
    *,
    status: str = "completed",
    service_type: str = "physical_care",
    start_time: str = "09:00",
    end_time: str = "10:00",
    customer_id: str = "C001",
    assigned_staff_ids: list[str] | None = None,
) -> dict[str, object]:
    return {
        "id": "ORD001",
        "customer_id": customer_id,
        "date": "2025-01-06",
        "start_time": start_time,
        "end_time": end_time,
        "service_type": service_type,
        "status": status,
        "assigned_staff_ids": assigned_staff_ids if assigned_staff_ids is not None else [],
    }


def _helper(helper_id: str, family: str, given: str) -> dict[str, object]:
    return {"id": helper_id, "family_name": family, "given_name": given}


def _customer(customer_id: str, family: str, given: str) -> dict[str, object]:
    return {"id": customer_id, "family_name": family, "given_name": given}


# ===========================================================================
# time_to_minutes / order_duration_minutes
# ===========================================================================
class TestTimeToMinutes:
    def test_basic(self) -> None:
        assert time_to_minutes("09:00") == 540

    def test_midnight(self) -> None:
        assert time_to_minutes("00:00") == 0

    def test_with_minutes(self) -> None:
        assert time_to_minutes("13:30") == 810


class TestOrderDurationMinutes:
    def test_one_hour(self) -> None:
        assert order_duration_minutes("09:00", "10:00") == 60

    def test_half_hour(self) -> None:
        assert order_duration_minutes("14:00", "14:30") == 30


# ===========================================================================
# StatusSummary テスト（5件）
# ===========================================================================
class TestAggregateStatusSummary:
    def test_all_statuses(self) -> None:
        """全ステータスが存在する場合の集計"""
        orders = [
            _order(status="pending"),
            _order(status="assigned"),
            _order(status="completed"),
            _order(status="cancelled"),
        ]
        result = aggregate_status_summary(orders)
        assert result.pending == 1
        assert result.assigned == 1
        assert result.completed == 1
        assert result.cancelled == 1
        assert result.total == 4
        # completion_rate = completed / (total - cancelled) * 100 = 1/3*100 ≈ 33
        assert result.completion_rate == pytest.approx(33.0, abs=1)

    def test_empty_orders(self) -> None:
        """空のオーダーリスト"""
        result = aggregate_status_summary([])
        assert result.total == 0
        assert result.completion_rate == 0

    def test_cancelled_only(self) -> None:
        """cancelledのみの場合（completion_rate=0）"""
        orders = [_order(status="cancelled"), _order(status="cancelled")]
        result = aggregate_status_summary(orders)
        assert result.cancelled == 2
        assert result.total == 2
        assert result.completion_rate == 0

    def test_completed_only(self) -> None:
        """completedのみの場合（completion_rate=100）"""
        orders = [_order(status="completed"), _order(status="completed")]
        result = aggregate_status_summary(orders)
        assert result.completed == 2
        assert result.completion_rate == 100

    def test_completion_rate_excludes_cancelled(self) -> None:
        """completionRateの計算（cancelled除外）"""
        # 3 completed, 2 pending, 5 cancelled → rate = 3/(5-5 は違う) → 3/(10-5)*100=60
        orders = [
            *[_order(status="completed") for _ in range(3)],
            *[_order(status="pending") for _ in range(2)],
            *[_order(status="cancelled") for _ in range(5)],
        ]
        result = aggregate_status_summary(orders)
        assert result.total == 10
        assert result.completion_rate == 60.0


# ===========================================================================
# ServiceTypeSummary テスト（4件）
# ===========================================================================
class TestAggregateServiceTypeSummary:
    def test_mixed_types(self) -> None:
        """physical_care と daily_living が混在"""
        orders = [
            _order(service_type="physical_care", start_time="09:00", end_time="10:00"),
            _order(service_type="daily_living", start_time="10:00", end_time="11:30"),
            _order(service_type="physical_care", start_time="13:00", end_time="14:00"),
        ]
        result = aggregate_service_type_summary(orders)
        assert len(result) == 2
        phys = next(r for r in result if r.service_type == "physical_care")
        daily = next(r for r in result if r.service_type == "daily_living")
        assert phys.visit_count == 2
        assert phys.total_minutes == 120
        assert phys.label == "身体介護"
        assert daily.visit_count == 1
        assert daily.total_minutes == 90
        assert daily.label == "生活援助"

    def test_single_type(self) -> None:
        """1種類のみ"""
        orders = [
            _order(service_type="daily_living", start_time="09:00", end_time="10:00"),
        ]
        result = aggregate_service_type_summary(orders)
        assert len(result) == 1
        assert result[0].service_type == "daily_living"

    def test_sorted_by_visit_count_desc(self) -> None:
        """visitCount降順ソート確認"""
        orders = [
            _order(service_type="daily_living", start_time="09:00", end_time="10:00"),
            _order(service_type="physical_care", start_time="09:00", end_time="10:00"),
            _order(service_type="physical_care", start_time="11:00", end_time="12:00"),
            _order(service_type="physical_care", start_time="13:00", end_time="14:00"),
        ]
        result = aggregate_service_type_summary(orders)
        assert result[0].service_type == "physical_care"
        assert result[0].visit_count == 3
        assert result[1].service_type == "daily_living"
        assert result[1].visit_count == 1

    def test_empty_orders(self) -> None:
        """空のリスト"""
        result = aggregate_service_type_summary([])
        assert result == []

    def test_dynamic_label_from_service_type_configs(self) -> None:
        """service_type_configsから動的ラベルを取得"""
        orders = [_order(service_type="physical_care")]
        configs = [{"code": "physical_care", "label": "カスタム身体介護"}]
        result = aggregate_service_type_summary(orders, service_type_configs=configs)
        assert len(result) == 1
        assert result[0].label == "カスタム身体介護"

    def test_static_fallback_when_no_configs(self) -> None:
        """service_type_configsなしの場合は静的フォールバック"""
        orders = [_order(service_type="physical_care")]
        result = aggregate_service_type_summary(orders)
        assert result[0].label == "身体介護"

    def test_dynamic_label_overrides_static(self) -> None:
        """マスタラベルが静的ラベルを上書きする"""
        orders = [_order(service_type="daily_living")]
        configs = [{"code": "daily_living", "label": "生活サポート（改）"}]
        result = aggregate_service_type_summary(orders, service_type_configs=configs)
        assert result[0].label == "生活サポート（改）"

    def test_static_fallback_for_unconfigured_type(self) -> None:
        """マスタに存在しない種別は静的ラベルまたはコードにフォールバック"""
        orders = [_order(service_type="physical_care")]
        # daily_livingのみ設定、physical_careは未設定
        configs = [{"code": "daily_living", "label": "生活援助"}]
        result = aggregate_service_type_summary(orders, service_type_configs=configs)
        # physical_care は未設定なので静的ラベル（SERVICE_TYPE_LABELS）を使う
        assert result[0].label == "身体介護"


# ===========================================================================
# StaffSummary テスト（4件）
# ===========================================================================
class TestAggregateStaffSummary:
    def test_multiple_staff_multiple_orders(self) -> None:
        """複数スタッフ、複数オーダーの集計"""
        orders = [
            _order(
                assigned_staff_ids=["H001"],
                start_time="09:00",
                end_time="10:00",
            ),
            _order(
                assigned_staff_ids=["H002"],
                start_time="10:00",
                end_time="11:30",
            ),
        ]
        helpers = [
            _helper("H001", "田中", "美咲"),
            _helper("H002", "佐藤", "太郎"),
        ]
        result = aggregate_staff_summary(orders, helpers)
        assert len(result) == 2
        # H002 が 90分で1位
        assert result[0].helper_id == "H002"
        assert result[0].total_minutes == 90
        assert result[0].name == "佐藤 太郎"
        assert result[1].helper_id == "H001"
        assert result[1].total_minutes == 60
        assert result[1].name == "田中 美咲"

    def test_same_staff_multiple_orders(self) -> None:
        """同スタッフが複数オーダーに登場（累計）"""
        orders = [
            _order(
                assigned_staff_ids=["H001"],
                start_time="09:00",
                end_time="10:00",
            ),
            _order(
                assigned_staff_ids=["H001"],
                start_time="13:00",
                end_time="14:00",
            ),
        ]
        helpers = [_helper("H001", "田中", "美咲")]
        result = aggregate_staff_summary(orders, helpers)
        assert len(result) == 1
        assert result[0].visit_count == 2
        assert result[0].total_minutes == 120

    def test_empty_assigned_staff_ids(self) -> None:
        """assigned_staff_idsが空のオーダーがある場合"""
        orders = [
            _order(assigned_staff_ids=[], start_time="09:00", end_time="10:00"),
            _order(assigned_staff_ids=["H001"], start_time="10:00", end_time="11:00"),
        ]
        helpers = [_helper("H001", "田中", "美咲")]
        result = aggregate_staff_summary(orders, helpers)
        assert len(result) == 1
        assert result[0].helper_id == "H001"

    def test_sorted_by_total_minutes_desc(self) -> None:
        """totalMinutes降順ソート確認"""
        orders = [
            _order(
                assigned_staff_ids=["H001"],
                start_time="09:00",
                end_time="09:30",
            ),
            _order(
                assigned_staff_ids=["H002"],
                start_time="09:00",
                end_time="11:00",
            ),
            _order(
                assigned_staff_ids=["H003"],
                start_time="09:00",
                end_time="10:00",
            ),
        ]
        helpers = [
            _helper("H001", "田中", "美咲"),
            _helper("H002", "佐藤", "太郎"),
            _helper("H003", "鈴木", "花子"),
        ]
        result = aggregate_staff_summary(orders, helpers)
        assert result[0].helper_id == "H002"  # 120分
        assert result[1].helper_id == "H003"  # 60分
        assert result[2].helper_id == "H001"  # 30分


# ===========================================================================
# CustomerSummary テスト（4件）
# ===========================================================================
class TestAggregateCustomerSummary:
    def test_multiple_customers(self) -> None:
        """複数利用者の集計"""
        orders = [
            _order(customer_id="C001", start_time="09:00", end_time="10:00"),
            _order(customer_id="C002", start_time="10:00", end_time="11:30"),
        ]
        customers = [
            _customer("C001", "山田", "太郎"),
            _customer("C002", "鈴木", "花子"),
        ]
        result = aggregate_customer_summary(orders, customers)
        assert len(result) == 2
        # C002 が 90分で1位
        assert result[0].customer_id == "C002"
        assert result[0].total_minutes == 90
        assert result[0].name == "鈴木 花子"

    def test_same_customer_multiple_orders(self) -> None:
        """同利用者が複数オーダー（累計）"""
        orders = [
            _order(customer_id="C001", start_time="09:00", end_time="10:00"),
            _order(customer_id="C001", start_time="13:00", end_time="14:30"),
        ]
        customers = [_customer("C001", "山田", "太郎")]
        result = aggregate_customer_summary(orders, customers)
        assert len(result) == 1
        assert result[0].visit_count == 2
        assert result[0].total_minutes == 150

    def test_unknown_customer(self) -> None:
        """不明な利用者（IDなし）は'(不明)'"""
        orders = [
            _order(customer_id="C999", start_time="09:00", end_time="10:00"),
        ]
        customers: list[dict[str, object]] = []
        result = aggregate_customer_summary(orders, customers)
        assert len(result) == 1
        assert result[0].name == "(不明)"

    def test_sorted_by_total_minutes_desc(self) -> None:
        """totalMinutes降順ソート確認"""
        orders = [
            _order(customer_id="C001", start_time="09:00", end_time="09:30"),
            _order(customer_id="C002", start_time="09:00", end_time="11:00"),
            _order(customer_id="C003", start_time="09:00", end_time="10:00"),
        ]
        customers = [
            _customer("C001", "山田", "太郎"),
            _customer("C002", "鈴木", "花子"),
            _customer("C003", "佐藤", "次郎"),
        ]
        result = aggregate_customer_summary(orders, customers)
        assert result[0].customer_id == "C002"  # 120分
        assert result[1].customer_id == "C003"  # 60分
        assert result[2].customer_id == "C001"  # 30分
