"""Google Chat DM 送信モジュールのテスト"""

from unittest.mock import MagicMock, patch

import pytest

from optimizer.notification.chat_sender import send_chat_dm, send_chat_dms


class TestSendChatDm:
    @patch("optimizer.notification.chat_sender._build_chat_service")
    def test_returns_false_when_service_unavailable(self, mock_build: MagicMock) -> None:
        """Chat API サービス構築失敗時は False を返す"""
        mock_build.return_value = None
        assert send_chat_dm("user@example.com", "test") is False

    @patch("optimizer.notification.chat_sender._build_chat_service")
    def test_returns_false_when_dm_space_not_found(self, mock_build: MagicMock) -> None:
        """DM スペースが見つからない場合は False を返す"""
        mock_service = MagicMock()
        mock_service.spaces.return_value.findDirectMessage.return_value.execute.side_effect = (
            Exception("Not found")
        )
        mock_build.return_value = mock_service
        assert send_chat_dm("user@example.com", "test") is False

    @patch("optimizer.notification.chat_sender._build_chat_service")
    def test_sends_message_successfully(self, mock_build: MagicMock) -> None:
        """DM スペースが見つかった場合はメッセージを送信し True を返す"""
        mock_service = MagicMock()
        mock_service.spaces.return_value.findDirectMessage.return_value.execute.return_value = {
            "name": "spaces/AAAA"
        }
        mock_build.return_value = mock_service

        assert send_chat_dm("user@example.com", "Hello!") is True

        mock_service.spaces.return_value.messages.return_value.create.assert_called_once_with(
            parent="spaces/AAAA",
            body={"text": "Hello!"},
        )

    @patch("optimizer.notification.chat_sender._build_chat_service")
    def test_returns_false_when_message_create_fails(self, mock_build: MagicMock) -> None:
        """メッセージ送信が失敗した場合は False を返す"""
        mock_service = MagicMock()
        mock_service.spaces.return_value.findDirectMessage.return_value.execute.return_value = {
            "name": "spaces/AAAA"
        }
        mock_service.spaces.return_value.messages.return_value.create.return_value.execute.side_effect = (
            Exception("Send failed")
        )
        mock_build.return_value = mock_service

        assert send_chat_dm("user@example.com", "Hello!") is False


class TestSendChatDms:
    @patch("optimizer.notification.chat_sender._build_chat_service")
    def test_returns_zero_for_empty_list(self, mock_build: MagicMock) -> None:
        """空リストの場合は 0 件を返す"""
        sent, results = send_chat_dms([], "test")
        assert sent == 0
        assert results == []

    @patch("optimizer.notification.chat_sender._build_chat_service")
    def test_returns_zero_when_service_unavailable(self, mock_build: MagicMock) -> None:
        """Chat API サービス構築失敗時は全件失敗を返す"""
        mock_build.return_value = None
        sent, results = send_chat_dms(["a@example.com", "b@example.com"], "test")
        assert sent == 0
        assert len(results) == 2
        assert all(r["success"] is False for r in results)

    @patch("optimizer.notification.chat_sender._build_chat_service")
    def test_partial_success(self, mock_build: MagicMock) -> None:
        """一部成功・一部失敗のケース"""
        mock_service = MagicMock()

        def find_dm_side_effect(name: str) -> MagicMock:
            mock_exec = MagicMock()
            if name == "users/a@example.com":
                mock_exec.execute.return_value = {"name": "spaces/AAA"}
            else:
                mock_exec.execute.side_effect = Exception("Not found")
            return mock_exec

        mock_service.spaces.return_value.findDirectMessage.side_effect = find_dm_side_effect
        mock_build.return_value = mock_service

        sent, results = send_chat_dms(
            ["a@example.com", "b@example.com"], "Hello!"
        )

        assert sent == 1
        assert len(results) == 2
        assert results[0] == {"email": "a@example.com", "success": True}
        assert results[1] == {"email": "b@example.com", "success": False}

    @patch("optimizer.notification.chat_sender._build_chat_service")
    def test_all_success(self, mock_build: MagicMock) -> None:
        """全件成功のケース"""
        mock_service = MagicMock()
        mock_service.spaces.return_value.findDirectMessage.return_value.execute.return_value = {
            "name": "spaces/DM"
        }
        mock_build.return_value = mock_service

        sent, results = send_chat_dms(
            ["a@example.com", "b@example.com"], "Hello!"
        )

        assert sent == 2
        assert all(r["success"] is True for r in results)
