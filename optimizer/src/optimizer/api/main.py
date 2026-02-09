"""FastAPI エントリポイント"""

from fastapi import FastAPI

from optimizer.api.routes import router

app = FastAPI(
    title="Visitcare Shift Optimizer API",
    version="0.1.0",
)

app.include_router(router)
