"""ソフト制約の重みパラメータテスト"""

from optimizer.engine.solver import SoftWeights, solve
from optimizer.models import (
    Customer,
    DayOfWeek,
    GeoLocation,
    Helper,
    HoursRange,
    OptimizationInput,
    Order,
    StaffConstraint,
    TravelTime,
)


def _h(id: str, pref_min: float = 4, pref_max: float = 8) -> Helper:
    return Helper(
        id=id, family_name="テスト", given_name=id, can_physical_care=True,
        transportation="car", preferred_hours=HoursRange(min=pref_min, max=pref_max),
        available_hours=HoursRange(min=0, max=40), employment_type="full_time",
    )


def _c(id: str) -> Customer:
    return Customer(
        id=id, family_name="テスト", given_name=id, address="テスト",
        location=GeoLocation(lat=31.59, lng=130.55),
    )


def _o(id: str, cid: str, start: str = "09:00", end: str = "10:00",
       date: str = "2025-01-06", dow: DayOfWeek = DayOfWeek.MONDAY) -> Order:
    return Order(
        id=id, customer_id=cid, date=date, day_of_week=dow,
        start_time=start, end_time=end, service_type="physical_care",
    )


class TestSoftWeightsDefault:
    """デフォルト重みで既存動作と同等"""

    def test_default_weights_produce_optimal(self) -> None:
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp, weights=SoftWeights())
        assert result.status == "Optimal"
        assert len(result.assignments) == 1

    def test_none_weights_uses_default(self) -> None:
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp, weights=None)
        assert result.status == "Optimal"


class TestCustomWeights:
    """カスタム重みでソルバーの挙動が変化する"""

    def test_zero_preferred_staff_weight(self) -> None:
        """推奨スタッフの重みを0にすると推奨が無視される"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1"), _h("H2")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[],
            staff_constraints=[
                StaffConstraint(customer_id="C1", staff_id="H1", constraint_type="preferred"),
            ],
        )
        # 重み=0でも解は得られる
        result = solve(inp, weights=SoftWeights(preferred_staff=0.0))
        assert result.status == "Optimal"
        assert len(result.assignments) == 1

    def test_high_preferred_staff_weight_forces_preferred(self) -> None:
        """推奨スタッフの重みを高くすると推奨スタッフが確実に選ばれる"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1"), _h("H2"), _h("H3")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[],
            staff_constraints=[
                StaffConstraint(customer_id="C1", staff_id="H1", constraint_type="preferred"),
            ],
        )
        result = solve(inp, weights=SoftWeights(preferred_staff=20.0))
        assert result.status == "Optimal"
        assert "H1" in result.assignments[0].staff_ids

    def test_zero_workload_balance_allows_concentration(self) -> None:
        """稼働バランスの重みを0にすると1人に集中してもペナルティなし"""
        inp = OptimizationInput(
            customers=[_c(f"C{i}") for i in range(1, 5)],
            helpers=[_h("H1", 2, 8), _h("H2", 2, 8)],
            orders=[
                _o(f"O{i}", f"C{i}", start=f"{8+i}:00", end=f"{9+i}:00")
                for i in range(1, 5)
            ],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp, weights=SoftWeights(workload_balance=0.0))
        assert result.status == "Optimal"
        assert len(result.assignments) == 4

    def test_zero_continuity_allows_staff_spread(self) -> None:
        """担当継続性の重みを0にしても問題なく解ける"""
        days = [
            (DayOfWeek.MONDAY, "2025-01-06"),
            (DayOfWeek.TUESDAY, "2025-01-07"),
            (DayOfWeek.WEDNESDAY, "2025-01-08"),
            (DayOfWeek.THURSDAY, "2025-01-09"),
        ]
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1"), _h("H2")],
            orders=[
                _o(f"O{i+1}", "C1", date=d, dow=dow) for i, (dow, d) in enumerate(days)
            ],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp, weights=SoftWeights(continuity=0.0))
        assert result.status == "Optimal"
        assert len(result.assignments) == 4

    def test_all_weights_zero_still_feasible(self) -> None:
        """全ソフト制約を無効化（重み0）してもハード制約だけで解ける"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp, weights=SoftWeights(
            travel=0.0, preferred_staff=0.0, workload_balance=0.0, continuity=0.0,
        ))
        assert result.status == "Optimal"

    def test_all_weights_max(self) -> None:
        """全ソフト制約の重みを最大値にしても解ける"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp, weights=SoftWeights(
            travel=20.0, preferred_staff=20.0, workload_balance=20.0, continuity=20.0,
        ))
        assert result.status == "Optimal"

    def test_zero_travel_weight_ignores_distance(self) -> None:
        """移動時間の重みを0にしても解は変わらず得られる"""
        inp = OptimizationInput(
            customers=[_c("C1"), _c("C2")],
            helpers=[_h("H1")],
            orders=[
                _o("O1", "C1", start="09:00", end="10:00"),
                _o("O2", "C2", start="10:30", end="11:30"),
            ],
            travel_times=[
                TravelTime(from_id="C1", to_id="C2", travel_time_minutes=30.0, source="dummy"),
                TravelTime(from_id="C2", to_id="C1", travel_time_minutes=30.0, source="dummy"),
            ],
            staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp, weights=SoftWeights(travel=0.0))
        assert result.status == "Optimal"
        assert len(result.assignments) == 2
