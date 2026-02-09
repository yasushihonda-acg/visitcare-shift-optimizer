"""F: 重複禁止 — 同一ヘルパーが同時刻に複数箇所にアサイン不可"""

from optimizer.engine.solver import solve
from optimizer.models import (
    Customer,
    DayOfWeek,
    GeoLocation,
    Helper,
    HoursRange,
    OptimizationInput,
    Order,
)


def _make_helper(id: str) -> Helper:
    return Helper(
        id=id, family_name="テスト", given_name=id, can_physical_care=True,
        transportation="car", preferred_hours=HoursRange(min=4, max=8),
        available_hours=HoursRange(min=4, max=8), employment_type="full_time",
    )


def _make_customer(id: str) -> Customer:
    return Customer(
        id=id, family_name="テスト", given_name=id, address="テスト",
        location=GeoLocation(lat=31.59, lng=130.55),
    )


def _make_order(id: str, cid: str, start: str, end: str, date: str = "2025-01-06") -> Order:
    dow_map = {"2025-01-06": DayOfWeek.MONDAY, "2025-01-07": DayOfWeek.TUESDAY}
    return Order(
        id=id, customer_id=cid, date=date, day_of_week=dow_map[date],
        start_time=start, end_time=end, service_type="physical_care",
    )


class TestNoOverlapConstraint:
    def test_overlapping_orders_different_helpers(self) -> None:
        """同時間帯の2オーダー → 別ヘルパーに割当"""
        inp = OptimizationInput(
            customers=[_make_customer("C1"), _make_customer("C2")],
            helpers=[_make_helper("H1"), _make_helper("H2")],
            orders=[
                _make_order("O1", "C1", "09:00", "10:00"),
                _make_order("O2", "C2", "09:00", "10:00"),
            ],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        o1_staff = next(a for a in result.assignments if a.order_id == "O1").staff_ids
        o2_staff = next(a for a in result.assignments if a.order_id == "O2").staff_ids
        # 同一ヘルパーが両方に割り当てられていないこと
        assert set(o1_staff).isdisjoint(set(o2_staff))

    def test_infeasible_one_helper_two_overlapping(self) -> None:
        """1ヘルパーで同時間帯2オーダー → Infeasible"""
        inp = OptimizationInput(
            customers=[_make_customer("C1"), _make_customer("C2")],
            helpers=[_make_helper("H1")],
            orders=[
                _make_order("O1", "C1", "09:00", "10:00"),
                _make_order("O2", "C2", "09:30", "10:30"),
            ],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Infeasible"

    def test_non_overlapping_same_helper_ok(self) -> None:
        """時間帯が重複しない → 同一ヘルパーが両方担当可能"""
        inp = OptimizationInput(
            customers=[_make_customer("C1"), _make_customer("C2")],
            helpers=[_make_helper("H1")],
            orders=[
                _make_order("O1", "C1", "09:00", "10:00"),
                _make_order("O2", "C2", "10:00", "11:00"),
            ],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        o1_staff = next(a for a in result.assignments if a.order_id == "O1").staff_ids
        o2_staff = next(a for a in result.assignments if a.order_id == "O2").staff_ids
        assert o1_staff == ["H1"]
        assert o2_staff == ["H1"]

    def test_different_days_same_time_ok(self) -> None:
        """異なる日の同時間帯 → 同一ヘルパー可"""
        inp = OptimizationInput(
            customers=[_make_customer("C1"), _make_customer("C2")],
            helpers=[_make_helper("H1")],
            orders=[
                _make_order("O1", "C1", "09:00", "10:00", "2025-01-06"),
                _make_order("O2", "C2", "09:00", "10:00", "2025-01-07"),
            ],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
