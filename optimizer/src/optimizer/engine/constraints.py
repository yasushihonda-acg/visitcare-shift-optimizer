"""ハード制約の定義"""

import pulp

from optimizer.engine.solver import _orders_overlap, _time_to_minutes
from optimizer.models import (
    DayOfWeek,
    GenderRequirement,
    OptimizationInput,
    ServiceType,
    StaffConstraintType,
    TrainingStatus,
    TransportationType,
)


MAX_WALK_TRAVEL_MINUTES = 30


def add_all_hard_constraints(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
    travel_lookup: dict[tuple[str, str], float],
) -> None:
    """全ハード制約を追加"""
    _add_qualification_constraint(prob, x, inp)
    _add_no_overlap_constraint(prob, x, inp)
    _add_ng_staff_constraint(prob, x, inp)
    _add_gender_constraint(prob, x, inp)
    _add_availability_constraint(prob, x, inp)
    _add_unavailability_constraint(prob, x, inp)
    _add_travel_time_constraint(prob, x, inp, travel_lookup)
    _add_household_constraint(prob, x, inp)
    _add_training_constraint(prob, x, inp)
    _add_walk_distance_constraint(prob, x, inp, travel_lookup)


_PHYSICAL_CARE_TYPES = {ServiceType.PHYSICAL_CARE, ServiceType.MIXED}


def _add_qualification_constraint(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
) -> None:
    """E: 資格制約 — 身体介護・混合サービスに無資格者を割り当てない"""
    for h in inp.helpers:
        if not h.can_physical_care:
            for o in inp.orders:
                if o.service_type in _PHYSICAL_CARE_TYPES:
                    prob += x[h.id, o.id] == 0, f"qual_{h.id}_{o.id}"


def _add_no_overlap_constraint(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
) -> None:
    """F: 重複禁止 — 同一ヘルパーが同時刻に複数箇所にアサイン不可

    最適化: 同一日付のオーダーのみペアリング（異なる日付は重複不可能）
    """
    # 日付でグループ化して、同日のオーダーペアのみチェック
    orders_by_date: dict[str, list] = {}
    for o in inp.orders:
        orders_by_date.setdefault(o.date, []).append(o)

    # 重複ペアを事前計算（ヘルパー非依存）
    overlap_pairs: list[tuple] = []
    for date_orders in orders_by_date.values():
        for i, o1 in enumerate(date_orders):
            for o2 in date_orders[i + 1 :]:
                if _orders_overlap(o1, o2):
                    overlap_pairs.append((o1, o2))

    # 各ヘルパーに対して重複ペア制約を追加
    for h in inp.helpers:
        for o1, o2 in overlap_pairs:
            prob += (
                x[h.id, o1.id] + x[h.id, o2.id] <= 1,
                f"no_overlap_{h.id}_{o1.id}_{o2.id}",
            )


def _add_ng_staff_constraint(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
) -> None:
    """H: NGスタッフ回避 — staff_constraintsのNG組み合わせを禁止"""
    ng_pairs: set[tuple[str, str]] = set()
    for sc in inp.staff_constraints:
        if sc.constraint_type == StaffConstraintType.NG:
            ng_pairs.add((sc.customer_id, sc.staff_id))

    for o in inp.orders:
        for h in inp.helpers:
            if (o.customer_id, h.id) in ng_pairs:
                prob += x[h.id, o.id] == 0, f"ng_{h.id}_{o.id}"


def _add_gender_constraint(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
) -> None:
    """N: 性別制約 — gender_requirementと一致しないスタッフを割り当てない"""
    customer_map = {c.id: c for c in inp.customers}
    for o in inp.orders:
        c = customer_map[o.customer_id]
        if c.gender_requirement == GenderRequirement.ANY:
            continue
        for h in inp.helpers:
            if h.gender != c.gender_requirement:
                prob += x[h.id, o.id] == 0, f"gender_{h.id}_{o.id}"


def _add_availability_constraint(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
) -> None:
    """I: 勤務可能時間制約 — availability外はアサイン不可"""
    for h in inp.helpers:
        if not h.weekly_availability:
            continue  # 未定義 → 常時可能
        for o in inp.orders:
            dow = o.day_of_week
            slots = h.weekly_availability.get(dow, [])
            if not slots:
                # この曜日に勤務設定がない → 割当不可
                prob += x[h.id, o.id] == 0, f"avail_day_{h.id}_{o.id}"
                continue

            order_start = _time_to_minutes(o.start_time)
            order_end = _time_to_minutes(o.end_time)
            covered = any(
                _time_to_minutes(s.start_time) <= order_start
                and order_end <= _time_to_minutes(s.end_time)
                for s in slots
            )
            if not covered:
                prob += x[h.id, o.id] == 0, f"avail_time_{h.id}_{o.id}"


def _add_unavailability_constraint(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
) -> None:
    """J: 希望休制約 — unavailable_slotsに該当する日時はアサイン不可"""
    for su in inp.staff_unavailabilities:
        for slot in su.unavailable_slots:
            for o in inp.orders:
                if o.date != slot.date:
                    continue
                if slot.all_day:
                    prob += (
                        x[su.staff_id, o.id] == 0,
                        f"unavail_{su.staff_id}_{o.id}_{slot.date}",
                    )
                else:
                    # 時間帯指定: 重複チェック
                    if slot.start_time and slot.end_time:
                        us = _time_to_minutes(slot.start_time)
                        ue = _time_to_minutes(slot.end_time)
                        os_ = _time_to_minutes(o.start_time)
                        oe = _time_to_minutes(o.end_time)
                        if os_ < ue and us < oe:  # 重複
                            prob += (
                                x[su.staff_id, o.id] == 0,
                                f"unavail_t_{su.staff_id}_{o.id}_{slot.date}",
                            )


