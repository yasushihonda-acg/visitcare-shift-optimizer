"""note_parser.py のユニットテスト"""

import pytest

from optimizer.integrations.note_parser import (
    NoteActionType,
    ParsedNote,
    TimeRange,
    parse_note,
    parse_notes,
)
from optimizer.integrations.sheets_reader import NoteRow


def _make_note_row(**overrides) -> NoteRow:
    """テスト用NoteRowを生成"""
    defaults = {
        "handled": False,
        "content": "テスト様(連絡不要)\nテスト内容",
        "sub_category": "その他",
        "date_from": "2026-03-25",
        "date_to": "",
        "category": "未来のシフトに関連すること",
        "author": "テスト者",
        "timestamp": "2026/03/01 10:00:00",
        "post_id": "TEST001",
    }
    defaults.update(overrides)
    return NoteRow(**defaults)


# ---------------------------------------------------------------------------
# 利用者名抽出
# ---------------------------------------------------------------------------


class TestCustomerNameExtraction:
    def test_standard_name(self):
        row = _make_note_row(content="田實朝子様(武、ヘルパー様へ要連絡)\nテスト")
        result = parse_note(row)
        assert result.customer_name == "田實朝子"

    def test_name_with_space(self):
        row = _make_note_row(content="末永 智美様(連絡不要)\nテスト")
        result = parse_note(row)
        assert result.customer_name == "末永 智美"

    def test_no_customer_name_for_staff_leave(self):
        row = _make_note_row(
            content="★★ヘルパー欠勤情報★★\n永田 由香里ヘルパー\n\n【内容】\nお休み",
            sub_category="ヘルパーの休み",
        )
        result = parse_note(row)
        assert result.staff_name == "永田 由香里"
        assert result.action_type == NoteActionType.STAFF_UNAVAILABILITY


# ---------------------------------------------------------------------------
# 施設名抽出
# ---------------------------------------------------------------------------


class TestFacilityExtraction:
    def test_facility_name(self):
        row = _make_note_row(content="田實朝子様(武、ヘルパー様へ要連絡)\nテスト")
        result = parse_note(row)
        assert result.facility == "武"

    def test_facility_nanei(self):
        row = _make_note_row(content="新田久代様(南栄、ヘルパー様へ要連絡)\nテスト")
        result = parse_note(row)
        assert result.facility == "南栄"

    def test_no_facility_for_contact_not_needed(self):
        row = _make_note_row(content="末永智美様(連絡不要)\nテスト")
        result = parse_note(row)
        assert result.facility is None

    def test_no_facility_for_self(self):
        row = _make_note_row(content="大平明美様(本人様へ要連絡)\nテスト")
        result = parse_note(row)
        assert result.facility is None


# ---------------------------------------------------------------------------
# アクション種別判定
# ---------------------------------------------------------------------------


class TestActionTypeDetection:
    def test_cancel_keyword(self):
        row = _make_note_row(content="末永智美様(連絡不要)\nキャンセル")
        result = parse_note(row)
        assert result.action_type == NoteActionType.CANCEL

    def test_cancel_from_subcategory(self):
        row = _make_note_row(
            content="井上三智子様(連絡不要)\n入院のため",
            sub_category="入院及び中止",
        )
        result = parse_note(row)
        assert result.action_type == NoteActionType.CANCEL

    def test_time_change_with_arrow(self):
        row = _make_note_row(
            content="末永智美様(ご本人様へ要連絡)\n22:00- → 19:00-21:30へ時間変更"
        )
        result = parse_note(row)
        assert result.action_type == NoteActionType.UPDATE_TIME
        assert result.time_range is not None
        assert result.time_range.start == "22:00"
        assert result.new_time_range is not None
        assert result.new_time_range.start == "19:00"
        assert result.new_time_range.end == "21:30"

    def test_hospital_visit(self):
        row = _make_note_row(
            content="日髙定造様(田上、ヘルパー様へ要連絡)\n小田代病院受診同行\n13時発"
        )
        result = parse_note(row)
        assert result.action_type == NoteActionType.ADD_VISIT

    def test_meeting(self):
        row = _make_note_row(
            content="モリ様様(連絡不要)\n担当者会議\nご自宅にて",
            sub_category="担当者会議",
        )
        result = parse_note(row)
        assert result.action_type == NoteActionType.ADD_MEETING

    def test_staff_unavailability(self):
        row = _make_note_row(
            content="★★ヘルパー欠勤情報★★\n永田 由香里ヘルパー\nお休み",
            sub_category="ヘルパーの休み",
        )
        result = parse_note(row)
        assert result.action_type == NoteActionType.STAFF_UNAVAILABILITY

    def test_unknown(self):
        row = _make_note_row(
            content="満下和男様(連絡不要)\nいづろ今村病院 循環器科\n8:30〜予約"
        )
        result = parse_note(row)
        # 「受診同行」ではなく単なる「受診」情報 → ADD_VISIT or UNKNOWN
        assert result.action_type in (NoteActionType.ADD_VISIT, NoteActionType.UNKNOWN)


