"""I: 入れるスタッフ制約 — allowed_staff_ids が空でない場合、リスト外スタッフの割り当てを禁止"""

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


def _c(id: str, allowed: list[str] | None = None, ng: list[str] | None = None) -> Customer:
    return Customer(
        id=id, family_name="テスト", given_name=id, address="テスト",
        location=GeoLocation(lat=31.59, lng=130.55),
        allowed_staff_ids=allowed or [],
        ng_staff_ids=ng or [],
    )


def _o(id: str, cid: str) -> Order:
    return Order(
        id=id, customer_id=cid, date="2025-01-06", day_of_week=DayOfWeek.MONDAY,
        start_time="09:00", end_time="10:00", service_type="physical_care",
    )


class TestAllowedStaffConstraint:
    def test_allowed_empty_no_restriction(self) -> None:
        """allowed_staff_ids が空 → 制限なし（全スタッフ割り当て可）"""
        inp = OptimizationInput(
            customers=[_c("C1", allowed=[])],
            helpers=[_h("H1"), _h("H2"), _h("H3")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[],
            staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        # いずれかのスタッフが割り当てられればOK（制限なし）
        assert len(result.assignments[0].staff_ids) == 1

    def test_allowed_list_blocks_unlisted_staff(self) -> None:
        """allowed_staff_ids に H001, H002 → H003 は割り当て禁止"""
        inp = OptimizationInput(
            customers=[_c("C1", allowed=["H001", "H002"])],
            helpers=[_h("H001"), _h("H002"), _h("H003")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[],
            staff_constraints=[
                StaffConstraint(customer_id="C1", staff_id="H001", constraint_type="allowed"),
                StaffConstraint(customer_id="C1", staff_id="H002", constraint_type="allowed"),
            ],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H003" not in result.assignments[0].staff_ids
        # H001 または H002 が割り当てられていること
        assigned = result.assignments[0].staff_ids
        assert any(sid in ("H001", "H002") for sid in assigned)

    def test_ng_takes_priority_over_allowed(self) -> None:
        """ng_staff_ids と allowed_staff_ids 両方に H001 → NG優先（H001 も禁止）"""
        inp = OptimizationInput(
            customers=[_c("C1", allowed=["H001"], ng=["H001"])],
            helpers=[_h("H001"), _h("H002")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[],
            staff_constraints=[
                StaffConstraint(customer_id="C1", staff_id="H001", constraint_type="allowed"),
                StaffConstraint(customer_id="C1", staff_id="H001", constraint_type="ng"),
            ],
        )
        result = solve(inp)
        # H001はNG+allowed両方 → NG優先でH001禁止、H002は allowed制約で禁止
        # → 割り当て可能スタッフなし → Infeasible
        assert result.status == "Infeasible"

    def test_allowed_staff_can_be_assigned(self) -> None:
        """allowed_staff_ids が空でない場合、リスト内のスタッフは NG がなければ割り当て可"""
        inp = OptimizationInput(
            customers=[_c("C1", allowed=["H001"])],
            helpers=[_h("H001"), _h("H002")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[],
            staff_constraints=[
                StaffConstraint(customer_id="C1", staff_id="H001", constraint_type="allowed"),
            ],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert result.assignments[0].staff_ids == ["H001"]
