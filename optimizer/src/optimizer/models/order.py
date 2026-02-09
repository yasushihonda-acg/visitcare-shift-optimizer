"""オーダーモデル — shared/types/order.ts に対応"""

from pydantic import BaseModel

from .common import DayOfWeek, ServiceType


class Order(BaseModel):
    id: str
    customer_id: str
    date: str  # "YYYY-MM-DD"
    day_of_week: DayOfWeek
    start_time: str  # "HH:MM"
    end_time: str  # "HH:MM"
    service_type: ServiceType
    staff_count: int = 1
    linked_order_id: str | None = None
