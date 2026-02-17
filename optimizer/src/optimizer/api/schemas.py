"""APIリクエスト/レスポンススキーマ"""

from pydantic import BaseModel, Field


class OptimizeRequest(BaseModel):
    week_start_date: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="最適化対象週の開始日（月曜日）YYYY-MM-DD",
        examples=["2026-02-09"],
    )
    time_limit_seconds: int = Field(
        default=180,
        ge=1,
        le=600,
        description="ソルバーの制限時間（秒）",
    )
    dry_run: bool = Field(
        default=False,
        description="trueの場合、Firestoreへの書き戻しを行わない",
    )
    w_travel: float = Field(
        default=1.0, ge=0.0, le=20.0, description="移動時間最小化の重み",
    )
    w_preferred_staff: float = Field(
        default=5.0, ge=0.0, le=20.0, description="推奨スタッフ優先の重み",
    )
    w_workload_balance: float = Field(
        default=10.0, ge=0.0, le=20.0, description="稼働バランスの重み",
    )
    w_continuity: float = Field(
        default=3.0, ge=0.0, le=20.0, description="担当継続性の重み",
    )


class AssignmentResponse(BaseModel):
    order_id: str
    staff_ids: list[str]


class OptimizeResponse(BaseModel):
    assignments: list[AssignmentResponse]
    objective_value: float
    solve_time_seconds: float
    status: str
    orders_updated: int = Field(description="Firestoreに書き戻したオーダー数")
    total_orders: int = Field(description="最適化対象オーダー総数")
    assigned_count: int = Field(description="割当成功オーダー数")


class OptimizationParametersResponse(BaseModel):
    time_limit_seconds: int = 180
    w_travel: float = 1.0
    w_preferred_staff: float = 5.0
    w_workload_balance: float = 10.0
    w_continuity: float = 3.0


class OptimizationRunResponse(BaseModel):
    id: str
    week_start_date: str
    executed_at: str = Field(description="ISO 8601 datetime")
    executed_by: str
    dry_run: bool
    status: str
    objective_value: float
    solve_time_seconds: float
    total_orders: int
    assigned_count: int
    parameters: OptimizationParametersResponse


class OptimizationRunDetailResponse(OptimizationRunResponse):
    assignments: list[AssignmentResponse]


class OptimizationRunListResponse(BaseModel):
    runs: list[OptimizationRunResponse]


class ResetAssignmentsRequest(BaseModel):
    week_start_date: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="リセット対象週の開始日（月曜日）YYYY-MM-DD",
        examples=["2026-02-09"],
    )


class ResetAssignmentsResponse(BaseModel):
    orders_reset: int = Field(description="リセットしたオーダー数")
    week_start_date: str


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
