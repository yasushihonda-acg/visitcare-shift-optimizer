"""Firestoreデータローダーのテスト"""

from datetime import date, datetime
from unittest.mock import MagicMock

import pytest

from optimizer.data.firestore_loader import (
    _build_staff_count_lookup,
    _date_to_day_of_week,
    _ts_to_date_str,
    load_customers,
    load_helpers,
    load_optimization_input,
    load_orders,
    load_staff_constraints,
    load_staff_unavailabilities,
    load_travel_times,
)
from optimizer.models import (
    Customer,
    DayOfWeek,
    GeoLocation,
    ServiceSlot,
    ServiceType,
    StaffConstraintType,
)

# --- ヘルパー関数 ---


def _mock_doc(doc_id: str, data: dict) -> MagicMock:
    """Firestoreドキュメントのモック"""
    doc = MagicMock()
    doc.id = doc_id
    doc.to_dict.return_value = data
    return doc


def _mock_db_with_collections(collection_data: dict[str, list[MagicMock]]) -> MagicMock:
    """コレクション→ドキュメントリストのモックDB"""
    db = MagicMock()

    def collection_side_effect(name: str) -> MagicMock:
        coll = MagicMock()
        docs = collection_data.get(name, [])
        coll.stream.return_value = iter(docs)
        # where チェイン対応
        coll.where.return_value = coll
        coll.document.side_effect = lambda doc_id: MagicMock()
        return coll

    db.collection.side_effect = collection_side_effect
    return db


# --- ユーティリティ関数テスト ---


class TestTsToDateStr:
    def test_datetime(self) -> None:
        dt = datetime(2026, 2, 9, 0, 0, 0)
        assert _ts_to_date_str(dt) == "2026-02-09"

    def test_firestore_timestamp(self) -> None:
        ts = MagicMock()
        ts.to_pydatetime.return_value = datetime(2026, 2, 10, 12, 0, 0)
        assert _ts_to_date_str(ts) == "2026-02-10"


class TestDateToDay:
    def test_monday(self) -> None:
        assert _date_to_day_of_week("2026-02-09") == DayOfWeek.MONDAY

    def test_sunday(self) -> None:
        assert _date_to_day_of_week("2026-02-15") == DayOfWeek.SUNDAY

    def test_friday(self) -> None:
        assert _date_to_day_of_week("2026-02-13") == DayOfWeek.FRIDAY


# --- Customerローダーテスト ---


class TestLoadCustomers:
    def _sample_customer_doc(self) -> MagicMock:
        return _mock_doc(
            "C001",
            {
                "name": {"family": "山田", "given": "太郎"},
                "address": "鹿児島市中央町1-1",
                "location": {"lat": 31.585, "lng": 130.558},
                "ng_staff_ids": ["H003"],
                "preferred_staff_ids": ["H001", "H002"],
                "weekly_services": {
                    "monday": [
                        {
                            "start_time": "09:00",
                            "end_time": "10:00",
                            "service_type": "physical_care",
                            "staff_count": 1,
                        }
                    ],
                    "wednesday": [
                        {
                            "start_time": "14:00",
                            "end_time": "15:00",
                            "service_type": "daily_living",
                            "staff_count": 2,
                        }
                    ],
                },
                "household_id": "H001",
                "service_manager": "管理者A",
                "notes": "テストメモ",
            },
        )

    def test_basic_fields(self) -> None:
        db = _mock_db_with_collections({"customers": [self._sample_customer_doc()]})
        customers = load_customers(db)
        assert len(customers) == 1
        c = customers[0]
        assert c.id == "C001"
        assert c.family_name == "山田"
        assert c.given_name == "太郎"
        assert c.address == "鹿児島市中央町1-1"
        assert c.household_id == "H001"
        assert c.service_manager == "管理者A"
        assert c.notes == "テストメモ"

    def test_location(self) -> None:
        db = _mock_db_with_collections({"customers": [self._sample_customer_doc()]})
        c = load_customers(db)[0]
        assert c.location.lat == pytest.approx(31.585)
        assert c.location.lng == pytest.approx(130.558)

    def test_ng_preferred_staff(self) -> None:
        db = _mock_db_with_collections({"customers": [self._sample_customer_doc()]})
        c = load_customers(db)[0]
        assert c.ng_staff_ids == ["H003"]
        assert c.preferred_staff_ids == ["H001", "H002"]

    def test_weekly_services(self) -> None:
        db = _mock_db_with_collections({"customers": [self._sample_customer_doc()]})
        c = load_customers(db)[0]
        assert DayOfWeek.MONDAY in c.weekly_services
        assert DayOfWeek.WEDNESDAY in c.weekly_services
        monday_slots = c.weekly_services[DayOfWeek.MONDAY]
        assert len(monday_slots) == 1
        assert monday_slots[0].service_type == ServiceType.PHYSICAL_CARE
        assert monday_slots[0].staff_count == 1
        wednesday_slots = c.weekly_services[DayOfWeek.WEDNESDAY]
        assert wednesday_slots[0].staff_count == 2

    def test_empty_collection(self) -> None:
        db = _mock_db_with_collections({"customers": []})
        assert load_customers(db) == []

    def test_null_doc_skipped(self) -> None:
        doc = MagicMock()
        doc.id = "C999"
        doc.to_dict.return_value = None
        db = _mock_db_with_collections({"customers": [doc]})
        assert load_customers(db) == []


