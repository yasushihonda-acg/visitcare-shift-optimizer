"""Google Sheets Writer のテスト（APIクライアントをモック）"""

from unittest.mock import MagicMock, call

import pytest

from optimizer.report.sheets_writer import (
    create_monthly_report_spreadsheet,
    minutes_to_hours_str,
)


# --- テストデータ ---

SAMPLE_STATUS_SUMMARY: dict[str, object] = {
    "pending": 5,
    "assigned": 10,
    "completed": 20,
    "cancelled": 2,
    "total": 37,
    "completion_rate": 74.0,
}

SAMPLE_SERVICE_TYPE_SUMMARY: list[dict[str, object]] = [
    {"service_type": "physical_care", "label": "身体介護", "visit_count": 15, "total_minutes": 900},
    {"service_type": "daily_living", "label": "生活援助", "visit_count": 10, "total_minutes": 600},
]

SAMPLE_STAFF_SUMMARY: list[dict[str, object]] = [
    {"helper_id": "h1", "name": "田中太郎", "visit_count": 8, "total_minutes": 480},
    {"helper_id": "h2", "name": "鈴木花子", "visit_count": 12, "total_minutes": 720},
]

SAMPLE_CUSTOMER_SUMMARY: list[dict[str, object]] = [
    {"customer_id": "c1", "name": "山田一郎", "visit_count": 4, "total_minutes": 240},
    {"customer_id": "c2", "name": "佐藤二郎", "visit_count": 6, "total_minutes": 390},
]


def _make_mock_services() -> tuple[MagicMock, MagicMock]:
    """Sheets API / Drive API のモックを生成"""
    mock_service = MagicMock()
    mock_drive = MagicMock()

    mock_service.spreadsheets().create().execute.return_value = {
        "spreadsheetId": "test-id-123",
        "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/test-id-123",
        "sheets": [
            {"properties": {"sheetId": 0, "title": "ステータス集計"}},
            {"properties": {"sheetId": 1, "title": "サービス種別集計"}},
            {"properties": {"sheetId": 2, "title": "スタッフ別稼働時間"}},
            {"properties": {"sheetId": 3, "title": "利用者別サービス実績"}},
        ],
    }

    return mock_service, mock_drive


class TestMinutesToHoursStr:
    def test_exact_hours(self) -> None:
        assert minutes_to_hours_str(60) == "1時間"

    def test_hours_and_minutes(self) -> None:
        assert minutes_to_hours_str(90) == "1時間30分"

    def test_zero(self) -> None:
        assert minutes_to_hours_str(0) == "0時間"

    def test_only_minutes(self) -> None:
        assert minutes_to_hours_str(45) == "0時間45分"

    def test_large_value(self) -> None:
        assert minutes_to_hours_str(150) == "2時間30分"


