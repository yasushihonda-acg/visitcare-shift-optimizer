"""CSV → Pydanticモデル変換ローダー"""

import csv
import math
from datetime import date, timedelta
from pathlib import Path

from optimizer.models import (
    AvailabilitySlot,
    Customer,
    DayOfWeek,
    GeoLocation,
    Helper,
    HoursRange,
    OptimizationInput,
    Order,
    ServiceSlot,
    StaffConstraint,
    StaffUnavailability,
    TravelTime,
    UnavailableSlot,
)

DAY_OF_WEEK_OFFSET: dict[DayOfWeek, int] = {
    DayOfWeek.MONDAY: 0,
    DayOfWeek.TUESDAY: 1,
    DayOfWeek.WEDNESDAY: 2,
    DayOfWeek.THURSDAY: 3,
    DayOfWeek.FRIDAY: 4,
    DayOfWeek.SATURDAY: 5,
    DayOfWeek.SUNDAY: 6,
}


def _read_csv(path: Path) -> list[dict[str, str]]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_customers(data_dir: Path) -> list[Customer]:
    """customers.csv + customer-services.csv → Customer リスト"""
    customers_csv = _read_csv(data_dir / "customers.csv")
    services_csv = _read_csv(data_dir / "customer-services.csv")
    constraints_csv = _read_csv(data_dir / "customer-staff-constraints.csv")

    # customer-services をグループ化
    services_by_customer: dict[str, dict[DayOfWeek, list[ServiceSlot]]] = {}
    for row in services_csv:
        cid = row["customer_id"]
        dow = DayOfWeek(row["day_of_week"])
        slot = ServiceSlot(
            start_time=row["start_time"],
            end_time=row["end_time"],
            service_type=row["service_type"],
            staff_count=int(row["staff_count"]),
        )
        services_by_customer.setdefault(cid, {}).setdefault(dow, []).append(slot)

    # constraints をグループ化
    ng_by_customer: dict[str, list[str]] = {}
    preferred_by_customer: dict[str, list[str]] = {}
    for row in constraints_csv:
        cid = row["customer_id"]
        sid = row["staff_id"]
        if row["constraint_type"] == "ng":
            ng_by_customer.setdefault(cid, []).append(sid)
        else:
            preferred_by_customer.setdefault(cid, []).append(sid)

    customers = []
    for row in customers_csv:
        cid = row["id"]
        customers.append(
            Customer(
                id=cid,
                family_name=row["family_name"],
                given_name=row["given_name"],
                address=row["address"],
                location=GeoLocation(lat=float(row["lat"]), lng=float(row["lng"])),
                ng_staff_ids=ng_by_customer.get(cid, []),
                preferred_staff_ids=preferred_by_customer.get(cid, []),
                weekly_services=services_by_customer.get(cid, {}),
                household_id=row.get("household_id") or None,
                service_manager=row.get("service_manager", ""),
                notes=row.get("notes") or None,
            )
        )
    return customers


def load_helpers(data_dir: Path) -> list[Helper]:
    """helpers.csv + helper-availability.csv → Helper リスト"""
    helpers_csv = _read_csv(data_dir / "helpers.csv")
    availability_csv = _read_csv(data_dir / "helper-availability.csv")

    # availability をグループ化
    avail_by_helper: dict[str, dict[DayOfWeek, list[AvailabilitySlot]]] = {}
    for row in availability_csv:
        hid = row["helper_id"]
        dow = DayOfWeek(row["day_of_week"])
        slot = AvailabilitySlot(start_time=row["start_time"], end_time=row["end_time"])
        avail_by_helper.setdefault(hid, {}).setdefault(dow, []).append(slot)

    helpers = []
    for row in helpers_csv:
        hid = row["id"]
        quals = [q.strip() for q in row["qualifications"].split(",") if q.strip()]
        helpers.append(
            Helper(
                id=hid,
                family_name=row["family_name"],
                given_name=row["given_name"],
                short_name=row.get("short_name", ""),
                qualifications=quals,
                can_physical_care=row["can_physical_care"].lower() == "true",
                transportation=row["transportation"],
                weekly_availability=avail_by_helper.get(hid, {}),
                preferred_hours=HoursRange(
                    min=float(row["preferred_hours_min"]),
                    max=float(row["preferred_hours_max"]),
                ),
                available_hours=HoursRange(
                    min=float(row["available_hours_min"]),
                    max=float(row["available_hours_max"]),
                ),
                employment_type=row["employment_type"],
            )
        )
    return helpers


