"""Firebase認証ミドルウェア（optimizer/api/auth.py から移植）"""

import logging
import threading

import firebase_admin
from fastapi import HTTPException, Request

from src.shared.config import ALLOW_UNAUTHENTICATED

logger = logging.getLogger(__name__)

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
    """認証検証。ALLOW_UNAUTHENTICATED=trueの場合はスキップ。"""
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


async def require_role(request: Request, allowed_roles: set[str]) -> dict | None:
    """指定ロールを要求する認証。"""
    decoded = await verify_auth(request)
    if decoded is None:
        return None

    role = decoded.get("role")
    if not role:
        logger.warning("ロールクレームが未設定 [uid=%s]", decoded.get("uid", "unknown"))
        raise HTTPException(
            status_code=403, detail="ロールが設定されていません。管理者にお問い合わせください。",
        )
    if role not in allowed_roles:
        logger.warning(
            "権限不足 [uid=%s, role=%s, required=%s]",
            decoded.get("uid", "unknown"), role, allowed_roles,
        )
        raise HTTPException(status_code=403, detail="権限がありません")
    return decoded


async def require_manager_or_above(request: Request) -> dict | None:
    """admin または service_manager ロールを要求。"""
    return await require_role(request, {"admin", "service_manager"})


async def require_helper(request: Request) -> dict | None:
    """helper, service_manager, admin いずれかのロールを要求。"""
    return await require_role(request, {"admin", "service_manager", "helper"})
