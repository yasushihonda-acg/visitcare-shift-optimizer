"""K: 世帯連続訪問制約 — linked_orderは同一ヘルパー"""

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


def _h(id: str) -> Helper:
    return Helper(
        id=id, family_name="テスト", given_name=id, can_physical_care=True,
        transportation="car", preferred_hours=HoursRange(min=4, max=8),
        available_hours=HoursRange(min=4, max=8), employment_type="full_time",
    )


def _c(id: str, household: str | None = None) -> Customer:
    return Customer(
        id=id, family_name="テスト", given_name=id, address="テスト",
        location=GeoLocation(lat=31.59, lng=130.55),
        household_id=household,
    )


class TestHouseholdConstraint:
    def test_linked_orders_same_helper(self) -> None:
        """リンクされたオーダー → 同一ヘルパーが担当"""
        inp = OptimizationInput(
            customers=[_c("C1", "HH1"), _c("C2", "HH1")],
            helpers=[_h("H1"), _h("H2")],
            orders=[
                Order(
                    id="O1", customer_id="C1", date="2025-01-06",
                    day_of_week=DayOfWeek.MONDAY, start_time="09:00", end_time="10:00",
                    service_type="physical_care", linked_order_id="O2",
                ),
                Order(
                    id="O2", customer_id="C2", date="2025-01-06",
                    day_of_week=DayOfWeek.MONDAY, start_time="10:00", end_time="11:00",
                    service_type="physical_care", linked_order_id="O1",
                ),
            ],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        o1_staff = next(a for a in result.assignments if a.order_id == "O1").staff_ids
        o2_staff = next(a for a in result.assignments if a.order_id == "O2").staff_ids
        assert o1_staff == o2_staff

    def test_unlinked_orders_can_differ(self) -> None:
        """リンクなし → 異なるヘルパー可"""
        inp = OptimizationInput(
            customers=[_c("C1"), _c("C2")],
            helpers=[_h("H1"), _h("H2")],
            orders=[
                Order(
                    id="O1", customer_id="C1", date="2025-01-06",
                    day_of_week=DayOfWeek.MONDAY, start_time="09:00", end_time="10:00",
                    service_type="physical_care",
                ),
                Order(
                    id="O2", customer_id="C2", date="2025-01-06",
                    day_of_week=DayOfWeek.MONDAY, start_time="09:00", end_time="10:00",
                    service_type="physical_care",
                ),
            ],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        # 同時間帯なので重複禁止により異なるヘルパーに割当
        o1_staff = next(a for a in result.assignments if a.order_id == "O1").staff_ids
        o2_staff = next(a for a in result.assignments if a.order_id == "O2").staff_ids
        assert set(o1_staff).isdisjoint(set(o2_staff))
