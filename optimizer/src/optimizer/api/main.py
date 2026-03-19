"""FastAPI エントリポイント"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from optimizer.api.routes import router as core_router
from optimizer.api.routes_import import router as import_router
from optimizer.api.routes_notify import router as notify_router
from optimizer.api.routes_orders import router as orders_router
from optimizer.api.routes_report import router as report_router

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

app.include_router(core_router)
app.include_router(import_router)
app.include_router(notify_router)
app.include_router(orders_router)
app.include_router(report_router)
