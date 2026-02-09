"""J: 希望休制約 — unavailable_slotsに該当する日時はアサイン不可"""

from optimizer.engine.solver import solve
from optimizer.models import (
    Customer,
    DayOfWeek,
    GeoLocation,
    Helper,
    HoursRange,
    OptimizationInput,
    Order,
    StaffUnavailability,
    UnavailableSlot,
)


def _h(id: str) -> Helper:
    return Helper(
        id=id, family_name="テスト", given_name=id, can_physical_care=True,
        transportation="car", preferred_hours=HoursRange(min=4, max=8),
        available_hours=HoursRange(min=4, max=8), employment_type="full_time",
    )


def _c(id: str) -> Customer:
    return Customer(
        id=id, family_name="テスト", given_name=id, address="テスト",
        location=GeoLocation(lat=31.59, lng=130.55),
    )


def _o(id: str, cid: str, date: str = "2025-01-06", start: str = "09:00", end: str = "10:00") -> Order:
    dow_map = {"2025-01-06": DayOfWeek.MONDAY, "2025-01-07": DayOfWeek.TUESDAY}
    return Order(
        id=id, customer_id=cid, date=date, day_of_week=dow_map[date],
        start_time=start, end_time=end, service_type="physical_care",
    )


class TestUnavailabilityConstraint:
    def test_all_day_unavailable(self) -> None:
        """終日休み → その日のオーダーに割当不可"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1"), _h("H2")],
            orders=[_o("O1", "C1", "2025-01-06")],
            travel_times=[], staff_constraints=[],
            staff_unavailabilities=[
                StaffUnavailability(
                    staff_id="H1", week_start_date="2025-01-06",
                    unavailable_slots=[UnavailableSlot(date="2025-01-06", all_day=True)],
                )
            ],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H1" not in result.assignments[0].staff_ids
        assert "H2" in result.assignments[0].staff_ids

    def test_time_range_unavailable(self) -> None:
        """時間帯指定の休み → その時間帯に割当不可"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1"), _h("H2")],
            orders=[_o("O1", "C1", "2025-01-06", "09:00", "10:00")],
            travel_times=[], staff_constraints=[],
            staff_unavailabilities=[
                StaffUnavailability(
                    staff_id="H1", week_start_date="2025-01-06",
                    unavailable_slots=[
                        UnavailableSlot(date="2025-01-06", all_day=False, start_time="08:00", end_time="12:00"),
                    ],
                )
            ],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H1" not in result.assignments[0].staff_ids

    def test_unavailable_different_day(self) -> None:
        """休みが別の日 → 影響なし"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1")],
            orders=[_o("O1", "C1", "2025-01-06")],
            travel_times=[], staff_constraints=[],
            staff_unavailabilities=[
                StaffUnavailability(
                    staff_id="H1", week_start_date="2025-01-06",
                    unavailable_slots=[UnavailableSlot(date="2025-01-07", all_day=True)],
                )
            ],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H1" in result.assignments[0].staff_ids
