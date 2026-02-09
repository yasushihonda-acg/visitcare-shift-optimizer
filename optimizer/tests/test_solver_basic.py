"""ソルバー骨格のテスト — 制約なしで基本動作確認"""

from optimizer.engine.solver import _orders_overlap, _time_to_minutes, solve
from optimizer.models import (
    Customer,
    DayOfWeek,
    GeoLocation,
    Helper,
    HoursRange,
    OptimizationInput,
    Order,
    ServiceSlot,
    TravelTime,
)


def _make_helper(id: str, can_physical: bool = True) -> Helper:
    return Helper(
        id=id,
        family_name="テスト",
        given_name=id,
        can_physical_care=can_physical,
        transportation="car",
        preferred_hours=HoursRange(min=4, max=8),
        available_hours=HoursRange(min=4, max=8),
        employment_type="full_time",
    )


def _make_customer(id: str) -> Customer:
    return Customer(
        id=id,
        family_name="テスト",
        given_name=id,
        address="テスト住所",
        location=GeoLocation(lat=31.59, lng=130.55),
    )


def _make_order(id: str, customer_id: str, start: str, end: str, stype: str = "physical_care") -> Order:
    return Order(
        id=id,
        customer_id=customer_id,
        date="2025-01-06",
        day_of_week=DayOfWeek.MONDAY,
        start_time=start,
        end_time=end,
        service_type=stype,
    )


class TestTimeToMinutes:
    def test_nine_am(self) -> None:
        assert _time_to_minutes("09:00") == 540

    def test_midnight(self) -> None:
        assert _time_to_minutes("00:00") == 0

    def test_five_thirty(self) -> None:
        assert _time_to_minutes("17:30") == 1050


class TestOrdersOverlap:
    def test_overlapping(self) -> None:
        o1 = _make_order("O1", "C1", "09:00", "10:00")
        o2 = _make_order("O2", "C2", "09:30", "10:30")
        assert _orders_overlap(o1, o2) is True

    def test_adjacent_no_overlap(self) -> None:
        o1 = _make_order("O1", "C1", "09:00", "10:00")
        o2 = _make_order("O2", "C2", "10:00", "11:00")
        assert _orders_overlap(o1, o2) is False

    def test_different_dates(self) -> None:
        o1 = _make_order("O1", "C1", "09:00", "10:00")
        o2 = Order(
            id="O2", customer_id="C2", date="2025-01-07",
            day_of_week=DayOfWeek.TUESDAY, start_time="09:00",
            end_time="10:00", service_type="physical_care",
        )
        assert _orders_overlap(o1, o2) is False


class TestSolveBasic:
    def test_single_order_single_helper(self) -> None:
        """最小構成: 1ヘルパー1オーダー → 割当成功"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1")],
            orders=[_make_order("O1", "C1", "09:00", "10:00")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert len(result.assignments) == 1
        assert result.assignments[0].staff_ids == ["H1"]

    def test_two_orders_two_helpers(self) -> None:
        """2ヘルパー2オーダー → 各オーダーに1人ずつ"""
        inp = OptimizationInput(
            customers=[_make_customer("C1"), _make_customer("C2")],
            helpers=[_make_helper("H1"), _make_helper("H2")],
            orders=[
                _make_order("O1", "C1", "09:00", "10:00"),
                _make_order("O2", "C2", "09:00", "10:00"),
            ],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert len(result.assignments) == 2
        for a in result.assignments:
            assert len(a.staff_ids) == 1

    def test_infeasible_no_helpers(self) -> None:
        """ヘルパー0人 → Infeasible"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[],
            orders=[_make_order("O1", "C1", "09:00", "10:00")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Infeasible"

    def test_solve_time_recorded(self) -> None:
        """実行時間が記録される"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1")],
            orders=[_make_order("O1", "C1", "09:00", "10:00")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
        )
        result = solve(inp)
        assert result.solve_time_seconds > 0
