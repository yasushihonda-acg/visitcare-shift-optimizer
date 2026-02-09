"""H: NGスタッフ回避 — ng_staff_idsに含まれるスタッフを割り当てない"""

from optimizer.engine.solver import solve
from optimizer.models import (
    Customer,
    DayOfWeek,
    GeoLocation,
    Helper,
    HoursRange,
    OptimizationInput,
    Order,
    StaffConstraint,
)


def _h(id: str) -> Helper:
    return Helper(
        id=id, family_name="テスト", given_name=id, can_physical_care=True,
        transportation="car", preferred_hours=HoursRange(min=4, max=8),
        available_hours=HoursRange(min=4, max=8), employment_type="full_time",
    )


def _c(id: str, ng: list[str] | None = None) -> Customer:
    return Customer(
        id=id, family_name="テスト", given_name=id, address="テスト",
        location=GeoLocation(lat=31.59, lng=130.55),
        ng_staff_ids=ng or [],
    )


def _o(id: str, cid: str) -> Order:
    return Order(
        id=id, customer_id=cid, date="2025-01-06", day_of_week=DayOfWeek.MONDAY,
        start_time="09:00", end_time="10:00", service_type="physical_care",
    )


class TestNgStaffConstraint:
    def test_ng_staff_not_assigned(self) -> None:
        """NGスタッフは割り当てられない"""
        inp = OptimizationInput(
            customers=[_c("C1", ng=["H1"])],
            helpers=[_h("H1"), _h("H2")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[],
            staff_constraints=[StaffConstraint(customer_id="C1", staff_id="H1", constraint_type="ng")],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H1" not in result.assignments[0].staff_ids
        assert "H2" in result.assignments[0].staff_ids

    def test_infeasible_all_ng(self) -> None:
        """全ヘルパーがNG → Infeasible"""
        inp = OptimizationInput(
            customers=[_c("C1", ng=["H1"])],
            helpers=[_h("H1")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[],
            staff_constraints=[StaffConstraint(customer_id="C1", staff_id="H1", constraint_type="ng")],
        )
        result = solve(inp)
        assert result.status == "Infeasible"
