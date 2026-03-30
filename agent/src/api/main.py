"""FastAPI + ADK Runner統合（カスタムエンドポイント）"""

import logging
import uuid

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types
from pydantic import BaseModel

from src.helper_support.agent import root_agent as helper_support_agent
from src.shared.auth import require_helper, require_manager_or_above
from src.shared.config import CORS_ORIGINS
from src.shift_manager.agent import root_agent as shift_manager_agent

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Visitcare AI Agent",
    description="訪問介護AIエージェントAPI",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# セッションサービス（Phase 1: InMemory → Phase 2: Firestore SessionService に移行予定）
session_service = InMemorySessionService()

# ADK Runner（エージェント別）
shift_manager_runner = Runner(
    agent=shift_manager_agent,
    app_name="visitcare-shift-manager",
    session_service=session_service,
)

helper_support_runner = Runner(
    agent=helper_support_agent,
    app_name="visitcare-helper-support",
    session_service=session_service,
)


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class SessionResponse(BaseModel):
    session_id: str
    agent_type: str


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "visitcare-agent", "version": "0.1.0"}


@app.post("/api/chat/shift-manager")
async def chat_shift_manager(
    req: ChatRequest,
    auth: dict | None = Depends(require_manager_or_above),
) -> dict:
    """シフト管理AIとチャット（サ責以上のみ）"""
    user_id = auth["uid"] if auth else "demo-user"
    session_id = req.session_id or str(uuid.uuid4())

    # セッション取得 or 作成
    session = await session_service.get_session(
        app_name="visitcare-shift-manager",
        user_id=user_id,
        session_id=session_id,
    )
    if session is None:
        session = await session_service.create_session(
            app_name="visitcare-shift-manager",
            user_id=user_id,
            session_id=session_id,
        )

    # エージェント実行
    content = genai_types.Content(
        role="user",
        parts=[genai_types.Part.from_text(req.message)],
    )

    response_text = ""
    async for event in shift_manager_runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=content,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text

    return {
        "session_id": session_id,
        "response": response_text,
        "agent_type": "shift_manager",
    }


@app.post("/api/chat/helper-support")
async def chat_helper_support(
    req: ChatRequest,
    auth: dict | None = Depends(require_helper),
) -> dict:
    """ヘルパー支援AIとチャット（全認証ユーザー）"""
    user_id = auth["uid"] if auth else "demo-user"
    session_id = req.session_id or str(uuid.uuid4())

    session = await session_service.get_session(
        app_name="visitcare-helper-support",
        user_id=user_id,
        session_id=session_id,
    )
    if session is None:
        session = await session_service.create_session(
            app_name="visitcare-helper-support",
            user_id=user_id,
            session_id=session_id,
        )

    content = genai_types.Content(
        role="user",
        parts=[genai_types.Part.from_text(req.message)],
    )

    response_text = ""
    async for event in helper_support_runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=content,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text

    return {
        "session_id": session_id,
        "response": response_text,
        "agent_type": "helper_support",
    }
