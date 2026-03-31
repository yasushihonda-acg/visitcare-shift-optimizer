"""変数枝刈り（sparse x dict）のテスト

Step 2: infeasibleペアのLpVariable生成をスキップし、
x辞書をfeasible_pairsのみにすることで、メモリと変数数を削減する。
"""

from optimizer.engine.solver import solve, _compute_feasible_pairs, SoftWeights
from optimizer.models import (
    AvailabilitySlot,
    Customer,
    DayOfWeek,
    GeoLocation,
    Helper,
    HoursRange,
    OptimizationInput,
    Order,
    StaffConstraint,
    StaffConstraintType,
)


def _make_helper(hid: str, **kwargs) -> Helper:
    defaults = dict(
        id=hid,
        family_name=f"H{hid}",
        given_name="太郎",
        can_physical_care=True,
        transportation="car",
        weekly_availability={
            DayOfWeek.MONDAY: [AvailabilitySlot(start_time="08:00", end_time="17:00")],
        },
        preferred_hours=HoursRange(min=0, max=40),
        available_hours=HoursRange(min=0, max=40),
        employment_type="full_time",
    )
    defaults.update(kwargs)
    return Helper(**defaults)


def _make_order(oid: str, cid: str = "c001", **kwargs) -> Order:
    defaults = dict(
        id=oid,
        customer_id=cid,
        date="2026-02-16",
        day_of_week=DayOfWeek.MONDAY,
        start_time="09:00",
        end_time="10:00",
        service_type="daily_living",
    )
    defaults.update(kwargs)
    return Order(**defaults)


def _make_customer(cid: str = "c001") -> Customer:
    return Customer(
        id=cid,
        family_name="テスト",
        given_name="花子",
        address="鹿児島市",
        location=GeoLocation(lat=31.56, lng=130.56),
    )


def _make_input(**kwargs) -> OptimizationInput:
    defaults = dict(
        customers=[_make_customer()],
        helpers=[_make_helper("h001")],
        orders=[_make_order("o001")],
        travel_times=[],
        staff_unavailabilities=[],
        staff_constraints=[],
    )
    defaults.update(kwargs)
    return OptimizationInput(**defaults)


class TestVariablePruning:
    """枝刈り後もsolve()が正しく動作する"""

    def test_basic_assignment(self) -> None:
        """基本: 1ヘルパー1オーダー → 割当成功"""
        inp = _make_input()
        result = solve(inp, time_limit_seconds=10)
        assert result.status == "Optimal"
        assert len(result.assignments) == 1
        assert result.assignments[0].staff_ids == ["h001"]

    def test_ng_constraint_prunes_pair(self) -> None:
        """NG制約でペアが枝刈りされても他のヘルパーで割当"""
        inp = _make_input(
            helpers=[_make_helper("h001"), _make_helper("h002")],
            staff_constraints=[
                StaffConstraint(
                    customer_id="c001", staff_id="h001",
                    constraint_type=StaffConstraintType.NG,
                ),
            ],
        )
        result = solve(inp, time_limit_seconds=10)
        assert result.status == "Optimal"
        assert result.assignments[0].staff_ids == ["h002"]

    def test_availability_prunes_pair(self) -> None:
        """可用性なし曜日のペアが枝刈りされる"""
        inp = _make_input(
            helpers=[
                _make_helper("h001", weekly_availability={
                    DayOfWeek.TUESDAY: [AvailabilitySlot(start_time="08:00", end_time="17:00")],
                }),
                _make_helper("h002"),
            ],
        )
        # h001は火曜のみ勤務、オーダーは月曜 → h001は枝刈り
        result = solve(inp, time_limit_seconds=10)
        assert result.status == "Optimal"
        assert result.assignments[0].staff_ids == ["h002"]

    def test_zero_feasible_order_infeasible(self) -> None:
        """全ヘルパーが枝刈りされたオーダー → Infeasible"""
        inp = _make_input(
            helpers=[
                _make_helper("h001", weekly_availability={
                    DayOfWeek.TUESDAY: [AvailabilitySlot(start_time="08:00", end_time="17:00")],
                }),
            ],
        )
        result = solve(inp, time_limit_seconds=10)
        assert result.status == "Infeasible"

    def test_multiple_orders_partial_pruning(self) -> None:
        """複数オーダーで一部が枝刈りされても全体は成功"""
        helpers = [_make_helper("h001"), _make_helper("h002")]
        customers = [_make_customer("c001"), _make_customer("c002")]
        orders = [
            _make_order("o001", "c001", start_time="09:00", end_time="10:00"),
            _make_order("o002", "c002", start_time="09:00", end_time="10:00"),
        ]
        # h001はc001のNG → h001はo001に割当不可
        inp = _make_input(
            helpers=helpers,
            customers=customers,
            orders=orders,
            staff_constraints=[
                StaffConstraint(
                    customer_id="c001", staff_id="h001",
                    constraint_type=StaffConstraintType.NG,
                ),
            ],
        )
        result = solve(inp, time_limit_seconds=10)
        assert result.status == "Optimal"
        assert len(result.assignments) == 2

    def test_variable_count_matches_feasible_pairs(self) -> None:
        """生成される変数数がfeasible_pairs数と一致する"""
        helpers = [_make_helper("h001"), _make_helper("h002"), _make_helper("h003")]
        orders = [_make_order("o001"), _make_order("o002")]
        inp = _make_input(
            helpers=helpers,
            orders=orders,
            staff_constraints=[
                StaffConstraint(
                    customer_id="c001", staff_id="h001",
                    constraint_type=StaffConstraintType.NG,
                ),
            ],
        )
        feasible = _compute_feasible_pairs(inp)
        # h001はc001のNG → o001,o002ともにNG → 2ペア除外
        # total=6, feasible=4
        assert len(feasible) == 4

    def test_overlap_constraint_with_sparse_x(self) -> None:
        """重複制約がsparse辞書でも正しく機能する"""
        helpers = [_make_helper("h001")]
        customers = [_make_customer("c001"), _make_customer("c002")]
        # 同時間帯の2オーダー → 1ヘルパーでは1つしか担当不可
        orders = [
            _make_order("o001", "c001", start_time="09:00", end_time="10:00"),
            _make_order("o002", "c002", start_time="09:00", end_time="10:00"),
        ]
        inp = _make_input(helpers=helpers, customers=customers, orders=orders)
        result = solve(inp, time_limit_seconds=10)
        # 1ヘルパーで同時間帯2オーダーは不可能 → Infeasible
        assert result.status == "Infeasible"

    def test_workload_balance_with_sparse_x(self) -> None:
        """ワークロードバランスがsparse辞書でも動作する"""
        inp = _make_input()
        weights = SoftWeights(workload_balance=10.0, travel=0, preferred_staff=0, continuity=0)
        result = solve(inp, time_limit_seconds=10, weights=weights)
        assert result.status == "Optimal"
