"""スタッフ希望休モデル — shared/types/staff-unavailability.ts に対応"""

from pydantic import BaseModel

from .common import UnavailableSlot


class StaffUnavailability(BaseModel):
    staff_id: str
    week_start_date: str  # "YYYY-MM-DD"
    unavailable_slots: list[UnavailableSlot] = []
