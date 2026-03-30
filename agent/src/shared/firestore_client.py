"""Firestoreクライアント（エミュレータ対応）"""

import logging
import threading

from google.cloud import firestore  # type: ignore[attr-defined]

from src.shared.config import GCP_PROJECT_ID

logger = logging.getLogger(__name__)

_client: firestore.Client | None = None
_lock = threading.Lock()


def get_firestore_client() -> firestore.Client:
    """Firestoreクライアントのシングルトン取得。

    FIRESTORE_EMULATOR_HOST 環境変数が設定されている場合、
    google-cloud-firestore ライブラリが自動的にエミュレータに接続する。
    """
    global _client
    if _client is not None:
        return _client
    with _lock:
        if _client is None:
            try:
                _client = firestore.Client(project=GCP_PROJECT_ID)
                logger.info("Firestoreクライアント初期化成功 [project=%s]", GCP_PROJECT_ID)
            except Exception as e:
                logger.error("Firestoreクライアント初期化失敗 [project=%s]: %s", GCP_PROJECT_ID, e)
                raise
    return _client
