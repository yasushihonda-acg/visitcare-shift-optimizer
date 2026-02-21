"""メール送信モジュール（未実装）

TODO: Gmail API（DWD）での実装を予定。
      実装が完了するまでは emails_sent=0 を返す（graceful degradation）。
      参考: docs/adr/ にて送信手段の ADR 作成予定。
"""

import logging

logger = logging.getLogger(__name__)


def send_email(to_emails: list[str], subject: str, html_content: str) -> int:
    """メール送信（未実装）。

    Gmail API（DWD）での実装が完了するまで 0 を返す。
    """
    logger.warning(
        "send_email: メール送信は未実装のためスキップします (to=%s, subject=%s)",
        to_emails,
        subject,
    )
    return 0
