"""通知モジュールのテスト"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from optimizer.api.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# TestRecipients
# ---------------------------------------------------------------------------

class TestRecipients:
    def _make_user(
        self,
        uid: str,
        email: str | None,
        role: str | None,
    ) -> MagicMock:
        user = MagicMock()
        user.uid = uid
        user.email = email
        claims = {"role": role} if role is not None else {}
        user.custom_claims = claims
        return user

    @patch("optimizer.notification.recipients.auth")
    def test_returns_admin_and_service_manager_emails(self, mock_auth: MagicMock) -> None:
        """admin / service_manager のメールのみ返す"""
        admin = self._make_user("u1", "admin@example.com", "admin")
        manager = self._make_user("u2", "mgr@example.com", "service_manager")
        helper = self._make_user("u3", "helper@example.com", "helper")

        page = MagicMock()
        page.users = [admin, manager, helper]
        page.next_page_token = None
        mock_auth.list_users.return_value = page

        from optimizer.notification.recipients import list_manager_emails

        emails = list_manager_emails()
        assert sorted(emails) == ["admin@example.com", "mgr@example.com"]

    @patch("optimizer.notification.recipients.auth")
    def test_skips_users_without_email(self, mock_auth: MagicMock) -> None:
        """email なしユーザーをスキップ"""
        no_email = self._make_user("u1", None, "admin")

        page = MagicMock()
        page.users = [no_email]
        page.next_page_token = None
        mock_auth.list_users.return_value = page

        from optimizer.notification.recipients import list_manager_emails

        assert list_manager_emails() == []

    @patch("optimizer.notification.recipients.auth")
    def test_skips_users_without_custom_claims(self, mock_auth: MagicMock) -> None:
        """Custom Claims なしユーザーをスキップ"""
        no_claims = self._make_user("u1", "user@example.com", None)

        page = MagicMock()
        page.users = [no_claims]
        page.next_page_token = None
        mock_auth.list_users.return_value = page

        from optimizer.notification.recipients import list_manager_emails

        assert list_manager_emails() == []


# ---------------------------------------------------------------------------
# TestSender
# ---------------------------------------------------------------------------

class TestSender:
    def test_send_email_returns_zero(self) -> None:
        """未実装のため常に 0 を返す（graceful degradation）
        TODO: Gmail API（DWD）実装後にテストを更新する
        """
        from optimizer.notification.sender import send_email

        count = send_email(
            to_emails=["a@example.com", "b@example.com"],
            subject="テスト件名",
            html_content="<p>テスト</p>",
        )
        assert count == 0


# ---------------------------------------------------------------------------
# TestNotifyEndpoints
# ---------------------------------------------------------------------------

class TestNotifyEndpoints:
    @patch("optimizer.api.routes.send_email")
    @patch("optimizer.api.routes.list_manager_emails")
    def test_shift_confirmed_success(
        self,
        mock_recipients: MagicMock,
        mock_send: MagicMock,
    ) -> None:
        """POST /notify/shift-confirmed → 200"""
        mock_recipients.return_value = ["mgr@example.com"]
        mock_send.return_value = 1

        response = client.post(
            "/notify/shift-confirmed",
            json={
                "week_start_date": "2026-02-23",
                "assigned_count": 50,
                "total_orders": 60,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["emails_sent"] == 1
        assert data["recipients"] == ["mgr@example.com"]

    @patch("optimizer.api.routes.send_email")
    @patch("optimizer.api.routes.list_manager_emails")
    def test_shift_confirmed_no_recipients(
        self,
        mock_recipients: MagicMock,
        mock_send: MagicMock,
    ) -> None:
        """サ責0名の場合 emails_sent=0"""
        mock_recipients.return_value = []
        mock_send.return_value = 0

        response = client.post(
            "/notify/shift-confirmed",
            json={
                "week_start_date": "2026-02-23",
                "assigned_count": 0,
                "total_orders": 0,
            },
        )
        assert response.status_code == 200
        assert response.json()["emails_sent"] == 0

    @patch("optimizer.api.routes.send_email")
    @patch("optimizer.api.routes.list_manager_emails")
    def test_shift_changed_success(
        self,
        mock_recipients: MagicMock,
        mock_send: MagicMock,
    ) -> None:
        """POST /notify/shift-changed → 200"""
        mock_recipients.return_value = ["mgr@example.com"]
        mock_send.return_value = 1

        response = client.post(
            "/notify/shift-changed",
            json={
                "week_start_date": "2026-02-23",
                "changes": [
                    {
                        "order_id": "order-1",
                        "customer_name": "山田 花子",
                        "date": "2026-02-24",
                        "time_range": "09:00〜10:00",
                        "old_staff": "田中 太郎",
                        "new_staff": "鈴木 次郎",
                    }
                ],
            },
        )
        assert response.status_code == 200
        assert response.json()["emails_sent"] == 1

    def test_shift_changed_empty_changes_returns_422(self) -> None:
        """changes が空の場合 422"""
        response = client.post(
            "/notify/shift-changed",
            json={
                "week_start_date": "2026-02-23",
                "changes": [],
            },
        )
        assert response.status_code == 422

    @patch("optimizer.api.routes.send_email")
    @patch("optimizer.api.routes.list_manager_emails")
    def test_unavailability_reminder_success(
        self,
        mock_recipients: MagicMock,
        mock_send: MagicMock,
    ) -> None:
        """POST /notify/unavailability-reminder → 200"""
        mock_recipients.return_value = ["mgr@example.com"]
        mock_send.return_value = 1

        response = client.post(
            "/notify/unavailability-reminder",
            json={
                "target_week_start": "2026-03-02",
                "helpers_not_submitted": [{"id": "h1", "name": "佐藤 一郎"}],
            },
        )
        assert response.status_code == 200
        assert response.json()["emails_sent"] == 1
