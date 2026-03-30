"""Firestoreクライアント（エミュレータ対応）"""

import threading

from google.cloud import firestore  # type: ignore[attr-defined]

from src.shared.config import FIRESTORE_EMULATOR_HOST, GCP_PROJECT_ID

_client: firestore.Client | None = None
_lock = threading.Lock()


def get_firestore_client() -> firestore.Client:
    """Firestoreクライアントのシングルトン取得。

    FIRESTORE_EMULATOR_HOST が設定されている場合はエミュレータに接続する。
    """
    global _client
    if _client is not None:
        return _client
    with _lock:
        if _client is None:
            if FIRESTORE_EMULATOR_HOST:
                _client = firestore.Client(project=GCP_PROJECT_ID)
            else:
                _client = firestore.Client(project=GCP_PROJECT_ID)
    return _client
