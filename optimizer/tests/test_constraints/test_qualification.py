"""E: 資格制約 — 身体介護に無資格者を割り当てない"""

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


def _make_helper(id: str, can_physical: bool) -> Helper:
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


def _make_order(id: str, customer_id: str, stype: str) -> Order:
    return Order(
        id=id,
        customer_id=customer_id,
        date="2025-01-06",
        day_of_week=DayOfWeek.MONDAY,
        start_time="09:00",
        end_time="10:00",
        service_type=stype,
    )


class TestQualificationConstraint:
    def test_unqualified_not_assigned_to_physical_care(self) -> None:
        """無資格者は身体介護に割り当てられない"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[
                _make_helper("H1", can_physical=True),
                _make_helper("H2", can_physical=False),
            ],
            orders=[_make_order("O1", "C1", "physical_care")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assigned = result.assignments[0].staff_ids
        assert "H1" in assigned
        assert "H2" not in assigned

    def test_unqualified_can_do_daily_living(self) -> None:
        """無資格者は生活援助に割り当て可能"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1", can_physical=False)],
            orders=[_make_order("O1", "C1", "daily_living")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H1" in result.assignments[0].staff_ids

    def test_infeasible_only_unqualified_for_physical(self) -> None:
        """無資格者しかいないのに身体介護 → Infeasible"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1", can_physical=False)],
            orders=[_make_order("O1", "C1", "physical_care")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Infeasible"

    def test_unqualified_not_assigned_to_mixed(self) -> None:
        """無資格者は混合サービスに割り当てられない"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[
                _make_helper("H1", can_physical=True),
                _make_helper("H2", can_physical=False),
            ],
            orders=[_make_order("O1", "C1", "mixed")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assigned = result.assignments[0].staff_ids
        assert "H1" in assigned
        assert "H2" not in assigned

    def test_infeasible_only_unqualified_for_mixed(self) -> None:
        """無資格者しかいないのに混合サービス → Infeasible"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1", can_physical=False)],
            orders=[_make_order("O1", "C1", "mixed")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Infeasible"

    def test_unqualified_can_do_prevention(self) -> None:
        """無資格者は介護予防に割り当て可能"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1", can_physical=False)],
            orders=[_make_order("O1", "C1", "prevention")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H1" in result.assignments[0].staff_ids
