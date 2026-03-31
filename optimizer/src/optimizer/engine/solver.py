"""MIPソルバー — PuLP + CBC"""

import logging
import time
from dataclasses import dataclass, field

import pulp

from optimizer.models import (
    Assignment,
    GenderRequirement,
    OptimizationInput,
    OptimizationResult,
    Order,
    StaffConstraintType,
)

logger = logging.getLogger(__name__)


@dataclass
class SoftWeights:
    """ソフト制約の重み"""

    travel: float = 1.0
    preferred_staff: float = 5.0
    workload_balance: float = 10.0
    continuity: float = 3.0


@dataclass
class InfeasibilityDiagnosis:
    """Infeasibility診断結果"""

    # feasible_pairsが0件のオーダー（どのヘルパーも割当不可）
    zero_feasible_orders: list[str] = field(default_factory=list)
    # ソフト解で staff_count を一切満たせなかったオーダー
    unassigned_orders: list[str] = field(default_factory=list)
    # ソフト解で staff_count を部分的にしか満たせなかったオーダー
    partially_assigned_orders: list[str] = field(default_factory=list)


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
    """(from_id, to_id) → 移動時間（分）のルックアップ

    同一世帯・同一施設の利用者ペアは移動時間0にオーバーライドする。
    """
    lookup = {(tt.from_id, tt.to_id): tt.travel_time_minutes for tt in inp.travel_times}

    # 同一世帯/施設グループを構築し、グループ内ペアの移動時間を0にする
    for c in inp.customers:
        related = set(c.same_household_customer_ids) | set(c.same_facility_customer_ids)
        for other_id in related:
            lookup[(c.id, other_id)] = 0.0
            lookup[(other_id, c.id)] = 0.0

    return lookup


