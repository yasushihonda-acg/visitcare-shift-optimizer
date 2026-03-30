"""API認証モジュールのテスト（AUTH-01〜AUTH-07）

セキュリティ: 認証境界の網羅テスト。
Firebase Admin SDKはモックで差し替え、Firestoreエミュレータ不要。
firebase_admin.authはverify_auth内で遅延importされるため、
patchは"firebase_admin.auth.verify_id_token"をターゲットとする。
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
    """最小限のRequest互換オブジェクト。headers.getのみ実装。"""
    request = MagicMock()
    headers = {}
    if authorization is not None:
        headers["Authorization"] = authorization
    request.headers.get = lambda key, default=None: headers.get(key, default)
    return request


def _patch_auth(decoded):
    """verify_id_tokenモックのコンテキストマネージャを返すヘルパー。"""
    return (
        patch.object(auth_module, "_get_firebase_app"),
        patch("firebase_admin.auth.verify_id_token", return_value=decoded),
    )


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
        """BEARERなど大文字表記でもトークン抽出できることを確認"""
        request = _make_request("BEARER my-token")
        assert _extract_token(request) == "my-token"


# ---------------------------------------------------------------------------
# AUTH-02: verify_auth
# ---------------------------------------------------------------------------
class TestVerifyAuth:
    """認証検証のテスト"""

    # auth_moduleのALLOW_UNAUTHENTICATEDを直接上書き
    # （from-importのため、config側ではなくauth_module側をパッチ）

    async def test_unauthenticated_mode_returns_none(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", True)
        request = _make_request()
        result = await verify_auth(request)
        assert result is None

    async def test_no_token_raises_401(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        request = _make_request(None)
        with pytest.raises(HTTPException) as exc_info:
            await verify_auth(request)
        assert exc_info.value.status_code == 401
        assert "認証が必要です" in exc_info.value.detail

    async def test_invalid_token_raises_401(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        request = _make_request("Bearer invalid-token")
        with patch.object(auth_module, "_get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", side_effect=Exception("Invalid")):
            with pytest.raises(HTTPException) as exc_info:
                await verify_auth(request)
            assert exc_info.value.status_code == 401
            assert "無効な認証トークン" in exc_info.value.detail

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
# AUTH-03: require_role（成功パス） / AUTH-04: require_role（拒否パス）
# ---------------------------------------------------------------------------
class TestRequireRole:
    """ロール判定のテスト（AUTH-03: 成功 / AUTH-04: 拒否）"""

    async def test_matching_role_passes(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "admin"}
        request = _make_request("Bearer t")
        p1, p2 = _patch_auth(decoded)
        with p1, p2:
            result = await require_role(request, {"admin"})
            assert result["role"] == "admin"

    async def test_multiple_allowed_roles(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "service_manager"}
        request = _make_request("Bearer t")
        p1, p2 = _patch_auth(decoded)
        with p1, p2:
            result = await require_role(request, {"admin", "service_manager"})
            assert result["role"] == "service_manager"

    async def test_insufficient_role_raises_403(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "helper"}
        request = _make_request("Bearer t")
        p1, p2 = _patch_auth(decoded)
        with p1, p2:
            with pytest.raises(HTTPException) as exc_info:
                await require_role(request, {"admin", "service_manager"})
            assert exc_info.value.status_code == 403
            assert "権限がありません" in exc_info.value.detail

    async def test_no_role_claim_raises_403(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1"}
        request = _make_request("Bearer t")
        p1, _ = _patch_auth(decoded)
        with p1, patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            with pytest.raises(HTTPException) as exc_info:
                await require_role(request, {"admin"})
            assert exc_info.value.status_code == 403
            assert "ロールが設定されていません" in exc_info.value.detail

    async def test_unauthenticated_mode_returns_none(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", True)
        request = _make_request()
        result = await require_role(request, {"admin"})
        assert result is None


# ---------------------------------------------------------------------------
# AUTH-05: require_manager_or_above
# ---------------------------------------------------------------------------
class TestRequireManagerOrAbove:
    """サ責以上の認可テスト（admin, service_manager のみ許可）"""

    async def test_admin_passes(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "admin"}
        request = _make_request("Bearer t")
        p1, p2 = _patch_auth(decoded)
        with p1, p2:
            result = await require_manager_or_above(request)
            assert result["role"] == "admin"

    async def test_service_manager_passes(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "service_manager"}
        request = _make_request("Bearer t")
        p1, p2 = _patch_auth(decoded)
        with p1, p2:
            result = await require_manager_or_above(request)
            assert result["role"] == "service_manager"

    async def test_helper_rejected(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "helper"}
        request = _make_request("Bearer t")
        p1, p2 = _patch_auth(decoded)
        with p1, p2:
            with pytest.raises(HTTPException) as exc_info:
                await require_manager_or_above(request)
            assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# AUTH-06: require_helper
# ---------------------------------------------------------------------------
class TestRequireHelper:
    """ヘルパー・サ責・adminいずれかの認可テスト"""

    async def test_helper_passes(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "helper"}
        request = _make_request("Bearer t")
        p1, p2 = _patch_auth(decoded)
        with p1, p2:
            result = await require_helper(request)
            assert result["role"] == "helper"

    async def test_admin_passes(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "admin"}
        request = _make_request("Bearer t")
        p1, p2 = _patch_auth(decoded)
        with p1, p2:
            result = await require_helper(request)
            assert result["role"] == "admin"

    async def test_service_manager_passes(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "service_manager"}
        request = _make_request("Bearer t")
        p1, p2 = _patch_auth(decoded)
        with p1, p2:
            result = await require_helper(request)
            assert result["role"] == "service_manager"

    async def test_unknown_role_rejected(self, monkeypatch):
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        decoded = {"uid": "u1", "role": "viewer"}
        request = _make_request("Bearer t")
        p1, p2 = _patch_auth(decoded)
        with p1, p2:
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

    def test_reuses_existing_app(self, monkeypatch):
        """firebase_admin.get_app()成功時: 既存Appを再利用"""
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        monkeypatch.setattr(auth_module, "_firebase_app", None)
        mock_app = MagicMock()
        with patch("firebase_admin.get_app", return_value=mock_app):
            result = _get_firebase_app()
            assert result is mock_app

    def test_initializes_new_app_on_value_error(self, monkeypatch):
        """firebase_admin.get_app()がValueError時: initialize_app()で新規作成"""
        monkeypatch.setattr(auth_module, "ALLOW_UNAUTHENTICATED", False)
        monkeypatch.setattr(auth_module, "_firebase_app", None)
        mock_app = MagicMock()
        with patch("firebase_admin.get_app", side_effect=ValueError), \
             patch("firebase_admin.initialize_app", return_value=mock_app):
            result = _get_firebase_app()
            assert result is mock_app
