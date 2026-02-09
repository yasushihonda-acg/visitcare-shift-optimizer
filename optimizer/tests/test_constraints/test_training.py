"""L: 研修中スタッフ制約 — training状態のヘルパーは単独訪問不可"""

from optimizer.engine.solver import solve
from optimizer.models import (
    Customer,
    DayOfWeek,
    GeoLocation,
    Helper,
    HoursRange,
    OptimizationInput,
    Order,
    TrainingStatus,
)


def _h(id: str, training_for: dict[str, TrainingStatus] | None = None) -> Helper:
    return Helper(
        id=id, family_name="テスト", given_name=id, can_physical_care=True,
        transportation="car", preferred_hours=HoursRange(min=4, max=8),
        available_hours=HoursRange(min=4, max=8), employment_type="full_time",
        customer_training_status=training_for or {},
    )


def _c(id: str) -> Customer:
    return Customer(
        id=id, family_name="テスト", given_name=id, address="テスト",
        location=GeoLocation(lat=31.59, lng=130.55),
    )


class TestTrainingConstraint:
    def test_training_helper_not_alone(self) -> None:
        """研修中のヘルパーは単独で割り当てられない（staff_count=1の場合）"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[
                _h("H1", {"C1": TrainingStatus.TRAINING}),
                _h("H2"),  # 独立状態
            ],
            orders=[Order(
                id="O1", customer_id="C1", date="2025-01-06",
                day_of_week=DayOfWeek.MONDAY, start_time="09:00", end_time="10:00",
                service_type="physical_care", staff_count=1,
            )],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        # H1はC1で研修中なので単独割当不可 → H2が担当
        assert "H1" not in result.assignments[0].staff_ids
        assert "H2" in result.assignments[0].staff_ids

    def test_independent_helper_ok(self) -> None:
        """独り立ち済み → 単独割当可"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1", {"C1": TrainingStatus.INDEPENDENT})],
            orders=[Order(
                id="O1", customer_id="C1", date="2025-01-06",
                day_of_week=DayOfWeek.MONDAY, start_time="09:00", end_time="10:00",
                service_type="physical_care", staff_count=1,
            )],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H1" in result.assignments[0].staff_ids

    def test_training_status_not_set_means_ok(self) -> None:
        """training_statusが未設定 → 独立とみなす"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1")],  # training_status未設定
            orders=[Order(
                id="O1", customer_id="C1", date="2025-01-06",
                day_of_week=DayOfWeek.MONDAY, start_time="09:00", end_time="10:00",
                service_type="physical_care", staff_count=1,
            )],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H1" in result.assignments[0].staff_ids
