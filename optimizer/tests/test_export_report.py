"""POST /export-report エンドポイントのテスト"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from optimizer.api.main import app

client = TestClient(app)


def _make_mock_sheets_result() -> dict[str, str]:
    return {
        "spreadsheet_id": "test-spreadsheet-id",
        "spreadsheet_url": "https://docs.google.com/spreadsheets/d/test-spreadsheet-id",
    }


class TestExportReportEndpoint:
    @patch("optimizer.api.routes.create_monthly_report_spreadsheet")
    @patch("optimizer.api.routes.build")
    @patch("optimizer.api.routes.load_all_customers")
    @patch("optimizer.api.routes.load_all_helpers")
    @patch("optimizer.api.routes.load_monthly_orders")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_export_report_success(
        self,
        mock_get_db: MagicMock,
        mock_load_orders: MagicMock,
        mock_load_helpers: MagicMock,
        mock_load_customers: MagicMock,
        mock_build: MagicMock,
        mock_create_sheet: MagicMock,
    ) -> None:
        """正常系: スプレッドシートが作成されURLが返る"""
        mock_load_orders.return_value = [
            {
                "id": "order-1",
                "customer_id": "cust-1",
                "date": "2026-02-01",
                "start_time": "09:00",
                "end_time": "10:00",
                "service_type": "physical_care",
                "status": "completed",
                "assigned_staff_ids": ["helper-1"],
                "staff_count": 1,
            }
        ]
        mock_load_helpers.return_value = [
            {"id": "helper-1", "family_name": "田中", "given_name": "太郎"}
        ]
        mock_load_customers.return_value = [
            {"id": "cust-1", "family_name": "山田", "given_name": "花子"}
        ]
        mock_create_sheet.return_value = _make_mock_sheets_result()

        response = client.post(
            "/export-report",
            json={"year_month": "2026-02"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["spreadsheet_id"] == "test-spreadsheet-id"
        assert "spreadsheet_url" in data
        assert data["title"] == "月次レポート 2026年2月"
        assert data["year_month"] == "2026-02"
        assert data["sheets_created"] == 4
        assert data["shared_with"] is None

    @patch("optimizer.api.routes.create_monthly_report_spreadsheet")
    @patch("optimizer.api.routes.build")
    @patch("optimizer.api.routes.load_all_customers")
    @patch("optimizer.api.routes.load_all_helpers")
    @patch("optimizer.api.routes.load_monthly_orders")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_export_report_with_email_share(
        self,
        mock_get_db: MagicMock,
        mock_load_orders: MagicMock,
        mock_load_helpers: MagicMock,
        mock_load_customers: MagicMock,
        mock_build: MagicMock,
        mock_create_sheet: MagicMock,
    ) -> None:
        """user_email 指定時に shared_with が返る"""
        mock_load_orders.return_value = [
            {
                "id": "order-1",
                "customer_id": "cust-1",
                "date": "2026-02-01",
                "start_time": "09:00",
                "end_time": "10:00",
                "service_type": "daily_living",
                "status": "assigned",
                "assigned_staff_ids": [],
                "staff_count": 1,
            }
        ]
        mock_load_helpers.return_value = []
        mock_load_customers.return_value = []
        mock_create_sheet.return_value = _make_mock_sheets_result()

        response = client.post(
            "/export-report",
            json={"year_month": "2026-02", "user_email": "manager@example.com"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["shared_with"] == "manager@example.com"
        # create_monthly_report_spreadsheet が share_with_email 付きで呼ばれていることを確認
        call_kwargs = mock_create_sheet.call_args.kwargs
        assert call_kwargs["share_with_email"] == "manager@example.com"

    @patch("optimizer.api.routes.load_monthly_orders")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_export_report_no_orders_returns_404(
        self,
        mock_get_db: MagicMock,
        mock_load_orders: MagicMock,
    ) -> None:
        """オーダーが存在しない場合は 404"""
        mock_load_orders.return_value = []

        response = client.post(
            "/export-report",
            json={"year_month": "2025-01"},
        )

        assert response.status_code == 404
        assert "見つかりません" in response.json()["detail"]

    def test_export_report_invalid_format_returns_422(self) -> None:
        """不正なyear_month形式は 422"""
        response = client.post(
            "/export-report",
            json={"year_month": "2026/02"},
        )
        assert response.status_code == 422

    def test_export_report_invalid_month_returns_422(self) -> None:
        """YYYY-MM形式でないものは 422"""
        response = client.post(
            "/export-report",
            json={"year_month": "2026-2"},
        )
        assert response.status_code == 422

    @patch("optimizer.api.routes.load_monthly_orders")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_export_report_firestore_error_returns_500(
        self,
        mock_get_db: MagicMock,
        mock_load_orders: MagicMock,
    ) -> None:
        """Firestore読み込みエラーは 500"""
        mock_load_orders.side_effect = RuntimeError("Firestore connection failed")

        response = client.post(
            "/export-report",
            json={"year_month": "2026-02"},
        )

        assert response.status_code == 500
        assert "Firestore" in response.json()["detail"]

    @patch("optimizer.api.routes.build")
    @patch("optimizer.api.routes.load_all_customers")
    @patch("optimizer.api.routes.load_all_helpers")
    @patch("optimizer.api.routes.load_monthly_orders")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_export_report_sheets_api_error_returns_503(
        self,
        mock_get_db: MagicMock,
        mock_load_orders: MagicMock,
        mock_load_helpers: MagicMock,
        mock_load_customers: MagicMock,
        mock_build: MagicMock,
    ) -> None:
        """Google Sheets API接続エラーは 503"""
        mock_load_orders.return_value = [
            {
                "id": "order-1",
                "customer_id": "cust-1",
                "date": "2026-02-01",
                "start_time": "09:00",
                "end_time": "10:00",
                "service_type": "physical_care",
                "status": "completed",
                "assigned_staff_ids": [],
                "staff_count": 1,
            }
        ]
        mock_load_helpers.return_value = []
        mock_load_customers.return_value = []
        mock_build.side_effect = Exception("API not enabled")

        response = client.post(
            "/export-report",
            json={"year_month": "2026-02"},
        )

        assert response.status_code == 503
        assert "Google Sheets API" in response.json()["detail"]

    @patch("optimizer.api.routes.create_monthly_report_spreadsheet")
    @patch("optimizer.api.routes.build")
    @patch("optimizer.api.routes.load_all_customers")
    @patch("optimizer.api.routes.load_all_helpers")
    @patch("optimizer.api.routes.load_monthly_orders")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_export_report_december_year_boundary(
        self,
        mock_get_db: MagicMock,
        mock_load_orders: MagicMock,
        mock_load_helpers: MagicMock,
        mock_load_customers: MagicMock,
        mock_build: MagicMock,
        mock_create_sheet: MagicMock,
    ) -> None:
        """12月（年またぎ）が正しく処理される"""
        mock_load_orders.return_value = [
            {
                "id": "order-1",
                "customer_id": "cust-1",
                "date": "2025-12-15",
                "start_time": "10:00",
                "end_time": "11:00",
                "service_type": "daily_living",
                "status": "completed",
                "assigned_staff_ids": [],
                "staff_count": 1,
            }
        ]
        mock_load_helpers.return_value = []
        mock_load_customers.return_value = []
        mock_create_sheet.return_value = _make_mock_sheets_result()

        response = client.post(
            "/export-report",
            json={"year_month": "2025-12"},
        )

        assert response.status_code == 200
        assert response.json()["title"] == "月次レポート 2025年12月"