def _add_household_constraint(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
) -> None:
    """K: 世帯連続訪問制約 — linked_orderは同一ヘルパーが担当"""
    order_map = {o.id: o for o in inp.orders}
    seen: set[tuple[str, str]] = set()

    for o in inp.orders:
        if o.linked_order_id and o.linked_order_id in order_map:
            pair = tuple(sorted([o.id, o.linked_order_id]))
            if pair in seen:
                continue
            seen.add(pair)
            # 両オーダーに同じヘルパーを割当
            for h in inp.helpers:
                prob += (
                    x[h.id, o.id] == x[h.id, o.linked_order_id],
                    f"linked_{h.id}_{o.id}_{o.linked_order_id}",
                )


def _add_travel_time_constraint(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
    travel_lookup: dict[tuple[str, str], float],
) -> None:
    """G: 移動時間確保 — 連続訪問間の移動時間を確保

    同一ヘルパーが異なる利用者のオーダーを連続で担当する場合、
    前のオーダー終了時刻 + 移動時間 ≤ 次のオーダー開始時刻
    でなければ、両方に割当不可。

    最適化: 日付でグループ化 + 移動時間不足ペアを事前計算
    """
    # 日付でグループ化
    orders_by_date: dict[str, list] = {}
    for o in inp.orders:
        orders_by_date.setdefault(o.date, []).append(o)

    # 移動時間不足ペアを事前計算（ヘルパー非依存）
    travel_conflict_pairs: list[tuple[str, str, str]] = []  # (o1.id, o2.id, constraint_name_suffix)
    for date_orders in orders_by_date.values():
        for i, o1 in enumerate(date_orders):
            for o2 in date_orders[i + 1 :]:
                if o1.customer_id == o2.customer_id:
                    continue

                e1 = _time_to_minutes(o1.end_time)
                s2 = _time_to_minutes(o2.start_time)
                e2 = _time_to_minutes(o2.end_time)
                s1 = _time_to_minutes(o1.start_time)

                tt_1to2 = travel_lookup.get((o1.customer_id, o2.customer_id), 0.0)
                tt_2to1 = travel_lookup.get((o2.customer_id, o1.customer_id), 0.0)

                if e1 <= s2 and (s2 - e1) < tt_1to2:
                    travel_conflict_pairs.append((o1.id, o2.id, f"{o1.id}_{o2.id}"))
                elif e2 <= s1 and (s1 - e2) < tt_2to1:
                    travel_conflict_pairs.append((o2.id, o1.id, f"{o2.id}_{o1.id}"))

    # 各ヘルパーに対して制約追加
    for h in inp.helpers:
        for oid1, oid2, suffix in travel_conflict_pairs:
            prob += (
                x[h.id, oid1] + x[h.id, oid2] <= 1,
                f"travel_{h.id}_{suffix}",
            )


def _add_training_constraint(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
) -> None:
    """L: 研修中スタッフ制約 — training状態は単独訪問不可（staff_count=1のオーダー）"""
    for h in inp.helpers:
        for o in inp.orders:
            if o.staff_count > 1:
                continue  # 複数人体制なら研修中でもOK
            training = h.customer_training_status.get(o.customer_id)
            if training == TrainingStatus.TRAINING:
                prob += x[h.id, o.id] == 0, f"training_{h.id}_{o.id}"


def _add_walk_distance_constraint(
    prob: pulp.LpProblem,
    x: dict[tuple[str, str], pulp.LpVariable],
    inp: OptimizationInput,
    travel_lookup: dict[tuple[str, str], float],
) -> None:
    """M: 徒歩移動距離制約 — 徒歩スタッフは移動時間が上限を超える訪問ペアに割当不可

    移動手段が walk のスタッフに対し、同日の異なる利用者間の
    移動時間が MAX_WALK_TRAVEL_MINUTES を超える場合、
    両方のオーダーへの割り当てを禁止する。
    """
    walk_helpers = [h for h in inp.helpers if h.transportation == TransportationType.WALK]
    if not walk_helpers:
        return

    # 日付でグループ化
    orders_by_date: dict[str, list] = {}
    for o in inp.orders:
        orders_by_date.setdefault(o.date, []).append(o)

    # 徒歩移動時間超過ペアを事前計算
    walk_conflict_pairs: list[tuple[str, str, str]] = []
    for date_orders in orders_by_date.values():
        for i, o1 in enumerate(date_orders):
            for o2 in date_orders[i + 1 :]:
                if o1.customer_id == o2.customer_id:
                    continue
                tt_1to2 = travel_lookup.get((o1.customer_id, o2.customer_id), 0.0)
                tt_2to1 = travel_lookup.get((o2.customer_id, o1.customer_id), 0.0)
                if tt_1to2 > MAX_WALK_TRAVEL_MINUTES or tt_2to1 > MAX_WALK_TRAVEL_MINUTES:
                    walk_conflict_pairs.append((o1.id, o2.id, f"{o1.id}_{o2.id}"))

    # 徒歩スタッフにのみ制約追加
    for h in walk_helpers:
        for oid1, oid2, suffix in walk_conflict_pairs:
            prob += (
                x[h.id, oid1] + x[h.id, oid2] <= 1,
                f"walk_dist_{h.id}_{suffix}",
            )
