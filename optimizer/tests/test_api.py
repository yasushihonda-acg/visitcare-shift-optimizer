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

    @patch("optimizer.api.routes.duplicate_week_orders")
    @patch("optimizer.api.routes.get_firestore_client")
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

    @patch("optimizer.api.routes.duplicate_week_orders")
    @patch("optimizer.api.routes.get_firestore_client")
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

    @patch("optimizer.api.routes.apply_unavailability_to_orders")
    @patch("optimizer.api.routes.get_firestore_client")
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

    @patch("optimizer.api.routes.apply_unavailability_to_orders")
    @patch("optimizer.api.routes.get_firestore_client")
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
