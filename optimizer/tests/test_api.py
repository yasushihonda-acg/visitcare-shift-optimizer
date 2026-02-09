"""APIエンドポイントのテスト"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from optimizer.api.main import app
from optimizer.models import Assignment, OptimizationInput, OptimizationResult

client = TestClient(app)


class TestHealthEndpoint:
    def test_health(self) -> None:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestOptimizeEndpoint:
    @patch("optimizer.api.routes.write_assignments")
    @patch("optimizer.api.routes.solve")
    @patch("optimizer.api.routes.load_optimization_input")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_optimal_result(
        self,
        mock_get_db: MagicMock,
        mock_load: MagicMock,
        mock_solve: MagicMock,
        mock_write: MagicMock,
    ) -> None:
        mock_get_db.return_value = MagicMock()
        mock_load.return_value = MagicMock(
            spec=OptimizationInput,
            orders=[MagicMock()],
            helpers=[MagicMock()],
            customers=[MagicMock()],
        )
        mock_solve.return_value = OptimizationResult(
            assignments=[Assignment(order_id="ORD0001", staff_ids=["H001"])],
            objective_value=10.5,
            solve_time_seconds=0.3,
            status="Optimal",
        )
        mock_write.return_value = 1

        response = client.post(
            "/optimize",
            json={"week_start_date": "2026-02-09"},  # 月曜日
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "Optimal"
        assert len(data["assignments"]) == 1
        assert data["assignments"][0]["order_id"] == "ORD0001"
        assert data["assignments"][0]["staff_ids"] == ["H001"]
        assert data["orders_updated"] == 1
        mock_write.assert_called_once()

    @patch("optimizer.api.routes.solve")
    @patch("optimizer.api.routes.load_optimization_input")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_dry_run_no_write(
        self,
        mock_get_db: MagicMock,
        mock_load: MagicMock,
        mock_solve: MagicMock,
    ) -> None:
        mock_get_db.return_value = MagicMock()
        mock_load.return_value = MagicMock(
            spec=OptimizationInput,
            orders=[MagicMock()],
            helpers=[MagicMock()],
            customers=[MagicMock()],
        )
        mock_solve.return_value = OptimizationResult(
            assignments=[Assignment(order_id="ORD0001", staff_ids=["H001"])],
            objective_value=5.0,
            solve_time_seconds=0.1,
            status="Optimal",
        )

        response = client.post(
            "/optimize",
            json={"week_start_date": "2026-02-09", "dry_run": True},
        )
        assert response.status_code == 200
        assert response.json()["orders_updated"] == 0

    @patch("optimizer.api.routes.solve")
    @patch("optimizer.api.routes.load_optimization_input")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_infeasible_returns_409(
        self,
        mock_get_db: MagicMock,
        mock_load: MagicMock,
        mock_solve: MagicMock,
    ) -> None:
        mock_get_db.return_value = MagicMock()
        mock_load.return_value = MagicMock(
            spec=OptimizationInput,
            orders=[MagicMock()],
            helpers=[MagicMock()],
            customers=[MagicMock()],
        )
        mock_solve.return_value = OptimizationResult(
            assignments=[],
            objective_value=0.0,
            solve_time_seconds=0.1,
            status="Infeasible",
        )

        response = client.post(
            "/optimize",
            json={"week_start_date": "2026-02-09"},
        )
        assert response.status_code == 409
        assert "制約を満たす割当" in response.json()["detail"]

    @patch("optimizer.api.routes.load_optimization_input")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_no_orders_returns_409(
        self,
        mock_get_db: MagicMock,
        mock_load: MagicMock,
    ) -> None:
        mock_get_db.return_value = MagicMock()
        mock_load.return_value = MagicMock(
            spec=OptimizationInput,
            orders=[],
        )

        response = client.post(
            "/optimize",
            json={"week_start_date": "2026-02-09"},
        )
        assert response.status_code == 409
        assert "オーダーがありません" in response.json()["detail"]

    def test_not_monday_returns_422(self) -> None:
        response = client.post(
            "/optimize",
            json={"week_start_date": "2026-02-10"},  # 火曜日
        )
        assert response.status_code == 422
        assert "月曜日ではありません" in response.json()["detail"]

    def test_invalid_date_format(self) -> None:
        response = client.post(
            "/optimize",
            json={"week_start_date": "not-a-date"},
        )
        assert response.status_code == 422

    def test_missing_required_field(self) -> None:
        response = client.post("/optimize", json={})
        assert response.status_code == 422

    @patch("optimizer.api.routes.write_assignments")
    @patch("optimizer.api.routes.solve")
    @patch("optimizer.api.routes.load_optimization_input")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_time_limit_passed_to_solver(
        self,
        mock_get_db: MagicMock,
        mock_load: MagicMock,
        mock_solve: MagicMock,
        mock_write: MagicMock,
    ) -> None:
        mock_get_db.return_value = MagicMock()
        mock_load.return_value = MagicMock(
            spec=OptimizationInput,
            orders=[MagicMock()],
            helpers=[MagicMock()],
            customers=[MagicMock()],
        )
        mock_solve.return_value = OptimizationResult(
            assignments=[],
            objective_value=0.0,
            solve_time_seconds=60.0,
            status="Optimal",
        )
        mock_write.return_value = 0

        response = client.post(
            "/optimize",
            json={"week_start_date": "2026-02-09", "time_limit_seconds": 60},
        )
        assert response.status_code == 200
        mock_solve.assert_called_once()
        _, kwargs = mock_solve.call_args
        assert kwargs["time_limit_seconds"] == 60


class TestFirestoreWriter:
    """Firestore書き戻しのユニットテスト"""

    @patch("optimizer.data.firestore_writer.SERVER_TIMESTAMP", "MOCK_TS")
    def test_write_assignments(self) -> None:
        from optimizer.data.firestore_writer import write_assignments
        from optimizer.models import Assignment

        db = MagicMock()
        batch = MagicMock()
        db.batch.return_value = batch

        assignments = [
            Assignment(order_id="ORD0001", staff_ids=["H001"]),
            Assignment(order_id="ORD0002", staff_ids=["H002", "H003"]),
        ]

        count = write_assignments(db, assignments)
        assert count == 2
        assert batch.update.call_count == 2
        batch.commit.assert_called_once()

    def test_write_empty_assignments(self) -> None:
        from optimizer.data.firestore_writer import write_assignments

        db = MagicMock()
        count = write_assignments(db, [])
        assert count == 0
        db.batch.assert_not_called()

    @patch("optimizer.data.firestore_writer.SERVER_TIMESTAMP", "MOCK_TS")
    def test_batch_limit(self) -> None:
        """500件超のバッチ分割テスト"""
        from optimizer.data.firestore_writer import write_assignments
        from optimizer.models import Assignment

        db = MagicMock()
        batch = MagicMock()
        db.batch.return_value = batch

        assignments = [
            Assignment(order_id=f"ORD{i:04d}", staff_ids=[f"H{(i % 20) + 1:03d}"])
            for i in range(501)
        ]

        count = write_assignments(db, assignments)
        assert count == 501
        assert db.batch.call_count == 2  # 500 + 1
        assert batch.commit.call_count == 2
