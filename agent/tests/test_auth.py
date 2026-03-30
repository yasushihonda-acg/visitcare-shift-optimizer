"""API認証モジュールのテスト（AUTH-01〜AUTH-07）

セキュリティ: 認証境界の網羅テスト。
Firebase Admin SDKはモックで差し替え、Firestoreエミュレータ不要。
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

import src.shared.auth as auth_module
from src.shared.auth import (
    _extract_token,
    _get_firebase_app,
    require_helper,
    require_manager_or_above,
    require_role,
    verify_auth,
)


def _make_request(authorization: str | None = None) -> MagicMock:
    """FastAPI Requestのモック生成。"""
    request = MagicMock()
    headers = {}
    if authorization is not None:
        headers["Authorization"] = authorization
    request.headers.get = lambda key, default=None: headers.get(key, default)
    return request


# ---------------------------------------------------------------------------
# AUTH-01: _extract_token
# ---------------------------------------------------------------------------
class TestExtractToken:
    """Bearerトークン解析のテスト"""

    def test_valid_bearer(self):
        request = _make_request("Bearer my-token-123")
        assert _extract_token(request) == "my-token-123"

    def test_no_header(self):
        request = _make_request(None)
        assert _extract_token(request) is None

    def test_basic_scheme_rejected(self):
        request = _make_request("Basic dXNlcjpwYXNz")
        assert _extract_token(request) is None

    def test_bearer_only_no_token(self):
        request = _make_request("Bearer")
        assert _extract_token(request) is None

    def test_too_many_parts(self):
        request = _make_request("Bearer a b c")
        assert _extract_token(request) is None

    def test_case_insensitive_bearer(self):
        """auth.pyは parts[0].lower() == 'bearer' で比較"""
        request = _make_request("BEARER my-token")
        assert _extract_token(request) == "my-token"


# ---------------------------------------------------------------------------
# AUTH-02: verify_auth
# ---------------------------------------------------------------------------
class TestVerifyAuth:
    """認証検証のテスト"""

    @pytest.mark.asyncio
    async def test_unauthenticated_mode_returns_none(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", True)
        request = _make_request()
        result = await verify_auth(request)
        assert result is None

    @pytest.mark.asyncio
    async def test_no_token_raises_401(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        request = _make_request(None)
        with pytest.raises(HTTPException) as exc_info:
            await verify_auth(request)
        assert exc_info.value.status_code == 401
        assert "認証が必要です" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        request = _make_request("Bearer invalid-token")
        with patch.object(auth_module, "_get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", side_effect=Exception("Invalid")):
            with pytest.raises(HTTPException) as exc_info:
                await verify_auth(request)
            assert exc_info.value.status_code == 401
            assert "無効な認証トークン" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_valid_token_returns_decoded(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "user-1", "role": "admin", "helper_id": "h1"}
        request = _make_request("Bearer valid-token")
        with patch.object(auth_module, "_get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            result = await verify_auth(request)
            assert result == decoded
            assert result["uid"] == "user-1"


# ---------------------------------------------------------------------------
# AUTH-03〜04: require_role
# ---------------------------------------------------------------------------
class TestRequireRole:
    """ロール判定のテスト"""

    @pytest.mark.asyncio
    async def test_matching_role_passes(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "admin"}
        request = _make_request("Bearer t")
        with patch.object(auth_module, "_get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            result = await require_role(request, {"admin"})
            assert result["role"] == "admin"

    @pytest.mark.asyncio
    async def test_multiple_allowed_roles(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "service_manager"}
        request = _make_request("Bearer t")
        with patch.object(auth_module, "_get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            result = await require_role(request, {"admin", "service_manager"})
            assert result["role"] == "service_manager"

    @pytest.mark.asyncio
    async def test_insufficient_role_raises_403(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "helper"}
        request = _make_request("Bearer t")
        with patch.object(auth_module, "_get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            with pytest.raises(HTTPException) as exc_info:
                await require_role(request, {"admin", "service_manager"})
            assert exc_info.value.status_code == 403
            assert "権限がありません" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_no_role_claim_raises_403(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1"}  # roleフィールドなし
        request = _make_request("Bearer t")
        with patch.object(auth_module, "_get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            with pytest.raises(HTTPException) as exc_info:
                await require_role(request, {"admin"})
            assert exc_info.value.status_code == 403
            assert "ロールが設定されていません" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_unauthenticated_mode_returns_none(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", True)
        request = _make_request()
        result = await require_role(request, {"admin"})
        assert result is None


# ---------------------------------------------------------------------------
# AUTH-05: require_manager_or_above
# ---------------------------------------------------------------------------
class TestRequireManagerOrAbove:
    """サ責以上の認可テスト"""

    @pytest.mark.asyncio
    async def test_admin_passes(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "admin"}
        request = _make_request("Bearer t")
        with patch.object(auth_module, "_get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            result = await require_manager_or_above(request)
            assert result["role"] == "admin"

    @pytest.mark.asyncio
    async def test_service_manager_passes(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "service_manager"}
        request = _make_request("Bearer t")
        with patch.object(auth_module, "_get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            result = await require_manager_or_above(request)
            assert result["role"] == "service_manager"

    @pytest.mark.asyncio
    async def test_helper_rejected(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "helper"}
        request = _make_request("Bearer t")
        with patch.object(auth_module, "_get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            with pytest.raises(HTTPException) as exc_info:
                await require_manager_or_above(request)
            assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# AUTH-06: require_helper
# ---------------------------------------------------------------------------
class TestRequireHelper:
    """ヘルパー以上の認可テスト"""

    @pytest.mark.asyncio
    async def test_helper_passes(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "helper"}
        request = _make_request("Bearer t")
        with patch.object(auth_module, "_get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            result = await require_helper(request)
            assert result["role"] == "helper"

    @pytest.mark.asyncio
    async def test_unknown_role_rejected(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "viewer"}
        request = _make_request("Bearer t")
        with patch.object(auth_module, "_get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            with pytest.raises(HTTPException) as exc_info:
                await require_helper(request)
            assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# AUTH-07: _get_firebase_app
# ---------------------------------------------------------------------------
class TestGetFirebaseApp:
    """Firebase App初期化のテスト"""

    def test_unauthenticated_mode_returns_none(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", True)
        monkeypatch.setattr(auth_module, "_firebase_app", None)
        assert _get_firebase_app() is None

    def test_cached_app_returned(self, monkeypatch):
        mock_app = MagicMock()
        monkeypatch.setattr(auth_module, "_firebase_app", mock_app)
        assert _get_firebase_app() is mock_app
