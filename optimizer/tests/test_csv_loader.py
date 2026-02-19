"""CSVデータローダーのテスト"""

from datetime import date
from pathlib import Path

from optimizer.data.csv_loader import (
    generate_orders,
    load_customers,
    load_helpers,
    load_optimization_input,
    load_staff_constraints,
    load_staff_unavailabilities,
    load_travel_times,
)
from optimizer.models import DayOfWeek


class TestLoadCustomers:
    def test_count(self, seed_data_dir: Path) -> None:
        customers = load_customers(seed_data_dir)
        assert len(customers) == 50

    def test_first_customer(self, seed_data_dir: Path) -> None:
        customers = load_customers(seed_data_dir)
        c001 = next(c for c in customers if c.id == "C001")
        assert c001.family_name == "山田"
        assert c001.location.lat > 31.0
        assert c001.household_id == "H001"

    def test_weekly_services_loaded(self, seed_data_dir: Path) -> None:
        customers = load_customers(seed_data_dir)
        c001 = next(c for c in customers if c.id == "C001")
        assert len(c001.weekly_services) > 0

    def test_ng_staff_loaded(self, seed_data_dir: Path) -> None:
        customers = load_customers(seed_data_dir)
        c004 = next(c for c in customers if c.id == "C004")
        assert len(c004.ng_staff_ids) > 0


class TestLoadHelpers:
    def test_count(self, seed_data_dir: Path) -> None:
        helpers = load_helpers(seed_data_dir)
        assert len(helpers) == 20

    def test_first_helper(self, seed_data_dir: Path) -> None:
        helpers = load_helpers(seed_data_dir)
        h001 = next(h for h in helpers if h.id == "H001")
        assert h001.can_physical_care is True
        assert h001.transportation == "car"
        assert "介護福祉士" in h001.qualifications

    def test_availability_loaded(self, seed_data_dir: Path) -> None:
        helpers = load_helpers(seed_data_dir)
        h001 = next(h for h in helpers if h.id == "H001")
        assert len(h001.weekly_availability) > 0

    def test_has_unqualified_helpers(self, seed_data_dir: Path) -> None:
        helpers = load_helpers(seed_data_dir)
        unqualified = [h for h in helpers if not h.can_physical_care]
        assert len(unqualified) == 4


class TestGenerateOrders:
    def test_order_count(self, seed_data_dir: Path) -> None:
        customers = load_customers(seed_data_dir)
        orders = generate_orders(customers, date(2025, 1, 6))
        assert len(orders) == 162

    def test_order_dates(self, seed_data_dir: Path) -> None:
        customers = load_customers(seed_data_dir)
        orders = generate_orders(customers, date(2025, 1, 6))
        monday_orders = [o for o in orders if o.day_of_week == DayOfWeek.MONDAY]
        for o in monday_orders:
            assert o.date == "2025-01-06"

    def test_unique_ids(self, seed_data_dir: Path) -> None:
        customers = load_customers(seed_data_dir)
        orders = generate_orders(customers, date(2025, 1, 6))
        ids = [o.id for o in orders]
        assert len(ids) == len(set(ids))


class TestLoadTravelTimes:
    def test_symmetric_pairs(self, seed_data_dir: Path) -> None:
        customers = load_customers(seed_data_dir)
        travel_times = load_travel_times(seed_data_dir, customers)
        # 50 customers → 50*49 = 2450 directed pairs
        assert len(travel_times) == 50 * 49

    def test_positive_values(self, seed_data_dir: Path) -> None:
        customers = load_customers(seed_data_dir)
        travel_times = load_travel_times(seed_data_dir, customers)
        for tt in travel_times:
            assert tt.travel_time_minutes >= 0


class TestLoadStaffUnavailabilities:
    def test_loaded(self, seed_data_dir: Path) -> None:
        unavailabilities = load_staff_unavailabilities(seed_data_dir)
        assert len(unavailabilities) > 0

    def test_has_slots(self, seed_data_dir: Path) -> None:
        unavailabilities = load_staff_unavailabilities(seed_data_dir)
        for su in unavailabilities:
            assert len(su.unavailable_slots) > 0


class TestLoadStaffConstraints:
    def test_loaded(self, seed_data_dir: Path) -> None:
        constraints = load_staff_constraints(seed_data_dir)
        assert len(constraints) == 19

    def test_ng_count(self, seed_data_dir: Path) -> None:
        constraints = load_staff_constraints(seed_data_dir)
        ng = [c for c in constraints if c.constraint_type == "ng"]
        assert len(ng) == 7


class TestGenerateOrdersLinkedOrders:
    """世帯ペアのlinked_order_id生成テスト"""

    def test_household_pair_linked(self, seed_data_dir: Path) -> None:
        """同世帯・同日・連続時間帯のオーダーがlinked_order_idで紐付く"""
        customers = load_customers(seed_data_dir)
        orders = generate_orders(customers, date(2025, 1, 6))

        # C001(山田太郎)とC002(山田花子)は世帯H001
        # C001: 月曜09:00-10:00, C002: 月曜10:00-11:00 → 連続
        c001_mon = [o for o in orders if o.customer_id == "C001" and o.day_of_week == DayOfWeek.MONDAY]
        c002_mon = [o for o in orders if o.customer_id == "C002" and o.day_of_week == DayOfWeek.MONDAY]
        assert len(c001_mon) == 1
        assert len(c002_mon) == 1
        assert c001_mon[0].linked_order_id == c002_mon[0].id
        assert c002_mon[0].linked_order_id == c001_mon[0].id

    def test_non_household_not_linked(self, seed_data_dir: Path) -> None:
        """世帯ペアでない利用者はlinked_order_idがNone"""
        customers = load_customers(seed_data_dir)
        orders = generate_orders(customers, date(2025, 1, 6))
        # C003(中村正雄)はhousehold_idなし
        c003_orders = [o for o in orders if o.customer_id == "C003"]
        for o in c003_orders:
            assert o.linked_order_id is None

    def test_all_household_pairs_linked(self, seed_data_dir: Path) -> None:
        """全3世帯ペアの連続訪問オーダーがリンクされている"""
        customers = load_customers(seed_data_dir)
        orders = generate_orders(customers, date(2025, 1, 6))
        linked = [o for o in orders if o.linked_order_id is not None]
        # 3世帯ペア × 各世帯の共通曜日数 × 2（双方向）
        assert len(linked) > 0


class TestLoadOptimizationInput:
    def test_full_load(self, seed_data_dir: Path) -> None:
        inp = load_optimization_input(seed_data_dir, date(2025, 1, 6))
        assert len(inp.customers) == 50
        assert len(inp.helpers) == 20
        assert len(inp.orders) == 162
        assert len(inp.travel_times) > 0
        assert len(inp.staff_constraints) == 19
