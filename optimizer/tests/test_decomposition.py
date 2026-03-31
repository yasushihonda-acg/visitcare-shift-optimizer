"""曜日分割（decompose_by_day）のテスト

Step 4: solve()を日ごとに分割して順次実行し、メモリ・時間を削減する。
"""

from optimizer.engine.solver import SoftWeights, solve  # noqa: I001
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


DAYS = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY, DayOfWeek.FRIDAY]
DATE_MAP = {
    DayOfWeek.MONDAY: "2026-02-16",
    DayOfWeek.TUESDAY: "2026-02-17",
    DayOfWeek.WEDNESDAY: "2026-02-18",
    DayOfWeek.THURSDAY: "2026-02-19",
    DayOfWeek.FRIDAY: "2026-02-20",
}


def _make_helper(hid: str, **kwargs) -> Helper:
    defaults = dict(
        id=hid,
        family_name=f"H{hid}",
        given_name="太郎",
        can_physical_care=True,
        transportation="car",
        weekly_availability={
            d: [AvailabilitySlot(start_time="08:00", end_time="17:00")]
            for d in DAYS
        },
        preferred_hours=HoursRange(min=0, max=40),
        available_hours=HoursRange(min=0, max=40),
        employment_type="full_time",
    )
    defaults.update(kwargs)
    return Helper(**defaults)


def _make_order(oid: str, cid: str, day: DayOfWeek, **kwargs) -> Order:
    defaults = dict(
        id=oid,
        customer_id=cid,
        date=DATE_MAP[day],
        day_of_week=day,
        start_time="09:00",
        end_time="10:00",
        service_type="daily_living",
    )
    defaults.update(kwargs)
    return Order(**defaults)


def _make_customer(cid: str) -> Customer:
    return Customer(
        id=cid,
        family_name=f"C{cid}",
        given_name="花子",
        address="鹿児島市",
        location=GeoLocation(lat=31.56, lng=130.56),
    )


