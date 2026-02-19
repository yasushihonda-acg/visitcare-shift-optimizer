"""月次レポート集計ロジック — TypeScript aggregation.ts の Python移植"""

from collections import defaultdict

from .models import (
    CustomerSummaryRow,
    ServiceTypeSummaryItem,
    StaffSummaryRow,
    StatusSummary,
)

SERVICE_TYPE_LABELS: dict[str, str] = {
    "physical_care": "身体介護",
    "daily_living": "生活援助",
}


def time_to_minutes(time: str) -> int:
    """'HH:MM' 形式の時刻を分数に変換する"""
    h, m = time.split(":")
    return int(h) * 60 + int(m)


def order_duration_minutes(start_time: str, end_time: str) -> int:
    """オーダーのサービス時間（分）を算出する"""
    return time_to_minutes(end_time) - time_to_minutes(start_time)


def aggregate_status_summary(orders: list[dict[str, object]]) -> StatusSummary:
    """ステータス別集計を行う"""
    counts: dict[str, int] = {
        "pending": 0,
        "assigned": 0,
        "completed": 0,
        "cancelled": 0,
    }
    for order in orders:
        status = str(order.get("status", ""))
        if status in counts:
            counts[status] += 1

    total = len(orders)
    denominator = total - counts["cancelled"]
    if denominator > 0:
        completion_rate = round((counts["completed"] / denominator) * 100)
    else:
        completion_rate = 0

    return StatusSummary(
        pending=counts["pending"],
        assigned=counts["assigned"],
        completed=counts["completed"],
        cancelled=counts["cancelled"],
        total=total,
        completion_rate=float(completion_rate),
    )


def aggregate_service_type_summary(
    orders: list[dict[str, object]],
) -> list[ServiceTypeSummaryItem]:
    """サービス種別内訳を集計する（visitCount降順）"""
    agg: dict[str, dict[str, int]] = defaultdict(lambda: {"visit_count": 0, "total_minutes": 0})

    for order in orders:
        stype = str(order.get("service_type", ""))
        start = str(order.get("start_time", "00:00"))
        end = str(order.get("end_time", "00:00"))
        duration = order_duration_minutes(start, end)
        agg[stype]["visit_count"] += 1
        agg[stype]["total_minutes"] += duration

    result: list[ServiceTypeSummaryItem] = []
    for stype, data in agg.items():
        result.append(
            ServiceTypeSummaryItem(
                service_type=stype,
                label=SERVICE_TYPE_LABELS.get(stype, stype),
                visit_count=data["visit_count"],
                total_minutes=data["total_minutes"],
            )
        )

    result.sort(key=lambda x: x.visit_count, reverse=True)
    return result


def aggregate_staff_summary(
    orders: list[dict[str, object]],
    helpers: list[dict[str, object]],
) -> list[StaffSummaryRow]:
    """スタッフ別稼働集計（totalMinutes降順）"""
    helper_map: dict[str, str] = {}
    for h in helpers:
        hid = str(h.get("id", ""))
        family = str(h.get("family_name", ""))
        given = str(h.get("given_name", ""))
        helper_map[hid] = f"{family} {given}"

    agg: dict[str, dict[str, int]] = defaultdict(lambda: {"visit_count": 0, "total_minutes": 0})

    for order in orders:
        staff_ids = order.get("assigned_staff_ids")
        if not isinstance(staff_ids, list):
            continue
        start = str(order.get("start_time", "00:00"))
        end = str(order.get("end_time", "00:00"))
        duration = order_duration_minutes(start, end)
        for sid in staff_ids:
            sid_str = str(sid)
            agg[sid_str]["visit_count"] += 1
            agg[sid_str]["total_minutes"] += duration

    result: list[StaffSummaryRow] = []
    for sid, data in agg.items():
        result.append(
            StaffSummaryRow(
                helper_id=sid,
                name=helper_map.get(sid, "(不明)"),
                visit_count=data["visit_count"],
                total_minutes=data["total_minutes"],
            )
        )

    result.sort(key=lambda x: x.total_minutes, reverse=True)
    return result


def aggregate_customer_summary(
    orders: list[dict[str, object]],
    customers: list[dict[str, object]],
) -> list[CustomerSummaryRow]:
    """利用者別サービス実績集計（totalMinutes降順）"""
    customer_map: dict[str, str] = {}
    for c in customers:
        cid = str(c.get("id", ""))
        family = str(c.get("family_name", ""))
        given = str(c.get("given_name", ""))
        customer_map[cid] = f"{family} {given}"

    agg: dict[str, dict[str, int]] = defaultdict(lambda: {"visit_count": 0, "total_minutes": 0})

    for order in orders:
        cid = str(order.get("customer_id", ""))
        start = str(order.get("start_time", "00:00"))
        end = str(order.get("end_time", "00:00"))
        duration = order_duration_minutes(start, end)
        agg[cid]["visit_count"] += 1
        agg[cid]["total_minutes"] += duration

    result: list[CustomerSummaryRow] = []
    for cid, data in agg.items():
        result.append(
            CustomerSummaryRow(
                customer_id=cid,
                name=customer_map.get(cid, "(不明)"),
                visit_count=data["visit_count"],
                total_minutes=data["total_minutes"],
            )
        )

    result.sort(key=lambda x: x.total_minutes, reverse=True)
    return result
