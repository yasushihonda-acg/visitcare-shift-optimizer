"""通知モジュールのテスト"""

import os
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from optimizer.api.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# TestGetSenderEmail
# ---------------------------------------------------------------------------

class TestGetSenderEmail:
    @patch("optimizer.api.routes.get_firestore_client")
    def test_returns_firestore_value_when_available(self, mock_get_client: MagicMock) -> None:
        """Firestore に sender_email がある場合、その値を返す"""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {"sender_email": "firestore@example.com"}
        mock_get_client.return_value.collection.return_value.document.return_value.get.return_value = mock_doc

        from optimizer.api.routes import _get_sender_email

        assert _get_sender_email() == "firestore@example.com"

    @patch.dict(os.environ, {"NOTIFICATION_SENDER_EMAIL": "env@example.com"})
    @patch("optimizer.api.routes.get_firestore_client")
    def test_falls_back_to_env_when_doc_not_exists(self, mock_get_client: MagicMock) -> None:
        """Firestore ドキュメントが存在しない場合、env var にフォールバックする"""
        mock_doc = MagicMock()
        mock_doc.exists = False
        mock_get_client.return_value.collection.return_value.document.return_value.get.return_value = mock_doc

        from optimizer.api.routes import _get_sender_email

        assert _get_sender_email() == "env@example.com"

    @patch.dict(os.environ, {"NOTIFICATION_SENDER_EMAIL": "env@example.com"})
    @patch("optimizer.api.routes.get_firestore_client")
    def test_falls_back_to_env_when_firestore_fails(self, mock_get_client: MagicMock) -> None:
        """Firestore アクセス失敗時、env var にフォールバックする"""
        mock_get_client.side_effect = Exception("Firestore 接続エラー")

        from optimizer.api.routes import _get_sender_email

        assert _get_sender_email() == "env@example.com"

    @patch.dict(os.environ, {"NOTIFICATION_SENDER_EMAIL": "env@example.com"})
    @patch("optimizer.api.routes.get_firestore_client")
    def test_falls_back_to_env_when_sender_email_empty(self, mock_get_client: MagicMock) -> None:
        """Firestore の sender_email が空の場合、env var にフォールバックする"""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {"sender_email": ""}
        mock_get_client.return_value.collection.return_value.document.return_value.get.return_value = mock_doc

        from optimizer.api.routes import _get_sender_email

        assert _get_sender_email() == "env@example.com"


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
    @patch.dict(os.environ, {"NOTIFICATION_SENDER_EMAIL": ""})
    def test_no_sender_email_returns_zero(self) -> None:
        """NOTIFICATION_SENDER_EMAIL 未設定の場合 0 を返す（graceful degradation）"""
        from optimizer.notification.sender import send_email

        assert send_email(["a@example.com"], "テスト件名", "<p>テスト</p>") == 0

    def test_empty_recipients_returns_zero(self) -> None:
        """宛先リストが空の場合 0 を返す（Gmail サービスを呼び出さない）"""
        from optimizer.notification.sender import send_email

        assert send_email([], "テスト件名", "<p>テスト</p>") == 0

    @patch("optimizer.notification.sender._build_gmail_service")
    def test_service_unavailable_returns_zero(self, mock_build: MagicMock) -> None:
        """Gmail サービス構築失敗時（None 返却）は 0 を返す"""
        mock_build.return_value = None

        from optimizer.notification.sender import send_email

        assert send_email(["a@example.com"], "テスト件名", "<p>テスト</p>") == 0

    @patch("optimizer.notification.sender._build_gmail_service")
    @patch.dict(os.environ, {"NOTIFICATION_SENDER_EMAIL": "noreply@example.com"})
    def test_send_email_success(self, mock_build: MagicMock) -> None:
        """全宛先に送信成功した場合、送信数を返す"""
        mock_service = MagicMock()
        mock_service.users().messages().send().execute.return_value = {"id": "msg-1"}
        mock_build.return_value = mock_service

        from optimizer.notification.sender import send_email

        count = send_email(["a@example.com", "b@example.com"], "テスト件名", "<p>テスト</p>")
        assert count == 2

    @patch("optimizer.notification.sender._build_gmail_service")
    @patch.dict(os.environ, {"NOTIFICATION_SENDER_EMAIL": "noreply@example.com"})
    def test_send_email_partial_failure(self, mock_build: MagicMock) -> None:
        """1件失敗しても他の送信は続行する（部分成功）"""
        mock_service = MagicMock()
        mock_service.users().messages().send().execute.side_effect = [
            Exception("送信失敗"),
            {"id": "msg-2"},
        ]
        mock_build.return_value = mock_service

        from optimizer.notification.sender import send_email

        count = send_email(["fail@example.com", "ok@example.com"], "テスト件名", "<p>テスト</p>")
        assert count == 1

    @patch("optimizer.notification.sender._build_gmail_service")
    def test_send_email_uses_sender_email_arg(self, mock_build: MagicMock) -> None:
        """sender_email 引数が指定された場合、その値を使用する（env var より優先）"""
        mock_service = MagicMock()
        mock_service.users().messages().send().execute.return_value = {"id": "msg-1"}
        mock_build.return_value = mock_service

        from optimizer.notification.sender import send_email

        count = send_email(
            ["a@example.com"],
            "テスト件名",
            "<p>テスト</p>",
            sender_email="custom@example.com",
        )
        assert count == 1
        # _build_gmail_service が custom sender_email で呼ばれること
        mock_build.assert_called_once_with("custom@example.com")

    def test_send_email_no_sender_email_returns_zero_without_env(self) -> None:
        """sender_email 引数なし かつ env var 未設定の場合 0 を返す"""
        with patch.dict(os.environ, {"NOTIFICATION_SENDER_EMAIL": ""}):
            from optimizer.notification.sender import send_email

            assert send_email(["a@example.com"], "テスト件名", "<p>テスト</p>") == 0


