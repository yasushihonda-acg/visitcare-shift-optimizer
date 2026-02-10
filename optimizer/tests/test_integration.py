"""統合テスト — Seedデータ全量で最適化実行"""

from datetime import date
from pathlib import Path

from optimizer.data.csv_loader import load_optimization_input
from optimizer.engine.solver import _time_to_minutes, solve
from optimizer.models import DayOfWeek, OptimizationInput, StaffConstraintType


def _time_to_min(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _helpers_available_for(o: "Order", helpers: list, inp: OptimizationInput) -> int:
    """オーダーoの時間帯に勤務可能なヘルパー数"""
    os = _time_to_min(o.start_time)
    oe = _time_to_min(o.end_time)
    count = 0
    for h in helpers:
        if not h.weekly_availability:
            count += 1
            continue
        slots = h.weekly_availability.get(o.day_of_week, [])
        if any(
            _time_to_min(s.start_time) <= os and oe <= _time_to_min(s.end_time)
            for s in slots
        ):
            count += 1
    return count


def _filter_feasible_orders(inp: OptimizationInput) -> OptimizationInput:
    """Seedデータの不整合オーダーを除外（テスト用）

    1. 個別にavailableヘルパーが0人のオーダーを除外
    2. 同一日・同時間帯でavailableヘルパー数が同時オーダー数より少ない時間帯のオーダーを間引き
    本番では Seedデータ修正 or 事前バリデーションで対応。
    """
    from optimizer.models import Order

    # Step 1: 個別フィルタ
    step1 = [o for o in inp.orders if _helpers_available_for(o, inp.helpers, inp) >= o.staff_count]

    # Step 2: 時間帯別の同時実行可能性チェック
    # 日付ごとにグループ化
    by_date: dict[str, list[Order]] = {}
    for o in step1:
        by_date.setdefault(o.date, []).append(o)

    feasible: list[Order] = []
    for date_val, day_orders in by_date.items():
        if not day_orders:
            continue
        day = day_orders[0].day_of_week

        # 10分刻みでチェック
        for t in range(6 * 60, 21 * 60, 10):
            concurrent = [o for o in day_orders if _time_to_min(o.start_time) <= t < _time_to_min(o.end_time)]
            if not concurrent:
                continue
            avail = sum(
                1 for h in inp.helpers
                if any(
                    _time_to_min(s.start_time) <= t and t < _time_to_min(s.end_time)
                    for s in h.weekly_availability.get(day, [])
                )
            )
            if len(concurrent) > avail:
                # この時間帯でオーバー → 末尾のオーダーを除外
                excess = len(concurrent) - avail
                for o in concurrent[-excess:]:
                    if o in day_orders:
                        day_orders.remove(o)

        feasible.extend(day_orders)

    return inp.model_copy(update={"orders": feasible})


class TestIntegration:
    def test_seed_data_all_feasible(self, seed_data_dir: Path) -> None:
        """Seedデータの全オーダーが充足可能"""
        inp = load_optimization_input(seed_data_dir, date(2025, 1, 6))
        filtered = _filter_feasible_orders(inp)
        infeasible_count = len(inp.orders) - len(filtered.orders)
        assert infeasible_count == 0, f"不整合オーダーが {infeasible_count} 件存在"
        print(f"\n  All {len(inp.orders)} orders are feasible")

    def test_seed_data_solves(self, seed_data_dir: Path) -> None:
        """Seedデータ全量で解が得られる"""
        inp = load_optimization_input(seed_data_dir, date(2025, 1, 6))
        result = solve(inp, time_limit_seconds=180)
        assert result.status in ("Optimal", "Feasible"), f"Status: {result.status}"
        assert len(result.assignments) == len(inp.orders)

    def test_performance_under_3_minutes(self, seed_data_dir: Path) -> None:
        """3分以内に完了"""
        inp = load_optimization_input(seed_data_dir, date(2025, 1, 6))
        result = solve(inp, time_limit_seconds=180)
        assert result.solve_time_seconds < 180, f"Took {result.solve_time_seconds}s"
        print(f"\n  Solve time: {result.solve_time_seconds:.1f}s")

    def test_all_orders_assigned(self, seed_data_dir: Path) -> None:
        """全オーダーに必要人数分のスタッフが割り当てられている"""
        inp = load_optimization_input(seed_data_dir, date(2025, 1, 6))
        result = solve(inp, time_limit_seconds=180)
        order_map = {o.id: o for o in inp.orders}
        for a in result.assignments:
            expected = order_map[a.order_id].staff_count
            assert len(a.staff_ids) == expected, (
                f"Order {a.order_id}: expected {expected} staff, got {len(a.staff_ids)}"
            )

    def test_no_qualification_violation(self, seed_data_dir: Path) -> None:
        """身体介護に無資格者が割り当てられていない"""
        inp = load_optimization_input(seed_data_dir, date(2025, 1, 6))
        result = solve(inp, time_limit_seconds=180)
        helper_map = {h.id: h for h in inp.helpers}
        order_map = {o.id: o for o in inp.orders}
        for a in result.assignments:
            order = order_map[a.order_id]
            if order.service_type.value == "physical_care":
                for sid in a.staff_ids:
                    assert helper_map[sid].can_physical_care, (
                        f"Unqualified {sid} assigned to physical_care {a.order_id}"
                    )

    def test_no_overlap_violation(self, seed_data_dir: Path) -> None:
        """同一ヘルパーの時間帯重複がない"""
        inp = load_optimization_input(seed_data_dir, date(2025, 1, 6))
        result = solve(inp, time_limit_seconds=180)
        order_map = {o.id: o for o in inp.orders}

        helper_orders: dict[str, list[str]] = {}
        for a in result.assignments:
            for sid in a.staff_ids:
                helper_orders.setdefault(sid, []).append(a.order_id)

        for hid, order_ids in helper_orders.items():
            orders = [order_map[oid] for oid in order_ids]
            for i, o1 in enumerate(orders):
                for o2 in orders[i + 1 :]:
                    if o1.date != o2.date:
                        continue
                    s1, e1 = _time_to_minutes(o1.start_time), _time_to_minutes(o1.end_time)
                    s2, e2 = _time_to_minutes(o2.start_time), _time_to_minutes(o2.end_time)
                    assert not (s1 < e2 and s2 < e1), (
                        f"Overlap: {hid} assigned {o1.id}({o1.start_time}-{o1.end_time}) "
                        f"and {o2.id}({o2.start_time}-{o2.end_time}) on {o1.date}"
                    )

    def test_no_ng_staff_violation(self, seed_data_dir: Path) -> None:
        """NGスタッフが割り当てられていない"""
        inp = load_optimization_input(seed_data_dir, date(2025, 1, 6))
        result = solve(inp, time_limit_seconds=180)
        order_map = {o.id: o for o in inp.orders}

        ng_pairs: set[tuple[str, str]] = set()
        for sc in inp.staff_constraints:
            if sc.constraint_type == StaffConstraintType.NG:
                ng_pairs.add((sc.customer_id, sc.staff_id))

        for a in result.assignments:
            cid = order_map[a.order_id].customer_id
            for sid in a.staff_ids:
                assert (cid, sid) not in ng_pairs, (
                    f"NG pair: customer={cid}, staff={sid} in {a.order_id}"
                )

    def test_result_summary(self, seed_data_dir: Path) -> None:
        """結果のサマリーを出力"""
        inp = load_optimization_input(seed_data_dir, date(2025, 1, 6))
        result = solve(inp, time_limit_seconds=180)

        helper_counts: dict[str, int] = {}
        for a in result.assignments:
            for sid in a.staff_ids:
                helper_counts[sid] = helper_counts.get(sid, 0) + 1

        print(f"\n  === 統合テスト結果サマリー ===")
        print(f"  Status: {result.status}")
        print(f"  Objective: {result.objective_value:.2f}")
        print(f"  Solve time: {result.solve_time_seconds:.1f}s")
        print(f"  Orders: {len(inp.orders)}")
        print(f"  Helpers: {len(inp.helpers)}")
        print(f"  Helpers used: {len(helper_counts)}")
        if helper_counts:
            print(f"  Avg orders/helper: {sum(helper_counts.values()) / len(helper_counts):.1f}")
            print(f"  Min/Max: {min(helper_counts.values())}/{max(helper_counts.values())}")
