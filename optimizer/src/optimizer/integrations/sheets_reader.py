"""CURAノート スプレッドシート読み取りモジュール"""

from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Pydantic モデル
# ---------------------------------------------------------------------------


class NoteRow(BaseModel):
    """NOTEシートの1行を表す"""

    handled: bool = Field(description="対応可否 (True=処理済み)")
    comment: str = Field(default="", description="コメント")
    schedule_reflected: str = Field(default="", description="週間スケジュール反映")
    contact_required: str = Field(default="", description="連絡要否")
    content: str = Field(description="スケジュール変更内容（自由テキスト）")
    sub_category: str = Field(default="", description="入退院・その他")
    date_from: str = Field(description="日付：From (YYYY-MM-DD)")
    date_to: str = Field(default="", description="日付：To (YYYY-MM-DD)")
    category: str = Field(default="", description="カテゴリー")
    author: str = Field(default="", description="入力者（ヘルパー）")
    timestamp: str = Field(default="", description="TimeStamp")
    post_id: str = Field(description="投稿ID")


# 列名 → NoteRow フィールドのマッピング（列名ベースで列順序に非依存）
_COLUMN_MAP: dict[str, str] = {
    "対応\n可否": "handled",
    "コメント": "comment",
    "週間スケジュール反映": "schedule_reflected",
    "\u3000連絡要否": "contact_required",
    "スケジュール変更内容": "content",
    "入退院・その他": "sub_category",
    "日付：From": "date_from",
    "日付：To": "date_to",
    "カテゴリー": "category",
    "入力者（ヘルパー）": "author",
    "TimeStamp": "timestamp",
    "投稿ID": "post_id",
}

# ヘッダーの正規化（改行除去・前後空白トリム）
_NORMALIZE_RE = re.compile(r"\s+")


def _normalize_header(raw: str) -> str:
    """ヘッダー文字列を正規化（改行→空白変換してからマッチ）"""
    return raw.strip()


def _build_column_index(header_row: list[str]) -> dict[str, int]:
    """ヘッダー行からフィールド名→列インデックスのマッピングを構築"""
    index_map: dict[str, int] = {}
    for i, raw_name in enumerate(header_row):
        normalized = _normalize_header(raw_name)
        if normalized in _COLUMN_MAP:
            index_map[_COLUMN_MAP[normalized]] = i
    return index_map


def _row_to_note(row: list[str], col_index: dict[str, int]) -> NoteRow | None:
    """1行のデータをNoteRowに変換。必須フィールドが欠けている場合はNoneを返す"""

    def get(field: str) -> str:
        idx = col_index.get(field)
        if idx is None or idx >= len(row):
            return ""
        return str(row[idx]).strip()

    handled_raw = get("handled")
    handled = handled_raw == "1" or handled_raw.lower() == "true"

    content = get("content")
    post_id = get("post_id")
    date_from = get("date_from")

    # 必須フィールドのバリデーション
    if not content or not post_id or not date_from:
        return None

    return NoteRow(
        handled=handled,
        comment=get("comment"),
        schedule_reflected=get("schedule_reflected"),
        contact_required=get("contact_required"),
        content=content,
        sub_category=get("sub_category"),
        date_from=date_from,
        date_to=get("date_to"),
        category=get("category"),
        author=get("author"),
        timestamp=get("timestamp"),
        post_id=post_id,
    )


# ---------------------------------------------------------------------------
# Sheets API 読み取り
# ---------------------------------------------------------------------------

# NOTEシートの読み取り範囲: 列A-L（12列）, 最大5000行
_NOTE_RANGE = "NOTE!A1:L5000"


def read_note_rows(
    sheets_service: Any,
    spreadsheet_id: str,
    *,
    only_unhandled: bool = True,
) -> list[NoteRow]:
    """NOTEシートから行を読み取り、NoteRowのリストとして返す。

    Args:
        sheets_service: Google Sheets API service オブジェクト
        spreadsheet_id: スプレッドシートID
        only_unhandled: True の場合、対応可否=0（未処理）の行のみ返す

    Returns:
        NoteRow のリスト
    """
    result = (
        sheets_service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=_NOTE_RANGE)
        .execute()
    )

    all_rows: list[list[str]] = result.get("values", [])
    if len(all_rows) < 2:
        return []

    header_row = all_rows[0]
    col_index = _build_column_index(header_row)

    # 必須列の存在チェック
    required = {"content", "post_id", "date_from"}
    missing = required - set(col_index.keys())
    if missing:
        raise ValueError(f"必須列が見つかりません: {missing}")

    notes: list[NoteRow] = []
    for row in all_rows[1:]:
        note = _row_to_note(row, col_index)
        if note is None:
            continue
        if only_unhandled and note.handled:
            continue
        notes.append(note)

    return notes


def mark_notes_as_handled(
    sheets_service: Any,
    spreadsheet_id: str,
    post_ids: list[str],
) -> int:
    """指定した投稿IDのノートを対応済み（対応可否=1）に更新する。

    Returns:
        更新した行数
    """
    # まず全データを読み取り、投稿IDの行番号を特定
    result = (
        sheets_service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=_NOTE_RANGE)
        .execute()
    )

    all_rows: list[list[str]] = result.get("values", [])
    if len(all_rows) < 2:
        return 0

    header_row = all_rows[0]
    col_index = _build_column_index(header_row)

    post_id_col = col_index.get("post_id")
    handled_col = col_index.get("handled")
    if post_id_col is None or handled_col is None:
        return 0

    post_id_set = set(post_ids)
    update_data: list[dict[str, Any]] = []

    for row_idx, row in enumerate(all_rows[1:], start=2):  # 1-indexed, skip header
        if post_id_col < len(row) and row[post_id_col] in post_id_set:
            # A列(handled)のセルを更新
            cell = f"NOTE!{chr(65 + handled_col)}{row_idx}"
            update_data.append({"range": cell, "values": [["1"]]})

    if not update_data:
        return 0

    sheets_service.spreadsheets().values().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"valueInputOption": "RAW", "data": update_data},
    ).execute()

    return len(update_data)
