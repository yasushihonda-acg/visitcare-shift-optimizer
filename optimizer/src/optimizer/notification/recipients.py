"""Firebase Auth からサ責メールアドレスを取得する"""

import logging

from firebase_admin import auth

logger = logging.getLogger(__name__)


def list_manager_emails() -> list[str]:
    """Custom Claims の role が admin/service_manager のユーザーのメールを返す。

    Firebase Admin SDK の auth.list_users() でページネーション走査する。
    """
    emails: list[str] = []

    page = auth.list_users()
    while page is not None:
        for user in page.users:
            if not user.email:
                continue
            claims = user.custom_claims or {}
            role = claims.get("role")
            if role in ("admin", "service_manager"):
                emails.append(user.email)
        page = page.get_next_page() if page.next_page_token else None

    return emails
