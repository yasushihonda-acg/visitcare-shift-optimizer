"""Pydanticモデルのテスト"""

import pytest
from pydantic import ValidationError

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
    ServiceType,
    StaffConstraint,
    StaffUnavailability,
    TravelTime,
    UnavailableSlot,
)


class TestCustomer:
    def test_basic_creation(self) -> None:
        c = Customer(
            id="C001",
            family_name="山田",
            given_name="太郎",
            address="鹿児島市天文館町10-1",
            location=GeoLocation(lat=31.5916, lng=130.5571),
            service_manager="田中美咲",
        )
        assert c.id == "C001"
        assert c.ng_staff_ids == []
        assert c.preferred_staff_ids == []
        assert c.weekly_services == {}
        assert c.household_id is None

    def test_with_weekly_services(self) -> None:
        c = Customer(
            id="C001",
            family_name="山田",
            given_name="太郎",
            address="鹿児島市",
            location=GeoLocation(lat=31.59, lng=130.55),
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
        assert len(c.weekly_services[DayOfWeek.MONDAY]) == 1

    def test_with_constraints(self) -> None:
        c = Customer(
            id="C001",
            family_name="山田",
            given_name="太郎",
            address="鹿児島市",
            location=GeoLocation(lat=31.59, lng=130.55),
            ng_staff_ids=["H006", "H014"],
            preferred_staff_ids=["H001"],
            household_id="H001",
        )
        assert c.ng_staff_ids == ["H006", "H014"]
        assert c.household_id == "H001"


class TestHelper:
    def test_basic_creation(self) -> None:
        h = Helper(
            id="H001",
            family_name="田中",
            given_name="美咲",
            short_name="田中",
            qualifications=["介護福祉士"],
            can_physical_care=True,
            transportation="car",
            preferred_hours=HoursRange(min=6, max=8),
            available_hours=HoursRange(min=4, max=8),
            employment_type="full_time",
        )
        assert h.can_physical_care is True
        assert h.preferred_hours.min == 6

    def test_no_qualification(self) -> None:
        h = Helper(
            id="H017",
            family_name="無資格",
            given_name="太郎",
            qualifications=[],
            can_physical_care=False,
            transportation="bicycle",
            preferred_hours=HoursRange(min=4, max=6),
            available_hours=HoursRange(min=3, max=6),
            employment_type="part_time",
        )
        assert h.can_physical_care is False
        assert h.employment_type == "part_time"


class TestOrder:
    def test_basic_creation(self) -> None:
        o = Order(
            id="ORD001",
            customer_id="C001",
            date="2025-01-06",
            day_of_week="monday",
            start_time="09:00",
            end_time="10:00",
            service_type="physical_care",
        )
        assert o.staff_count == 1
        assert o.linked_order_id is None

    def test_linked_order(self) -> None:
        o = Order(
            id="ORD002",
            customer_id="C001",
            date="2025-01-06",
            day_of_week="monday",
            start_time="10:00",
            end_time="11:00",
            service_type="daily_living",
            linked_order_id="ORD001",
        )
        assert o.linked_order_id == "ORD001"


class TestTravelTime:
    def test_basic_creation(self) -> None:
        tt = TravelTime(from_id="C001", to_id="C002", travel_time_minutes=5.3)
        assert tt.travel_time_minutes == 5.3


class TestStaffUnavailability:
    def test_all_day(self) -> None:
        su = StaffUnavailability(
            staff_id="H003",
            week_start_date="2025-01-06",
            unavailable_slots=[
                UnavailableSlot(date="2025-01-07", all_day=True),
            ],
        )
        assert su.unavailable_slots[0].all_day is True
        assert su.unavailable_slots[0].start_time is None

    def test_time_range(self) -> None:
        su = StaffUnavailability(
            staff_id="H005",
            week_start_date="2025-01-06",
            unavailable_slots=[
                UnavailableSlot(
                    date="2025-01-08",
                    all_day=False,
                    start_time="09:00",
                    end_time="12:00",
                ),
            ],
        )
        assert su.unavailable_slots[0].start_time == "09:00"


class TestStaffConstraint:
    def test_ng(self) -> None:
        sc = StaffConstraint(customer_id="C004", staff_id="H006", constraint_type="ng")
        assert sc.constraint_type == "ng"

    def test_preferred(self) -> None:
        sc = StaffConstraint(customer_id="C001", staff_id="H001", constraint_type="preferred")
        assert sc.constraint_type == "preferred"

    def test_invalid_type(self) -> None:
        with pytest.raises(ValidationError):
            StaffConstraint(customer_id="C001", staff_id="H001", constraint_type="invalid")


class TestOptimizationInput:
    def test_empty(self) -> None:
        inp = OptimizationInput(
            customers=[],
            helpers=[],
            orders=[],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
        )
        assert len(inp.orders) == 0
