"""MIPソルバー — PuLP + CBC"""

import time
from dataclasses import dataclass

import pulp

from optimizer.models import (
    Assignment,
    OptimizationInput,
    OptimizationResult,
    Order,
    StaffConstraintType,
)


@dataclass
class SoftWeights:
    """ソフト制約の重み"""

    travel: float = 1.0
    preferred_staff: float = 5.0
    workload_balance: float = 10.0
    continuity: float = 3.0


def _time_to_minutes(time_str: str) -> int:
    """"HH:MM" → 分換算"""
    h, m = time_str.split(":")
    return int(h) * 60 + int(m)


def _orders_overlap(o1: Order, o2: Order) -> bool:
    """2つのオーダーが同日かつ時間帯重複するか判定"""
    if o1.date != o2.date:
        return False
    s1, e1 = _time_to_minutes(o1.start_time), _time_to_minutes(o1.end_time)
    s2, e2 = _time_to_minutes(o2.start_time), _time_to_minutes(o2.end_time)
    return s1 < e2 and s2 < e1


def _build_travel_time_lookup(
    inp: OptimizationInput,
) -> dict[tuple[str, str], float]:
    """(from_id, to_id) → 移動時間（分）のルックアップ"""
    return {(tt.from_id, tt.to_id): tt.travel_time_minutes for tt in inp.travel_times}


def solve(
    inp: OptimizationInput,
    time_limit_seconds: int = 180,
    weights: SoftWeights | None = None,
) -> OptimizationResult:
    """最適化を実行し、結果を返す"""
    start_time = time.time()
    w = weights or SoftWeights()

    helpers = inp.helpers
    orders = inp.orders
    travel_lookup = _build_travel_time_lookup(inp)

    # --- モデル作成 ---
    prob = pulp.LpProblem("shift_optimization", pulp.LpMinimize)

    # --- 決定変数: x[h_id, o_id] = ヘルパーhをオーダーoに割り当てるか ---
    x: dict[tuple[str, str], pulp.LpVariable] = {}
    for h in helpers:
        for o in orders:
            x[h.id, o.id] = pulp.LpVariable(f"x_{h.id}_{o.id}", cat="Binary")

    # --- 基本制約: 各オーダーに必要人数を割り当てる ---
    for o in orders:
        prob += (
            pulp.lpSum(x[h.id, o.id] for h in helpers) == o.staff_count,
            f"assign_{o.id}",
        )

    # --- 制約の追加（外部から呼べるよう分離） ---
    _add_constraints(prob, x, inp, travel_lookup)

    # --- 目的関数: 重み付き加算 ---
    objective = _build_objective(x, inp, travel_lookup, prob, w)
    prob += objective, "total_cost"

    # --- ソルバー実行 ---
    solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=time_limit_seconds)
    prob.solve(solver)

    solve_time = time.time() - start_time

    # --- 結果の組み立て ---
    status_map = {
        pulp.constants.LpStatusOptimal: "Optimal",
        pulp.constants.LpStatusNotSolved: "Not Solved",
        pulp.constants.LpStatusInfeasible: "Infeasible",
        pulp.constants.LpStatusUnbounded: "Unbounded",
    }
    status = status_map.get(prob.status, "Unknown")

    assignments: list[Assignment] = []
    if prob.status == pulp.constants.LpStatusOptimal:
        for o in orders:
            staff_ids = [h.id for h in helpers if pulp.value(x[h.id, o.id]) > 0.5]
            assignments.append(Assignment(order_id=o.id, staff_ids=staff_ids))

    return OptimizationResult(
        assignments=assignments,
        objective_value=pulp.value(prob.objective) or 0.0,
        solve_time_seconds=round(solve_time, 3),
        status=status,
    )


def _add_constraints(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
    travel_lookup: dict[tuple[str, str], float],
) -> None:
    """全制約を追加するエントリポイント"""
    from optimizer.engine.constraints import add_all_hard_constraints

    add_all_hard_constraints(prob, x, inp, travel_lookup)


