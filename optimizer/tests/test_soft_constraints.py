"""ソフト制約のテスト — 推奨スタッフ優先"""

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


def _c(id: str) -> Customer:
    return Customer(
        id=id, family_name="テスト", given_name=id, address="テスト",
        location=GeoLocation(lat=31.59, lng=130.55),
        preferred_staff_ids=["H1"],
    )


def _o(id: str, cid: str) -> Order:
    return Order(
        id=id, customer_id=cid, date="2025-01-06", day_of_week=DayOfWeek.MONDAY,
        start_time="09:00", end_time="10:00", service_type="physical_care",
    )


class TestPreferredStaffSoftConstraint:
    def test_preferred_staff_chosen(self) -> None:
        """推奨スタッフが優先的に選ばれる"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1"), _h("H2"), _h("H3")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[],
            staff_constraints=[
                StaffConstraint(customer_id="C1", staff_id="H1", constraint_type="preferred"),
            ],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        # 推奨スタッフH1が優先される
        assert "H1" in result.assignments[0].staff_ids

    def test_non_preferred_used_when_preferred_unavailable(self) -> None:
        """推奨スタッフがNG等で使えない場合は非推奨が使われる（ソフト制約）"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1"), _h("H2")],
            orders=[
                _o("O1", "C1"),
                Order(
                    id="O2", customer_id="C1", date="2025-01-06",
                    day_of_week=DayOfWeek.MONDAY, start_time="09:00",
                    end_time="10:00", service_type="physical_care",
                ),  # 同時刻の別オーダー → H1は1つしか担当できない
            ],
            travel_times=[], staff_unavailabilities=[],
            staff_constraints=[
                StaffConstraint(customer_id="C1", staff_id="H1", constraint_type="preferred"),
            ],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        # 少なくとも1つはH1が担当
        all_staff = [s for a in result.assignments for s in a.staff_ids]
        assert "H1" in all_staff
