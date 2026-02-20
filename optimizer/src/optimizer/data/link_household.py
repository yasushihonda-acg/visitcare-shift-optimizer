"""世帯（household）オーダーのリンク生成ユーティリティ

csv_loader / firestore_loader の両方から呼び出す共通ロジック。
同一世帯の同日・連続時間帯オーダーに linked_order_id を設定する。
"""

from optimizer.models import Customer, Order


def link_household_orders(
    orders: list[Order],
    customers: list[Customer],
    gap_minutes: int = 30,
) -> None:
    """同一世帯の同日・連続時間帯オーダーにlinked_order_idを設定（in-place）

    Args:
        orders: オーダーリスト（in-placeで変更）
        customers: 利用者リスト（household_id参照用）
        gap_minutes: 連続と見なす最大間隔（分）。デフォルト30分。
    """
    # customer_id → household_id
    customer_to_household: dict[str, str] = {
        c.id: c.household_id for c in customers if c.household_id
    }

    if not customer_to_household:
        return

    # 世帯メンバーのcustomer_idセット
    household_customer_ids = set(customer_to_household.keys())

    # 日付別にグループ化（世帯メンバーのオーダーのみ）
    orders_by_date: dict[str, list[Order]] = {}
    for o in orders:
        if o.customer_id in household_customer_ids:
            orders_by_date.setdefault(o.date, []).append(o)

    for _date, day_orders in orders_by_date.items():
        # 同世帯のオーダーをグループ化
        by_household: dict[str, list[Order]] = {}
        for o in day_orders:
            hh_id = customer_to_household.get(o.customer_id)
            if hh_id:
                by_household.setdefault(hh_id, []).append(o)

        for hh_orders in by_household.values():
            if len(hh_orders) < 2:
                continue
            # 開始時刻でソートし、連続するペアをリンク
            sorted_orders = sorted(hh_orders, key=lambda o: o.start_time)
            for i in range(len(sorted_orders) - 1):
                o1 = sorted_orders[i]
                o2 = sorted_orders[i + 1]
                # 連続判定: o1の終了からo2の開始までの間隔がgap_minutes以内
                e1 = int(o1.end_time.split(":")[0]) * 60 + int(o1.end_time.split(":")[1])
                s2 = int(o2.start_time.split(":")[0]) * 60 + int(o2.start_time.split(":")[1])
                if s2 - e1 <= gap_minutes:
                    o1.linked_order_id = o2.id
                    o2.linked_order_id = o1.id
