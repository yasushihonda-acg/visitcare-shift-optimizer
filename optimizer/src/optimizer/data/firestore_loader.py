"""Firestore → Pydanticモデル変換ローダー"""

import os
from datetime import date, datetime, timezone, timedelta

from google.cloud import firestore  # type: ignore[attr-defined]

from optimizer.models import (
    AvailabilitySlot,
    Customer,
    DayOfWeek,
    Gender,
    GenderRequirement,
    GeoLocation,
    Helper,
    HoursRange,
    IrregularPattern,
    OptimizationInput,
    Order,
    ServiceSlot,
    StaffConstraint,
    StaffConstraintType,
    StaffUnavailability,
    TravelTime,
    UnavailableSlot,
)

OFFSET_TO_DAY_OF_WEEK: dict[int, DayOfWeek] = {
    0: DayOfWeek.MONDAY,
    1: DayOfWeek.TUESDAY,
    2: DayOfWeek.WEDNESDAY,
    3: DayOfWeek.THURSDAY,
    4: DayOfWeek.FRIDAY,
    5: DayOfWeek.SATURDAY,
    6: DayOfWeek.SUNDAY,
}


def _ts_to_date_str(ts: datetime | object) -> str:
    """Firestore Timestamp/datetime → 'YYYY-MM-DD' (JST)"""
    JST = timezone(timedelta(hours=9))
    if isinstance(ts, datetime):
        return ts.astimezone(JST).strftime("%Y-%m-%d")
    if hasattr(ts, "to_pydatetime"):
        dt = ts.to_pydatetime()  # type: ignore[union-attr]
        return dt.astimezone(JST).strftime("%Y-%m-%d")
    if isinstance(ts, str):
        return ts.split("T")[0]
    raise ValueError(f"Unsupported timestamp type: {type(ts)}")


def _date_to_day_of_week(date_str: str) -> DayOfWeek:
    """'YYYY-MM-DD' → DayOfWeek"""
    return OFFSET_TO_DAY_OF_WEEK[date.fromisoformat(date_str).weekday()]


def get_firestore_client(project: str | None = None) -> firestore.Client:
    """Firestoreクライアント取得（FIRESTORE_EMULATOR_HOST設定時はEmulatorに接続）"""
    project_id = project or os.environ.get("GCP_PROJECT_ID", "visitcare-shift-optimizer")
    return firestore.Client(project=project_id)


def load_customers(db: firestore.Client) -> list[Customer]:
    """customersコレクション → Customer リスト"""
    customers: list[Customer] = []
    for doc in db.collection("customers").stream():
        d = doc.to_dict()
        if d is None:
            continue
        name = d.get("name", {})
        location = d.get("location", {})

        weekly_services: dict[DayOfWeek, list[ServiceSlot]] = {}
        for dow_str, slots in d.get("weekly_services", {}).items():
            dow = DayOfWeek(dow_str)
            weekly_services[dow] = [
                ServiceSlot(
                    start_time=s["start_time"],
                    end_time=s["end_time"],
                    service_type=s["service_type"],
                    staff_count=s.get("staff_count", 1),
                )
                for s in slots
            ]

        customers.append(
            Customer(
                id=doc.id,
                family_name=name.get("family", ""),
                given_name=name.get("given", ""),
                address=d.get("address", ""),
                location=GeoLocation(
                    lat=location.get("lat", 0.0),
                    lng=location.get("lng", 0.0),
                ),
                ng_staff_ids=d.get("ng_staff_ids", []),
                preferred_staff_ids=d.get("preferred_staff_ids", []),
                weekly_services=weekly_services,
                household_id=d.get("household_id") or None,
                irregular_patterns=[
                    IrregularPattern(**p)
                    for p in d.get("irregular_patterns", [])
                ],
                service_manager=d.get("service_manager", ""),
                gender_requirement=d.get("gender_requirement", "any"),
                notes=d.get("notes") or None,
            )
        )
    return customers


