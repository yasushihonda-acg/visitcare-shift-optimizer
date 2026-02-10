"""共有フィクスチャ"""

import os

os.environ.setdefault("ALLOW_UNAUTHENTICATED", "true")

from pathlib import Path

import pytest

SEED_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "seed" / "data"


@pytest.fixture
def seed_data_dir() -> Path:
    """seed/data/ ディレクトリのパスを返す"""
    assert SEED_DATA_DIR.exists(), f"Seed data directory not found: {SEED_DATA_DIR}"
    return SEED_DATA_DIR
