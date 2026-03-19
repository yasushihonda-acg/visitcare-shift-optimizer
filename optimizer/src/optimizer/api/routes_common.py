"""ルート共通ユーティリティ"""

import logging
import os

from datetime import date
from fastapi import HTTPException

logger = logging.getLogger(__name__)

APP_URL = os.getenv("APP_URL", "https://visitcare-shift-optimizer.web.app")


def _parse_monday(date_str: str) -> date:
    """日付文字列をパースし月曜日であることを検証する。不正時はHTTPException。"""
    try:
        d = date.fromisoformat(date_str)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    if d.weekday() != 0:
        raise HTTPException(
            status_code=422,
            detail=f"{date_str} は月曜日ではありません（weekday={d.weekday()}）",
        )
    return d


def _serialize_executed_at(value: object) -> str:
    """Firestore Timestamp/datetimeをISO 8601文字列に変換"""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value) if value else ""


_SHEETS_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def _get_sheets_credentials() -> object:
    """Sheets/Drive API用の認証情報を取得する。

    ローカル開発: ADC（gcloud auth application-default login --scopes=... で設定済み）をそのまま使用。
    Cloud Run: Compute Engine Credentials は cloud-platform スコープしか持てないため、
    IAM Credentials API を経由した SA self-impersonation でSheets/Drive スコープのトークンを取得する。
    """
    import google.auth  # type: ignore[import-untyped]
    import google.auth.compute_engine  # type: ignore[import-untyped]

    creds, _ = google.auth.default()

    if isinstance(creds, google.auth.compute_engine.Credentials):
        from google.auth import impersonated_credentials  # type: ignore[import-untyped]

        sa_email = os.getenv(
            "SHEETS_SA_EMAIL",
            "1045989697649-compute@developer.gserviceaccount.com",
        )
        creds = impersonated_credentials.Credentials(
            source_credentials=creds,
            target_principal=sa_email,
            target_scopes=_SHEETS_SCOPES,
        )

    return creds
