"""シフト管理AIエージェント定義（ADK規約: root_agent）"""

from google.adk.agents import Agent

from src.shared.config import GEMINI_MODEL_DEFAULT
from src.shift_manager.prompts import SHIFT_MANAGER_SYSTEM_PROMPT
from src.shift_manager.tools.customer_tools import get_customer_detail, get_customers
from src.shift_manager.tools.helper_tools import get_helper_availability, get_helpers
from src.shift_manager.tools.order_tools import get_weekly_orders
from src.shift_manager.tools.schedule_tools import check_constraints, suggest_assignment

root_agent = Agent(
    model=f"vertexai/{GEMINI_MODEL_DEFAULT}",
    name="shift_manager",
    description="訪問介護シフト管理AIアシスタント。サ責を支援し対話的にシフト作成をサポートする。",
    instruction=SHIFT_MANAGER_SYSTEM_PROMPT,
    tools=[
        get_customers,
        get_customer_detail,
        get_helpers,
        get_helper_availability,
        get_weekly_orders,
        check_constraints,
        suggest_assignment,
    ],
)
