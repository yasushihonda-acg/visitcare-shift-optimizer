"""最適化問題の入力データ"""

from pydantic import BaseModel

from .common import ServiceTypeConfig
from .constraint import StaffConstraint
from .customer import Customer
from .helper import Helper
from .order import Order
from .staff_unavailability import StaffUnavailability
from .travel_time import TravelTime


class OptimizationInput(BaseModel):
    """最適化エンジンへの入力データ一式"""

    customers: list[Customer]
    helpers: list[Helper]
    orders: list[Order]
    travel_times: list[TravelTime]
    staff_unavailabilities: list[StaffUnavailability]
    staff_constraints: list[StaffConstraint]
    service_type_configs: list[ServiceTypeConfig] = []  # Firestoreマスタ（後方互換のためデフォルト空）


class Assignment(BaseModel):
    """1つのオーダーに対するスタッフ割当結果"""

    order_id: str
    staff_ids: list[str]


class OptimizationResult(BaseModel):
    """最適化結果"""

    assignments: list[Assignment]
    objective_value: float
    solve_time_seconds: float
    status: str  # "Optimal", "Feasible", "Infeasible", "Not Solved"
