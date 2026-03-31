"""カバレッジ制約緩和のテスト

Step 3: == staff_count → <= staff_count + 高ペナルティ
feasible時は完全割当を保証し、infeasible時はgraceful degradationする。
"""

from optimizer.engine.solver import SoftWeights, solve
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


class TestSoftCoverage:
    """カバレッジ制約緩和テスト"""

    def test_feasible_full_assignment(self) -> None:
        """feasible時は全オーダーに完全割当（staff_count人）"""
        inp = _make_input(
            helpers=[_make_helper("h001"), _make_helper("h002")],
            orders=[
                _make_order("o001"),
                _make_order("o002", "c001", start_time="11:00", end_time="12:00"),
            ],
        )
        result = solve(inp, time_limit_seconds=10)
        assert result.status == "Optimal"
        assert len(result.assignments) == 2
        # 全オーダーにstaff_count=1分のスタッフが割当
        for a in result.assignments:
            assert len(a.staff_ids) >= 1

    def test_infeasible_becomes_feasible(self) -> None:
        """以前Infeasibleだったケース → Optimalでpartial割当"""
        # 全ヘルパーが火曜のみ → 月曜のオーダーには誰も割当できない
        inp = _make_input(
            helpers=[
                _make_helper("h001", weekly_availability={
                    DayOfWeek.TUESDAY: [AvailabilitySlot(start_time="08:00", end_time="17:00")],
                }),
            ],
        )
        result = solve(inp, time_limit_seconds=10)
        # 緩和後はInfeasibleではなく、Optimalで未割当として返る
        assert result.status == "Optimal"
        assert result.unassigned_count == 1  # 1オーダーが未割当

    def test_partial_assignment_count(self) -> None:
        """staff_count=2のオーダーに1人しか割当できない → partial_count=1"""
        inp = _make_input(
            helpers=[_make_helper("h001")],
            orders=[_make_order("o001", staff_count=2)],
        )
        result = solve(inp, time_limit_seconds=10)
        assert result.status == "Optimal"
        # 1人は割当されるが、2人目は無理
        assert result.partial_count == 1

    def test_unassigned_count_zero_when_feasible(self) -> None:
        """feasibleな場合はunassigned_count=0"""
        inp = _make_input()
        result = solve(inp, time_limit_seconds=10)
        assert result.status == "Optimal"
        assert result.unassigned_count == 0
        assert result.partial_count == 0

    def test_penalty_ensures_full_coverage_when_possible(self) -> None:
        """ペナルティが十分大きく、feasibleなら必ず完全割当"""
        helpers = [_make_helper(f"h{i:03d}") for i in range(5)]
        customers = [_make_customer(f"c{i:03d}") for i in range(3)]
        orders = [
            _make_order("o001", "c000", start_time="09:00", end_time="10:00"),
            _make_order("o002", "c001", start_time="09:00", end_time="10:00"),
            _make_order("o003", "c002", start_time="09:00", end_time="10:00"),
        ]
        inp = _make_input(helpers=helpers, customers=customers, orders=orders)
        result = solve(inp, time_limit_seconds=10)
        assert result.status == "Optimal"
        assert result.unassigned_count == 0
        assert result.partial_count == 0
        # 全オーダーにスタッフが割当されている
        for a in result.assignments:
            assert len(a.staff_ids) == 1

    def test_overlap_forces_partial(self) -> None:
        """1ヘルパーで同時間帯2オーダー → 1つは未割当"""
        helpers = [_make_helper("h001")]
        customers = [_make_customer("c001"), _make_customer("c002")]
        orders = [
            _make_order("o001", "c001", start_time="09:00", end_time="10:00"),
            _make_order("o002", "c002", start_time="09:00", end_time="10:00"),
        ]
        inp = _make_input(helpers=helpers, customers=customers, orders=orders)
        result = solve(inp, time_limit_seconds=10)
        # 以前はInfeasible、緩和後はOptimalで1つ未割当
        assert result.status == "Optimal"
        assert result.unassigned_count == 1

    def test_ng_constraint_forces_unassigned(self) -> None:
        """唯一のヘルパーがNG → そのオーダーは未割当"""
        inp = _make_input(
            staff_constraints=[
                StaffConstraint(
                    customer_id="c001", staff_id="h001",
                    constraint_type=StaffConstraintType.NG,
                ),
            ],
        )
        result = solve(inp, time_limit_seconds=10)
        assert result.status == "Optimal"
        assert result.unassigned_count == 1

    def test_mixed_feasible_and_infeasible_orders(self) -> None:
        """一部feasible + 一部infeasible → feasibleは割当、infeasibleは未割当"""
        helpers = [_make_helper("h001")]
        customers = [_make_customer("c001"), _make_customer("c002")]
        orders = [
            # o001: 月曜 → h001が割当可能
            _make_order("o001", "c001", start_time="09:00", end_time="10:00"),
            # o002: 月曜同時間帯 → h001は重複で割当不可
            _make_order("o002", "c002", start_time="09:00", end_time="10:00"),
            # o003: 月曜別時間帯 → h001が割当可能
            _make_order("o003", "c001", start_time="11:00", end_time="12:00"),
        ]
        inp = _make_input(helpers=helpers, customers=customers, orders=orders)
        result = solve(inp, time_limit_seconds=10)
        assert result.status == "Optimal"
        # 3オーダー中、2つは割当、1つは重複で未割当
        assigned = [a for a in result.assignments if len(a.staff_ids) > 0]
        unassigned = [a for a in result.assignments if len(a.staff_ids) == 0]
        assert len(assigned) == 2
        assert len(unassigned) == 1

    def test_staff_count_anomaly_no_crash(self) -> None:
        """staff_count=7（本番データの異常値）→ クラッシュせず部分割当"""
        helpers = [_make_helper(f"h{i:03d}") for i in range(3)]
        orders = [_make_order("o001", staff_count=7)]
        inp = _make_input(helpers=helpers, orders=orders)
        result = solve(inp, time_limit_seconds=10)
        # 3ヘルパーしかいないので7人割当は不可能 → 部分割当
        assert result.status == "Optimal"
        assert result.partial_count == 1
        # 割当された人数は3以下
        assert len(result.assignments[0].staff_ids) <= 3

    def test_workload_balance_still_works(self) -> None:
        """ワークロードバランスが緩和後も動作する"""
        inp = _make_input(
            helpers=[_make_helper("h001"), _make_helper("h002")],
        )
        weights = SoftWeights(workload_balance=10.0, travel=0, preferred_staff=0, continuity=0)
        result = solve(inp, time_limit_seconds=10, weights=weights)
        assert result.status == "Optimal"
        assert result.unassigned_count == 0
