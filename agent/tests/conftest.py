"""テスト共通設定"""

import os

import pytest

# Firestoreエミュレータ接続設定
os.environ["FIRESTORE_EMULATOR_HOST"] = os.getenv("FIRESTORE_EMULATOR_HOST", "localhost:8080")
os.environ["GCP_PROJECT_ID"] = "visitcare-shift-optimizer"
os.environ["ALLOW_UNAUTHENTICATED"] = "true"


@pytest.fixture
def firestore_client():
    """Firestoreエミュレータ接続クライアント"""
    from google.cloud import firestore

    client = firestore.Client(project="visitcare-shift-optimizer")
    return client


@pytest.fixture
def seed_customer(firestore_client):
    """テスト用利用者データ"""
    doc_ref = firestore_client.collection("customers").document("test-customer-1")
    doc_ref.set({
        "name": {"family": "田中", "given": "太郎"},
        "address": "東京都新宿区1-1-1",
        "ng_staff_ids": ["helper-ng"],
        "allowed_staff_ids": [],
        "preferred_staff_ids": ["helper-preferred"],
        "gender_requirement": "any",
        "weekly_services": {
            "monday": [
                {
                    "start_time": "09:00",
                    "end_time": "10:00",
                    "service_type": "daily_living_2",
                }
            ],
        },
        "same_household_customer_ids": [],
        "same_facility_customer_ids": [],
    })
    yield doc_ref
    doc_ref.delete()


@pytest.fixture
def seed_helper(firestore_client):
    """テスト用ヘルパーデータ"""
    doc_ref = firestore_client.collection("helpers").document("test-helper-1")
    doc_ref.set({
        "name": {"family": "佐藤", "given": "花子"},
        "can_physical_care": True,
        "transportation": "bicycle",
        "employment_type": "full_time",
        "gender": "female",
        "qualifications": ["介護福祉士"],
        "preferred_hours": {"min": 20, "max": 30},
        "available_hours": {"min": 15, "max": 40},
        "weekly_availability": {
            "monday": [{"start_time": "08:00", "end_time": "17:00"}],
            "tuesday": [{"start_time": "08:00", "end_time": "17:00"}],
        },
    })
    yield doc_ref
    doc_ref.delete()


@pytest.fixture
def seed_order(firestore_client):
    """テスト用オーダーデータ"""
    doc_ref = firestore_client.collection("orders").document("test-order-1")
    doc_ref.set({
        "customer_id": "test-customer-1",
        "week_start_date": "2026-03-30",
        "date": "2026-03-30",
        "start_time": "09:00",
        "end_time": "10:00",
        "service_type": "daily_living_2",
        "assigned_staff_ids": ["test-helper-1"],
        "status": "assigned",
        "manually_edited": False,
    })
    yield doc_ref
    doc_ref.delete()
