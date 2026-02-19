"""月次レポート集計用Pydanticモデル"""

from pydantic import BaseModel


class StatusSummary(BaseModel):
    pending: int
    assigned: int
    completed: int
    cancelled: int
    total: int
    completion_rate: float  # 0-100の整数値（cancelledを除いた完了率）


class ServiceTypeSummaryItem(BaseModel):
    service_type: str  # "physical_care" | "daily_living"
    label: str  # "身体介護" | "生活援助"
    visit_count: int
    total_minutes: int


class StaffSummaryRow(BaseModel):
    helper_id: str
    name: str
    visit_count: int
    total_minutes: int


class CustomerSummaryRow(BaseModel):
    customer_id: str
    name: str
    visit_count: int
    total_minutes: int
