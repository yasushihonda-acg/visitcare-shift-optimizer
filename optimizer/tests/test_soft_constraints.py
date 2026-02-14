"""ソフト制約のテスト — 推奨スタッフ優先、稼働バランス、担当継続性"""

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

from optimizer.engine.solver import _time_to_minutes


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


class TestWorkloadBalanceSoftConstraint:
    """稼働バランス — preferred_hoursの乖離にペナルティ"""

    def _make_helper(self, id: str, pref_min: float, pref_max: float) -> Helper:
        return Helper(
            id=id, family_name="テスト", given_name=id, can_physical_care=True,
            transportation="car", preferred_hours=HoursRange(min=pref_min, max=pref_max),
            available_hours=HoursRange(min=0, max=40), employment_type="full_time",
        )

    def test_workload_distributed_evenly(self) -> None:
        """同じpreferred_hoursのヘルパーには均等に配分される（複数利用者）"""
        helpers = [self._make_helper(f"H{i}", 2, 4) for i in range(1, 4)]
        customers = [
            Customer(
                id=f"C{i}", family_name="テスト", given_name=f"C{i}", address="テスト",
                location=GeoLocation(lat=31.59, lng=130.55),
            )
            for i in range(1, 7)
        ]
        # 6利用者×各1時間 = 6時間分を3人に → 各2時間が理想
        orders = [
            Order(
                id=f"O{i}", customer_id=f"C{i}", date="2025-01-06",
                day_of_week=DayOfWeek.MONDAY,
                start_time=f"{8+i}:00", end_time=f"{9+i}:00",
                service_type="physical_care",
            )
            for i in range(1, 7)
        ]
        inp = OptimizationInput(
            customers=customers, helpers=helpers, orders=orders,
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        counts = {h.id: 0 for h in helpers}
        for a in result.assignments:
            for sid in a.staff_ids:
                counts[sid] += 1
        # 1人に6件集中しない（最大でも3件以下）
        assert max(counts.values()) <= 3, f"偏り過ぎ: {counts}"
        # 全員に1件以上割当
        assert min(counts.values()) >= 1, f"未割当あり: {counts}"

    def test_prefer_within_preferred_hours(self) -> None:
        """preferred_hoursが少ないヘルパーにオーダーを集中させない"""
        # H1: 希望2-3h, H2: 希望6-8h
        h1 = self._make_helper("H1", 2, 3)
        h2 = self._make_helper("H2", 6, 8)
        customer = Customer(
            id="C1", family_name="テスト", given_name="C1", address="テスト",
            location=GeoLocation(lat=31.59, lng=130.55),
        )
        # 7件×1時間 = 7時間分 → H1に2-3h, H2に4-5h が理想
        orders = [
            Order(
                id=f"O{i}", customer_id="C1", date="2025-01-06",
                day_of_week=DayOfWeek.MONDAY,
                start_time=f"{8+i}:00", end_time=f"{9+i}:00",
                service_type="physical_care",
            )
            for i in range(7)
        ]
        inp = OptimizationInput(
            customers=[customer], helpers=[h1, h2], orders=orders,
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        h1_count = sum(1 for a in result.assignments if "H1" in a.staff_ids)
        h2_count = sum(1 for a in result.assignments if "H2" in a.staff_ids)
        # H1は最大4件（4h）まで、H2は少なくとも3件
        assert h1_count <= 4, f"H1(希望2-3h)に{h1_count}h集中"
        assert h2_count >= 3, f"H2(希望6-8h)に{h2_count}hしか割当なし"


class TestStaffContinuitySoftConstraint:
    """担当継続性 — 同一利用者のオーダーは同一スタッフ優先"""

    def test_same_customer_same_staff(self) -> None:
        """同一利用者の複数オーダーは同じスタッフに割り当てられやすい"""
        helpers = [
            Helper(
                id=f"H{i}", family_name="テスト", given_name=f"H{i}",
                can_physical_care=True, transportation="car",
                preferred_hours=HoursRange(min=4, max=8),
                available_hours=HoursRange(min=0, max=40),
                employment_type="full_time",
            )
            for i in range(1, 4)
        ]
        customer = Customer(
            id="C1", family_name="テスト", given_name="C1", address="テスト",
            location=GeoLocation(lat=31.59, lng=130.55),
        )
        # C1の月〜金オーダー（各日1件）→ 同一スタッフが担当すべき
        days = [
            (DayOfWeek.MONDAY, "2025-01-06"),
            (DayOfWeek.TUESDAY, "2025-01-07"),
            (DayOfWeek.WEDNESDAY, "2025-01-08"),
            (DayOfWeek.THURSDAY, "2025-01-09"),
            (DayOfWeek.FRIDAY, "2025-01-10"),
        ]
        orders = [
            Order(
                id=f"O{i+1}", customer_id="C1", date=d,
                day_of_week=dow, start_time="09:00", end_time="10:00",
                service_type="physical_care",
            )
            for i, (dow, d) in enumerate(days)
        ]
        inp = OptimizationInput(
            customers=[customer], helpers=helpers, orders=orders,
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp)
        assert result.status == "Optimal"
        # 担当スタッフの種類を確認: 全5件が1人に集中すべき
        staff_set = set()
        for a in result.assignments:
            for sid in a.staff_ids:
                staff_set.add(sid)
        # 担当者数は1-2人以内（3人に分散するのはNG）
        assert len(staff_set) <= 2, f"担当が{len(staff_set)}人に分散: {staff_set}"
