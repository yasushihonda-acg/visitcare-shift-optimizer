"""note_diff.py のユニットテスト"""

import pytest

from optimizer.integrations.note_diff import (
    ImportActionStatus,
    NoteImportAction,
    build_import_preview,
    generate_import_actions,
)
from optimizer.integrations.note_parser import NoteActionType, ParsedNote, TimeRange


def _make_parsed_note(**overrides) -> ParsedNote:
    """テスト用ParsedNoteを生成"""
    defaults = {
        "post_id": "TEST001",
        "customer_name": "田中太郎",
        "action_type": NoteActionType.CANCEL,
        "date_from": "2026-03-25",
        "raw_content": "テスト内容",
        "confidence": 0.8,
    }
    defaults.update(overrides)
    return ParsedNote(**defaults)


def _make_customer(family_name: str, given_name: str, customer_id: str = "C001") -> dict:
    return {
        "id": customer_id,
        "family_name": family_name,
        "given_name": given_name,
        "short_name": "",
    }


def _make_order(
    order_id: str,
    customer_id: str,
    date: str,
    start_time: str = "09:00",
    end_time: str = "10:00",
    service_type: str = "physical_care",
    status: str = "assigned",
) -> dict:
    return {
        "id": order_id,
        "customer_id": customer_id,
        "date": date,
        "start_time": start_time,
        "end_time": end_time,
        "service_type": service_type,
        "status": status,
    }


# ---------------------------------------------------------------------------
# 利用者マッチング
# ---------------------------------------------------------------------------


class TestCustomerMatching:
    def test_exact_match(self):
        note = _make_parsed_note(customer_name="田中太郎")
        customers = [_make_customer("田中", "太郎")]
        orders = [_make_order("O1", "C001", "2026-03-25")]

        actions = generate_import_actions([note], customers, orders)
        assert len(actions) == 1
        assert actions[0].matched_customer_id == "C001"

    def test_unmatched_customer(self):
        note = _make_parsed_note(customer_name="存在しない人")
        customers = [_make_customer("田中", "太郎")]
        orders = []

        actions = generate_import_actions([note], customers, orders)
        assert len(actions) == 1
        assert actions[0].status == ImportActionStatus.UNMATCHED

    def test_no_customer_name(self):
        note = _make_parsed_note(customer_name=None, action_type=NoteActionType.UNKNOWN)
        actions = generate_import_actions([note], [], [])
        assert len(actions) == 1
        assert actions[0].action_type == NoteActionType.UNKNOWN


# ---------------------------------------------------------------------------
# キャンセルアクション
# ---------------------------------------------------------------------------


class TestCancelAction:
    def test_cancel_with_matched_order(self):
        note = _make_parsed_note(
            action_type=NoteActionType.CANCEL,
            customer_name="田中太郎",
        )
        customers = [_make_customer("田中", "太郎")]
        orders = [_make_order("O1", "C001", "2026-03-25")]

        actions = generate_import_actions([note], customers, orders)
        assert len(actions) == 1
        assert actions[0].status == ImportActionStatus.READY
        assert actions[0].matched_order is not None
        assert actions[0].matched_order.order_id == "O1"
        assert actions[0].update_fields == {"status": "cancelled"}

    def test_cancel_no_matching_order(self):
        note = _make_parsed_note(
            action_type=NoteActionType.CANCEL,
            customer_name="田中太郎",
        )
        customers = [_make_customer("田中", "太郎")]
        orders = [_make_order("O1", "C001", "2026-04-01")]  # 日付不一致

        actions = generate_import_actions([note], customers, orders)
        assert len(actions) == 1
        assert actions[0].status == ImportActionStatus.NEEDS_REVIEW

    def test_cancel_multiple_orders_needs_review(self):
        note = _make_parsed_note(
            action_type=NoteActionType.CANCEL,
            customer_name="田中太郎",
        )
        customers = [_make_customer("田中", "太郎")]
        orders = [
            _make_order("O1", "C001", "2026-03-25", "09:00", "10:00"),
            _make_order("O2", "C001", "2026-03-25", "14:00", "15:00"),
        ]

        actions = generate_import_actions([note], customers, orders)
        assert len(actions) == 1
        assert actions[0].status == ImportActionStatus.NEEDS_REVIEW

    def test_cancel_skips_cancelled_orders(self):
        note = _make_parsed_note(
            action_type=NoteActionType.CANCEL,
            customer_name="田中太郎",
        )
        customers = [_make_customer("田中", "太郎")]
        orders = [_make_order("O1", "C001", "2026-03-25", status="cancelled")]

        actions = generate_import_actions([note], customers, orders)
        assert len(actions) == 1
        assert actions[0].status == ImportActionStatus.NEEDS_REVIEW


