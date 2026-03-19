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
        assert data["total_orders"] == 1
        assert data["assigned_count"] == 1
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


class TestDuplicateWeekOrders:
    """duplicate_week_orders 関数のユニットテスト"""

    @patch("optimizer.data.firestore_writer.SERVER_TIMESTAMP", "MOCK_TS")
    def test_duplicate_creates_new_orders(self) -> None:
        from datetime import datetime, timezone, timedelta
        from optimizer.data.firestore_writer import duplicate_week_orders

        JST = timezone(timedelta(hours=9))
        source_date = datetime(2026, 2, 9, tzinfo=JST)  # 月曜日

        # ソースオーダー2件のモック
        doc1 = MagicMock()
        doc1.id = "order-1"
        doc1.to_dict.return_value = {
            "customer_id": "C001",
            "date": datetime(2026, 2, 9, tzinfo=JST),  # 月曜日
            "start_time": "09:00",
            "end_time": "10:00",
            "service_type": "physical_care",
            "staff_count": 1,
        }

        doc2 = MagicMock()
        doc2.id = "order-2"
        doc2.to_dict.return_value = {
            "customer_id": "C002",
            "date": datetime(2026, 2, 11, tzinfo=JST),  # 水曜日
            "start_time": "14:00",
            "end_time": "15:00",
            "service_type": "daily_living",
            "linked_order_id": "order-1",
        }

        db = MagicMock()
        batch = MagicMock()
        db.batch.return_value = batch

        # ソース週クエリ → 2件返す
        source_query = MagicMock()
        source_query.where.return_value = source_query
        source_query.stream.return_value = iter([doc1, doc2])

        # ターゲット週クエリ → 0件（既存なし）
        target_query = MagicMock()
        target_query.where.return_value = target_query
        target_query.stream.return_value = iter([])

        # 最初のcollection("orders")呼び出し→ソース、2回目→ターゲット
        call_count = {"n": 0}
        def collection_side_effect(name: str) -> MagicMock:
            if name == "orders":
                call_count["n"] += 1
                if call_count["n"] == 1:
                    return source_query
                return target_query
            return MagicMock()

        db.collection.side_effect = collection_side_effect

        from datetime import date
        created, skipped = duplicate_week_orders(
            db, date(2026, 2, 9), date(2026, 2, 16)
        )

        assert created == 2
        assert skipped == 0
        assert batch.set.call_count == 2
        batch.commit.assert_called_once()

        # 作成されたオーダーの内容を検証
        set_calls = batch.set.call_args_list
        order_data_list = [call[0][1] for call in set_calls]

        # customer_idが保持されていること
        customer_ids = {d["customer_id"] for d in order_data_list}
        assert customer_ids == {"C001", "C002"}

        # 全てpending/空割当
        for d in order_data_list:
            assert d["status"] == "pending"
            assert d["assigned_staff_ids"] == []
            assert d["manually_edited"] is False

    @patch("optimizer.data.firestore_writer.SERVER_TIMESTAMP", "MOCK_TS")
    def test_duplicate_skips_when_target_has_orders(self) -> None:
        from datetime import datetime, timezone, timedelta
        from optimizer.data.firestore_writer import duplicate_week_orders

        JST = timezone(timedelta(hours=9))

        doc1 = MagicMock()
        doc1.id = "source-1"
        doc1.to_dict.return_value = {"customer_id": "C001"}

        existing_doc = MagicMock()

        db = MagicMock()
        source_query = MagicMock()
        source_query.where.return_value = source_query
        source_query.stream.return_value = iter([doc1])

        target_query = MagicMock()
        target_query.where.return_value = target_query
        target_query.stream.return_value = iter([existing_doc])

        call_count = {"n": 0}
        def collection_side_effect(name: str) -> MagicMock:
            if name == "orders":
                call_count["n"] += 1
                if call_count["n"] == 1:
                    return source_query
                return target_query
            return MagicMock()

        db.collection.side_effect = collection_side_effect

        from datetime import date
        created, skipped = duplicate_week_orders(
            db, date(2026, 2, 9), date(2026, 2, 16)
        )

        assert created == 0
        assert skipped == 1
        db.batch.assert_not_called()

    @patch("optimizer.data.firestore_writer.SERVER_TIMESTAMP", "MOCK_TS")
    def test_duplicate_empty_source(self) -> None:
        from optimizer.data.firestore_writer import duplicate_week_orders

        db = MagicMock()
        source_query = MagicMock()
        source_query.where.return_value = source_query
        source_query.stream.return_value = iter([])

        db.collection.return_value = source_query

        from datetime import date
        created, skipped = duplicate_week_orders(
            db, date(2026, 2, 9), date(2026, 2, 16)
        )

        assert created == 0
        assert skipped == 0


