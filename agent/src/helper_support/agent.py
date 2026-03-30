"""ヘルパー支援AIエージェント定義（ADK規約: root_agent）

セキュリティ: ヘルパー支援AIはスコープ付きツールのみ使用。
ヘルパーは自分に関連するデータのみアクセス可能。
シフト管理AI（サ責向け）のフルアクセスツールは使用しない。
"""

from google.adk.agents import Agent

from src.helper_support.prompts import HELPER_SUPPORT_SYSTEM_PROMPT
from src.helper_support.tools.scoped_tools import (
    get_my_customer_info,
    get_my_orders,
    get_my_profile,
    get_my_schedule,
)
from src.shared.config import GEMINI_MODEL_DEFAULT

root_agent = Agent(
    model=f"vertexai/{GEMINI_MODEL_DEFAULT}",
    name="helper_support",
    description="訪問介護ヘルパー個別支援AIアシスタント。メンタルサポートと業務お困りごと対応。",
    instruction=HELPER_SUPPORT_SYSTEM_PROMPT,
    tools=[
        get_my_profile,
        get_my_schedule,
        get_my_orders,
        get_my_customer_info,
    ],
)
