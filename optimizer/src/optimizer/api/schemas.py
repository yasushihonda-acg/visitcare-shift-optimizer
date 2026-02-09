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


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
