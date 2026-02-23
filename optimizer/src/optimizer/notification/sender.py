"""Gmail API（Domain-Wide Delegation）によるメール送信モジュール

認証フロー（Cloud Run）:
  Compute Engine SA → IAM Credentials API（SA self-impersonation）
  → subject=NOTIFICATION_SENDER_EMAIL → Gmail API: users.messages.send

ローカル開発:
  NOTIFICATION_SENDER_EMAIL 未設定時は 0 を返す（graceful degradation）
  Compute Engine 以外の環境では送信をスキップする。

参考: docs/adr/ADR-016-gmail-api-dwd-email-sender.md
"""

import base64
import logging
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import google.auth  # type: ignore[import-untyped]
import google.auth.compute_engine  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)

_GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


def _build_gmail_service(sender_email: str) -> Any | None:
    """Gmail API サービスを構築する。

    Sheets API と同じ SA self-impersonation + DWD subject パターンを使用する。
    """
    try:
        from googleapiclient.discovery import build  # type: ignore[import-untyped]

        creds, _ = google.auth.default()

        if isinstance(creds, google.auth.compute_engine.Credentials):
            from google.auth import impersonated_credentials  # type: ignore[import-untyped]

            sa_email = os.getenv(
                "NOTIFICATION_SA_EMAIL",
                "1045989697649-compute@developer.gserviceaccount.com",
            )
            creds = impersonated_credentials.Credentials(
                source_credentials=creds,
                target_principal=sa_email,
                target_scopes=_GMAIL_SCOPES,
                subject=sender_email,
            )

        return build("gmail", "v1", credentials=creds)

    except Exception:
        logger.exception("Gmail API サービスの構築に失敗しました")
        return None


def _create_message(
    sender: str, to: str, subject: str, html_content: str
) -> dict[str, str]:
    """MIME メッセージを作成し、Gmail API 送信用の辞書に変換する。"""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    msg.attach(MIMEText(html_content, "html", "utf-8"))
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    return {"raw": raw}


def send_email(
    to_emails: list[str],
    subject: str,
    html_content: str,
    sender_email: str | None = None,
) -> int:
    """Gmail API（DWD）でメールを一斉送信する。

    Args:
        to_emails: 送信先メールアドレスリスト
        subject: メール件名
        html_content: メール本文（HTML）
        sender_email: 送信元メールアドレス。None の場合は env var フォールバック。

    Returns:
        送信成功した件数。送信元未設定・認証失敗時は 0。
        個別の送信失敗は他の送信に影響しない（部分成功対応）。
    """
    if not to_emails:
        return 0

    resolved_sender = sender_email or os.getenv("NOTIFICATION_SENDER_EMAIL", "")
    if not resolved_sender:
        logger.warning("送信元メールアドレスが未設定のため、メール送信をスキップします")
        return 0

    service = _build_gmail_service(resolved_sender)
    if service is None:
        return 0

    sent_count = 0

    for email in to_emails:
        try:
            message = _create_message(resolved_sender, email, subject, html_content)
            service.users().messages().send(userId="me", body=message).execute()
            sent_count += 1
        except Exception:
            logger.exception("メール送信失敗 to=%s", email)

    return sent_count
