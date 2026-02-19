"""N: 性別制約 — gender_requirementに合わないスタッフを割り当てない"""

from optimizer.engine.solver import solve
from optimizer.models import (
    Customer,
    DayOfWeek,
    Gender,
    GeoLocation,
    Helper,
    HoursRange,
    OptimizationInput,
    Order,
)


def _h(id: str, gender: Gender) -> Helper:
    return Helper(
        id=id, family_name="テスト", given_name=id, can_physical_care=True,
        transportation="car", preferred_hours=HoursRange(min=4, max=8),
        available_hours=HoursRange(min=4, max=8), employment_type="full_time",
        gender=gender,
    )


def _c(id: str, gender_requirement: str = "any") -> Customer:
    return Customer(
        id=id, family_name="テスト", given_name=id, address="テスト",
        location=GeoLocation(lat=31.59, lng=130.55),
        gender_requirement=gender_requirement,
    )


def _o(id: str, cid: str) -> Order:
    return Order(
        id=id, customer_id=cid, date="2025-01-06", day_of_week=DayOfWeek.MONDAY,
        start_time="09:00", end_time="10:00", service_type="physical_care",
    )


class TestGenderConstraint:
    def test_female_only_customer_gets_female_staff(self) -> None:
        """女性限定利用者には女性スタッフのみ割り当てられる"""
        inp = OptimizationInput(
            customers=[_c("C1", gender_requirement="female")],
            helpers=[_h("H1", Gender.MALE), _h("H2", Gender.FEMALE)],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H1" not in result.assignments[0].staff_ids
        assert "H2" in result.assignments[0].staff_ids

    def test_male_only_customer_gets_male_staff(self) -> None:
        """男性限定利用者には男性スタッフのみ割り当てられる"""
        inp = OptimizationInput(
            customers=[_c("C1", gender_requirement="male")],
            helpers=[_h("H1", Gender.FEMALE), _h("H2", Gender.MALE)],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H1" not in result.assignments[0].staff_ids
        assert "H2" in result.assignments[0].staff_ids

    def test_any_requirement_allows_all(self) -> None:
        """指定なし（any）の場合は全性別のスタッフが割り当て可能"""
        inp = OptimizationInput(
            customers=[_c("C1", gender_requirement="any")],
            helpers=[_h("H1", Gender.MALE), _h("H2", Gender.FEMALE)],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert len(result.assignments[0].staff_ids) == 1

    def test_infeasible_no_matching_gender(self) -> None:
        """条件を満たすスタッフがいない場合はInfeasible"""
        inp = OptimizationInput(
            customers=[_c("C1", gender_requirement="female")],
            helpers=[_h("H1", Gender.MALE), _h("H2", Gender.MALE)],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Infeasible"