# --- Helperローダーテスト ---


class TestLoadHelpers:
    def _sample_helper_doc(self) -> MagicMock:
        return _mock_doc(
            "H001",
            {
                "name": {"family": "鈴木", "given": "花子", "short": "鈴木H"},
                "qualifications": ["介護福祉士", "実務者研修"],
                "can_physical_care": True,
                "transportation": "car",
                "weekly_availability": {
                    "monday": [{"start_time": "08:00", "end_time": "17:00"}],
                    "tuesday": [{"start_time": "09:00", "end_time": "16:00"}],
                },
                "preferred_hours": {"min": 20.0, "max": 30.0},
                "available_hours": {"min": 15.0, "max": 35.0},
                "customer_training_status": {"C010": "training"},
                "employment_type": "full_time",
            },
        )

    def test_basic_fields(self) -> None:
        db = _mock_db_with_collections({"helpers": [self._sample_helper_doc()]})
        helpers = load_helpers(db)
        assert len(helpers) == 1
        h = helpers[0]
        assert h.id == "H001"
        assert h.family_name == "鈴木"
        assert h.given_name == "花子"
        assert h.short_name == "鈴木H"
        assert h.can_physical_care is True
        assert h.qualifications == ["介護福祉士", "実務者研修"]

    def test_weekly_availability(self) -> None:
        db = _mock_db_with_collections({"helpers": [self._sample_helper_doc()]})
        h = load_helpers(db)[0]
        assert DayOfWeek.MONDAY in h.weekly_availability
        assert h.weekly_availability[DayOfWeek.MONDAY][0].start_time == "08:00"
        assert h.weekly_availability[DayOfWeek.MONDAY][0].end_time == "17:00"

    def test_hours_range(self) -> None:
        db = _mock_db_with_collections({"helpers": [self._sample_helper_doc()]})
        h = load_helpers(db)[0]
        assert h.preferred_hours.min == pytest.approx(20.0)
        assert h.preferred_hours.max == pytest.approx(30.0)
        assert h.available_hours.min == pytest.approx(15.0)

    def test_training_status(self) -> None:
        db = _mock_db_with_collections({"helpers": [self._sample_helper_doc()]})
        h = load_helpers(db)[0]
        assert h.customer_training_status.get("C010") == "training"


# --- Orderローダーテスト ---


