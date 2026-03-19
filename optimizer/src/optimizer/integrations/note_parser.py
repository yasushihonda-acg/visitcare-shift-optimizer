"""CURAノート自由テキスト解析モジュール

スケジュール変更内容（自由テキスト）から利用者名・アクション種別・時刻を抽出する。
"""

from __future__ import annotations

import re
from enum import Enum

from pydantic import BaseModel, Field

from optimizer.integrations.sheets_reader import NoteRow


class NoteActionType(str, Enum):
    """ノートから判定されるアクション種別"""

    CANCEL = "cancel"
    UPDATE_TIME = "update_time"
    ADD_VISIT = "add_visit"
    ADD_MEETING = "add_meeting"
    ADD = "add"
    STAFF_UNAVAILABILITY = "staff_unavailability"
    UNKNOWN = "unknown"


class TimeRange(BaseModel):
    """時間帯"""

    start: str = Field(description="開始時刻 HH:MM")
    end: str | None = Field(default=None, description="終了時刻 HH:MM")


class ParsedNote(BaseModel):
    """解析済みノート"""

    post_id: str
    customer_name: str | None = Field(default=None, description="利用者名")
    staff_name: str | None = Field(default=None, description="ヘルパー名（休み情報の場合）")
    facility: str | None = Field(default=None, description="施設名")
    action_type: NoteActionType
    date_from: str = Field(description="YYYY-MM-DD")
    date_to: str = Field(default="", description="YYYY-MM-DD（空=単日）")
    time_range: TimeRange | None = Field(default=None, description="時間帯")
    new_time_range: TimeRange | None = Field(
        default=None, description="変更後の時間帯（時間変更の場合）"
    )
    contact_required: str = Field(default="")
    raw_content: str = Field(description="元のスケジュール変更内容テキスト")
    sub_category: str = Field(default="")
    author: str = Field(default="")
    confidence: float = Field(
        default=1.0, description="解析の確信度 (0.0-1.0)"
    )


# ---------------------------------------------------------------------------
# 正規表現パターン
# ---------------------------------------------------------------------------

# 利用者名: 先頭の「XXX様」
_CUSTOMER_NAME_RE = re.compile(r"^(.+?)様")

# ヘルパー名: 「★★ヘルパー欠勤情報★★\n{name}ヘルパー」
_STAFF_NAME_RE = re.compile(r"★+ヘルパー欠勤情報★+\s*\n(.+?)ヘルパー")

# 施設名: 「様(施設名、」または「様(施設名 」
_FACILITY_RE = re.compile(r"様\((.+?)(?:[、,\s]|へ|様)")

# 時刻: HH:MM〜HH:MM or HH:MM-HH:MM
_TIME_RANGE_RE = re.compile(
    r"(\d{1,2})[：:](\d{2})\s*[〜～\-ー]\s*(\d{1,2})[：:](\d{2})"
)

# 開始時刻のみ: HH:MM〜 or HH:MM-
_TIME_START_RE = re.compile(r"(\d{1,2})[：:](\d{2})\s*[〜～\-ー]")

# 漢字時刻: X時Y分 or X時
_TIME_KANJI_RE = re.compile(r"(\d{1,2})時(?:(\d{1,2})分)?")

# 時間変更: 旧時刻 → 新時刻
_TIME_CHANGE_RE = re.compile(
    r"(\d{1,2})[：:](\d{2})\s*[〜～\-ー]\s*"
    r"→\s*"
    r"(\d{1,2})[：:](\d{2})\s*[〜～\-ー]\s*(\d{1,2})[：:](\d{2})"
)

# 時間変更パターン2: 旧時刻範囲 → 新時刻範囲
_TIME_CHANGE_FULL_RE = re.compile(
    r"(\d{1,2})[：:](\d{2})\s*[〜～\-ー]\s*(\d{1,2})[：:](\d{2})\s*"
    r"→\s*"
    r"(\d{1,2})[：:](\d{2})\s*[〜～\-ー]\s*(\d{1,2})[：:](\d{2})"
)


# キーワードによるアクション判定
_CANCEL_KEYWORDS = ["キャンセル", "中止", "お休み"]
_TIME_CHANGE_KEYWORDS = ["時間変更", "→"]
_VISIT_KEYWORDS = ["受診同行", "受診"]
_MEETING_KEYWORDS = ["担当者会議", "担会"]
_ADD_KEYWORDS = ["追加", "新規"]


# ---------------------------------------------------------------------------
# 解析関数
# ---------------------------------------------------------------------------


def _extract_customer_name(content: str) -> str | None:
    """スケジュール変更内容の先頭行から利用者名を抽出"""
    first_line = content.split("\n")[0]
    m = _CUSTOMER_NAME_RE.search(first_line)
    if m:
        return m.group(1).strip()
    return None


def _extract_staff_name(content: str) -> str | None:
    """ヘルパー欠勤情報からヘルパー名を抽出"""
    m = _STAFF_NAME_RE.search(content)
    if m:
        return m.group(1).strip()
    return None


def _extract_facility(content: str) -> str | None:
    """施設名を抽出"""
    first_line = content.split("\n")[0]
    m = _FACILITY_RE.search(first_line)
    if m:
        facility = m.group(1).strip()
        # 連絡不要/本人/ご本人 は施設名ではない
        if facility in ("連絡不要", "本人", "ご本人", "調整後"):
            return None
        return facility
    return None


