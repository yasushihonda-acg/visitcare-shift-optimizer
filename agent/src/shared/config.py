"""環境変数・設定管理"""

import os

# GCP
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "visitcare-shift-optimizer")
GCP_REGION = os.getenv("GCP_REGION", "asia-northeast1")

# Vertex AI / Gemini
GEMINI_MODEL_DEFAULT = os.getenv("GEMINI_MODEL_DEFAULT", "gemini-2.5-flash")
GEMINI_MODEL_ADVANCED = os.getenv("GEMINI_MODEL_ADVANCED", "gemini-2.5-pro")

# Firestore
FIRESTORE_EMULATOR_HOST = os.getenv("FIRESTORE_EMULATOR_HOST", "")

# 既存 Optimizer API
OPTIMIZER_API_URL = os.getenv(
    "OPTIMIZER_API_URL",
    "https://shift-optimizer-1045989697649.asia-northeast1.run.app",
)

# CORS
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "https://visitcare-shift-optimizer.web.app,http://localhost:3000",
).split(",")

# 認証
ALLOW_UNAUTHENTICATED = os.getenv("ALLOW_UNAUTHENTICATED", "false").lower() == "true"