def load_helpers(db: firestore.Client) -> list[Helper]:
    """helpersコレクション → Helper リスト"""
    helpers: list[Helper] = []
    for doc in db.collection("helpers").stream():
        d = doc.to_dict()
        if d is None:
            continue
        name = d.get("name", {})

        weekly_availability: dict[DayOfWeek, list[AvailabilitySlot]] = {}
        for dow_str, slots in d.get("weekly_availability", {}).items():
            dow = DayOfWeek(dow_str)
            weekly_availability[dow] = [
                AvailabilitySlot(start_time=s["start_time"], end_time=s["end_time"])
                for s in slots
            ]

        preferred = d.get("preferred_hours", {})
        available = d.get("available_hours", {})

        helpers.append(
            Helper(
                id=doc.id,
                family_name=name.get("family", ""),
                given_name=name.get("given", ""),
                short_name=name.get("short", ""),
                qualifications=d.get("qualifications", []),
                can_physical_care=d.get("can_physical_care", False),
                transportation=d.get("transportation", "car"),
                weekly_availability=weekly_availability,
                preferred_hours=HoursRange(
                    min=preferred.get("min", 0.0),
                    max=preferred.get("max", 40.0),
                ),
                available_hours=HoursRange(
                    min=available.get("min", 0.0),
                    max=available.get("max", 40.0),
                ),
                customer_training_status=d.get("customer_training_status", {}),
                employment_type=d.get("employment_type", "full_time"),
                gender=d.get("gender", "female"),
                split_shift_allowed=d.get("split_shift_allowed", False),
            )
        )
    return helpers


def _build_staff_count_lookup(
    customers: list[Customer],
) -> dict[tuple[str, str, str, str, str], int]:
    """(customer_id, dow, start_time, end_time, service_type) → staff_count"""
    lookup: dict[tuple[str, str, str, str, str], int] = {}
    for c in customers:
        for dow, slots in c.weekly_services.items():
            for s in slots:
                key = (c.id, dow.value, s.start_time, s.end_time, s.service_type.value)
                lookup[key] = s.staff_count
    return lookup


def load_orders(
    db: firestore.Client,
    week_start: date,
    customers: list[Customer],
) -> list[Order]:
    """ordersコレクション → Order リスト（対象週のpending/assigned）"""
    # seedスクリプトが JST (UTC+9) midnight で保存するため、クエリも JST で合わせる
    JST = timezone(timedelta(hours=9))
    week_start_dt = datetime(week_start.year, week_start.month, week_start.day, tzinfo=JST)

    docs = (
        db.collection("orders")
        .where("week_start_date", "==", week_start_dt)
        .where("status", "in", ["pending", "assigned"])
        .stream()
    )

    staff_count_lookup = _build_staff_count_lookup(customers)

    orders: list[Order] = []
    for doc in docs:
        d = doc.to_dict()
        if d is None:
            continue
        order_date_str = _ts_to_date_str(d["date"])
        dow = _date_to_day_of_week(order_date_str)

        # staff_count: Firestoreにあればそれを使う、なければcustomer weekly_servicesから導出
        staff_count = d.get("staff_count")
        if staff_count is None:
            key = (d["customer_id"], dow.value, d["start_time"], d["end_time"], d["service_type"])
            staff_count = staff_count_lookup.get(key, 1)

        orders.append(
            Order(
                id=doc.id,
                customer_id=d["customer_id"],
                date=order_date_str,
                day_of_week=dow,
                start_time=d["start_time"],
                end_time=d["end_time"],
                service_type=d["service_type"],
                staff_count=staff_count,
                linked_order_id=d.get("linked_order_id") or None,
            )
        )
    return orders


def load_travel_times(
    db: firestore.Client,
    customer_ids: set[str] | None = None,
) -> list[TravelTime]:
    """travel_timesコレクション → TravelTime リスト

    Args:
        db: Firestoreクライアント
        customer_ids: フィルタリング対象のcustomer ID集合。
                      指定時はこれらのIDに関連するペアのみ返す。
    """
    travel_times: list[TravelTime] = []
    for doc in db.collection("travel_times").stream():
        d = doc.to_dict()
        if d is None:
            continue
        # ドキュメントID形式: from_{fromId}_to_{toId}
        parts = doc.id.split("_to_", 1)
        if len(parts) != 2:
            continue
        from_id = parts[0].removeprefix("from_")
        to_id = parts[1]

        # customer_idsが指定されている場合、関連するペアのみ
        if customer_ids is not None:
            if from_id not in customer_ids or to_id not in customer_ids:
                continue

        travel_times.append(
            TravelTime(
                from_id=from_id,
                to_id=to_id,
                travel_time_minutes=d.get("travel_time_minutes", 0.0),
            )
        )
    return travel_times


def load_staff_unavailabilities(
    db: firestore.Client,
    week_start: date,
) -> list[StaffUnavailability]:
    """staff_unavailabilityコレクション → StaffUnavailability リスト（対象週）"""
    JST = timezone(timedelta(hours=9))
    week_start_dt = datetime(week_start.year, week_start.month, week_start.day, tzinfo=JST)

    docs = (
        db.collection("staff_unavailability")
        .where("week_start_date", "==", week_start_dt)
        .stream()
    )

    unavailabilities: list[StaffUnavailability] = []
    for doc in docs:
        d = doc.to_dict()
        if d is None:
            continue
        slots = [
            UnavailableSlot(
                date=_ts_to_date_str(s["date"]),
                all_day=s.get("all_day", True),
                start_time=s.get("start_time"),
                end_time=s.get("end_time"),
            )
            for s in d.get("unavailable_slots", [])
        ]
        unavailabilities.append(
            StaffUnavailability(
                staff_id=d["staff_id"],
                week_start_date=week_start.isoformat(),
                unavailable_slots=slots,
            )
        )
    return unavailabilities


