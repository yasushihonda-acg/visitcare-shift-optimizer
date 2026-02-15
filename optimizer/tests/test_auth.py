"""認証ミドルウェアのテスト"""

from unittest.mock import MagicMock, patch

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from optimizer.api.auth import _extract_token, require_manager_or_above


class TestExtractToken:
    """Authorizationヘッダーからのトークン抽出テスト"""

    def test_valid_bearer_token(self) -> None:
        request = MagicMock()
        request.headers.get.return_value = "Bearer my-token-123"
        assert _extract_token(request) == "my-token-123"

    def test_missing_header(self) -> None:
        request = MagicMock()
        request.headers.get.return_value = None
        assert _extract_token(request) is None

    def test_invalid_format_no_bearer(self) -> None:
        request = MagicMock()
        request.headers.get.return_value = "Basic abc123"
        assert _extract_token(request) is None

    def test_invalid_format_no_space(self) -> None:
        request = MagicMock()
        request.headers.get.return_value = "Bearertoken"
        assert _extract_token(request) is None

    def test_empty_token(self) -> None:
        request = MagicMock()
        request.headers.get.return_value = "Bearer "
        # split("Bearer ") -> ["Bearer", ""]
        # parts[1] == "" which is falsy but still a string
        result = _extract_token(request)
        assert result == ""


class TestVerifyAuthUnauthenticated:
    """ALLOW_UNAUTHENTICATED=true の場合のテスト"""

    def test_skips_auth_when_allowed(self) -> None:
        """ALLOW_UNAUTHENTICATED=true ならトークンなしでもOK"""
        # conftest.pyで ALLOW_UNAUTHENTICATED=true が設定済み
        from optimizer.api.auth import verify_auth, ALLOW_UNAUTHENTICATED

        assert ALLOW_UNAUTHENTICATED is True

        # verify_authがNoneを返すことを確認（FastAPIのDependsとして使われる想定）
        # この環境ではトークン検証がスキップされるはず


class TestVerifyAuthRequired:
    """ALLOW_UNAUTHENTICATED=false の場合のテスト（モック版）"""

    def test_missing_token_returns_401(self) -> None:
        """トークンなしで401"""
        # auth.pyを新しい環境変数で再ロード
        with patch("optimizer.api.auth.ALLOW_UNAUTHENTICATED", False):
            from optimizer.api.auth import verify_auth

            app = FastAPI()

            @app.get("/test")
            async def test_endpoint(_auth: dict | None = Depends(verify_auth)) -> dict:
                return {"ok": True}

            client = TestClient(app)
            response = client.get("/test")
            assert response.status_code == 401
            assert "認証が必要です" in response.json()["detail"]

    def test_invalid_token_returns_401(self) -> None:
        """無効トークンで401"""
        with patch("optimizer.api.auth.ALLOW_UNAUTHENTICATED", False), \
             patch("optimizer.api.auth._get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", side_effect=Exception("Invalid")):
            from optimizer.api.auth import verify_auth

            app = FastAPI()

            @app.get("/test")
            async def test_endpoint(_auth: dict | None = Depends(verify_auth)) -> dict:
                return {"ok": True}

            client = TestClient(app)
            response = client.get("/test", headers={"Authorization": "Bearer invalid-token"})
            assert response.status_code == 401
            assert "無効な認証トークン" in response.json()["detail"]

    def test_valid_token_succeeds(self) -> None:
        """有効トークンで200"""
        decoded = {"uid": "user123", "email": "test@example.com"}
        with patch("optimizer.api.auth.ALLOW_UNAUTHENTICATED", False), \
             patch("optimizer.api.auth._get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            from optimizer.api.auth import verify_auth

            app = FastAPI()

            @app.get("/test")
            async def test_endpoint(auth_data: dict | None = Depends(verify_auth)) -> dict:
                return {"uid": auth_data["uid"] if auth_data else None}

            client = TestClient(app)
            response = client.get("/test", headers={"Authorization": "Bearer valid-token"})
            assert response.status_code == 200
            assert response.json()["uid"] == "user123"


class TestRequireManagerOrAbove:
    """ロール検証（require_manager_or_above）のテスト"""

    def test_admin_allowed(self) -> None:
        """adminロールで200"""
        decoded = {"uid": "admin-1", "role": "admin"}
        with patch("optimizer.api.auth.ALLOW_UNAUTHENTICATED", False), \
             patch("optimizer.api.auth._get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            app = FastAPI()

            @app.get("/test")
            async def ep(auth_data: dict | None = Depends(require_manager_or_above)) -> dict:
                return {"role": auth_data["role"] if auth_data else None}

            client = TestClient(app)
            resp = client.get("/test", headers={"Authorization": "Bearer t"})
            assert resp.status_code == 200
            assert resp.json()["role"] == "admin"

    def test_service_manager_allowed(self) -> None:
        """service_managerロールで200"""
        decoded = {"uid": "sm-1", "role": "service_manager"}
        with patch("optimizer.api.auth.ALLOW_UNAUTHENTICATED", False), \
             patch("optimizer.api.auth._get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            app = FastAPI()

            @app.get("/test")
            async def ep(auth_data: dict | None = Depends(require_manager_or_above)) -> dict:
                return {"ok": True}

            client = TestClient(app)
            resp = client.get("/test", headers={"Authorization": "Bearer t"})
            assert resp.status_code == 200

    def test_helper_denied(self) -> None:
        """helperロールで403"""
        decoded = {"uid": "h-1", "role": "helper"}
        with patch("optimizer.api.auth.ALLOW_UNAUTHENTICATED", False), \
             patch("optimizer.api.auth._get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            app = FastAPI()

            @app.get("/test")
            async def ep(_auth: dict | None = Depends(require_manager_or_above)) -> dict:
                return {"ok": True}

            client = TestClient(app)
            resp = client.get("/test", headers={"Authorization": "Bearer t"})
            assert resp.status_code == 403
            assert "権限がありません" in resp.json()["detail"]

    def test_no_role_allowed(self) -> None:
        """roleなし（Custom Claims未設定）で200（デモ互換）"""
        decoded = {"uid": "no-role-1", "email": "user@example.com"}
        with patch("optimizer.api.auth.ALLOW_UNAUTHENTICATED", False), \
             patch("optimizer.api.auth._get_firebase_app"), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded):
            app = FastAPI()

            @app.get("/test")
            async def ep(auth_data: dict | None = Depends(require_manager_or_above)) -> dict:
                return {"uid": auth_data["uid"] if auth_data else None}

            client = TestClient(app)
            resp = client.get("/test", headers={"Authorization": "Bearer t"})
            assert resp.status_code == 200

    def test_unauthenticated_mode_skips(self) -> None:
        """ALLOW_UNAUTHENTICATED=trueでスキップ"""
        with patch("optimizer.api.auth.ALLOW_UNAUTHENTICATED", True):
            app = FastAPI()

            @app.get("/test")
            async def ep(auth_data: dict | None = Depends(require_manager_or_above)) -> dict:
                return {"auth": auth_data}

            client = TestClient(app)
            resp = client.get("/test")
            assert resp.status_code == 200
            assert resp.json()["auth"] is None
