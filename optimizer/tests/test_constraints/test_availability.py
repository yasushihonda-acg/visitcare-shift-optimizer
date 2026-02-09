"""I: 勤務可能時間制約 — availability外はアサイン不可"""

from optimizer.engine.solver import solve
from optimizer.models import (
    AvailabilitySlot,
    Customer,
    DayOfWeek,
    GeoLocation,
    Helper,
    HoursRange,
    OptimizationInput,
    Order,
)


def _h(id: str, avail: dict | None = None) -> Helper:
    return Helper(
        id=id, family_name="テスト", given_name=id, can_physical_care=True,
        transportation="car", preferred_hours=HoursRange(min=4, max=8),
        available_hours=HoursRange(min=4, max=8), employment_type="full_time",
        weekly_availability=avail or {},
    )


def _c(id: str) -> Customer:
    return Customer(
        id=id, family_name="テスト", given_name=id, address="テスト",
        location=GeoLocation(lat=31.59, lng=130.55),
    )


def _o(id: str, cid: str, start: str = "09:00", end: str = "10:00") -> Order:
    return Order(
        id=id, customer_id=cid, date="2025-01-06", day_of_week=DayOfWeek.MONDAY,
        start_time=start, end_time=end, service_type="physical_care",
    )


class TestAvailabilityConstraint:
    def test_within_availability(self) -> None:
        """勤務可能時間内 → 割当可能"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1", {DayOfWeek.MONDAY: [AvailabilitySlot(start_time="08:00", end_time="17:00")]})],
            orders=[_o("O1", "C1", "09:00", "10:00")],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"

    def test_outside_availability(self) -> None:
        """勤務可能時間外 → 割当不可"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[
                _h("H1", {DayOfWeek.MONDAY: [AvailabilitySlot(start_time="13:00", end_time="17:00")]}),
                _h("H2", {DayOfWeek.MONDAY: [AvailabilitySlot(start_time="08:00", end_time="12:00")]}),
            ],
            orders=[_o("O1", "C1", "09:00", "10:00")],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        # H1は13:00開始なので9:00のオーダーは不可、H2が割当
        assert "H2" in result.assignments[0].staff_ids
        assert "H1" not in result.assignments[0].staff_ids

    def test_no_availability_for_day(self) -> None:
        """その曜日の勤務設定がない → 割当不可"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[
                _h("H1", {DayOfWeek.TUESDAY: [AvailabilitySlot(start_time="08:00", end_time="17:00")]}),
                _h("H2", {DayOfWeek.MONDAY: [AvailabilitySlot(start_time="08:00", end_time="17:00")]}),
            ],
            orders=[_o("O1", "C1", "09:00", "10:00")],  # Monday
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H2" in result.assignments[0].staff_ids
        assert "H1" not in result.assignments[0].staff_ids

    def test_no_availability_defined_means_always_available(self) -> None:
        """availability未定義 → 常時可能（既存テストとの後方互換）"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1")],  # availability未設定
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
