"""SendGrid を使ってメールを送信する"""

import logging
import os

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

logger = logging.getLogger(__name__)

SENDER_EMAIL = os.getenv("NOTIFICATION_SENDER_EMAIL", "noreply@example.com")


def send_email(to_emails: list[str], subject: str, html_content: str) -> int:
    """SendGrid でメール送信。送信成功数を返す。

    - SENDGRID_API_KEY 未設定時は 0 を返す（graceful degradation）
    - 個別送信失敗は他に影響させない（部分成功対応）
    """
    api_key = os.getenv("SENDGRID_API_KEY")
    if not api_key:
        logger.warning("SENDGRID_API_KEY が未設定のため、メール送信をスキップします")
        return 0

    sg = SendGridAPIClient(api_key)
    sent = 0
    for to_email in to_emails:
        try:
            message = Mail(
                from_email=SENDER_EMAIL,
                to_emails=to_email,
                subject=subject,
                html_content=html_content,
            )
            sg.send(message)
            sent += 1
            logger.info("メール送信成功: to=%s", to_email)
        except Exception as e:
            logger.error("メール送信失敗: to=%s, error=%s", to_email, e)

    return sent
