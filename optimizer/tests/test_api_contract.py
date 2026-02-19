"""FE-BE API契約テスト

FEが期待する全フィールドがBEレスポンスに存在することを確認する。
"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from optimizer.api.main import app
from optimizer.models import Assignment, OptimizationInput, OptimizationResult

client = TestClient(app)

# FEが期待するOptimizeResponseの全フィールド
EXPECTED_FIELDS = {
    "assignments",
    "objective_value",
    "solve_time_seconds",
    "status",
    "orders_updated",
    "total_orders",
    "assigned_count",
}


class TestApiContract:
    """FE-BE間のAPIレスポンス契約テスト"""

    @patch("optimizer.api.routes.write_assignments")
    @patch("optimizer.api.routes.solve")
    @patch("optimizer.api.routes.load_optimization_input")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_optimize_response_has_all_fields(
        self,
        mock_get_db: MagicMock,
        mock_load: MagicMock,
        mock_solve: MagicMock,
        mock_write: MagicMock,
    ) -> None:
        """FEが期待する全フィールドがレスポンスに含まれる"""
        mock_get_db.return_value = MagicMock()
        mock_load.return_value = MagicMock(
            spec=OptimizationInput,
            orders=[MagicMock(), MagicMock(), MagicMock()],
            helpers=[MagicMock()],
            customers=[MagicMock()],
        )
        mock_solve.return_value = OptimizationResult(
            assignments=[
                Assignment(order_id="ORD0001", staff_ids=["H001"]),
                Assignment(order_id="ORD0002", staff_ids=["H002"]),
            ],
            objective_value=10.5,
            solve_time_seconds=0.3,
            status="Optimal",
        )
        mock_write.return_value = 2

        response = client.post(
            "/optimize",
            json={"week_start_date": "2026-02-09"},
        )
        assert response.status_code == 200
        data = response.json()

        missing = EXPECTED_FIELDS - set(data.keys())
        assert not missing, f"レスポンスに不足フィールド: {missing}"

    @patch("optimizer.api.routes.write_assignments")
    @patch("optimizer.api.routes.solve")
    @patch("optimizer.api.routes.load_optimization_input")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_total_orders_matches_input(
        self,
        mock_get_db: MagicMock,
        mock_load: MagicMock,
        mock_solve: MagicMock,
        mock_write: MagicMock,
    ) -> None:
        """total_ordersが入力オーダー数と一致する"""
        orders = [MagicMock() for _ in range(5)]
        mock_get_db.return_value = MagicMock()
        mock_load.return_value = MagicMock(
            spec=OptimizationInput,
            orders=orders,
            helpers=[MagicMock()],
            customers=[MagicMock()],
        )
        mock_solve.return_value = OptimizationResult(
            assignments=[
                Assignment(order_id="ORD0001", staff_ids=["H001"]),
            ],
            objective_value=5.0,
            solve_time_seconds=0.2,
            status="Optimal",
        )
        mock_write.return_value = 1

        response = client.post(
            "/optimize",
            json={"week_start_date": "2026-02-09"},
        )
        data = response.json()
        assert data["total_orders"] == 5
        assert data["assigned_count"] == 1

    @patch("optimizer.api.routes.write_assignments")
    @patch("optimizer.api.routes.solve")
    @patch("optimizer.api.routes.load_optimization_input")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_assignments_structure(
        self,
        mock_get_db: MagicMock,
        mock_load: MagicMock,
        mock_solve: MagicMock,
        mock_write: MagicMock,
    ) -> None:
        """assignmentsの各要素にorder_idとstaff_idsが含まれる"""
        mock_get_db.return_value = MagicMock()
        mock_load.return_value = MagicMock(
            spec=OptimizationInput,
            orders=[MagicMock()],
            helpers=[MagicMock()],
            customers=[MagicMock()],
        )
        mock_solve.return_value = OptimizationResult(
            assignments=[Assignment(order_id="ORD0001", staff_ids=["H001", "H002"])],
            objective_value=5.0,
            solve_time_seconds=0.1,
            status="Optimal",
        )
        mock_write.return_value = 1

        response = client.post(
            "/optimize",
            json={"week_start_date": "2026-02-09"},
        )
        data = response.json()
        assert len(data["assignments"]) == 1
        assignment = data["assignments"][0]
        assert "order_id" in assignment
        assert "staff_ids" in assignment
        assert isinstance(assignment["staff_ids"], list)


# FEが期待するExportReportResponseの全フィールド
EXPECTED_EXPORT_FIELDS = {
    "spreadsheet_id",
    "spreadsheet_url",
    "title",
    "year_month",
    "sheets_created",
    "shared_with",
}


class TestExportReportContract:
    """POST /export-report のFE-BE契約テスト"""

    @patch("optimizer.api.routes.create_monthly_report_spreadsheet")
    @patch("optimizer.api.routes.build")
    @patch("optimizer.api.routes.load_all_customers")
    @patch("optimizer.api.routes.load_all_helpers")
    @patch("optimizer.api.routes.load_monthly_orders")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_export_response_has_all_required_fields(
        self,
        mock_get_db: MagicMock,
        mock_load_orders: MagicMock,
        mock_load_helpers: MagicMock,
        mock_load_customers: MagicMock,
        mock_build: MagicMock,
        mock_create_sheet: MagicMock,
    ) -> None:
        """FEが期待する全フィールドがエクスポートレスポンスに含まれる"""
        mock_load_orders.return_value = [
            {
                "id": "o1",
                "customer_id": "c1",
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
        mock_create_sheet.return_value = {
            "spreadsheet_id": "ss-123",
            "spreadsheet_url": "https://docs.google.com/spreadsheets/d/ss-123",
        }

        response = client.post("/export-report", json={"year_month": "2026-02"})
        assert response.status_code == 200
        data = response.json()

        missing = EXPECTED_EXPORT_FIELDS - set(data.keys())
        assert not missing, f"レスポンスに不足フィールド: {missing}"

    def test_export_report_invalid_year_month_returns_422(self) -> None:
        """year_month が YYYY-MM 形式でない場合は 422"""
        response = client.post("/export-report", json={"year_month": "2026/02"})
        assert response.status_code == 422

    @patch("optimizer.api.routes.load_monthly_orders")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_export_report_not_found_returns_detail(
        self, mock_get_db: MagicMock, mock_load_orders: MagicMock
    ) -> None:
        """データなし 404 レスポンスに detail フィールドがある"""
        mock_load_orders.return_value = []
        response = client.post("/export-report", json={"year_month": "2025-01"})
        assert response.status_code == 404
        assert "detail" in response.json()
