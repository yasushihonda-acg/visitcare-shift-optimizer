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
