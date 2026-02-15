"""最適化実行記録モデル"""

from datetime import datetime

from pydantic import BaseModel

from .problem import Assignment


class OptimizationParameters(BaseModel):
    """最適化パラメータ"""

    time_limit_seconds: int
    w_travel: float = 1.0
    w_preferred_staff: float = 5.0
    w_workload_balance: float = 10.0
    w_continuity: float = 3.0


class OptimizationRunRecord(BaseModel):
    """Firestoreに保存する最適化実行記録"""

    id: str
    week_start_date: str  # YYYY-MM-DD
    executed_at: datetime
    executed_by: str  # Firebase Auth UID
    dry_run: bool
    status: str  # "Optimal", "Feasible", "Infeasible", "Not Solved"
    objective_value: float
    solve_time_seconds: float
    total_orders: int
    assigned_count: int
    assignments: list[Assignment]
    parameters: OptimizationParameters
