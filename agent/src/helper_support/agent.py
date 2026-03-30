"""ヘルパー支援AIエージェント定義（ADK規約: root_agent）"""

from google.adk.agents import Agent

from src.helper_support.prompts import HELPER_SUPPORT_SYSTEM_PROMPT
from src.shared.config import GEMINI_MODEL_DEFAULT
from src.shift_manager.tools.customer_tools import get_customer_detail, get_customers
from src.shift_manager.tools.helper_tools import get_helper_availability
from src.shift_manager.tools.order_tools import get_weekly_orders

root_agent = Agent(
    model=f"vertexai/{GEMINI_MODEL_DEFAULT}",
    name="helper_support",
    description="訪問介護ヘルパー個別支援AIアシスタント。メンタルサポートと業務お困りごと対応。",
    instruction=HELPER_SUPPORT_SYSTEM_PROMPT,
    tools=[
        get_customers,
        get_customer_detail,
        get_helper_availability,
        get_weekly_orders,
    ],
)
