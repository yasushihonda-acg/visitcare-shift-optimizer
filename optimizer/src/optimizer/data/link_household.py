"""同一住所グループ（世帯・施設）オーダーのリンク生成ユーティリティ

csv_loader / firestore_loader の両方から呼び出す共通ロジック。
同一世帯・同一施設の同日・連続時間帯オーダーに linked_order_id を設定する。
"""

from optimizer.models import Customer, Order


def link_household_orders(
    orders: list[Order],
    customers: list[Customer],
    gap_minutes: int = 30,
) -> None:
    """同一住所グループの同日・連続時間帯オーダーにlinked_order_idを設定（in-place）

    Args:
        orders: オーダーリスト（in-placeで変更）
        customers: 利用者リスト（same_household/facility参照用）
        gap_minutes: 連続と見なす最大間隔（分）。デフォルト30分。
    """
    # 同一住所グループを構築: customer_id → group_key
    # same_household と same_facility の和集合でグループ化
    customer_map = {c.id: c for c in customers}
    customer_to_group: dict[str, str] = {}

    visited: set[str] = set()
    group_idx = 0
    for c in customers:
        if c.id in visited:
            continue
        # この利用者のグループメンバー（世帯+施設の和集合）
        members = set(c.same_household_customer_ids) | set(c.same_facility_customer_ids)
        if not members:
            continue
        members.add(c.id)
        # 既存のグループに属していないメンバーだけで新グループ作成
        unvisited = members - visited
        if not unvisited:
            continue
        group_key = f"G{group_idx}"
        group_idx += 1
        for mid in members:
            if mid in customer_map:
                customer_to_group[mid] = group_key
                visited.add(mid)

    if not customer_to_group:
        return

    grouped_customer_ids = set(customer_to_group.keys())

    # 日付別にグループ化（グループメンバーのオーダーのみ）
    orders_by_date: dict[str, list[Order]] = {}
    for o in orders:
        if o.customer_id in grouped_customer_ids:
            orders_by_date.setdefault(o.date, []).append(o)

    for _date, day_orders in orders_by_date.items():
        # 同グループのオーダーをグループ化
        by_group: dict[str, list[Order]] = {}
        for o in day_orders:
            gk = customer_to_group.get(o.customer_id)
            if gk:
                by_group.setdefault(gk, []).append(o)

        for group_orders in by_group.values():
            if len(group_orders) < 2:
                continue
            # 開始時刻でソートし、連続するペアをリンク
            sorted_orders = sorted(group_orders, key=lambda o: o.start_time)
            for i in range(len(sorted_orders) - 1):
                o1 = sorted_orders[i]
                o2 = sorted_orders[i + 1]
                # 連続判定: o1の終了からo2の開始までの間隔がgap_minutes以内
                e1 = int(o1.end_time.split(":")[0]) * 60 + int(o1.end_time.split(":")[1])
                s2 = int(o2.start_time.split(":")[0]) * 60 + int(o2.start_time.split(":")[1])
                if s2 - e1 <= gap_minutes:
                    o1.linked_order_id = o2.id
                    o2.linked_order_id = o1.id