def load_staff_constraints(customers: list[Customer]) -> list[StaffConstraint]:
    """Customer.ng_staff_ids / preferred_staff_ids → StaffConstraint リスト"""
    constraints: list[StaffConstraint] = []
    for c in customers:
        for sid in c.ng_staff_ids:
            constraints.append(
                StaffConstraint(
                    customer_id=c.id,
                    staff_id=sid,
                    constraint_type=StaffConstraintType.NG,
                )
            )
        for sid in c.preferred_staff_ids:
            constraints.append(
                StaffConstraint(
                    customer_id=c.id,
                    staff_id=sid,
                    constraint_type=StaffConstraintType.PREFERRED,
                )
            )
    return constraints


def load_monthly_orders(
    db: firestore.Client,
    year_month: str,
) -> list[dict[str, object]]:
    """指定月のオーダーを全ステータスで取得（月次レポート集計用）

    Args:
        db: Firestoreクライアント
        year_month: 'YYYY-MM' 形式の年月文字列

    Returns:
        オーダーのdict リスト（集計ロジック向けのフラットなdict形式）
    """
    JST = timezone(timedelta(hours=9))
    year, month = (int(x) for x in year_month.split("-"))
    month_start = datetime(year, month, 1, tzinfo=JST)
    # 翌月初を計算
    if month == 12:
        next_month_start = datetime(year + 1, 1, 1, tzinfo=JST)
    else:
        next_month_start = datetime(year, month + 1, 1, tzinfo=JST)

    docs = (
        db.collection("orders")
        .where("date", ">=", month_start)
        .where("date", "<", next_month_start)
        .stream()
    )

    orders: list[dict[str, object]] = []
    for doc in docs:
        d = doc.to_dict()
        if d is None:
            continue
        orders.append(
            {
                "id": doc.id,
                "customer_id": d.get("customer_id", ""),
                "date": _ts_to_date_str(d["date"]),
                "start_time": d.get("start_time", ""),
                "end_time": d.get("end_time", ""),
                "service_type": d.get("service_type", ""),
                "status": d.get("status", ""),
                "assigned_staff_ids": d.get("assigned_staff_ids", []),
                "staff_count": d.get("staff_count", 1),
            }
        )
    return orders


def load_all_helpers(db: firestore.Client) -> list[dict[str, object]]:
    """全ヘルパーを取得（月次レポート集計用）

    Returns:
        ヘルパーのdict リスト（集計ロジック向けのフラットなdict形式）
    """
    helpers: list[dict[str, object]] = []
    for doc in db.collection("helpers").stream():
        d = doc.to_dict()
        if d is None:
            continue
        name = d.get("name", {})
        helpers.append(
            {
                "id": doc.id,
                "family_name": name.get("family", ""),
                "given_name": name.get("given", ""),
            }
        )
    return helpers


def load_all_customers(db: firestore.Client) -> list[dict[str, object]]:
    """全利用者を取得（月次レポート集計用）

    Returns:
        利用者のdict リスト（集計ロジック向けのフラットなdict形式）
    """
    customers: list[dict[str, object]] = []
    for doc in db.collection("customers").stream():
        d = doc.to_dict()
        if d is None:
            continue
        name = d.get("name", {})
        customers.append(
            {
                "id": doc.id,
                "family_name": name.get("family", ""),
                "given_name": name.get("given", ""),
            }
        )
    return customers


def load_optimization_input(
    db: firestore.Client,
    week_start: date,
) -> OptimizationInput:
    """全データをFirestoreから読み込み、OptimizationInput を返す"""
    customers = load_customers(db)
    helpers = load_helpers(db)
    orders = load_orders(db, week_start, customers)
    # オーダーに含まれる利用者IDのみでtravel_timesをフィルタリング
    order_customer_ids = {o.customer_id for o in orders}
    travel_times = load_travel_times(db, customer_ids=order_customer_ids)
    staff_unavailabilities = load_staff_unavailabilities(db, week_start)
    staff_constraints = load_staff_constraints(customers)

    return OptimizationInput(
        customers=customers,
        helpers=helpers,
        orders=orders,
        travel_times=travel_times,
        staff_unavailabilities=staff_unavailabilities,
        staff_constraints=staff_constraints,
    )
