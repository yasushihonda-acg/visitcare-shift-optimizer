"""Google Chat API によるDM送信モジュール

認証フロー:
  サービスアカウント → chat.bot スコープ → Google Chat API
  findDirectMessage で DM スペースを検出 → messages.create で送信

Bot未設定・認証失敗時は 0 を返す（graceful degradation）。
ローカル開発では Chat API が利用できないため送信をスキップする。
"""

import logging
from typing import Any

import google.auth  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)

_CHAT_SCOPES = ["https://www.googleapis.com/auth/chat.bot"]


def _build_chat_service() -> Any | None:
    """Google Chat API サービスを構築する。"""
    try:
        from googleapiclient.discovery import build  # type: ignore[import-untyped]

        creds, _ = google.auth.default(scopes=_CHAT_SCOPES)
        return build("chat", "v1", credentials=creds)
    except google.auth.exceptions.DefaultCredentialsError:
        logger.error("Google 認証情報が設定されていません。ADC または SA キーを確認してください")
        return None
    except Exception:
        logger.exception("Google Chat API サービスの構築に失敗しました")
        return None


def _find_dm_space(service: Any, user_email: str) -> str | None:
    """ユーザーとの DM スペース名を取得する。

    Chat App がユーザーにインストール済みであれば DM スペースが存在する。
    """
    try:
        dm = service.spaces().findDirectMessage(
            name=f"users/{user_email}"
        ).execute()
        return dm.get("name")
    except Exception:
        logger.exception("DM スペース取得で予期しないエラー: %s", user_email)
        return None


def send_chat_dm(user_email: str, message_text: str) -> bool:
    """Google Chat で個人 DM を送信する。

    Args:
        user_email: 送信先ユーザーのメールアドレス
        message_text: 送信するメッセージテキスト

    Returns:
        送信成功時 True、失敗時 False。
    """
    service = _build_chat_service()
    if service is None:
        return False

    space_name = _find_dm_space(service, user_email)
    if not space_name:
        return False

    try:
        service.spaces().messages().create(
            parent=space_name,
            body={"text": message_text},
        ).execute()
        return True
    except Exception:
        logger.exception("Chat DM 送信失敗: %s", user_email)
        return False


def send_chat_dms(
    user_emails: list[str],
    message_text: str,
) -> tuple[int, list[dict[str, str | bool]]]:
    """複数ユーザーに Google Chat DM を一斉送信する。

    Args:
        user_emails: 送信先メールアドレスリスト
        message_text: 送信するメッセージテキスト

    Returns:
        (送信成功件数, 各ユーザーの結果リスト [{email, success}])
    """
    if not user_emails:
        return 0, []

    service = _build_chat_service()
    if service is None:
        logger.warning("Chat API サービス構築失敗のため、全送信をスキップします")
        return 0, [{"email": e, "success": False} for e in user_emails]

    sent_count = 0
    results: list[dict[str, str | bool]] = []

    for email in user_emails:
        space_name = _find_dm_space(service, email)
        if not space_name:
            results.append({"email": email, "success": False})
            continue

        try:
            service.spaces().messages().create(
                parent=space_name,
                body={"text": message_text},
            ).execute()
            sent_count += 1
            results.append({"email": email, "success": True})
        except Exception:
            logger.exception("Chat DM 送信失敗: %s", email)
            results.append({"email": email, "success": False})

    return sent_count, results