def _compute_feasible_pairs(inp: OptimizationInput) -> set[tuple[str, str]]:
    """割当可能な(helper_id, order_id)ペアを事前計算

    資格制約・性別制約・勤務可能日・勤務可能時間帯・NGスタッフを考慮し、
    明らかに割当不可能なペアを除外する。
    """
    # NGペアの事前計算
    ng_pairs: set[tuple[str, str]] = set()
    for sc in inp.staff_constraints:
        if sc.constraint_type == StaffConstraintType.NG:
            ng_pairs.add((sc.customer_id, sc.staff_id))

    # 資格が必要なservice_typeのセットをマスタデータから構築
    _cert_required: set[str] = {c.code for c in inp.service_type_configs if c.requires_physical_care_cert} if inp.service_type_configs else set()

    # 顧客マップ（customer_id → Customer）
    customer_map = {c.id: c for c in inp.customers}

    feasible: set[tuple[str, str]] = set()
    for h in inp.helpers:
        for o in inp.orders:
            # 資格チェック: 無資格者は資格必要な種別に割当不可
            if not h.can_physical_care and o.service_type in _cert_required:
                continue
            # NGスタッフチェック
            if (o.customer_id, h.id) in ng_pairs:
                continue
            # 性別制約チェック
            customer = customer_map.get(o.customer_id)
            if customer and customer.gender_requirement != GenderRequirement.ANY:
                if h.gender.value != customer.gender_requirement.value:
                    continue
            # 勤務可能日チェック
            if h.weekly_availability:
                slots = h.weekly_availability.get(o.day_of_week, [])
                if not slots:
                    continue
                # 勤務時間帯チェック
                order_start = _time_to_minutes(o.start_time)
                order_end = _time_to_minutes(o.end_time)
                covered = any(
                    _time_to_minutes(s.start_time) <= order_start
                    and order_end <= _time_to_minutes(s.end_time)
                    for s in slots
                )
                if not covered:
                    continue
            feasible.add((h.id, o.id))
    return feasible


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

    # --- 割当可能ペアの事前計算（変数枝刈り） ---
    feasible_pairs = _compute_feasible_pairs(inp)

    # --- 決定変数: feasibleペアのみ生成（メモリ削減） ---
    x: dict[tuple[str, str], pulp.LpVariable] = {}
    for h_id, o_id in feasible_pairs:
        x[h_id, o_id] = pulp.LpVariable(f"x_{h_id}_{o_id}", cat="Binary")

    # --- 基本制約: カバレッジ（<= staff_count + ペナルティで緩和） ---
    COVERAGE_PENALTY = 1000  # 未割当1人あたりのペナルティ（他重みの100倍以上）
    unmet: dict[str, pulp.LpVariable] = {}  # order_id → 不足人数
    for o in orders:
        assigned_sum = pulp.lpSum(x.get((h.id, o.id), 0) for h in helpers)
        # 割当人数 <= staff_count（上限制約）
        prob += assigned_sum <= o.staff_count, f"assign_upper_{o.id}"
        # 不足人数のスラック変数: unmet_o >= staff_count - assigned_sum
        u = pulp.LpVariable(f"unmet_{o.id}", lowBound=0, cat="Integer")
        prob += u >= o.staff_count - assigned_sum, f"unmet_def_{o.id}"
        unmet[o.id] = u

    # --- 制約の追加（外部から呼べるよう分離） ---
    _add_constraints(prob, x, inp, travel_lookup)

    # --- 目的関数: 重み付き加算 + カバレッジペナルティ ---
    objective = _build_objective(x, inp, travel_lookup, prob, w)
    coverage_penalty = pulp.lpSum(COVERAGE_PENALTY * unmet[o.id] for o in orders)
    prob += objective + coverage_penalty, "total_cost"

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
    unassigned_count = 0
    partial_count = 0
    if prob.status == pulp.constants.LpStatusOptimal:
        for o in orders:
            staff_ids = [
                h.id for h in helpers
                if (h.id, o.id) in x and pulp.value(x[h.id, o.id]) > 0.5
            ]
            assignments.append(Assignment(order_id=o.id, staff_ids=staff_ids))
            if len(staff_ids) == 0:
                unassigned_count += 1
            elif len(staff_ids) < o.staff_count:
                partial_count += 1

    return OptimizationResult(
        assignments=assignments,
        objective_value=pulp.value(prob.objective) or 0.0,
        solve_time_seconds=round(solve_time, 3),
        status=status,
        unassigned_count=unassigned_count,
        partial_count=partial_count,
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
                            v1 = x.get((h.id, o1.id), 0)
                            v2 = x.get((h.id, o2.id), 0)
                            if v1 != 0 or v2 != 0:
                                objective += w.travel * tt * (v1 + v2) / 2

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
                    v = x.get((h.id, o.id), 0)
                    if v != 0:
                        objective += w.preferred_staff * v

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
            (_time_to_minutes(o.end_time) - _time_to_minutes(o.start_time)) * x.get((h.id, o.id), 0)
            for o in inp.orders
            if (h.id, o.id) in x
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
                v = x.get((h.id, o.id), 0)
                if v != 0:
                    prob += y >= v, f"cont_y_{cid}_{h.id}_{o.id}"

            objective += weight * y


def diagnose_infeasibility(
    inp: OptimizationInput,
    time_limit_seconds: int = 30,
) -> InfeasibilityDiagnosis:
    """Infeasible時の診断: どのオーダーが割当不可かを特定する

    coverage制約をソフト化（unmet変数でペナルティ化）した MIP を解き、
    割当が不足したオーダーを特定する。ハード制約（no_overlap, gender,
    travel_time など）は引き続き有効なため、それらの制約を満たしながら
    できるだけ多くのオーダーに割り当てた結果を返す。

    Returns:
        InfeasibilityDiagnosis — どのオーダーが問題かの診断結果
    """
    from optimizer.engine.constraints import add_all_hard_constraints

    helpers = inp.helpers
    orders = inp.orders
    travel_lookup = _build_travel_time_lookup(inp)

    # --- 0. feasible_pairsが0のオーダーを特定（cert/NG/availability考慮） ---
    feasible_pairs = _compute_feasible_pairs(inp)
    feasible_count_by_order: dict[str, int] = {o.id: 0 for o in orders}
    for h_id, o_id in feasible_pairs:
        feasible_count_by_order[o_id] += 1
    zero_feasible_orders = [
        oid for oid, cnt in feasible_count_by_order.items() if cnt == 0
    ]

    # --- 1. ソフトカバレッジ MIP ---
    prob = pulp.LpProblem("diagnose", pulp.LpMinimize)

    # 決定変数: feasibleペアのみ生成
    x: dict[tuple[str, str], pulp.LpVariable] = {}
    for h_id, o_id in feasible_pairs:
        x[h_id, o_id] = pulp.LpVariable(f"x_{h_id}_{o_id}", cat="Binary")

    # coverage 不足スラック変数（unmet[o] = staff_count - assigned）
    unmet_vars: dict[str, pulp.LpVariable] = {}
    for o in orders:
        unmet = pulp.LpVariable(f"unmet_{o.id}", lowBound=0, upBound=o.staff_count)
        unmet_vars[o.id] = unmet
        assigned = pulp.lpSum(x.get((h.id, o.id), 0) for h in helpers)
        prob += unmet >= o.staff_count - assigned, f"soft_cover_{o.id}"
        # 過剰割当は禁止（staff_count を超えない）
        prob += assigned <= o.staff_count, f"max_cover_{o.id}"

    # ハード制約を追加（coverage 制約はソフト化済みのため除外）
    add_all_hard_constraints(prob, x, inp, travel_lookup)

    # 目的: unmet の合計を最小化
    prob += pulp.lpSum(unmet_vars[o.id] for o in orders), "minimize_unmet"

    solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=time_limit_seconds)
    prob.solve(solver)

    # --- 2. 結果の解析 ---
    unassigned_orders: list[str] = []
    partially_assigned_orders: list[str] = []

    if prob.status != pulp.constants.LpStatusInfeasible:
        for o in orders:
            unmet_val = pulp.value(unmet_vars[o.id])
            if unmet_val is None:
                continue
            if unmet_val >= o.staff_count - 0.5:
                # staff_count を一切満たせなかった
                unassigned_orders.append(o.id)
            elif unmet_val > 0.5:
                # 部分的にしか満たせなかった
                partially_assigned_orders.append(o.id)
    else:
        logger.warning("diagnose_infeasibility: ソフト問題も Infeasible — 診断結果は不完全")

    logger.warning(
        "Infeasibility診断結果: "
        "zero_feasible=%s, unassigned=%s, partially_assigned=%s",
        zero_feasible_orders,
        unassigned_orders,
        partially_assigned_orders,
    )

    return InfeasibilityDiagnosis(
        zero_feasible_orders=zero_feasible_orders,
        unassigned_orders=unassigned_orders,
        partially_assigned_orders=partially_assigned_orders,
    )
