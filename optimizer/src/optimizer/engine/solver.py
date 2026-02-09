"""MIPソルバー — PuLP + CBC"""

import time

import pulp

from optimizer.models import (
    Assignment,
    OptimizationInput,
    OptimizationResult,
    Order,
)


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
) -> OptimizationResult:
    """最適化を実行し、結果を返す"""
    start_time = time.time()

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
    objective = _build_objective(x, inp, travel_lookup)
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
) -> pulp.LpAffineExpression:
    """重み付き目的関数の構築

    w1: 移動時間最小化
    w2: 非推奨スタッフペナルティ
    """
    W_TRAVEL = 1.0
    W_NOT_PREFERRED = 5.0  # 推奨スタッフでない場合のペナルティ

    objective = pulp.LpAffineExpression()

    # --- 1. 移動時間最小化（線形近似） ---
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
                        objective += W_TRAVEL * tt * (x[h.id, o1.id] + x[h.id, o2.id]) / 2

    # --- 2. 推奨スタッフ優先 ---
    # 推奨スタッフペアをセット化
    preferred_pairs: set[tuple[str, str]] = set()
    for sc in inp.staff_constraints:
        if sc.constraint_type.value == "preferred":
            preferred_pairs.add((sc.customer_id, sc.staff_id))

    # 推奨設定がある利用者のオーダーで、非推奨スタッフにペナルティ
    customers_with_preferred: set[str] = {cid for cid, _ in preferred_pairs}
    for o in inp.orders:
        if o.customer_id not in customers_with_preferred:
            continue
        for h in inp.helpers:
            if (o.customer_id, h.id) not in preferred_pairs:
                objective += W_NOT_PREFERRED * x[h.id, o.id]

    return objective
