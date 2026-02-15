"""Firebase認証ミドルウェア"""

import logging
import os
import threading

import firebase_admin
from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

ALLOW_UNAUTHENTICATED = os.getenv("ALLOW_UNAUTHENTICATED", "false").lower() == "true"

# Firebase Admin初期化（アプリケーションデフォルト認証情報を使用）
_firebase_app: firebase_admin.App | None = None
_lock = threading.Lock()


def _get_firebase_app() -> firebase_admin.App | None:
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    if ALLOW_UNAUTHENTICATED:
        return None
    with _lock:
        if _firebase_app is None:
            try:
                _firebase_app = firebase_admin.get_app()
            except ValueError:
                _firebase_app = firebase_admin.initialize_app()
    return _firebase_app


def _extract_token(request: Request) -> str | None:
    """AuthorizationヘッダーからBearerトークンを取得"""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    parts = auth_header.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


async def verify_auth(request: Request) -> dict | None:
    """認証検証の依存注入。

    ALLOW_UNAUTHENTICATED=true の場合はスキップ。
    それ以外はFirebase IDトークンを検証し、デコード済みトークンを返す。
    """
    if ALLOW_UNAUTHENTICATED:
        return None

    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="認証が必要です")

    _get_firebase_app()
    try:
        from firebase_admin import auth

        decoded = auth.verify_id_token(token)
        return decoded
    except Exception as e:
        logger.warning("トークン検証失敗: %s", type(e).__name__)
        raise HTTPException(status_code=401, detail="無効な認証トークンです")


async def require_manager_or_above(request: Request) -> dict | None:
    """admin または service_manager ロールを要求する依存注入。

    - ALLOW_UNAUTHENTICATED=true: スキップ（デモモード互換）
    - role 未設定（Custom Claims なし）: 許可（Firestoreルールの hasNoRole() と同等）
    - admin / service_manager: 許可
    - helper / その他: 403
    """
    decoded = await verify_auth(request)
    if decoded is None:
        return None

    role = decoded.get("role")
    if role is None:
        return decoded

    if role not in ("admin", "service_manager"):
        raise HTTPException(status_code=403, detail="権限がありません")
    return decoded
