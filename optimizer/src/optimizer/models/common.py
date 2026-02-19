"""共通型定義 — shared/types/common.ts に対応"""

from enum import Enum
from typing import Literal

from pydantic import BaseModel


class ServiceType(str, Enum):
    PHYSICAL_CARE = "physical_care"
    DAILY_LIVING = "daily_living"


class DayOfWeek(str, Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class TransportationType(str, Enum):
    CAR = "car"
    BICYCLE = "bicycle"
    WALK = "walk"


class EmploymentType(str, Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"


class TrainingStatus(str, Enum):
    TRAINING = "training"
    INDEPENDENT = "independent"


class StaffConstraintType(str, Enum):
    NG = "ng"
    PREFERRED = "preferred"


class GeoLocation(BaseModel):
    lat: float
    lng: float


class ServiceSlot(BaseModel):
    start_time: str  # "HH:MM"
    end_time: str  # "HH:MM"
    service_type: ServiceType
    staff_count: int


class AvailabilitySlot(BaseModel):
    start_time: str  # "HH:MM"
    end_time: str  # "HH:MM"


class UnavailableSlot(BaseModel):
    date: str  # "YYYY-MM-DD"
    all_day: bool
    start_time: str | None = None  # "HH:MM"
    end_time: str | None = None  # "HH:MM"


class IrregularPatternType(str, Enum):
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    TEMPORARY_STOP = "temporary_stop"


class IrregularPattern(BaseModel):
    type: IrregularPatternType
    description: str
    active_weeks: list[int] | None = None


StaffConstraintTypeLiteral = Literal["ng", "preferred"]
