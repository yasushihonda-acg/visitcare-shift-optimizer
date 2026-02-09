"""G: 移動時間確保制約 — 連続訪問間の移動時間を確保"""

from optimizer.engine.solver import solve
from optimizer.models import (
    Customer,
    DayOfWeek,
    GeoLocation,
    Helper,
    HoursRange,
    OptimizationInput,
    Order,
    TravelTime,
)


def _h(id: str) -> Helper:
    return Helper(
        id=id, family_name="テスト", given_name=id, can_physical_care=True,
        transportation="car", preferred_hours=HoursRange(min=4, max=8),
        available_hours=HoursRange(min=4, max=8), employment_type="full_time",
    )


def _c(id: str, lat: float = 31.59, lng: float = 130.55) -> Customer:
    return Customer(
        id=id, family_name="テスト", given_name=id, address="テスト",
        location=GeoLocation(lat=lat, lng=lng),
    )


def _o(id: str, cid: str, start: str, end: str) -> Order:
    return Order(
        id=id, customer_id=cid, date="2025-01-06", day_of_week=DayOfWeek.MONDAY,
        start_time=start, end_time=end, service_type="physical_care",
    )


class TestTravelTimeConstraint:
    def test_sufficient_gap_allows_assignment(self) -> None:
        """移動時間15分、間隔30分 → 同一ヘルパー可"""
        inp = OptimizationInput(
            customers=[_c("C1"), _c("C2")],
            helpers=[_h("H1")],
            orders=[
                _o("O1", "C1", "09:00", "10:00"),
                _o("O2", "C2", "10:30", "11:30"),  # 30分の間隔
            ],
            travel_times=[
                TravelTime(from_id="C1", to_id="C2", travel_time_minutes=15.0),
                TravelTime(from_id="C2", to_id="C1", travel_time_minutes=15.0),
            ],
            staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        o1_staff = next(a for a in result.assignments if a.order_id == "O1").staff_ids
        o2_staff = next(a for a in result.assignments if a.order_id == "O2").staff_ids
        assert o1_staff == ["H1"]
        assert o2_staff == ["H1"]

    def test_insufficient_gap_prevents_same_helper(self) -> None:
        """移動時間20分、間隔10分 → 同一ヘルパー不可"""
        inp = OptimizationInput(
            customers=[_c("C1"), _c("C2")],
            helpers=[_h("H1"), _h("H2")],
            orders=[
                _o("O1", "C1", "09:00", "10:00"),
                _o("O2", "C2", "10:10", "11:10"),  # 10分の間隔
            ],
            travel_times=[
                TravelTime(from_id="C1", to_id="C2", travel_time_minutes=20.0),
                TravelTime(from_id="C2", to_id="C1", travel_time_minutes=20.0),
            ],
            staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        o1_staff = next(a for a in result.assignments if a.order_id == "O1").staff_ids
        o2_staff = next(a for a in result.assignments if a.order_id == "O2").staff_ids
        assert set(o1_staff).isdisjoint(set(o2_staff))

    def test_same_customer_no_travel_needed(self) -> None:
        """同じ利用者の連続訪問 → 移動時間不要"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1")],
            orders=[
                _o("O1", "C1", "09:00", "10:00"),
                _o("O2", "C1", "10:00", "11:00"),
            ],
            travel_times=[],
            staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert result.assignments[0].staff_ids == ["H1"]
        assert result.assignments[1].staff_ids == ["H1"]
