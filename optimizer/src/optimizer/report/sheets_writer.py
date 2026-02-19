"""Google Sheets APIを使った月次レポート作成モジュール"""

from typing import Any


def minutes_to_hours_str(minutes: int) -> str:
    """分数を 'X時間Y分' 形式に変換（Y分が0の場合は 'X時間'）"""
    h = minutes // 60
    m = minutes % 60
    if m == 0:
        return f"{h}時間"
    return f"{h}時間{m}分"


def _build_sheet_properties(title: str, index: int) -> dict[str, Any]:
    return {"properties": {"title": title, "index": index}}


def _header_format_request(sheet_id: int) -> dict[str, Any]:
    """ヘッダー行（1行目）を太字＋背景色に設定するリクエスト"""
    return {
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": 0,
                "endRowIndex": 1,
            },
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": {
                        "red": 0.85,
                        "green": 0.92,
                        "blue": 1.0,
                    },
                    "textFormat": {"bold": True},
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat)",
        }
    }


def _bold_row_request(sheet_id: int, row_index: int) -> dict[str, Any]:
    """指定行を太字にするリクエスト（合計行用）"""
    return {
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": row_index,
                "endRowIndex": row_index + 1,
            },
            "cell": {
                "userEnteredFormat": {
                    "textFormat": {"bold": True},
                }
            },
            "fields": "userEnteredFormat(textFormat)",
        }
    }


def create_monthly_report_spreadsheet(
    service: Any,
    drive_service: Any,
    year_month: str,
    status_summary: dict[str, object],
    service_type_summary: list[dict[str, object]],
    staff_summary: list[dict[str, object]],
    customer_summary: list[dict[str, object]],
    share_with_email: str | None = None,
) -> dict[str, str]:
    """
    Google Sheetsに月次レポートを作成し、スプレッドシートIDとURLを返す。

    Returns:
        {
            "spreadsheet_id": str,
            "spreadsheet_url": str,
        }
    """
    # year_month ("2026-02") からタイトル生成
    year, month = year_month.split("-")
    title = f"月次レポート {year}年{int(month)}月"

    # --- 1. スプレッドシート作成（4シート） ---
    spreadsheet_body: dict[str, Any] = {
        "properties": {"title": title},
        "sheets": [
            _build_sheet_properties("ステータス集計", 0),
            _build_sheet_properties("サービス種別集計", 1),
            _build_sheet_properties("スタッフ別稼働時間", 2),
            _build_sheet_properties("利用者別サービス実績", 3),
        ],
    }

    created = service.spreadsheets().create(body=spreadsheet_body).execute()  # type: ignore[attr-defined]
    spreadsheet_id: str = created["spreadsheetId"]
    spreadsheet_url: str = created["spreadsheetUrl"]

    # シートIDを取得
    sheet_ids: list[int] = [
        s["properties"]["sheetId"] for s in created["sheets"]
    ]

    # --- 2. データ書き込み ---
    # ステータス集計シート
    pending = status_summary.get("pending", 0)
    assigned = status_summary.get("assigned", 0)
    completed = status_summary.get("completed", 0)
    cancelled = status_summary.get("cancelled", 0)
    total = status_summary.get("total", 0)
    completion_rate = status_summary.get("completion_rate", 0.0)

    status_data = [
        ["ステータス", "件数"],
        ["未割当(pending)", pending],
        ["割当済(assigned)", assigned],
        ["実績確認済(completed)", completed],
        ["キャンセル", cancelled],
        ["合計", total],
        ["実績確認率", f"{completion_rate}%"],
    ]

    # サービス種別集計シート
    total_visits = sum(int(item.get("visit_count", 0)) for item in service_type_summary)
    total_service_minutes = sum(int(item.get("total_minutes", 0)) for item in service_type_summary)

    service_type_data: list[list[object]] = [
        ["サービス種別", "訪問件数", "合計時間", "割合(%)"],
    ]
    for item in service_type_summary:
        visit_count = int(item.get("visit_count", 0))
        total_min = int(item.get("total_minutes", 0))
        label = str(item.get("label", ""))
        pct = round(visit_count / total_visits * 100, 1) if total_visits > 0 else 0.0
        service_type_data.append([
            label,
            visit_count,
            minutes_to_hours_str(total_min),
            f"{pct}%",
        ])
    service_type_data.append([
        "合計",
        total_visits,
        minutes_to_hours_str(total_service_minutes),
        "100%",
    ])

    # スタッフ別稼働時間シート
    staff_data: list[list[object]] = [
        ["氏名", "訪問件数", "稼働時間", "稼働時間(分)"],
    ]
    for row in staff_summary:
        name = str(row.get("name", ""))
        visit_count = int(row.get("visit_count", 0))
        total_min = int(row.get("total_minutes", 0))
        staff_data.append([name, visit_count, minutes_to_hours_str(total_min), total_min])

    # 利用者別サービス実績シート
    customer_data: list[list[object]] = [
        ["氏名", "訪問件数", "合計時間", "合計時間(分)"],
    ]
    for row in customer_summary:
        name = str(row.get("name", ""))
        visit_count = int(row.get("visit_count", 0))
        total_min = int(row.get("total_minutes", 0))
        customer_data.append([name, visit_count, minutes_to_hours_str(total_min), total_min])

    # batchUpdate でデータ書き込み
    value_ranges = [
        {"range": "ステータス集計!A1", "values": status_data},
        {"range": "サービス種別集計!A1", "values": service_type_data},
        {"range": "スタッフ別稼働時間!A1", "values": staff_data},
        {"range": "利用者別サービス実績!A1", "values": customer_data},
    ]

    service.spreadsheets().values().batchUpdate(  # type: ignore[attr-defined]
        spreadsheetId=spreadsheet_id,
        body={
            "valueInputOption": "RAW",
            "data": value_ranges,
        },
    ).execute()

    # --- 3. 書式設定 ---
    format_requests: list[dict[str, Any]] = []

    # 各シートのヘッダー行書式
    for sid in sheet_ids:
        format_requests.append(_header_format_request(sid))

    # ステータス集計: 合計行（6行目 = index 5）と実績確認率行（7行目 = index 6）を太字
    format_requests.append(_bold_row_request(sheet_ids[0], 5))
    format_requests.append(_bold_row_request(sheet_ids[0], 6))

    # サービス種別集計: 合計行（最終行）を太字
    service_type_total_row = len(service_type_data) - 1
    format_requests.append(_bold_row_request(sheet_ids[1], service_type_total_row))

    service.spreadsheets().batchUpdate(  # type: ignore[attr-defined]
        spreadsheetId=spreadsheet_id,
        body={"requests": format_requests},
    ).execute()

    # --- 4. 共有設定 ---
    if share_with_email is not None:
        drive_service.permissions().create(  # type: ignore[attr-defined]
            fileId=spreadsheet_id,
            body={
                "type": "user",
                "role": "writer",
                "emailAddress": share_with_email,
            },
            fields="id",
        ).execute()

    return {
        "spreadsheet_id": spreadsheet_id,
        "spreadsheet_url": spreadsheet_url,
    }
