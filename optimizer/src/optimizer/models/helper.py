"""ヘルパーモデル — shared/types/helper.ts に対応"""

from pydantic import BaseModel

from .common import AvailabilitySlot, DayOfWeek, EmploymentType, Gender, GeoLocation, TrainingStatus, TransportationType


class HoursRange(BaseModel):
    min: float
    max: float


class Helper(BaseModel):
    id: str
    family_name: str
    given_name: str
    short_name: str = ""
    qualifications: list[str] = []
    can_physical_care: bool
    transportation: TransportationType
    weekly_availability: dict[DayOfWeek, list[AvailabilitySlot]] = {}
    preferred_hours: HoursRange
    available_hours: HoursRange
    customer_training_status: dict[str, TrainingStatus] = {}
    employment_type: EmploymentType
    gender: Gender = Gender.FEMALE
    split_shift_allowed: bool = False
    employee_number: str | None = None
    address: str | None = None
    location: GeoLocation | None = None
    phone_number: str | None = None