# ---------------------------------------------------------------------------
# 時間変更アクション
# ---------------------------------------------------------------------------


class TestUpdateTimeAction:
    def test_update_with_new_time(self):
        note = _make_parsed_note(
            action_type=NoteActionType.UPDATE_TIME,
            customer_name="田中太郎",
            time_range=TimeRange(start="22:00"),
            new_time_range=TimeRange(start="19:00", end="21:30"),
        )
        customers = [_make_customer("田中", "太郎")]
        orders = [_make_order("O1", "C001", "2026-03-25", "22:00", "23:00")]

        actions = generate_import_actions([note], customers, orders)
        assert len(actions) == 1
        assert actions[0].status == ImportActionStatus.READY
        assert actions[0].update_fields == {"start_time": "19:00", "end_time": "21:30"}

    def test_update_without_new_time_needs_review(self):
        note = _make_parsed_note(
            action_type=NoteActionType.UPDATE_TIME,
            customer_name="田中太郎",
            time_range=None,
            new_time_range=None,
        )
        customers = [_make_customer("田中", "太郎")]
        orders = [_make_order("O1", "C001", "2026-03-25")]

        actions = generate_import_actions([note], customers, orders)
        assert len(actions) == 1
        assert actions[0].status == ImportActionStatus.NEEDS_REVIEW


# ---------------------------------------------------------------------------
# 追加アクション
# ---------------------------------------------------------------------------


class TestAddAction:
    def test_add_visit(self):
        note = _make_parsed_note(
            action_type=NoteActionType.ADD_VISIT,
            customer_name="田中太郎",
            time_range=TimeRange(start="13:00", end="15:00"),
        )
        customers = [_make_customer("田中", "太郎")]

        actions = generate_import_actions([note], customers, [])
        assert len(actions) == 1
        assert actions[0].status == ImportActionStatus.READY
        assert actions[0].new_order_data is not None
        assert actions[0].new_order_data["service_type"] == "hospital_visit"
        assert actions[0].new_order_data["start_time"] == "13:00"

    def test_add_without_time_needs_review(self):
        note = _make_parsed_note(
            action_type=NoteActionType.ADD_VISIT,
            customer_name="田中太郎",
            time_range=None,
        )
        customers = [_make_customer("田中", "太郎")]

        actions = generate_import_actions([note], customers, [])
        assert len(actions) == 1
        assert actions[0].status == ImportActionStatus.NEEDS_REVIEW


# ---------------------------------------------------------------------------
# ヘルパー休み
# ---------------------------------------------------------------------------


class TestStaffUnavailability:
    def test_staff_leave_skipped(self):
        note = _make_parsed_note(
            action_type=NoteActionType.STAFF_UNAVAILABILITY,
            customer_name=None,
            staff_name="永田 由香里",
        )
        actions = generate_import_actions([note], [], [])
        assert len(actions) == 1
        assert actions[0].status == ImportActionStatus.SKIPPED


# ---------------------------------------------------------------------------
# プレビュー構築
# ---------------------------------------------------------------------------


class TestBuildImportPreview:
    def test_preview_counts(self):
        notes = [
            _make_parsed_note(
                post_id="P1",
                action_type=NoteActionType.CANCEL,
                customer_name="田中太郎",
            ),
            _make_parsed_note(
                post_id="P2",
                action_type=NoteActionType.UNKNOWN,
                customer_name="不明",
            ),
            _make_parsed_note(
                post_id="P3",
                action_type=NoteActionType.STAFF_UNAVAILABILITY,
                staff_name="テストヘルパー",
            ),
        ]
        customers = [_make_customer("田中", "太郎")]
        orders = [_make_order("O1", "C001", "2026-03-25")]

        preview = build_import_preview("SHEET_ID", notes, customers, orders)
        assert preview.total_notes == 3
        assert preview.ready_count == 1  # cancel
        assert preview.review_count == 1  # unknown
        assert preview.skipped_count == 1  # staff_unavailability
