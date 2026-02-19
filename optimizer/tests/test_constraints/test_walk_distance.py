"""M: 徒歩移動スタッフの訪問距離上限制約

移動手段が walk のスタッフは、同日の訪問間移動時間が
MAX_WALK_TRAVEL_MINUTES（30分）を超えるペアに割り当て不可。
"""

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


def _h(id: str, transportation: str = "car") -> Helper:
    return Helper(
        id=id, family_name="テスト", given_name=id, can_physical_care=True,
        transportation=transportation, preferred_hours=HoursRange(min=4, max=8),
        available_hours=HoursRange(min=4, max=8), employment_type="full_time",
    )


def _c(id: str) -> Customer:
    return Customer(
        id=id, family_name="テスト", given_name=id, address="テスト",
        location=GeoLocation(lat=31.59, lng=130.55),
    )


def _o(id: str, cid: str, start: str, end: str) -> Order:
    return Order(
        id=id, customer_id=cid, date="2025-01-06", day_of_week=DayOfWeek.MONDAY,
        start_time=start, end_time=end, service_type="physical_care",
    )


class TestWalkDistanceConstraint:
    def test_walk_staff_blocked_when_travel_exceeds_limit(self) -> None:
        """徒歩スタッフ: 移動時間35分（> 30分上限）→ 同日両方に割当不可"""
        inp = OptimizationInput(
            customers=[_c("C1"), _c("C2")],
            helpers=[_h("H1", "walk"), _h("H2", "car")],
            orders=[
                _o("O1", "C1", "09:00", "10:00"),
                _o("O2", "C2", "11:00", "12:00"),  # 60分の間隔（時間は十分）
            ],
            travel_times=[
                TravelTime(from_id="C1", to_id="C2", travel_time_minutes=35.0),
                TravelTime(from_id="C2", to_id="C1", travel_time_minutes=35.0),
            ],
            staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        o1_staff = next(a for a in result.assignments if a.order_id == "O1").staff_ids
        o2_staff = next(a for a in result.assignments if a.order_id == "O2").staff_ids
        # H1（徒歩）は両方に割り当てられない
        assert not ("H1" in o1_staff and "H1" in o2_staff)

    def test_car_staff_unaffected_by_walk_limit(self) -> None:
        """車スタッフ: 移動時間35分でも制限なし → 両方に割当可能"""
        inp = OptimizationInput(
            customers=[_c("C1"), _c("C2")],
            helpers=[_h("H1", "car")],
            orders=[
                _o("O1", "C1", "09:00", "10:00"),
                _o("O2", "C2", "11:00", "12:00"),
            ],
            travel_times=[
                TravelTime(from_id="C1", to_id="C2", travel_time_minutes=35.0),
                TravelTime(from_id="C2", to_id="C1", travel_time_minutes=35.0),
            ],
            staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        o1_staff = next(a for a in result.assignments if a.order_id == "O1").staff_ids
        o2_staff = next(a for a in result.assignments if a.order_id == "O2").staff_ids
        assert o1_staff == ["H1"]
        assert o2_staff == ["H1"]

    def test_walk_staff_allowed_within_limit(self) -> None:
        """徒歩スタッフ: 移動時間25分（≤ 30分上限）→ 割当OK"""
        inp = OptimizationInput(
            customers=[_c("C1"), _c("C2")],
            helpers=[_h("H1", "walk")],
            orders=[
                _o("O1", "C1", "09:00", "10:00"),
                _o("O2", "C2", "10:30", "11:30"),
            ],
            travel_times=[
                TravelTime(from_id="C1", to_id="C2", travel_time_minutes=25.0),
                TravelTime(from_id="C2", to_id="C1", travel_time_minutes=25.0),
            ],
            staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        o1_staff = next(a for a in result.assignments if a.order_id == "O1").staff_ids
        o2_staff = next(a for a in result.assignments if a.order_id == "O2").staff_ids
        assert o1_staff == ["H1"]
        assert o2_staff == ["H1"]

    def test_walk_staff_only_infeasible(self) -> None:
        """徒歩スタッフのみで遠距離訪問2件 → Infeasible"""
        inp = OptimizationInput(
            customers=[_c("C1"), _c("C2")],
            helpers=[_h("H1", "walk")],
            orders=[
                _o("O1", "C1", "09:00", "10:00"),
                _o("O2", "C2", "11:00", "12:00"),
            ],
            travel_times=[
                TravelTime(from_id="C1", to_id="C2", travel_time_minutes=45.0),
                TravelTime(from_id="C2", to_id="C1", travel_time_minutes=45.0),
            ],
            staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Infeasible"
