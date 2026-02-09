"""移動時間モデル — shared/types/travel-time.ts に対応"""

from pydantic import BaseModel


class TravelTime(BaseModel):
    from_id: str  # customer_id or helper base location
    to_id: str
    travel_time_minutes: float