class TestResetAssignmentsEndpoint:
    """POST /reset-assignments のテスト"""

    @patch("optimizer.api.routes.reset_assignments")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_reset_success(
        self,
        mock_get_db: MagicMock,
        mock_reset: MagicMock,
    ) -> None:
        mock_get_db.return_value = MagicMock()
        mock_reset.return_value = 30

        response = client.post(
            "/reset-assignments",
            json={"week_start_date": "2026-02-09"},  # 月曜日
        )
        assert response.status_code == 200
        data = response.json()
        assert data["orders_reset"] == 30
        assert data["week_start_date"] == "2026-02-09"
        mock_reset.assert_called_once()

    def test_not_monday_returns_422(self) -> None:
        response = client.post(
            "/reset-assignments",
            json={"week_start_date": "2026-02-10"},  # 火曜日
        )
        assert response.status_code == 422
        assert "月曜日ではありません" in response.json()["detail"]

    @patch("optimizer.api.routes.reset_assignments")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_firestore_error_returns_500(
        self,
        mock_get_db: MagicMock,
        mock_reset: MagicMock,
    ) -> None:
        mock_get_db.return_value = MagicMock()
        mock_reset.side_effect = Exception("Firestore connection failed")

        response = client.post(
            "/reset-assignments",
            json={"week_start_date": "2026-02-09"},
        )
        assert response.status_code == 500
        assert "リセットエラー" in response.json()["detail"]

    @patch("optimizer.api.routes.reset_assignments")
    @patch("optimizer.api.routes.get_firestore_client")
    def test_zero_orders_reset(
        self,
        mock_get_db: MagicMock,
        mock_reset: MagicMock,
    ) -> None:
        mock_get_db.return_value = MagicMock()
        mock_reset.return_value = 0

        response = client.post(
            "/reset-assignments",
            json={"week_start_date": "2026-02-09"},
        )
        assert response.status_code == 200
        assert response.json()["orders_reset"] == 0


