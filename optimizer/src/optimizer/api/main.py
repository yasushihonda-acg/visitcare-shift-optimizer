"""FastAPI エントリポイント"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from optimizer.api.routes import router

app = FastAPI(
    title="Visitcare Shift Optimizer API",
    version="0.1.0",
)

# CORS設定
_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
