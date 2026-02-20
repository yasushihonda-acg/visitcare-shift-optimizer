"""link_household モジュールのユニットテスト"""

from optimizer.data.link_household import link_household_orders
from optimizer.models import Customer, DayOfWeek, GeoLocation, Order


def _make_customer(cid: str, household_id: str | None = None) -> Customer:
    return Customer(
        id=cid,
        family_name="山田",
        given_name="太郎",
        address="test",
        location=GeoLocation(lat=31.5, lng=130.5),
        weekly_services={},
        household_id=household_id,
    )


def _make_order(oid: str, cid: str, start: str, end: str, date: str = "2026-02-09") -> Order:
    return Order(
        id=oid,
        customer_id=cid,
        date=date,
        day_of_week=DayOfWeek.MONDAY,
        start_time=start,
        end_time=end,
        service_type="physical_care",
        staff_count=1,
    )


class TestLinkHouseholdOrders:
    def test_linked_when_gap_within_30min(self) -> None:
        """連続時間帯（隙間30分以内）のペアにlinked_order_idが設定される"""
        customers = [
            _make_customer("C001", household_id="HH01"),
            _make_customer("C002", household_id="HH01"),
        ]
        o1 = _make_order("ORD0001", "C001", "09:00", "10:00")
        o2 = _make_order("ORD0002", "C002", "10:00", "11:00")  # gap = 0分
        orders = [o1, o2]

        link_household_orders(orders, customers)

        assert o1.linked_order_id == "ORD0002"
        assert o2.linked_order_id == "ORD0001"

    def test_linked_when_gap_exactly_30min(self) -> None:
        """隙間ちょうど30分でもリンクされる"""
        customers = [
            _make_customer("C001", household_id="HH01"),
            _make_customer("C002", household_id="HH01"),
        ]
        o1 = _make_order("ORD0001", "C001", "09:00", "10:00")
        o2 = _make_order("ORD0002", "C002", "10:30", "11:30")  # gap = 30分
        orders = [o1, o2]

        link_household_orders(orders, customers)

        assert o1.linked_order_id == "ORD0002"
        assert o2.linked_order_id == "ORD0001"

    def test_not_linked_when_gap_exceeds_30min(self) -> None:
        """隙間が30分超の場合はリンクされない"""
        customers = [
            _make_customer("C001", household_id="HH01"),
            _make_customer("C002", household_id="HH01"),
        ]
        o1 = _make_order("ORD0001", "C001", "09:00", "10:00")
        o2 = _make_order("ORD0002", "C002", "10:31", "11:31")  # gap = 31分
        orders = [o1, o2]

        link_household_orders(orders, customers)

        assert o1.linked_order_id is None
        assert o2.linked_order_id is None

    def test_no_link_for_different_households(self) -> None:
        """異なる世帯のオーダーはリンクされない"""
        customers = [
            _make_customer("C001", household_id="HH01"),
            _make_customer("C002", household_id="HH02"),
        ]
        o1 = _make_order("ORD0001", "C001", "09:00", "10:00")
        o2 = _make_order("ORD0002", "C002", "10:00", "11:00")
        orders = [o1, o2]

        link_household_orders(orders, customers)

        assert o1.linked_order_id is None
        assert o2.linked_order_id is None

    def test_no_link_without_household_id(self) -> None:
        """household_idがない利用者のオーダーはリンクされない"""
        customers = [
            _make_customer("C001", household_id=None),
            _make_customer("C002", household_id=None),
        ]
        o1 = _make_order("ORD0001", "C001", "09:00", "10:00")
        o2 = _make_order("ORD0002", "C002", "10:00", "11:00")
        orders = [o1, o2]

        link_household_orders(orders, customers)

        assert o1.linked_order_id is None
        assert o2.linked_order_id is None

    def test_no_link_for_different_dates(self) -> None:
        """異なる日付のオーダーはリンクされない"""
        customers = [
            _make_customer("C001", household_id="HH01"),
            _make_customer("C002", household_id="HH01"),
        ]
        o1 = _make_order("ORD0001", "C001", "09:00", "10:00", date="2026-02-09")
        o2 = _make_order("ORD0002", "C002", "10:00", "11:00", date="2026-02-10")
        orders = [o1, o2]

        link_household_orders(orders, customers)

        assert o1.linked_order_id is None
        assert o2.linked_order_id is None

    def test_empty_orders(self) -> None:
        """オーダーが空でもエラーにならない"""
        customers = [_make_customer("C001", household_id="HH01")]
        link_household_orders([], customers)

    def test_empty_customers(self) -> None:
        """利用者が空でもエラーにならない"""
        o1 = _make_order("ORD0001", "C001", "09:00", "10:00")
        link_household_orders([o1], [])
        assert o1.linked_order_id is None

    def test_custom_gap_minutes(self) -> None:
        """gap_minutesパラメータが機能する"""
        customers = [
            _make_customer("C001", household_id="HH01"),
            _make_customer("C002", household_id="HH01"),
        ]
        o1 = _make_order("ORD0001", "C001", "09:00", "10:00")
        o2 = _make_order("ORD0002", "C002", "10:20", "11:20")  # gap = 20分

        # gap_minutes=10 → リンクされない
        link_household_orders([o1, o2], customers, gap_minutes=10)
        assert o1.linked_order_id is None

        # リセット
        o1.linked_order_id = None
        o2.linked_order_id = None

        # gap_minutes=30 → リンクされる
        link_household_orders([o1, o2], customers, gap_minutes=30)
        assert o1.linked_order_id == "ORD0002"

    def test_existing_linked_order_id_overwritten(self) -> None:
        """Firestoreに既存のlinked_order_idがあっても動的リンクで上書きされる"""
        customers = [
            _make_customer("C001", household_id="HH01"),
            _make_customer("C002", household_id="HH01"),
        ]
        o1 = _make_order("ORD0001", "C001", "09:00", "10:00")
        o2 = _make_order("ORD0002", "C002", "10:00", "11:00")
        o1.linked_order_id = "OLD_ID"  # 既存の値

        link_household_orders([o1, o2], customers)

        assert o1.linked_order_id == "ORD0002"
        assert o2.linked_order_id == "ORD0001"
