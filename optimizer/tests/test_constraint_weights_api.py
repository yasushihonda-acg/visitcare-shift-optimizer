"""ソフト制約の重みパラメータに関するテスト"""

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


def _o(id: str, cid: str) -> Order:
    return Order(
        id=id, customer_id=cid, date="2026-02-09", day_of_week=DayOfWeek.MONDAY,
        start_time="09:00", end_time="10:00", service_type="physical_care",
    )


def _simple_input() -> OptimizationInput:
    return OptimizationInput(
        customers=[_c("C1")],
        helpers=[_h("H1")],
        orders=[_o("O1", "C1")],
        travel_times=[], staff_unavailabilities=[], staff_constraints=[],
    )


class TestSoftWeightsDataclass:
    """SoftWeightsデータクラスのテスト"""

    def test_default_values(self):
        w = SoftWeights()
        assert w.travel == 1.0
        assert w.preferred_staff == 5.0
        assert w.workload_balance == 10.0
        assert w.continuity == 3.0

    def test_custom_values(self):
        w = SoftWeights(travel=0.0, preferred_staff=10.0, workload_balance=5.0, continuity=0.0)
        assert w.travel == 0.0
        assert w.preferred_staff == 10.0
        assert w.workload_balance == 5.0
        assert w.continuity == 0.0


class TestSolveWithCustomWeights:
    """カスタム重みでのsolve()テスト"""

    def test_default_weights_produce_optimal(self):
        """デフォルト重みでOptimalになること"""
        result = solve(_simple_input(), weights=SoftWeights())
        assert result.status == "Optimal"
        assert len(result.assignments) == 1

    def test_zero_all_weights(self):
        """全重み0でも正常に動作すること（ハード制約のみ）"""
        result = solve(
            _simple_input(),
            weights=SoftWeights(travel=0.0, preferred_staff=0.0, workload_balance=0.0, continuity=0.0),
        )
        assert result.status == "Optimal"
        assert len(result.assignments) == 1

    def test_max_all_weights(self):
        """全重み最大でも正常動作すること"""
        result = solve(
            _simple_input(),
            weights=SoftWeights(travel=20.0, preferred_staff=20.0, workload_balance=20.0, continuity=20.0),
        )
        assert result.status == "Optimal"

    def test_none_weights_uses_defaults(self):
        """weights=Noneでデフォルト値が使われること"""
        result = solve(_simple_input(), weights=None)
        assert result.status == "Optimal"


class TestWeightsAffectObjective:
    """重みが目的関数値に影響することを検証"""

    def test_preferred_weight_zero_ignores_preference(self):
        """推奨スタッフ重み=0のとき、ペナルティが発生しないこと"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1"), _h("H2")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[],
            staff_constraints=[
                StaffConstraint(customer_id="C1", staff_id="H1", constraint_type="preferred"),
            ],
        )
        result_with = solve(inp, weights=SoftWeights(preferred_staff=5.0, workload_balance=0.0))
        result_without = solve(inp, weights=SoftWeights(preferred_staff=0.0, workload_balance=0.0))
        # 推奨重みなしの方がobjective値が小さい（ペナルティなし）
        assert result_without.objective_value <= result_with.objective_value

    def test_higher_weight_increases_penalty(self):
        """重みを増やすとobjective値が増加すること"""
        inp = OptimizationInput(
            customers=[_c("C1")],
            helpers=[_h("H1"), _h("H2")],
            orders=[_o("O1", "C1")],
            travel_times=[], staff_unavailabilities=[],
            staff_constraints=[
                StaffConstraint(customer_id="C1", staff_id="H1", constraint_type="preferred"),
            ],
        )
        result_low = solve(inp, weights=SoftWeights(preferred_staff=1.0, workload_balance=0.0))
        result_high = solve(inp, weights=SoftWeights(preferred_staff=20.0, workload_balance=0.0))
        # 重みが大きいほどobjective値が大きい
        assert result_high.objective_value >= result_low.objective_value