class TestLoadOrders:
    def _sample_order_doc(self) -> MagicMock:
        return _mock_doc(
            "ORD0001",
            {
                "customer_id": "C001",
                "date": datetime(2026, 2, 9),  # 月曜
                "week_start_date": datetime(2026, 2, 9),
                "start_time": "09:00",
                "end_time": "10:00",
                "service_type": "physical_care",
                "status": "pending",
                "linked_order_id": None,
            },
        )

    def _sample_customers(self) -> list[Customer]:
        return [
            Customer(
                id="C001",
                family_name="山田",
                given_name="太郎",
                address="test",
                location=GeoLocation(lat=31.5, lng=130.5),
                weekly_services={
                    DayOfWeek.MONDAY: [
                        ServiceSlot(
                            start_time="09:00",
                            end_time="10:00",
                            service_type=ServiceType.PHYSICAL_CARE,
                            staff_count=1,
                        )
                    ]
                },
            )
        ]

    def test_basic_order_loading(self) -> None:
        db = _mock_db_with_collections({"orders": [self._sample_order_doc()]})
        orders = load_orders(db, date(2026, 2, 9), self._sample_customers())
        assert len(orders) == 1
        o = orders[0]
        assert o.id == "ORD0001"
        assert o.customer_id == "C001"
        assert o.date == "2026-02-09"
        assert o.day_of_week == DayOfWeek.MONDAY
        assert o.start_time == "09:00"
        assert o.end_time == "10:00"
        assert o.service_type == ServiceType.PHYSICAL_CARE

    def test_staff_count_from_customer(self) -> None:
        """staff_countがFirestoreに無い場合、customerのweekly_servicesから導出"""
        db = _mock_db_with_collections({"orders": [self._sample_order_doc()]})
        orders = load_orders(db, date(2026, 2, 9), self._sample_customers())
        assert orders[0].staff_count == 1

    def test_staff_count_from_firestore(self) -> None:
        """staff_countがFirestoreにある場合はそれを使用"""
        doc = _mock_doc(
            "ORD0002",
            {
                "customer_id": "C001",
                "date": datetime(2026, 2, 9),
                "week_start_date": datetime(2026, 2, 9),
                "start_time": "09:00",
                "end_time": "10:00",
                "service_type": "physical_care",
                "status": "pending",
                "staff_count": 3,
            },
        )
        db = _mock_db_with_collections({"orders": [doc]})
        orders = load_orders(db, date(2026, 2, 9), self._sample_customers())
        assert orders[0].staff_count == 3

    def test_staff_count_default_when_no_match(self) -> None:
        """customerにもFirestoreにもstaff_countが無い場合はデフォルト1"""
        doc = _mock_doc(
            "ORD0003",
            {
                "customer_id": "C999",  # 存在しないcustomer
                "date": datetime(2026, 2, 9),
                "week_start_date": datetime(2026, 2, 9),
                "start_time": "11:00",
                "end_time": "12:00",
                "service_type": "daily_living",
                "status": "pending",
            },
        )
        db = _mock_db_with_collections({"orders": [doc]})
        orders = load_orders(db, date(2026, 2, 9), self._sample_customers())
        assert orders[0].staff_count == 1

    def test_empty_orders(self) -> None:
        db = _mock_db_with_collections({"orders": []})
        orders = load_orders(db, date(2026, 2, 9), self._sample_customers())
        assert orders == []


# --- TravelTimeローダーテスト ---


class TestLoadTravelTimes:
    def test_doc_id_parsing(self) -> None:
        doc = _mock_doc("from_C001_to_C002", {"travel_time_minutes": 5.3})
        db = _mock_db_with_collections({"travel_times": [doc]})
        tts = load_travel_times(db)
        assert len(tts) == 1
        assert tts[0].from_id == "C001"
        assert tts[0].to_id == "C002"
        assert tts[0].travel_time_minutes == pytest.approx(5.3)

    def test_invalid_doc_id_skipped(self) -> None:
        doc = _mock_doc("invalid_format", {"travel_time_minutes": 1.0})
        db = _mock_db_with_collections({"travel_times": [doc]})
        assert load_travel_times(db) == []

    def test_multiple_entries(self) -> None:
        docs = [
            _mock_doc("from_C001_to_C002", {"travel_time_minutes": 5.0}),
            _mock_doc("from_C002_to_C001", {"travel_time_minutes": 5.0}),
            _mock_doc("from_C001_to_C003", {"travel_time_minutes": 8.2}),
        ]
        db = _mock_db_with_collections({"travel_times": docs})
        assert len(load_travel_times(db)) == 3


# --- StaffUnavailabilityローダーテスト ---


class TestLoadStaffUnavailabilities:
    def test_basic_loading(self) -> None:
        doc = _mock_doc(
            "UA001",
            {
                "staff_id": "H003",
                "week_start_date": datetime(2026, 2, 9),
                "unavailable_slots": [
                    {
                        "date": datetime(2026, 2, 10),
                        "all_day": True,
                    },
                    {
                        "date": datetime(2026, 2, 12),
                        "all_day": False,
                        "start_time": "09:00",
                        "end_time": "12:00",
                    },
                ],
            },
        )
        db = _mock_db_with_collections({"staff_unavailability": [doc]})
        unavails = load_staff_unavailabilities(db, date(2026, 2, 9))
        assert len(unavails) == 1
        ua = unavails[0]
        assert ua.staff_id == "H003"
        assert ua.week_start_date == "2026-02-09"
        assert len(ua.unavailable_slots) == 2
        assert ua.unavailable_slots[0].all_day is True
        assert ua.unavailable_slots[0].date == "2026-02-10"
        assert ua.unavailable_slots[1].start_time == "09:00"