def generate_orders(customers: list[Customer], week_start: date) -> list[Order]:
    """Customer.weekly_services から対象週のOrder一覧を生成"""
    orders: list[Order] = []
    order_counter = 0
    for customer in customers:
        for dow, slots in customer.weekly_services.items():
            order_date = week_start + timedelta(days=DAY_OF_WEEK_OFFSET[dow])
            for slot in slots:
                order_counter += 1
                orders.append(
                    Order(
                        id=f"ORD{order_counter:04d}",
                        customer_id=customer.id,
                        date=order_date.isoformat(),
                        day_of_week=dow,
                        start_time=slot.start_time,
                        end_time=slot.end_time,
                        service_type=slot.service_type,
                        staff_count=slot.staff_count,
                    )
                )
    return orders


def load_travel_times(data_dir: Path, customers: list[Customer]) -> list[TravelTime]:
    """Haversine距離ベースの移動時間を全ペアで計算（seed/dataにCSVがない場合のフォールバック）"""
    travel_times: list[TravelTime] = []
    for i, c1 in enumerate(customers):
        for c2 in customers[i + 1 :]:
            minutes = _haversine_travel_minutes(c1.location, c2.location)
            travel_times.append(
                TravelTime(from_id=c1.id, to_id=c2.id, travel_time_minutes=minutes)
            )
            travel_times.append(
                TravelTime(from_id=c2.id, to_id=c1.id, travel_time_minutes=minutes)
            )
    return travel_times


def _haversine_travel_minutes(loc1: GeoLocation, loc2: GeoLocation) -> float:
    """Haversine距離 × 市街地係数1.3 ÷ 車速40km/h → 分"""

    R = 6371.0  # 地球半径 km
    lat1, lat2 = math.radians(loc1.lat), math.radians(loc2.lat)
    dlat = lat2 - lat1
    dlng = math.radians(loc2.lng - loc1.lng)
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    distance_km = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    urban_distance_km = distance_km * 1.3
    return urban_distance_km / 40.0 * 60.0  # 分換算


def load_staff_unavailabilities(data_dir: Path) -> list[StaffUnavailability]:
    """staff-unavailability.csv → StaffUnavailability リスト"""
    rows = _read_csv(data_dir / "staff-unavailability.csv")

    # staff_id + week_start_date でグループ化
    grouped: dict[tuple[str, str], list[UnavailableSlot]] = {}
    for row in rows:
        key = (row["staff_id"], row["week_start_date"])
        slot = UnavailableSlot(
            date=row["date"],
            all_day=row["all_day"].lower() == "true",
            start_time=row.get("start_time") or None,
            end_time=row.get("end_time") or None,
        )
        grouped.setdefault(key, []).append(slot)

    return [
        StaffUnavailability(
            staff_id=staff_id,
            week_start_date=week_start,
            unavailable_slots=slots,
        )
        for (staff_id, week_start), slots in grouped.items()
    ]


def load_staff_constraints(data_dir: Path) -> list[StaffConstraint]:
    """customer-staff-constraints.csv → StaffConstraint リスト"""
    rows = _read_csv(data_dir / "customer-staff-constraints.csv")
    return [
        StaffConstraint(
            customer_id=row["customer_id"],
            staff_id=row["staff_id"],
            constraint_type=row["constraint_type"],
        )
        for row in rows
    ]


def load_optimization_input(data_dir: Path, week_start: date) -> OptimizationInput:
    """全データを読み込み、OptimizationInput を返す"""
    customers = load_customers(data_dir)
    helpers = load_helpers(data_dir)
    orders = generate_orders(customers, week_start)
    travel_times = load_travel_times(data_dir, customers)
    staff_unavailabilities = load_staff_unavailabilities(data_dir)
    staff_constraints = load_staff_constraints(data_dir)

    return OptimizationInput(
        customers=customers,
        helpers=helpers,
        orders=orders,
        travel_times=travel_times,
        staff_unavailabilities=staff_unavailabilities,
        staff_constraints=staff_constraints,
    )
