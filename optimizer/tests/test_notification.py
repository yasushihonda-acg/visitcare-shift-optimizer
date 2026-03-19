"""通知モジュールのテスト（Google Chat DM 催促）"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from optimizer.api.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# TestChatReminderEndpoints
# ---------------------------------------------------------------------------

class TestChatReminderEndpoints:
    @patch("optimizer.api.routes_notify.send_chat_dms")
    def test_chat_reminder_success(self, mock_send: MagicMock) -> None:
        """POST /notify/chat-reminder → 200"""
        mock_send.return_value = (1, [
            {"email": "staff@example.com", "success": True},
        ])

        response = client.post(
            "/notify/chat-reminder",
            json={
                "target_week_start": "2026-03-10",
                "targets": [
                    {"staff_id": "h1", "name": "佐藤 一郎", "email": "staff@example.com"},
                ],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["messages_sent"] == 1
        assert data["total_targets"] == 1
        assert data["results"][0]["staff_id"] == "h1"
        assert data["results"][0]["success"] is True

    @patch("optimizer.api.routes_notify.send_chat_dms")
    def test_chat_reminder_partial_failure(self, mock_send: MagicMock) -> None:
        """一部失敗でも200を返し結果に反映される"""
        mock_send.return_value = (1, [
            {"email": "a@example.com", "success": True},
            {"email": "b@example.com", "success": False},
        ])

        response = client.post(
            "/notify/chat-reminder",
            json={
                "target_week_start": "2026-03-10",
                "targets": [
                    {"staff_id": "h1", "name": "田中", "email": "a@example.com"},
                    {"staff_id": "h2", "name": "鈴木", "email": "b@example.com"},
                ],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["messages_sent"] == 1
        assert data["total_targets"] == 2

    def test_chat_reminder_empty_targets_returns_422(self) -> None:
        """targets が空の場合 422"""
        response = client.post(
            "/notify/chat-reminder",
            json={
                "target_week_start": "2026-03-10",
                "targets": [],
            },
        )
        assert response.status_code == 422

    @patch("optimizer.api.routes_notify.send_chat_dms")
    def test_chat_reminder_custom_message(self, mock_send: MagicMock) -> None:
        """カスタムメッセージが send_chat_dms に渡される"""
        mock_send.return_value = (1, [
            {"email": "a@example.com", "success": True},
        ])

        response = client.post(
            "/notify/chat-reminder",
            json={
                "target_week_start": "2026-03-10",
                "targets": [
                    {"staff_id": "h1", "name": "田中", "email": "a@example.com"},
                ],
                "message": "カスタム催促メッセージ",
            },
        )
        assert response.status_code == 200
        mock_send.assert_called_once_with(
            ["a@example.com"],
            "カスタム催促メッセージ",
        )