# --- StaffConstraint導出テスト ---


class TestLoadStaffConstraints:
    def test_ng_and_preferred(self) -> None:
        customers = [
            Customer(
                id="C001",
                family_name="山田",
                given_name="太郎",
                address="test",
                location=GeoLocation(lat=31.5, lng=130.5),
                ng_staff_ids=["H003"],
                preferred_staff_ids=["H001", "H002"],
            ),
        ]
        constraints = load_staff_constraints(customers)
        assert len(constraints) == 3
        ng = [c for c in constraints if c.constraint_type == StaffConstraintType.NG]
        pref = [c for c in constraints if c.constraint_type == StaffConstraintType.PREFERRED]
        assert len(ng) == 1
        assert ng[0].customer_id == "C001"
        assert ng[0].staff_id == "H003"
        assert len(pref) == 2

    def test_empty_constraints(self) -> None:
        customers = [
            Customer(
                id="C002",
                family_name="田中",
                given_name="次郎",
                address="test",
                location=GeoLocation(lat=31.5, lng=130.5),
            ),
        ]
        assert load_staff_constraints(customers) == []


# --- staff_count lookup テスト ---


class TestBuildStaffCountLookup:
    def test_lookup(self) -> None:
        customers = [
            Customer(
                id="C001",
                family_name="山田",
                given_name="太郎",
                address="test",
                location=GeoLocation(lat=31.5, lng=130.5),
                weekly_services={
                    DayOfWeek.MONDAY: [
                        ServiceSlot(
                            start_time="09:00",
                            end_time="10:00",
                            service_type=ServiceType.PHYSICAL_CARE,
                            staff_count=2,
                        )
                    ]
                },
            ),
        ]
        lookup = _build_staff_count_lookup(customers)
        assert lookup[("C001", "monday", "09:00", "10:00", "physical_care")] == 2


# --- 統合ロードテスト ---


class TestLoadOptimizationInput:
    def test_full_load(self) -> None:
        customer_doc = _mock_doc(
            "C001",
            {
                "name": {"family": "山田", "given": "太郎"},
                "address": "test",
                "location": {"lat": 31.5, "lng": 130.5},
                "ng_staff_ids": [],
                "preferred_staff_ids": [],
                "weekly_services": {
                    "monday": [
                        {
                            "start_time": "09:00",
                            "end_time": "10:00",
                            "service_type": "physical_care",
                            "staff_count": 1,
                        }
                    ]
                },
                "service_manager": "管理者",
            },
        )
        helper_doc = _mock_doc(
            "H001",
            {
                "name": {"family": "鈴木", "given": "花子"},
                "qualifications": ["介護福祉士"],
                "can_physical_care": True,
                "transportation": "car",
                "weekly_availability": {
                    "monday": [{"start_time": "08:00", "end_time": "17:00"}]
                },
                "preferred_hours": {"min": 20, "max": 30},
                "available_hours": {"min": 15, "max": 35},
                "customer_training_status": {},
                "employment_type": "full_time",
            },
        )
        order_doc = _mock_doc(
            "ORD0001",
            {
                "customer_id": "C001",
                "date": datetime(2026, 2, 9),
                "week_start_date": datetime(2026, 2, 9),
                "start_time": "09:00",
                "end_time": "10:00",
                "service_type": "physical_care",
                "status": "pending",
            },
        )
        # C002のオーダーも追加（travel_timesフィルタリングの対象にするため）
        order_doc2 = _mock_doc(
            "ORD0002",
            {
                "customer_id": "C002",
                "date": datetime(2026, 2, 9),
                "week_start_date": datetime(2026, 2, 9),
                "start_time": "11:00",
                "end_time": "12:00",
                "service_type": "daily_living",
                "status": "pending",
            },
        )
        tt_doc = _mock_doc("from_C001_to_C002", {"travel_time_minutes": 5.0})

        db = _mock_db_with_collections(
            {
                "customers": [customer_doc],
                "helpers": [helper_doc],
                "orders": [order_doc, order_doc2],
                "travel_times": [tt_doc],
                "staff_unavailability": [],
            }
        )

        inp = load_optimization_input(db, date(2026, 2, 9))
        assert len(inp.customers) == 1
        assert len(inp.helpers) == 1
        assert len(inp.orders) == 2
        assert len(inp.travel_times) == 1
        assert len(inp.staff_unavailabilities) == 0
        assert len(inp.staff_constraints) == 0