def _fmt_time(h: str, m: str) -> str:
    """時刻を HH:MM 形式にフォーマット"""
    return f"{int(h):02d}:{int(m):02d}"


def _extract_time_change(content: str) -> tuple[TimeRange | None, TimeRange | None]:
    """時間変更パターンを抽出（旧時間帯, 新時間帯）"""
    # パターン1: 旧範囲 → 新範囲
    m = _TIME_CHANGE_FULL_RE.search(content)
    if m:
        old_range = TimeRange(
            start=_fmt_time(m.group(1), m.group(2)),
            end=_fmt_time(m.group(3), m.group(4)),
        )
        new_range = TimeRange(
            start=_fmt_time(m.group(5), m.group(6)),
            end=_fmt_time(m.group(7), m.group(8)),
        )
        return old_range, new_range

    # パターン2: 旧開始〜 → 新範囲
    m = _TIME_CHANGE_RE.search(content)
    if m:
        old_range = TimeRange(start=_fmt_time(m.group(1), m.group(2)))
        new_range = TimeRange(
            start=_fmt_time(m.group(3), m.group(4)),
            end=_fmt_time(m.group(5), m.group(6)),
        )
        return old_range, new_range

    return None, None


def _extract_time_range(content: str) -> TimeRange | None:
    """テキストから時間帯を抽出"""
    # 完全な範囲: HH:MM〜HH:MM
    m = _TIME_RANGE_RE.search(content)
    if m:
        return TimeRange(
            start=_fmt_time(m.group(1), m.group(2)),
            end=_fmt_time(m.group(3), m.group(4)),
        )

    # 開始のみ: HH:MM〜
    m = _TIME_START_RE.search(content)
    if m:
        return TimeRange(start=_fmt_time(m.group(1), m.group(2)))

    # 漢字: X時Y分
    m = _TIME_KANJI_RE.search(content)
    if m:
        minute = m.group(2) or "00"
        return TimeRange(start=_fmt_time(m.group(1), minute))

    return None


def _determine_action_type(
    content: str, sub_category: str
) -> tuple[NoteActionType, float]:
    """アクション種別を判定し、確信度を返す"""
    # 優先度1: ヘルパーの休み
    if sub_category == "ヘルパーの休み":
        return NoteActionType.STAFF_UNAVAILABILITY, 0.9

    # 優先度2: 入院及び中止
    if sub_category == "入院及び中止":
        return NoteActionType.CANCEL, 0.9

    # 優先度3: キャンセル
    if any(kw in content for kw in _CANCEL_KEYWORDS):
        return NoteActionType.CANCEL, 0.8

    # 優先度4: 時間変更
    if any(kw in content for kw in _TIME_CHANGE_KEYWORDS):
        # 「→」は時間変更の文脈かチェック
        if "→" in content:
            # 時刻パターンとセットの場合のみ
            if _TIME_CHANGE_RE.search(content) or _TIME_CHANGE_FULL_RE.search(content):
                return NoteActionType.UPDATE_TIME, 0.8
            if "時間変更" in content:
                return NoteActionType.UPDATE_TIME, 0.7
        elif "時間変更" in content:
            return NoteActionType.UPDATE_TIME, 0.7

    # 優先度5: 担当者会議
    if sub_category == "担当者会議" or any(kw in content for kw in _MEETING_KEYWORDS):
        return NoteActionType.ADD_MEETING, 0.7

    # 優先度6: 受診同行
    if any(kw in content for kw in _VISIT_KEYWORDS):
        return NoteActionType.ADD_VISIT, 0.7

    # 優先度7: 追加
    if any(kw in content for kw in _ADD_KEYWORDS):
        return NoteActionType.ADD, 0.6

    # 判定不能
    return NoteActionType.UNKNOWN, 0.3


def parse_note(note_row: NoteRow) -> ParsedNote:
    """NoteRow を解析して ParsedNote を生成する"""
    content = note_row.content

    # 利用者名 or ヘルパー名
    customer_name = _extract_customer_name(content)
    staff_name = _extract_staff_name(content)
    facility = _extract_facility(content)

    # アクション種別
    action_type, confidence = _determine_action_type(content, note_row.sub_category)

    # 時間帯
    time_range: TimeRange | None = None
    new_time_range: TimeRange | None = None

    if action_type == NoteActionType.UPDATE_TIME:
        old_tr, new_tr = _extract_time_change(content)
        time_range = old_tr
        new_time_range = new_tr
        if old_tr is None and new_tr is None:
            # 時間変更と判定したが時刻を抽出できなかった
            time_range = _extract_time_range(content)
            confidence = min(confidence, 0.5)
    else:
        time_range = _extract_time_range(content)

    return ParsedNote(
        post_id=note_row.post_id,
        customer_name=customer_name,
        staff_name=staff_name,
        facility=facility,
        action_type=action_type,
        date_from=note_row.date_from,
        date_to=note_row.date_to,
        time_range=time_range,
        new_time_range=new_time_range,
        contact_required=note_row.contact_required,
        raw_content=content,
        sub_category=note_row.sub_category,
        author=note_row.author,
        confidence=confidence,
    )


def parse_notes(note_rows: list[NoteRow]) -> list[ParsedNote]:
    """NoteRow のリストを一括解析"""
    return [parse_note(row) for row in note_rows]
