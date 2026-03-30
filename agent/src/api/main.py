"""FastAPI + ADK Runner統合（カスタムエンドポイント）"""

import logging
import uuid
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types
from pydantic import BaseModel, Field

from src.helper_support.agent import root_agent as helper_support_agent
from src.shared.auth import require_helper, require_manager_or_above
from src.shared.config import ALLOW_UNAUTHENTICATED, CORS_ORIGINS
from src.shift_manager.agent import root_agent as shift_manager_agent

logger = logging.getLogger(__name__)

AgentType = Literal["shift_manager", "helper_support"]

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
    message: str = Field(min_length=1, max_length=10000)
    session_id: str | None = None


class ChatResponse(BaseModel):
    session_id: str
    response: str
    agent_type: AgentType


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "visitcare-agent", "version": "0.1.0"}


async def _run_chat(
    runner: Runner,
    app_name: str,
    agent_type: AgentType,
    req: ChatRequest,
    auth: dict | None,
) -> ChatResponse:
    """共通チャット実行ロジック。"""
    user_id = auth["uid"] if auth else "demo-user"
    session_id = req.session_id or str(uuid.uuid4())

    # 認証情報からユーザースコープのStateを構築
    initial_state: dict = {}
    if auth:
        helper_id = auth.get("helper_id")
        if helper_id:
            initial_state["user:helper_id"] = helper_id
    elif ALLOW_UNAUTHENTICATED:
        import os

        dev_helper_id = os.environ.get("DEV_HELPER_ID")
        if dev_helper_id:
            initial_state["user:helper_id"] = dev_helper_id
            logger.info("DEV MODE: DEV_HELPER_ID=%s", dev_helper_id)

    try:
        session = await session_service.get_session(
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
        )
        if session is None:
            await session_service.create_session(
                app_name=app_name,
                user_id=user_id,
                session_id=session_id,
                state=initial_state,
            )
        elif initial_state and not session.state.get("user:helper_id"):
            # 既存セッションにhelper_idが未設定の場合、ログ警告
            logger.warning(
                "既存セッションにhelper_id未設定 [session_id=%s]", session_id,
            )
    except Exception as e:
        logger.error("セッション管理エラー [session_id=%s]: %s", session_id, e)
        raise HTTPException(status_code=500, detail="セッションの初期化に失敗しました")

    content = genai_types.Content(
        role="user",
        parts=[genai_types.Part.from_text(req.message)],
    )

    try:
        response_text = ""
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=content,
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        response_text += part.text
    except Exception as e:
        logger.error(
            "エージェント実行エラー [session_id=%s, user_id=%s]: %s: %s",
            session_id, user_id, type(e).__name__, e,
        )
        raise HTTPException(
            status_code=503,
            detail="AIエージェントの応答生成中にエラーが発生しました。しばらく待ってから再度お試しください。",
        )

    if not response_text.strip():
        logger.warning(
            "エージェントから空の応答 [session_id=%s, message=%s]",
            session_id, req.message[:100],
        )
        response_text = "申し訳ありません。応答を生成できませんでした。もう一度お試しください。"

    return ChatResponse(
        session_id=session_id,
        response=response_text,
        agent_type=agent_type,
    )


@app.post("/api/chat/shift-manager")
async def chat_shift_manager(
    req: ChatRequest,
    auth: dict | None = Depends(require_manager_or_above),
) -> ChatResponse:
    """シフト管理AIとチャット（サ責以上のみ）"""
    return await _run_chat(
        shift_manager_runner, "visitcare-shift-manager", "shift_manager", req, auth,
    )


@app.post("/api/chat/helper-support")
async def chat_helper_support(
    req: ChatRequest,
    auth: dict | None = Depends(require_helper),
) -> ChatResponse:
    """ヘルパー支援AIとチャット（ヘルパー以上のロールが必要）"""
    return await _run_chat(
        helper_support_runner, "visitcare-helper-support", "helper_support", req, auth,
    )
