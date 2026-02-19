"""利用者モデル — shared/types/customer.ts に対応"""

from pydantic import BaseModel

from .common import DayOfWeek, GeoLocation, IrregularPattern, ServiceSlot


class Customer(BaseModel):
    id: str
    family_name: str
    given_name: str
    address: str
    location: GeoLocation
    ng_staff_ids: list[str] = []
    preferred_staff_ids: list[str] = []
    weekly_services: dict[DayOfWeek, list[ServiceSlot]] = {}
    household_id: str | None = None
    irregular_patterns: list[IrregularPattern] = []
    service_manager: str = ""
    notes: str | None = None