class TestDuplicateWeekEndpoint:
    """オーダー一括複製エンドポイントのテスト"""

    @patch("optimizer.api.routes_orders.duplicate_week_orders")
    @patch("optimizer.api.routes_orders.get_firestore_client")
    def test_successful_duplicate(
        self,
        mock_get_db: MagicMock,
        mock_duplicate: MagicMock,
    ) -> None:
        mock_get_db.return_value = MagicMock()
        mock_duplicate.return_value = (10, 0)

        response = client.post(
            "/orders/duplicate-week",
            json={
                "source_week_start": "2026-02-09",
                "target_week_start": "2026-02-16",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["created_count"] == 10
        assert data["skipped_count"] == 0
        assert data["target_week_start"] == "2026-02-16"

    @patch("optimizer.api.routes_orders.duplicate_week_orders")
    @patch("optimizer.api.routes_orders.get_firestore_client")
    def test_existing_target_orders_returns_409(
        self,
        mock_get_db: MagicMock,
        mock_duplicate: MagicMock,
    ) -> None:
        mock_get_db.return_value = MagicMock()
        mock_duplicate.return_value = (0, 5)

        response = client.post(
            "/orders/duplicate-week",
            json={
                "source_week_start": "2026-02-09",
                "target_week_start": "2026-02-16",
            },
        )
        assert response.status_code == 409
        assert "既存オーダー" in response.json()["detail"]

    def test_source_not_monday_returns_422(self) -> None:
        response = client.post(
            "/orders/duplicate-week",
            json={
                "source_week_start": "2026-02-10",  # 火曜日
                "target_week_start": "2026-02-16",
            },
        )
        assert response.status_code == 422
        assert "月曜日ではありません" in response.json()["detail"]

    def test_target_not_monday_returns_422(self) -> None:
        response = client.post(
            "/orders/duplicate-week",
            json={
                "source_week_start": "2026-02-09",
                "target_week_start": "2026-02-17",  # 火曜日
            },
        )
        assert response.status_code == 422
        assert "月曜日ではありません" in response.json()["detail"]

    def test_same_week_returns_422(self) -> None:
        response = client.post(
            "/orders/duplicate-week",
            json={
                "source_week_start": "2026-02-09",
                "target_week_start": "2026-02-09",
            },
        )
        assert response.status_code == 422
        assert "同じ週" in response.json()["detail"]

    def test_missing_fields_returns_422(self) -> None:
        response = client.post(
            "/orders/duplicate-week",
            json={"source_week_start": "2026-02-09"},
        )
        assert response.status_code == 422


class TestApplyUnavailabilityEndpoint:
    """POST /orders/apply-unavailability のテスト"""

    @patch("optimizer.api.routes_orders.apply_unavailability_to_orders")
    @patch("optimizer.api.routes_orders.get_firestore_client")
    def test_successful_apply(
        self,
        mock_get_db: MagicMock,
        mock_apply: MagicMock,
    ) -> None:
        from optimizer.data.firestore_writer import (
            ApplyUnavailabilityResult,
            UnavailabilityRemoval,
        )
        mock_get_db.return_value = MagicMock()
        mock_apply.return_value = ApplyUnavailabilityResult(
            orders_modified=3,
            removals_count=4,
            reverted_to_pending=1,
            removals=[
                UnavailabilityRemoval(
                    order_id="ORD001", staff_id="H003",
                    customer_id="C001", date="2026-02-11",
                    start_time="09:00", end_time="10:00",
                ),
            ],
        )

        response = client.post(
            "/orders/apply-unavailability",
            json={"week_start_date": "2026-02-09"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["orders_modified"] == 3
        assert data["removals_count"] == 4
        assert data["reverted_to_pending"] == 1
        assert len(data["removals"]) == 1
        assert data["removals"][0]["staff_id"] == "H003"

    def test_not_monday_returns_422(self) -> None:
        response = client.post(
            "/orders/apply-unavailability",
            json={"week_start_date": "2026-02-10"},
        )
        assert response.status_code == 422
        assert "月曜日ではありません" in response.json()["detail"]

    @patch("optimizer.api.routes_orders.apply_unavailability_to_orders")
    @patch("optimizer.api.routes_orders.get_firestore_client")
    def test_no_modifications(
        self,
        mock_get_db: MagicMock,
        mock_apply: MagicMock,
    ) -> None:
        from optimizer.data.firestore_writer import ApplyUnavailabilityResult
        mock_get_db.return_value = MagicMock()
        mock_apply.return_value = ApplyUnavailabilityResult(0, 0, 0, [])

        response = client.post(
            "/orders/apply-unavailability",
            json={"week_start_date": "2026-02-09"},
        )
        assert response.status_code == 200
        assert response.json()["orders_modified"] == 0


class TestApplyUnavailabilityLogic:
    """apply_unavailability_to_orders のユニットテスト"""

    @patch("optimizer.data.firestore_writer.SERVER_TIMESTAMP", "MOCK_TS")
    def test_removes_unavailable_staff_from_orders(self) -> None:
        from datetime import datetime, timezone, timedelta
        from optimizer.data.firestore_writer import apply_unavailability_to_orders

        JST = timezone(timedelta(hours=9))

        # 休み希望: H003は水曜終日休み
        unavail_doc = MagicMock()
        unavail_doc.to_dict.return_value = {
            "staff_id": "H003",
            "unavailable_slots": [
                {
                    "date": datetime(2026, 2, 11, tzinfo=JST),  # 水曜
                    "all_day": True,
                }
            ],
        }

        # 割当済みオーダー: H003が水曜に割当
        order_doc = MagicMock()
        order_doc.id = "ORD001"
        order_doc.to_dict.return_value = {
            "customer_id": "C001",
            "date": datetime(2026, 2, 11, tzinfo=JST),  # 水曜
            "start_time": "09:00",
            "end_time": "10:00",
            "assigned_staff_ids": ["H003"],
            "status": "assigned",
        }

        db = MagicMock()
        batch = MagicMock()
        db.batch.return_value = batch

        # staff_unavailability クエリ
        unavail_query = MagicMock()
        unavail_query.where.return_value = unavail_query
        unavail_query.stream.return_value = iter([unavail_doc])

        # orders クエリ
        order_query = MagicMock()
        order_query.where.return_value = order_query
        order_query.stream.return_value = iter([order_doc])

        call_count = {"n": 0}
        def collection_side_effect(name: str) -> MagicMock:
            call_count["n"] += 1
            if name == "staff_unavailability":
                return unavail_query
            return order_query

        db.collection.side_effect = collection_side_effect

        from datetime import date
        result = apply_unavailability_to_orders(db, date(2026, 2, 9))

        assert result.orders_modified == 1
        assert result.removals_count == 1
        assert result.reverted_to_pending == 1
        assert result.removals[0].staff_id == "H003"

        # バッチ更新が呼ばれたか
        batch.update.assert_called_once()
        update_args = batch.update.call_args[0][1]
        assert update_args["assigned_staff_ids"] == []
        assert update_args["status"] == "pending"

    @patch("optimizer.data.firestore_writer.SERVER_TIMESTAMP", "MOCK_TS")
    def test_partial_day_overlap(self) -> None:
        """部分休みが時間帯重複するオーダーのみ解除"""
        from datetime import datetime, timezone, timedelta
        from optimizer.data.firestore_writer import apply_unavailability_to_orders

        JST = timezone(timedelta(hours=9))

        unavail_doc = MagicMock()
        unavail_doc.to_dict.return_value = {
            "staff_id": "H008",
            "unavailable_slots": [
                {
                    "date": datetime(2026, 2, 11, tzinfo=JST),
                    "all_day": False,
                    "start_time": "09:00",
                    "end_time": "12:00",
                }
            ],
        }

        # 重複するオーダー (10:00-11:00)
        order_overlap = MagicMock()
        order_overlap.id = "ORD-OVERLAP"
        order_overlap.to_dict.return_value = {
            "customer_id": "C001",
            "date": datetime(2026, 2, 11, tzinfo=JST),
            "start_time": "10:00",
            "end_time": "11:00",
            "assigned_staff_ids": ["H008"],
            "status": "assigned",
        }

        # 重複しないオーダー (14:00-15:00)
        order_no_overlap = MagicMock()
        order_no_overlap.id = "ORD-OK"
        order_no_overlap.to_dict.return_value = {
            "customer_id": "C002",
            "date": datetime(2026, 2, 11, tzinfo=JST),
            "start_time": "14:00",
            "end_time": "15:00",
            "assigned_staff_ids": ["H008"],
            "status": "assigned",
        }

        db = MagicMock()
        batch = MagicMock()
        db.batch.return_value = batch

        unavail_query = MagicMock()
        unavail_query.where.return_value = unavail_query
        unavail_query.stream.return_value = iter([unavail_doc])

        order_query = MagicMock()
        order_query.where.return_value = order_query
        order_query.stream.return_value = iter([order_overlap, order_no_overlap])

        def collection_side_effect(name: str) -> MagicMock:
            if name == "staff_unavailability":
                return unavail_query
            return order_query

        db.collection.side_effect = collection_side_effect

        from datetime import date
        result = apply_unavailability_to_orders(db, date(2026, 2, 9))

        # 重複するオーダーのみ解除
        assert result.orders_modified == 1
        assert result.removals_count == 1
        assert result.removals[0].order_id == "ORD-OVERLAP"

    @patch("optimizer.data.firestore_writer.SERVER_TIMESTAMP", "MOCK_TS")
    def test_multi_staff_partial_removal(self) -> None:
        """2人割当のオーダーから1人だけ除外 → assignedのまま"""
        from datetime import datetime, timezone, timedelta
        from optimizer.data.firestore_writer import apply_unavailability_to_orders

        JST = timezone(timedelta(hours=9))

        unavail_doc = MagicMock()
        unavail_doc.to_dict.return_value = {
            "staff_id": "H003",
            "unavailable_slots": [
                {"date": datetime(2026, 2, 11, tzinfo=JST), "all_day": True}
            ],
        }

        order_doc = MagicMock()
        order_doc.id = "ORD-MULTI"
        order_doc.to_dict.return_value = {
            "customer_id": "C001",
            "date": datetime(2026, 2, 11, tzinfo=JST),
            "start_time": "09:00",
            "end_time": "10:00",
            "assigned_staff_ids": ["H003", "H005"],
            "status": "assigned",
        }

        db = MagicMock()
        batch = MagicMock()
        db.batch.return_value = batch

        unavail_query = MagicMock()
        unavail_query.where.return_value = unavail_query
        unavail_query.stream.return_value = iter([unavail_doc])

        order_query = MagicMock()
        order_query.where.return_value = order_query
        order_query.stream.return_value = iter([order_doc])

        def collection_side_effect(name: str) -> MagicMock:
            if name == "staff_unavailability":
                return unavail_query
            return order_query

        db.collection.side_effect = collection_side_effect

        from datetime import date
        result = apply_unavailability_to_orders(db, date(2026, 2, 9))

        assert result.orders_modified == 1
        assert result.removals_count == 1
        assert result.reverted_to_pending == 0  # まだH005がいるのでassignedのまま

        update_args = batch.update.call_args[0][1]
        assert update_args["assigned_staff_ids"] == ["H005"]
        assert update_args["status"] == "assigned"


class TestApplyIrregularPatternsEndpoint:
    """POST /orders/apply-irregular-patterns のテスト"""

    @patch("optimizer.api.routes_orders.apply_irregular_patterns")
    @patch("optimizer.api.routes_orders.get_firestore_client")
    def test_successful_apply(
        self,
        mock_get_db: MagicMock,
        mock_apply: MagicMock,
    ) -> None:
        from optimizer.data.firestore_writer import (
            ApplyIrregularPatternsResult,
            IrregularPatternExclusionInfo,
        )
        mock_get_db.return_value = MagicMock()
        mock_apply.return_value = ApplyIrregularPatternsResult(
            cancelled_count=5,
            excluded_customers=[
                IrregularPatternExclusionInfo(
                    customer_id="C030", customer_name="田中 太郎",
                    pattern_type="temporary_stop", description="入院中",
                ),
            ],
        )

        response = client.post(
            "/orders/apply-irregular-patterns",
            json={"week_start_date": "2026-02-09"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["cancelled_count"] == 5
        assert len(data["excluded_customers"]) == 1
        assert data["excluded_customers"][0]["pattern_type"] == "temporary_stop"

    def test_not_monday_returns_422(self) -> None:
        response = client.post(
            "/orders/apply-irregular-patterns",
            json={"week_start_date": "2026-02-10"},
        )
        assert response.status_code == 422


class TestApplyIrregularPatternsLogic:
    """不定期パターン適用ロジックのユニットテスト"""

    @patch("optimizer.data.firestore_writer.SERVER_TIMESTAMP", "MOCK_TS")
    def test_temporary_stop_cancels_orders(self) -> None:
        from datetime import datetime, timezone, timedelta
        from optimizer.data.firestore_writer import apply_irregular_patterns

        JST = timezone(timedelta(hours=9))

        # 利用者: temporary_stop
        customer_doc = MagicMock()
        customer_doc.id = "C030"
        customer_doc.to_dict.return_value = {
            "name": {"family": "田中", "given": "太郎"},
            "irregular_patterns": [
                {"type": "temporary_stop", "description": "入院中"}
            ],
        }

        # オーダー
        order_doc = MagicMock()
        order_doc.id = "ORD-C030"
        order_doc.to_dict.return_value = {
            "customer_id": "C030",
            "status": "pending",
        }

        db = MagicMock()
        batch = MagicMock()
        db.batch.return_value = batch

        customer_query = MagicMock()
        customer_query.stream.return_value = iter([customer_doc])

        order_query = MagicMock()
        order_query.where.return_value = order_query
        order_query.stream.return_value = iter([order_doc])

        def collection_side_effect(name: str) -> MagicMock:
            if name == "customers":
                return customer_query
            return order_query

        db.collection.side_effect = collection_side_effect

        from datetime import date
        result = apply_irregular_patterns(db, date(2026, 2, 9))

        assert result.cancelled_count == 1
        assert len(result.excluded_customers) == 1
        assert result.excluded_customers[0].pattern_type == "temporary_stop"
        batch.update.assert_called_once()

    @patch("optimizer.data.firestore_writer.SERVER_TIMESTAMP", "MOCK_TS")
    def test_biweekly_excludes_inactive_week(self) -> None:
        """隔週パターン: active_weeks=[0,2]で第2週(index=1)は除外"""
        from optimizer.data.firestore_writer import apply_irregular_patterns

        customer_doc = MagicMock()
        customer_doc.id = "C005"
        customer_doc.to_dict.return_value = {
            "name": {"family": "佐藤", "given": "花子"},
            "irregular_patterns": [
                {"type": "biweekly", "description": "隔週", "active_weeks": [0, 2]}
            ],
        }

        order_doc = MagicMock()
        order_doc.id = "ORD-C005"
        order_doc.to_dict.return_value = {
            "customer_id": "C005",
            "status": "pending",
        }

        db = MagicMock()
        batch = MagicMock()
        db.batch.return_value = batch

        customer_query = MagicMock()
        customer_query.stream.return_value = iter([customer_doc])

        order_query = MagicMock()
        order_query.where.return_value = order_query
        order_query.stream.return_value = iter([order_doc])

        def collection_side_effect(name: str) -> MagicMock:
            if name == "customers":
                return customer_query
            return order_query

        db.collection.side_effect = collection_side_effect

        from datetime import date
        # 2026-02-09 = 2月9日 → (9-1)//7 = 1 → week index 1 → NOT in [0,2]
        result = apply_irregular_patterns(db, date(2026, 2, 9))

        assert result.cancelled_count == 1
        assert result.excluded_customers[0].customer_id == "C005"

    @patch("optimizer.data.firestore_writer.SERVER_TIMESTAMP", "MOCK_TS")
    def test_biweekly_includes_active_week(self) -> None:
        """隔週パターン: active_weeks=[0,2]で第1週(index=0)は除外しない"""
        from optimizer.data.firestore_writer import apply_irregular_patterns

        customer_doc = MagicMock()
        customer_doc.id = "C005"
        customer_doc.to_dict.return_value = {
            "name": {"family": "佐藤", "given": "花子"},
            "irregular_patterns": [
                {"type": "biweekly", "description": "隔週", "active_weeks": [0, 2]}
            ],
        }

        db = MagicMock()
        customer_query = MagicMock()
        customer_query.stream.return_value = iter([customer_doc])

        order_query = MagicMock()
        order_query.where.return_value = order_query
        order_query.stream.return_value = iter([])

        def collection_side_effect(name: str) -> MagicMock:
            if name == "customers":
                return customer_query
            return order_query

        db.collection.side_effect = collection_side_effect

        from datetime import date
        # 2026-02-02 = 2月2日 → (2-1)//7 = 0 → week index 0 → IN [0,2]
        result = apply_irregular_patterns(db, date(2026, 2, 2))

        assert result.cancelled_count == 0
        assert len(result.excluded_customers) == 0


class TestOrderChangeNotifyEndpoint:
    """POST /notify/order-change のテスト"""

    @patch("optimizer.api.routes_notify.send_chat_dms")
    @patch("optimizer.api.routes_notify.get_firestore_client")
    def test_successful_notify(
        self,
        mock_get_db: MagicMock,
        mock_send: MagicMock,
    ) -> None:
        db = MagicMock()
        mock_get_db.return_value = db

        # ヘルパードキュメントモック
        helper_doc = MagicMock()
        helper_doc.id = "H003"
        helper_doc.exists = True
        helper_doc.to_dict.return_value = {"email": "h003@example.com"}
        db.get_all.return_value = [helper_doc]

        mock_send.return_value = (1, [{"email": "h003@example.com", "success": True}])

        response = client.post(
            "/notify/order-change",
            json={
                "order_id": "ORD001",
                "change_type": "reassigned",
                "affected_staff_ids": ["H003"],
                "customer_name": "田中 太郎",
                "date": "2026-02-11",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["messages_sent"] == 1
        assert data["total_targets"] == 1
        assert data["results"][0]["success"] is True

    @patch("optimizer.api.routes_notify.get_firestore_client")
    def test_no_email_returns_zero_sent(
        self,
        mock_get_db: MagicMock,
    ) -> None:
        db = MagicMock()
        mock_get_db.return_value = db

        helper_doc = MagicMock()
        helper_doc.id = "H003"
        helper_doc.exists = True
        helper_doc.to_dict.return_value = {}
        db.get_all.return_value = [helper_doc]

        response = client.post(
            "/notify/order-change",
            json={
                "order_id": "ORD001",
                "change_type": "cancelled",
                "affected_staff_ids": ["H003"],
                "customer_name": "田中 太郎",
                "date": "2026-02-11",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["messages_sent"] == 0

    def test_missing_required_fields_returns_422(self) -> None:
        response = client.post(
            "/notify/order-change",
            json={"order_id": "ORD001"},
        )
        assert response.status_code == 422


class TestDailyChecklistEndpoint:
    """GET /checklist/next-day のテスト"""

    @patch("optimizer.api.routes_report.get_firestore_client")
    def test_successful_checklist(
        self,
        mock_get_db: MagicMock,
    ) -> None:
        from datetime import datetime, timezone, timedelta
        JST = timezone(timedelta(hours=9))

        db = MagicMock()
        mock_get_db.return_value = db

        # オーダードキュメント
        order_doc = MagicMock()
        order_doc.id = "ORD001"
        order_doc.to_dict.return_value = {
            "customer_id": "C001",
            "start_time": "09:00",
            "end_time": "10:00",
            "service_type": "physical_care",
            "status": "assigned",
            "assigned_staff_ids": ["H003"],
        }

        # ordersコレクションクエリ
        order_query = MagicMock()
        order_query.where.return_value = order_query
        order_query.stream.return_value = iter([order_doc])

        # helpersドキュメント（db.get_all用）
        helper_doc = MagicMock()
        helper_doc.id = "H003"
        helper_doc.exists = True
        helper_doc.to_dict.return_value = {
            "name": {"family": "佐藤", "given": "花子"},
        }

        # customersドキュメント（db.get_all用）
        customer_doc = MagicMock()
        customer_doc.id = "C001"
        customer_doc.exists = True
        customer_doc.to_dict.return_value = {
            "name": {"family": "田中", "given": "太郎"},
        }

        db.collection.return_value = order_query
        # get_all は helpers と customers の両方で呼ばれる
        db.get_all.side_effect = [[helper_doc], [customer_doc]]

        response = client.get("/checklist/next-day?date=2026-02-11")
        assert response.status_code == 200
        data = response.json()
        assert data["date"] == "2026-02-11"
        assert data["total_orders"] == 1
        assert len(data["staff_checklists"]) == 1
        assert data["staff_checklists"][0]["staff_id"] == "H003"
        assert data["staff_checklists"][0]["staff_name"] == "佐藤 花子"
        assert len(data["staff_checklists"][0]["orders"]) == 1

    @patch("optimizer.api.routes_report.get_firestore_client")
    def test_empty_checklist(
        self,
        mock_get_db: MagicMock,
    ) -> None:
        db = MagicMock()
        mock_get_db.return_value = db

        order_query = MagicMock()
        order_query.where.return_value = order_query
        order_query.stream.return_value = iter([])
        db.collection.return_value = order_query

        response = client.get("/checklist/next-day?date=2026-02-11")
        assert response.status_code == 200
        data = response.json()
        assert data["total_orders"] == 0
        assert data["staff_checklists"] == []

    def test_invalid_date_returns_422(self) -> None:
        response = client.get("/checklist/next-day?date=bad-date")
        assert response.status_code == 422


class TestNextDayNotifyEndpoint:
    """POST /notify/next-day のテスト"""

    @patch("optimizer.api.routes_notify.send_chat_dm")
    @patch("optimizer.api.routes_notify.get_firestore_client")
    def test_successful_notify(
        self,
        mock_get_db: MagicMock,
        mock_send_dm: MagicMock,
    ) -> None:
        from datetime import datetime, timezone, timedelta
        JST = timezone(timedelta(hours=9))

        db = MagicMock()
        mock_get_db.return_value = db
        mock_send_dm.return_value = True

        # オーダー
        order_doc = MagicMock()
        order_doc.to_dict.return_value = {
            "customer_id": "C001",
            "start_time": "09:00",
            "end_time": "10:00",
            "status": "assigned",
            "assigned_staff_ids": ["H003"],
        }

        order_query = MagicMock()
        order_query.where.return_value = order_query
        order_query.stream.return_value = iter([order_doc])

        # ヘルパー（db.get_all用）
        helper_doc = MagicMock()
        helper_doc.id = "H003"
        helper_doc.exists = True
        helper_doc.to_dict.return_value = {
            "name": {"family": "佐藤", "given": "花子"},
            "email": "h003@example.com",
        }

        # 利用者（db.get_all用）
        customer_doc = MagicMock()
        customer_doc.id = "C001"
        customer_doc.exists = True
        customer_doc.to_dict.return_value = {
            "name": {"family": "田中", "given": "太郎"},
        }

        db.collection.return_value = order_query
        # get_all: 1回目=customer, 2回目=helper
        db.get_all.side_effect = [[customer_doc], [helper_doc]]

        response = client.post(
            "/notify/next-day",
            json={"date": "2026-02-11"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["messages_sent"] == 1
        assert data["total_targets"] == 1
        assert data["results"][0]["staff_name"] == "佐藤 花子"
        assert data["results"][0]["success"] is True
        mock_send_dm.assert_called_once()

    def test_email_channel_returns_422(self) -> None:
        response = client.post(
            "/notify/next-day",
            json={"date": "2026-02-11", "channel": "email"},
        )
        assert response.status_code == 422
        assert "未実装" in response.json()["detail"]

    @patch("optimizer.api.routes_notify.get_firestore_client")
    def test_no_orders_returns_empty(
        self,
        mock_get_db: MagicMock,
    ) -> None:
        db = MagicMock()
        mock_get_db.return_value = db

        order_query = MagicMock()
        order_query.where.return_value = order_query
        order_query.stream.return_value = iter([])
        db.collection.return_value = order_query

        response = client.post(
            "/notify/next-day",
            json={"date": "2026-02-11"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["messages_sent"] == 0
        assert data["total_targets"] == 0


class TestTimesOverlap:
    """_times_overlap の境界値テスト"""

    def test_overlap(self) -> None:
        from optimizer.data.firestore_writer import _times_overlap
        assert _times_overlap("09:00", "10:00", "09:30", "11:00") is True

    def test_no_overlap(self) -> None:
        from optimizer.data.firestore_writer import _times_overlap
        assert _times_overlap("09:00", "10:00", "10:30", "11:00") is False

    def test_boundary_touching_no_overlap(self) -> None:
        """境界接触（end == start）は重複しない"""
        from optimizer.data.firestore_writer import _times_overlap
        assert _times_overlap("09:00", "10:00", "10:00", "11:00") is False

    def test_contained(self) -> None:
        """一方が他方に完全に含まれる"""
        from optimizer.data.firestore_writer import _times_overlap
        assert _times_overlap("09:00", "12:00", "10:00", "11:00") is True

    def test_same_range(self) -> None:
        from optimizer.data.firestore_writer import _times_overlap
        assert _times_overlap("09:00", "10:00", "09:00", "10:00") is True


class TestShouldExcludeCustomer:
    """_should_exclude_customer のテスト"""

    def test_string_active_weeks(self) -> None:
        """active_weeksが文字列カンマ区切りの場合"""
        from optimizer.data.firestore_writer import _should_exclude_customer
        from datetime import date

        patterns = [{"type": "biweekly", "description": "隔週", "active_weeks": "0,2"}]
        # 2月9日 → week index 1 → NOT in [0,2]
        exclude, ptype, _ = _should_exclude_customer(patterns, date(2026, 2, 9))
        assert exclude is True
        assert ptype == "biweekly"

    def test_empty_active_weeks_no_exclude(self) -> None:
        """active_weeksが空の場合は除外しない"""
        from optimizer.data.firestore_writer import _should_exclude_customer
        from datetime import date

        patterns = [{"type": "biweekly", "description": "隔週", "active_weeks": []}]
        exclude, _, _ = _should_exclude_customer(patterns, date(2026, 2, 9))
        assert exclude is False