class TestDecomposeByDay:
    """曜日分割テスト"""

    def test_single_day_same_result(self) -> None:
        """1日のみ入力 → 分割/非分割で同一結果"""
        helpers = [_make_helper("h001"), _make_helper("h002")]
        customers = [_make_customer("c001")]
        orders = [_make_order("o001", "c001", DayOfWeek.MONDAY)]
        inp = OptimizationInput(
            customers=customers, helpers=helpers, orders=orders,
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        # 非分割
        r1 = solve(inp, time_limit_seconds=10, decompose_by_day=False)
        # 分割
        r2 = solve(inp, time_limit_seconds=10, decompose_by_day=True)

        assert r1.status == "Optimal"
        assert r2.status == "Optimal"
        assert len(r1.assignments) == len(r2.assignments)
        assert r1.unassigned_count == r2.unassigned_count

    def test_multi_day_all_assigned(self) -> None:
        """5日間入力 → 全オーダー割当"""
        helpers = [_make_helper("h001"), _make_helper("h002")]
        customers = [_make_customer("c001")]
        orders = [
            _make_order(f"o{i}", "c001", day)
            for i, day in enumerate(DAYS)
        ]
        inp = OptimizationInput(
            customers=customers, helpers=helpers, orders=orders,
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp, time_limit_seconds=30, decompose_by_day=True)
        assert result.status == "Optimal"
        assert len(result.assignments) == 5
        assert result.unassigned_count == 0

    def test_decompose_preserves_overlap_constraint(self) -> None:
        """分割後も同日の重複制約が機能する"""
        helpers = [_make_helper("h001")]
        customers = [_make_customer("c001"), _make_customer("c002")]
        # 同日同時間帯の2オーダー → 1ヘルパーでは1つしか割当不可
        orders = [
            _make_order("o001", "c001", DayOfWeek.MONDAY,
                        start_time="09:00", end_time="10:00"),
            _make_order("o002", "c002", DayOfWeek.MONDAY,
                        start_time="09:00", end_time="10:00"),
        ]
        inp = OptimizationInput(
            customers=customers, helpers=helpers, orders=orders,
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp, time_limit_seconds=10, decompose_by_day=True)
        assert result.status == "Optimal"
        assert result.unassigned_count == 1

    def test_decompose_different_days_independent(self) -> None:
        """異なる日のオーダーは独立して割当"""
        helpers = [_make_helper("h001")]
        customers = [_make_customer("c001"), _make_customer("c002")]
        # 月曜と火曜に1件ずつ → 同一ヘルパーが両方担当可能
        orders = [
            _make_order("o001", "c001", DayOfWeek.MONDAY),
            _make_order("o002", "c002", DayOfWeek.TUESDAY),
        ]
        inp = OptimizationInput(
            customers=customers, helpers=helpers, orders=orders,
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp, time_limit_seconds=10, decompose_by_day=True)
        assert result.status == "Optimal"
        assert len(result.assignments) == 2
        assert result.unassigned_count == 0

    def test_decompose_aggregates_counts(self) -> None:
        """日ごとの未割当数が合算される"""
        helpers = [_make_helper("h001")]
        customers = [_make_customer("c001"), _make_customer("c002")]
        # 月曜: 同時間帯2件（1件未割当）、火曜: 同時間帯2件（1件未割当）
        orders = [
            _make_order("o001", "c001", DayOfWeek.MONDAY,
                        start_time="09:00", end_time="10:00"),
            _make_order("o002", "c002", DayOfWeek.MONDAY,
                        start_time="09:00", end_time="10:00"),
            _make_order("o003", "c001", DayOfWeek.TUESDAY,
                        start_time="09:00", end_time="10:00"),
            _make_order("o004", "c002", DayOfWeek.TUESDAY,
                        start_time="09:00", end_time="10:00"),
        ]
        inp = OptimizationInput(
            customers=customers, helpers=helpers, orders=orders,
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp, time_limit_seconds=10, decompose_by_day=True)
        assert result.status == "Optimal"
        assert result.unassigned_count == 2  # 各日1件ずつ

    def test_decompose_default_is_true(self) -> None:
        """decompose_by_dayのデフォルトはTrue"""
        helpers = [_make_helper("h001")]
        customers = [_make_customer("c001")]
        orders = [_make_order("o001", "c001", DayOfWeek.MONDAY)]
        inp = OptimizationInput(
            customers=customers, helpers=helpers, orders=orders,
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        # デフォルト引数で呼び出し
        result = solve(inp, time_limit_seconds=10)
        assert result.status == "Optimal"
        assert len(result.assignments) == 1

    def test_decompose_with_workload_balance(self) -> None:
        """分割後もワークロードバランスが動作"""
        helpers = [_make_helper("h001"), _make_helper("h002")]
        customers = [_make_customer("c001")]
        orders = [
            _make_order("o001", "c001", DayOfWeek.MONDAY),
            _make_order("o002", "c001", DayOfWeek.TUESDAY),
        ]
        inp = OptimizationInput(
            customers=customers, helpers=helpers, orders=orders,
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        weights = SoftWeights(
            workload_balance=10.0, travel=0,
            preferred_staff=0, continuity=0,
        )
        result = solve(
            inp, time_limit_seconds=10,
            weights=weights, decompose_by_day=True,
        )
        assert result.status == "Optimal"
        assert result.unassigned_count == 0

    def test_empty_day_skipped(self) -> None:
        """オーダーのない日はスキップされる"""
        helpers = [_make_helper("h001")]
        customers = [_make_customer("c001")]
        # 月曜のみオーダーあり（火〜金はなし）
        orders = [_make_order("o001", "c001", DayOfWeek.MONDAY)]
        inp = OptimizationInput(
            customers=customers, helpers=helpers, orders=orders,
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp, time_limit_seconds=10, decompose_by_day=True)
        assert result.status == "Optimal"
        assert len(result.assignments) == 1

    def test_partial_count_aggregated(self) -> None:
        """staff_count=2で1人しか割当できない場合、partial_countが正しく合算"""
        helpers = [_make_helper("h001")]
        customers = [_make_customer("c001")]
        orders = [
            _make_order("o001", "c001", DayOfWeek.MONDAY, staff_count=2),
            _make_order("o002", "c001", DayOfWeek.TUESDAY, staff_count=2),
        ]
        inp = OptimizationInput(
            customers=customers, helpers=helpers, orders=orders,
            travel_times=[], staff_unavailabilities=[], staff_constraints=[],
        )
        result = solve(inp, time_limit_seconds=10, decompose_by_day=True)
        assert result.status == "Optimal"
        assert result.partial_count == 2  # 各日1件ずつ部分割当