# ---------------------------------------------------------------------------
# TestNotifyEndpoints
# ---------------------------------------------------------------------------

class TestNotifyEndpoints:
    @patch("optimizer.api.routes._get_sender_email")
    @patch("optimizer.api.routes.send_email")
    @patch("optimizer.api.routes.list_manager_emails")
    def test_shift_confirmed_success(
        self,
        mock_recipients: MagicMock,
        mock_send: MagicMock,
        mock_sender: MagicMock,
    ) -> None:
        """POST /notify/shift-confirmed → 200"""
        mock_recipients.return_value = ["mgr@example.com"]
        mock_send.return_value = 1
        mock_sender.return_value = "noreply@example.com"

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
        # send_email が sender_email 引数付きで呼ばれること
        mock_send.assert_called_once()
        _, kwargs = mock_send.call_args
        assert kwargs.get("sender_email") == "noreply@example.com"

    @patch("optimizer.api.routes._get_sender_email")
    @patch("optimizer.api.routes.send_email")
    @patch("optimizer.api.routes.list_manager_emails")
    def test_shift_confirmed_no_recipients(
        self,
        mock_recipients: MagicMock,
        mock_send: MagicMock,
        mock_sender: MagicMock,
    ) -> None:
        """サ責0名の場合 emails_sent=0"""
        mock_recipients.return_value = []
        mock_send.return_value = 0
        mock_sender.return_value = "noreply@example.com"

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

    @patch("optimizer.api.routes._get_sender_email")
    @patch("optimizer.api.routes.send_email")
    @patch("optimizer.api.routes.list_manager_emails")
    def test_shift_changed_success(
        self,
        mock_recipients: MagicMock,
        mock_send: MagicMock,
        mock_sender: MagicMock,
    ) -> None:
        """POST /notify/shift-changed → 200"""
        mock_recipients.return_value = ["mgr@example.com"]
        mock_send.return_value = 1
        mock_sender.return_value = "noreply@example.com"

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

    @patch("optimizer.api.routes._get_sender_email")
    @patch("optimizer.api.routes.send_email")
    @patch("optimizer.api.routes.list_manager_emails")
    def test_unavailability_reminder_success(
        self,
        mock_recipients: MagicMock,
        mock_send: MagicMock,
        mock_sender: MagicMock,
    ) -> None:
        """POST /notify/unavailability-reminder → 200"""
        mock_recipients.return_value = ["mgr@example.com"]
        mock_send.return_value = 1
        mock_sender.return_value = "noreply@example.com"

        response = client.post(
            "/notify/unavailability-reminder",
            json={
                "target_week_start": "2026-03-02",
                "helpers_not_submitted": [{"id": "h1", "name": "佐藤 一郎"}],
            },
        )
        assert response.status_code == 200
        assert response.json()["emails_sent"] == 1

    @patch("optimizer.api.routes.send_chat_dms")
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

    @patch("optimizer.api.routes.send_chat_dms")
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

    @patch("optimizer.api.routes.send_chat_dms")
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