# ---------------------------------------------------------------------------
# 時刻抽出
# ---------------------------------------------------------------------------


class TestTimeExtraction:
    def test_range_with_tilde(self):
        row = _make_note_row(content="テスト様(連絡不要)\n9:00〜12:00")
        result = parse_note(row)
        assert result.time_range is not None
        assert result.time_range.start == "09:00"
        assert result.time_range.end == "12:00"

    def test_range_with_hyphen(self):
        row = _make_note_row(content="テスト様(連絡不要)\n13:00-14:30")
        result = parse_note(row)
        assert result.time_range is not None
        assert result.time_range.start == "13:00"
        assert result.time_range.end == "14:30"

    def test_start_only(self):
        row = _make_note_row(content="テスト様(連絡不要)\n9:30〜")
        result = parse_note(row)
        assert result.time_range is not None
        assert result.time_range.start == "09:30"
        assert result.time_range.end is None

    def test_kanji_time(self):
        row = _make_note_row(
            content="テスト様(連絡不要)\n受診同行\n13時発",
        )
        result = parse_note(row)
        assert result.time_range is not None
        assert result.time_range.start == "13:00"


# ---------------------------------------------------------------------------
# バッチ処理
# ---------------------------------------------------------------------------


class TestParseNotes:
    def test_multiple_notes(self):
        rows = [
            _make_note_row(content="A様(連絡不要)\nキャンセル", post_id="P1"),
            _make_note_row(
                content="B様(連絡不要)\n受診同行\n10:00〜",
                post_id="P2",
            ),
        ]
        results = parse_notes(rows)
        assert len(results) == 2
        assert results[0].action_type == NoteActionType.CANCEL
        assert results[1].action_type == NoteActionType.ADD_VISIT


# ---------------------------------------------------------------------------
# 実データに基づくテスト
# ---------------------------------------------------------------------------


class TestRealWorldPatterns:
    """実際のCURAノートデータパターンに基づくテスト"""

    def test_cancel_with_date_range(self):
        """期間指定のキャンセル"""
        row = _make_note_row(
            content="末永智美様(連絡不要)\n園田ヘルパーからの情報\n\n【内容】\n2026-04-04(土)のみ\nキャンセル\n\n",
            date_from="2026-04-04",
            date_to="2026-04-04",
        )
        result = parse_note(row)
        assert result.customer_name == "末永智美"
        assert result.action_type == NoteActionType.CANCEL

    def test_hospital_visit_with_time(self):
        """受診同行（時刻付き）"""
        row = _make_note_row(
            content="福永雅代様(笹貫、ヘルパー様へ要連絡)\n連絡先：0\n\n西村ヘルパーからの情報\n\n【内容】\n2026-03-23(月)のみ\n\n谷山病院受診\n9：00〜12：00\n\n",
            date_from="2026-03-23",
        )
        result = parse_note(row)
        assert result.customer_name == "福永雅代"
        assert result.action_type == NoteActionType.ADD_VISIT
        assert result.time_range is not None
        assert result.time_range.start == "09:00"
        assert result.time_range.end == "12:00"

    def test_time_change_with_period(self):
        """期間指定の時間変更"""
        row = _make_note_row(
            content=(
                "末永智美様(ご本人様へ要連絡)\n連絡先：09018722750\n\n"
                "園田ヘルパーからの情報\n\n【内容】\n"
                "2026-02-03(火)~2026-04-30(木)の期間\n\n"
                "2/3(火)〜4/30(木)\n22:00- → 19:00-21:30へ時間変更\n"
                "園田ヘルパー対応不可\n\n"
            ),
            date_from="2026-02-03",
            date_to="2026-04-30",
        )
        result = parse_note(row)
        assert result.customer_name == "末永智美"
        assert result.action_type == NoteActionType.UPDATE_TIME
        assert result.new_time_range is not None
        assert result.new_time_range.start == "19:00"
        assert result.new_time_range.end == "21:30"
