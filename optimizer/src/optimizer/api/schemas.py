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


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