class TestCreateMonthlyReportSpreadsheet:
    def test_creates_spreadsheet_with_correct_title(self) -> None:
        mock_service, mock_drive = _make_mock_services()

        result = create_monthly_report_spreadsheet(
            service=mock_service,
            drive_service=mock_drive,
            year_month="2026-02",
            status_summary=SAMPLE_STATUS_SUMMARY,
            service_type_summary=SAMPLE_SERVICE_TYPE_SUMMARY,
            staff_summary=SAMPLE_STAFF_SUMMARY,
            customer_summary=SAMPLE_CUSTOMER_SUMMARY,
        )

        assert result["spreadsheet_id"] == "test-id-123"
        assert result["spreadsheet_url"] == "https://docs.google.com/spreadsheets/d/test-id-123"

        # create が正しいbodyで呼ばれたことを確認
        create_calls = mock_service.spreadsheets().create.call_args_list
        # MagicMock チェーンの setup 呼び出しを除き、body= 付きの呼び出しを探す
        body_calls = [c for c in create_calls if c.kwargs.get("body") is not None]
        assert len(body_calls) == 1
        body = body_calls[0].kwargs["body"]
        assert body["properties"]["title"] == "月次レポート 2026年2月"

    def test_creates_four_sheets(self) -> None:
        mock_service, mock_drive = _make_mock_services()

        create_monthly_report_spreadsheet(
            service=mock_service,
            drive_service=mock_drive,
            year_month="2026-02",
            status_summary=SAMPLE_STATUS_SUMMARY,
            service_type_summary=SAMPLE_SERVICE_TYPE_SUMMARY,
            staff_summary=SAMPLE_STAFF_SUMMARY,
            customer_summary=SAMPLE_CUSTOMER_SUMMARY,
        )

        create_call_kwargs = mock_service.spreadsheets().create.call_args
        body = create_call_kwargs.kwargs.get("body") or create_call_kwargs[1].get("body")
        sheets = body["sheets"]
        assert len(sheets) == 4
        titles = [s["properties"]["title"] for s in sheets]
        assert titles == ["ステータス集計", "サービス種別集計", "スタッフ別稼働時間", "利用者別サービス実績"]

    def test_writes_data_via_batch_update(self) -> None:
        mock_service, mock_drive = _make_mock_services()

        create_monthly_report_spreadsheet(
            service=mock_service,
            drive_service=mock_drive,
            year_month="2026-02",
            status_summary=SAMPLE_STATUS_SUMMARY,
            service_type_summary=SAMPLE_SERVICE_TYPE_SUMMARY,
            staff_summary=SAMPLE_STAFF_SUMMARY,
            customer_summary=SAMPLE_CUSTOMER_SUMMARY,
        )

        # values().batchUpdate が呼ばれたことを確認
        mock_service.spreadsheets().values().batchUpdate.assert_called_once()
        batch_call = mock_service.spreadsheets().values().batchUpdate.call_args
        body = batch_call.kwargs.get("body") or batch_call[1].get("body")
        assert body["valueInputOption"] == "RAW"
        assert len(body["data"]) == 4

    def test_applies_formatting(self) -> None:
        mock_service, mock_drive = _make_mock_services()

        create_monthly_report_spreadsheet(
            service=mock_service,
            drive_service=mock_drive,
            year_month="2026-02",
            status_summary=SAMPLE_STATUS_SUMMARY,
            service_type_summary=SAMPLE_SERVICE_TYPE_SUMMARY,
            staff_summary=SAMPLE_STAFF_SUMMARY,
            customer_summary=SAMPLE_CUSTOMER_SUMMARY,
        )

        # spreadsheets().batchUpdate が書式設定で呼ばれたことを確認
        mock_service.spreadsheets().batchUpdate.assert_called_once()
        format_call = mock_service.spreadsheets().batchUpdate.call_args
        body = format_call.kwargs.get("body") or format_call[1].get("body")
        requests = body["requests"]
        # ヘッダー4枚 + ステータス合計行 + ステータス実績確認率行 + サービス種別合計行 = 7
        assert len(requests) == 7

    def test_shares_with_email_when_provided(self) -> None:
        mock_service, mock_drive = _make_mock_services()

        create_monthly_report_spreadsheet(
            service=mock_service,
            drive_service=mock_drive,
            year_month="2026-02",
            status_summary=SAMPLE_STATUS_SUMMARY,
            service_type_summary=[],
            staff_summary=[],
            customer_summary=[],
            share_with_email="test@example.com",
        )

        # permissions().create が呼ばれたことを確認
        mock_drive.permissions().create.assert_called_once()
        perm_call = mock_drive.permissions().create.call_args
        assert perm_call.kwargs.get("fileId") == "test-id-123"
        body = perm_call.kwargs.get("body") or perm_call[1].get("body")
        assert body["emailAddress"] == "test@example.com"
        assert body["role"] == "writer"

    def test_no_share_when_email_not_provided(self) -> None:
        mock_service, mock_drive = _make_mock_services()

        create_monthly_report_spreadsheet(
            service=mock_service,
            drive_service=mock_drive,
            year_month="2026-02",
            status_summary=SAMPLE_STATUS_SUMMARY,
            service_type_summary=[],
            staff_summary=[],
            customer_summary=[],
            share_with_email=None,
        )

        # permissions().create が呼ばれていないことを確認
        mock_drive.permissions().create.assert_not_called()

    def test_year_month_parsing_single_digit_month(self) -> None:
        mock_service, mock_drive = _make_mock_services()

        create_monthly_report_spreadsheet(
            service=mock_service,
            drive_service=mock_drive,
            year_month="2026-01",
            status_summary=SAMPLE_STATUS_SUMMARY,
            service_type_summary=[],
            staff_summary=[],
            customer_summary=[],
        )

        create_call_kwargs = mock_service.spreadsheets().create.call_args
        body = create_call_kwargs.kwargs.get("body") or create_call_kwargs[1].get("body")
        # "01" -> "1" に変換されること
        assert body["properties"]["title"] == "月次レポート 2026年1月"