def _build_objective(
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
    travel_lookup: dict[tuple[str, str], float],
    prob: pulp.LpProblem,
    w: SoftWeights | None = None,
) -> pulp.LpAffineExpression:
    """重み付き目的関数の構築

    w.travel: 移動時間最小化
    w.preferred_staff: 非推奨スタッフペナルティ
    w.workload_balance: 稼働バランス（preferred_hours乖離ペナルティ）
    w.continuity: 担当継続性（同一利用者のスタッフ分散ペナルティ）
    """
    if w is None:
        w = SoftWeights()

    objective = pulp.LpAffineExpression()

    # --- 1. 移動時間最小化（線形近似） ---
    if w.travel > 0:
        orders_by_date: dict[str, list[Order]] = {}
        for o in inp.orders:
            orders_by_date.setdefault(o.date, []).append(o)

        for h in inp.helpers:
            for date_orders in orders_by_date.values():
                for i, o1 in enumerate(date_orders):
                    for o2 in date_orders[i + 1 :]:
                        c1, c2 = o1.customer_id, o2.customer_id
                        if c1 == c2:
                            continue
                        tt = travel_lookup.get((c1, c2), 0.0)
                        if tt > 0:
                            objective += w.travel * tt * (x[h.id, o1.id] + x[h.id, o2.id]) / 2

    # --- 2. 推奨スタッフ優先 ---
    if w.preferred_staff > 0:
        preferred_pairs: set[tuple[str, str]] = set()
        for sc in inp.staff_constraints:
            if sc.constraint_type == StaffConstraintType.PREFERRED:
                preferred_pairs.add((sc.customer_id, sc.staff_id))

        customers_with_preferred: set[str] = {cid for cid, _ in preferred_pairs}
        for o in inp.orders:
            if o.customer_id not in customers_with_preferred:
                continue
            for h in inp.helpers:
                if (o.customer_id, h.id) not in preferred_pairs:
                    objective += w.preferred_staff * x[h.id, o.id]

    # --- 3. 稼働バランス（preferred_hours乖離ペナルティ） ---
    if w.workload_balance > 0:
        _add_workload_balance(prob, x, inp, objective, w.workload_balance)

    # --- 4. 担当継続性（同一利用者のスタッフ分散ペナルティ） ---
    if w.continuity > 0:
        _add_staff_continuity(prob, x, inp, objective, w.continuity)

    return objective


def _add_workload_balance(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
    objective: pulp.LpAffineExpression,
    weight: float,
) -> None:
    """稼働バランス: 各ヘルパーの合計稼働時間がpreferred_hoursを超過した分にペナルティ

    over_h: preferred_hours.max を超えた時間（分）
    under_h: preferred_hours.min を下回った時間（分）
    """
    for h in inp.helpers:
        # 各ヘルパーの合計稼働時間（分）
        total_minutes = pulp.lpSum(
            (_time_to_minutes(o.end_time) - _time_to_minutes(o.start_time)) * x[h.id, o.id]
            for o in inp.orders
        )

        pref_max_min = h.preferred_hours.max * 60
        pref_min_min = h.preferred_hours.min * 60

        # 超過スラック変数
        over = pulp.LpVariable(f"over_{h.id}", lowBound=0)
        prob += over >= total_minutes - pref_max_min, f"over_def_{h.id}"

        # 不足スラック変数
        under = pulp.LpVariable(f"under_{h.id}", lowBound=0)
        prob += under >= pref_min_min - total_minutes, f"under_def_{h.id}"

        # 超過・不足にペナルティ（超過のほうが深刻なので2倍重み）
        objective += weight * 2.0 * over
        objective += weight * under


def _add_staff_continuity(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
    objective: pulp.LpAffineExpression,
    weight: float,
) -> None:
    """担当継続性: 同一利用者の複数オーダーを異なるスタッフに割り当てるとペナルティ

    y[c,h] = ヘルパーhが利用者cの少なくとも1件を担当するか（連続変数0-1）
    → y[c,h]の合計を最小化 = 担当スタッフ数を最小化

    計算効率のため、3件以上のオーダーを持つ利用者のみ対象とし、
    資格・曜日で明らかに不可能なヘルパーは除外する。
    """
    orders_by_customer: dict[str, list[Order]] = {}
    for o in inp.orders:
        orders_by_customer.setdefault(o.customer_id, []).append(o)

    # ヘルパーの曜日別勤務可能セットを事前計算
    helper_available_days: dict[str, set[str]] = {}
    for h in inp.helpers:
        if h.weekly_availability:
            helper_available_days[h.id] = {
                dow.value for dow in h.weekly_availability.keys()
            }
        else:
            helper_available_days[h.id] = set()  # 未定義=全日可能は別扱い

    for cid, customer_orders in orders_by_customer.items():
        if len(customer_orders) < 4:
            continue  # 3件以下はスキップ（計算効率・変数数削減）

        # この利用者のオーダー曜日
        order_days = {o.day_of_week.value for o in customer_orders}

        for h in inp.helpers:
            # 明らかに割当不可能なヘルパーはスキップ
            avail_days = helper_available_days[h.id]
            if avail_days and not order_days & avail_days:
                continue  # この利用者の曜日に一切勤務しない

            y = pulp.LpVariable(f"y_{cid}_{h.id}", lowBound=0, upBound=1)

            for o in customer_orders:
                prob += y >= x[h.id, o.id], f"cont_y_{cid}_{h.id}_{o.id}"

            objective += weight * y
