"""Firestoreデータローダーのテスト"""

from datetime import date, datetime
from unittest.mock import MagicMock

import pytest

from optimizer.data.firestore_loader import (
    _build_staff_count_lookup,
    _date_to_day_of_week,
    _ts_to_date_str,
    load_all_customers,
    load_all_helpers,
    load_all_service_types,
    load_customers,
    load_helpers,
    load_monthly_orders,
    load_optimization_input,
    load_orders,
    load_service_types,
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
    ServiceTypeConfig,
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

    def test_irregular_patterns_loaded(self) -> None:
        """irregular_patternsがFirestoreから正しく読み込まれる"""
        doc = _mock_doc(
            "C010",
            {
                "name": {"family": "鈴木", "given": "一郎"},
                "address": "鹿児島市天文館",
                "location": {"lat": 31.59, "lng": 130.56},
                "ng_staff_ids": [],
                "preferred_staff_ids": [],
                "weekly_services": {},
                "service_manager": "管理者B",
                "irregular_patterns": [
                    {
                        "type": "biweekly",
                        "description": "隔週（第1・3週）",
                        "active_weeks": [0, 2],
                    },
                    {
                        "type": "temporary_stop",
                        "description": "入院中",
                    },
                ],
            },
        )
        db = _mock_db_with_collections({"customers": [doc]})
        customers = load_customers(db)
        assert len(customers) == 1
        c = customers[0]
        assert len(c.irregular_patterns) == 2
        assert c.irregular_patterns[0].type.value == "biweekly"
        assert c.irregular_patterns[0].active_weeks == [0, 2]
        assert c.irregular_patterns[1].type.value == "temporary_stop"
        assert c.irregular_patterns[1].active_weeks is None

    def test_irregular_patterns_empty_by_default(self) -> None:
        """irregular_patternsが未設定の場合は空リスト"""
        db = _mock_db_with_collections({"customers": [self._sample_customer_doc()]})
        c = load_customers(db)[0]
        assert c.irregular_patterns == []


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

    def test_split_shift_allowed_default(self) -> None:
        """split_shift_allowedが未設定の場合はFalse"""
        db = _mock_db_with_collections({"helpers": [self._sample_helper_doc()]})
        h = load_helpers(db)[0]
        assert h.split_shift_allowed is False

    def test_split_shift_allowed_true(self) -> None:
        """split_shift_allowed=Trueが正しく読み込まれる"""
        doc = _mock_doc(
            "H002",
            {
                "name": {"family": "田中", "given": "太郎"},
                "qualifications": [],
                "can_physical_care": False,
                "transportation": "bicycle",
                "weekly_availability": {},
                "preferred_hours": {"min": 10.0, "max": 20.0},
                "available_hours": {"min": 8.0, "max": 24.0},
                "employment_type": "part_time",
                "split_shift_allowed": True,
            },
        )
        db = _mock_db_with_collections({"helpers": [doc]})
        h = load_helpers(db)[0]
        assert h.split_shift_allowed is True


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


# --- 月次ローダーテスト ---


class TestLoadMonthlyOrders:
    def test_basic_loading(self) -> None:
        """月次オーダーの基本取得"""
        doc = _mock_doc(
            "ORD0001",
            {
                "customer_id": "C001",
                "date": datetime(2026, 2, 10),
                "start_time": "09:00",
                "end_time": "10:00",
                "service_type": "physical_care",
                "status": "completed",
                "assigned_staff_ids": ["H001"],
                "staff_count": 1,
            },
        )
        db = _mock_db_with_collections({"orders": [doc]})
        orders = load_monthly_orders(db, "2026-02")
        assert len(orders) == 1
        o = orders[0]
        assert o["id"] == "ORD0001"
        assert o["customer_id"] == "C001"
        assert o["date"] == "2026-02-10"
        assert o["start_time"] == "09:00"
        assert o["end_time"] == "10:00"
        assert o["service_type"] == "physical_care"
        assert o["status"] == "completed"
        assert o["assigned_staff_ids"] == ["H001"]
        assert o["staff_count"] == 1

    def test_all_statuses_included(self) -> None:
        """全ステータスのオーダーが含まれる"""
        docs = [
            _mock_doc(
                f"ORD{i:04d}",
                {
                    "customer_id": "C001",
                    "date": datetime(2026, 2, 10),
                    "start_time": "09:00",
                    "end_time": "10:00",
                    "service_type": "physical_care",
                    "status": status,
                    "assigned_staff_ids": [],
                },
            )
            for i, status in enumerate(["pending", "assigned", "completed", "cancelled"])
        ]
        db = _mock_db_with_collections({"orders": docs})
        orders = load_monthly_orders(db, "2026-02")
        assert len(orders) == 4
        statuses = {o["status"] for o in orders}
        assert statuses == {"pending", "assigned", "completed", "cancelled"}

    def test_empty_orders(self) -> None:
        """オーダーなしの場合"""
        db = _mock_db_with_collections({"orders": []})
        orders = load_monthly_orders(db, "2026-02")
        assert orders == []

    def test_null_doc_skipped(self) -> None:
        """to_dictがNoneのドキュメントはスキップ"""
        doc = MagicMock()
        doc.id = "ORD_NULL"
        doc.to_dict.return_value = None
        db = _mock_db_with_collections({"orders": [doc]})
        orders = load_monthly_orders(db, "2026-02")
        assert orders == []

    def test_december_year_boundary(self) -> None:
        """12月→翌年1月の境界テスト"""
        doc = _mock_doc(
            "ORD0001",
            {
                "customer_id": "C001",
                "date": datetime(2025, 12, 15),
                "start_time": "09:00",
                "end_time": "10:00",
                "service_type": "daily_living",
                "status": "completed",
                "assigned_staff_ids": ["H001"],
            },
        )
        db = _mock_db_with_collections({"orders": [doc]})
        orders = load_monthly_orders(db, "2025-12")
        assert len(orders) == 1

    def test_default_assigned_staff_ids(self) -> None:
        """assigned_staff_idsがない場合はデフォルト空リスト"""
        doc = _mock_doc(
            "ORD0001",
            {
                "customer_id": "C001",
                "date": datetime(2026, 2, 10),
                "start_time": "09:00",
                "end_time": "10:00",
                "service_type": "physical_care",
                "status": "pending",
            },
        )
        db = _mock_db_with_collections({"orders": [doc]})
        orders = load_monthly_orders(db, "2026-02")
        assert orders[0]["assigned_staff_ids"] == []
        assert orders[0]["staff_count"] == 1


class TestLoadAllHelpers:
    def test_basic_loading(self) -> None:
        """ヘルパーの基本取得（集計用フラットdict形式）"""
        doc = _mock_doc(
            "H001",
            {
                "name": {"family": "鈴木", "given": "花子"},
                "qualifications": ["介護福祉士"],
                "can_physical_care": True,
            },
        )
        db = _mock_db_with_collections({"helpers": [doc]})
        helpers = load_all_helpers(db)
        assert len(helpers) == 1
        h = helpers[0]
        assert h["id"] == "H001"
        assert h["family_name"] == "鈴木"
        assert h["given_name"] == "花子"

    def test_empty_collection(self) -> None:
        db = _mock_db_with_collections({"helpers": []})
        assert load_all_helpers(db) == []

    def test_null_doc_skipped(self) -> None:
        doc = MagicMock()
        doc.id = "H999"
        doc.to_dict.return_value = None
        db = _mock_db_with_collections({"helpers": [doc]})
        assert load_all_helpers(db) == []

    def test_multiple_helpers(self) -> None:
        docs = [
            _mock_doc("H001", {"name": {"family": "鈴木", "given": "花子"}}),
            _mock_doc("H002", {"name": {"family": "田中", "given": "一郎"}}),
        ]
        db = _mock_db_with_collections({"helpers": docs})
        helpers = load_all_helpers(db)
        assert len(helpers) == 2
        assert helpers[0]["id"] == "H001"
        assert helpers[1]["id"] == "H002"


class TestLoadAllCustomers:
    def test_basic_loading(self) -> None:
        """利用者の基本取得（集計用フラットdict形式）"""
        doc = _mock_doc(
            "C001",
            {
                "name": {"family": "山田", "given": "太郎"},
                "address": "鹿児島市",
            },
        )
        db = _mock_db_with_collections({"customers": [doc]})
        customers = load_all_customers(db)
        assert len(customers) == 1
        c = customers[0]
        assert c["id"] == "C001"
        assert c["family_name"] == "山田"
        assert c["given_name"] == "太郎"

    def test_empty_collection(self) -> None:
        db = _mock_db_with_collections({"customers": []})
        assert load_all_customers(db) == []

    def test_null_doc_skipped(self) -> None:
        doc = MagicMock()
        doc.id = "C999"
        doc.to_dict.return_value = None
        db = _mock_db_with_collections({"customers": [doc]})
        assert load_all_customers(db) == []

    def test_multiple_customers(self) -> None:
        docs = [
            _mock_doc("C001", {"name": {"family": "山田", "given": "太郎"}}),
            _mock_doc("C002", {"name": {"family": "佐藤", "given": "花子"}}),
        ]
        db = _mock_db_with_collections({"customers": docs})
        customers = load_all_customers(db)
        assert len(customers) == 2
        assert customers[0]["id"] == "C001"
        assert customers[1]["id"] == "C002"


# --- ServiceTypesローダーテスト ---


class TestLoadServiceTypes:
    def test_basic_loading(self) -> None:
        """service_typesコレクションの基本取得"""
        doc = _mock_doc(
            "physical_care",
            {
                "code": "physical_care",
                "label": "身体介護",
                "short_label": "身体",
                "requires_physical_care_cert": True,
                "sort_order": 1,
            },
        )
        db = _mock_db_with_collections({"service_types": [doc]})
        configs = load_service_types(db)
        assert len(configs) == 1
        c = configs[0]
        assert c.code == "physical_care"
        assert c.label == "身体介護"
        assert c.short_label == "身体"
        assert c.requires_physical_care_cert is True
        assert c.sort_order == 1

    def test_empty_collection(self) -> None:
        """空コレクションは空リストを返す"""
        db = _mock_db_with_collections({"service_types": []})
        assert load_service_types(db) == []

    def test_null_doc_skipped(self) -> None:
        """to_dictがNoneのドキュメントはスキップ"""
        doc = MagicMock()
        doc.id = "X"
        doc.to_dict.return_value = None
        db = _mock_db_with_collections({"service_types": [doc]})
        assert load_service_types(db) == []

    def test_multiple_configs(self) -> None:
        """複数種別を取得"""
        docs = [
            _mock_doc(
                "physical_care",
                {
                    "code": "physical_care",
                    "label": "身体介護",
                    "short_label": "身体",
                    "requires_physical_care_cert": True,
                    "sort_order": 1,
                },
            ),
            _mock_doc(
                "daily_living",
                {
                    "code": "daily_living",
                    "label": "生活援助",
                    "short_label": "生活",
                    "requires_physical_care_cert": False,
                    "sort_order": 2,
                },
            ),
        ]
        db = _mock_db_with_collections({"service_types": docs})
        configs = load_service_types(db)
        assert len(configs) == 2
        codes = {c.code for c in configs}
        assert codes == {"physical_care", "daily_living"}

    def test_code_defaults_to_doc_id(self) -> None:
        """codeフィールドがない場合はdoc.idを使用"""
        doc = _mock_doc(
            "transport_support",
            {
                "label": "移動支援",
                "short_label": "移動",
                "requires_physical_care_cert": False,
                "sort_order": 7,
            },
        )
        db = _mock_db_with_collections({"service_types": [doc]})
        configs = load_service_types(db)
        assert configs[0].code == "transport_support"


class TestLoadAllServiceTypes:
    def test_basic_loading(self) -> None:
        """dict形式で取得"""
        doc = _mock_doc(
            "physical_care",
            {
                "code": "physical_care",
                "label": "身体介護",
                "short_label": "身体",
                "requires_physical_care_cert": True,
                "sort_order": 1,
            },
        )
        db = _mock_db_with_collections({"service_types": [doc]})
        configs = load_all_service_types(db)
        assert len(configs) == 1
        c = configs[0]
        assert c["code"] == "physical_care"
        assert c["label"] == "身体介護"
        assert c["requires_physical_care_cert"] is True

    def test_empty_collection(self) -> None:
        db = _mock_db_with_collections({"service_types": []})
        assert load_all_service_types(db) == []


# --- household リンク統合テスト ---


class TestHouseholdLinkInFirestoreLoader:
    """load_optimization_input が household リンクを動的生成することを確認"""

    def _make_customer_doc(
        self, cid: str, household_id: str | None = None
    ) -> MagicMock:
        data: dict = {
            "name": {"family": "山田", "given": "太郎"},
            "address": "test",
            "location": {"lat": 31.5, "lng": 130.5},
            "ng_staff_ids": [],
            "preferred_staff_ids": [],
            "weekly_services": {},
            "service_manager": "",
        }
        if household_id:
            data["household_id"] = household_id
        return _mock_doc(cid, data)

    def _make_order_doc(
        self,
        oid: str,
        cid: str,
        start: str,
        end: str,
        linked_order_id: str | None = None,
    ) -> MagicMock:
        data: dict = {
            "customer_id": cid,
            "date": datetime(2026, 2, 9),
            "week_start_date": datetime(2026, 2, 9),
            "start_time": start,
            "end_time": end,
            "service_type": "physical_care",
            "status": "pending",
        }
        if linked_order_id:
            data["linked_order_id"] = linked_order_id
        return _mock_doc(oid, data)

    def test_household_link_generated_dynamically(self) -> None:
        """Firestoreにlinked_order_idがなくても動的リンクが生成される"""
        customer_docs = [
            self._make_customer_doc("C001", household_id="HH01"),
            self._make_customer_doc("C002", household_id="HH01"),
        ]
        helper_doc = _mock_doc(
            "H001",
            {
                "name": {"family": "鈴木", "given": "花子"},
                "qualifications": [],
                "can_physical_care": True,
                "transportation": "car",
                "weekly_availability": {},
                "preferred_hours": {"min": 20, "max": 30},
                "available_hours": {"min": 15, "max": 35},
                "customer_training_status": {},
                "employment_type": "full_time",
            },
        )
        order_docs = [
            # Firestoreにlinked_order_idなし（動的生成でリンクされるべき）
            self._make_order_doc("ORD0001", "C001", "09:00", "10:00"),
            self._make_order_doc("ORD0002", "C002", "10:00", "11:00"),
        ]
        db = _mock_db_with_collections(
            {
                "customers": customer_docs,
                "helpers": [helper_doc],
                "orders": order_docs,
                "travel_times": [],
                "staff_unavailability": [],
            }
        )

        inp = load_optimization_input(db, date(2026, 2, 9))

        orders_by_id = {o.id: o for o in inp.orders}
        assert orders_by_id["ORD0001"].linked_order_id == "ORD0002"
        assert orders_by_id["ORD0002"].linked_order_id == "ORD0001"

    def test_no_link_when_gap_exceeds_30min(self) -> None:
        """隙間が30分超のオーダーはリンクされない"""
        customer_docs = [
            self._make_customer_doc("C001", household_id="HH01"),
            self._make_customer_doc("C002", household_id="HH01"),
        ]
        helper_doc = _mock_doc(
            "H001",
            {
                "name": {"family": "鈴木", "given": "花子"},
                "qualifications": [],
                "can_physical_care": True,
                "transportation": "car",
                "weekly_availability": {},
                "preferred_hours": {"min": 20, "max": 30},
                "available_hours": {"min": 15, "max": 35},
                "customer_training_status": {},
                "employment_type": "full_time",
            },
        )
        order_docs = [
            self._make_order_doc("ORD0001", "C001", "09:00", "10:00"),
            self._make_order_doc("ORD0002", "C002", "10:31", "11:31"),  # gap > 30分
        ]
        db = _mock_db_with_collections(
            {
                "customers": customer_docs,
                "helpers": [helper_doc],
                "orders": order_docs,
                "travel_times": [],
                "staff_unavailability": [],
            }
        )

        inp = load_optimization_input(db, date(2026, 2, 9))

        orders_by_id = {o.id: o for o in inp.orders}
        assert orders_by_id["ORD0001"].linked_order_id is None
        assert orders_by_id["ORD0002"].linked_order_id is None
