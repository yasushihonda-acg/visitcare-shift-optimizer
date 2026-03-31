"""APIリクエスト/レスポンススキーマ"""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field


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
    unassigned_count: int = Field(default=0, description="未割当オーダー数（スタッフ0人）")
    partial_count: int = Field(default=0, description="部分割当オーダー数（スタッフ < 必要人数）")


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
    unassigned_count: int = Field(default=0, description="未割当オーダー数")
    partial_count: int = Field(default=0, description="部分割当オーダー数")
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


class ExportReportRequest(BaseModel):
    year_month: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}$",
        description="エクスポート対象年月 YYYY-MM",
        examples=["2026-02"],
    )
    user_email: str | None = Field(
        default=None,
        description="スプレッドシートを共有するメールアドレス（省略可）",
    )


class ExportReportResponse(BaseModel):
    spreadsheet_id: str
    spreadsheet_url: str
    title: str
    year_month: str
    sheets_created: int = Field(description="作成したシート数（常に4）")
    shared_with: str | None = Field(description="共有先メールアドレス（共有しない場合はnull）")


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None


# ---------------------------------------------------------------------------
# Google Chat DM 催促
# ---------------------------------------------------------------------------

class ChatReminderTarget(BaseModel):
    staff_id: str = Field(..., description="スタッフID")
    name: str = Field(..., description="スタッフ名（表示用）")
    email: EmailStr = Field(..., description="Google Workspace メールアドレス")


class ChatReminderRequest(BaseModel):
    target_week_start: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="催促対象週の開始日 YYYY-MM-DD",
    )
    targets: list[ChatReminderTarget] = Field(
        ...,
        min_length=1,
        description="送信対象スタッフのリスト",
    )
    message: str | None = Field(
        default=None,
        description="カスタムメッセージ（省略時はデフォルトテンプレート使用）",
    )


class ChatReminderResultItem(BaseModel):
    staff_id: str
    email: str
    success: bool


class ChatReminderResponse(BaseModel):
    messages_sent: int = Field(description="送信成功件数")
    total_targets: int = Field(description="送信対象件数")
    results: list[ChatReminderResultItem]


# ---------------------------------------------------------------------------
# CURAノート インポート
# ---------------------------------------------------------------------------


class NoteImportRequest(BaseModel):
    spreadsheet_id: str = Field(
        ...,
        min_length=20,
        max_length=80,
        pattern=r"^[a-zA-Z0-9_-]+$",
        description="CURAノートのスプレッドシートID",
    )


class NoteImportTimeRange(BaseModel):
    start: str = Field(description="開始時刻 HH:MM")
    end: str | None = Field(default=None, description="終了時刻 HH:MM")


class NoteImportMatchedOrder(BaseModel):
    order_id: str
    customer_id: str
    customer_name: str
    date: str
    start_time: str
    end_time: str
    service_type: str
    status: str


class NoteImportActionResponse(BaseModel):
    post_id: str
    action_type: str = Field(description="cancel/update_time/add_visit/add_meeting/add/staff_unavailability/unknown")
    status: str = Field(description="ready/needs_review/unmatched/skipped")
    customer_name: str | None = None
    matched_customer_id: str | None = None
    matched_order: NoteImportMatchedOrder | None = None
    description: str
    raw_content: str
    date_from: str
    date_to: str = ""
    time_range: NoteImportTimeRange | None = None
    new_time_range: NoteImportTimeRange | None = None
    confidence: float = 1.0


class NoteImportPreviewResponse(BaseModel):
    spreadsheet_id: str
    total_notes: int = Field(description="読み取ったノート数")
    actions: list[NoteImportActionResponse]
    ready_count: int = Field(description="自動適用可能な件数")
    review_count: int = Field(description="要確認の件数")
    unmatched_count: int = Field(description="未マッチの件数")
    skipped_count: int = Field(description="スキップの件数")


class NoteImportApplyRequest(BaseModel):
    spreadsheet_id: str = Field(description="スプレッドシートID")
    post_ids: list[str] = Field(
        ...,
        min_length=1,
        description="適用するノートの投稿IDリスト",
    )
    mark_as_handled: bool = Field(
        default=True,
        description="適用後にスプレッドシートの対応可否を1に更新するか",
    )


class NoteImportApplyResponse(BaseModel):
    applied_count: int = Field(description="Firestoreに反映したアクション数")
    marked_count: int = Field(description="スプレッドシートで対応済みにした行数")
    total_requested: int = Field(description="リクエストされたアクション数")


# ---------------------------------------------------------------------------
# オーダー一括複製
# ---------------------------------------------------------------------------


class DuplicateWeekRequest(BaseModel):
    source_week_start: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="コピー元週の開始日（月曜日）YYYY-MM-DD",
        examples=["2026-02-09"],
    )
    target_week_start: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="コピー先週の開始日（月曜日）YYYY-MM-DD",
        examples=["2026-02-16"],
    )


class DuplicateWeekResponse(BaseModel):
    created_count: int = Field(description="作成したオーダー数")
    skipped_count: int = Field(description="スキップしたオーダー数（対象週に既存オーダーがある場合）")
    target_week_start: str


# ---------------------------------------------------------------------------
# 休み希望の自動反映
# ---------------------------------------------------------------------------


class ApplyUnavailabilityRequest(BaseModel):
    week_start_date: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="対象週の開始日（月曜日）YYYY-MM-DD",
        examples=["2026-02-09"],
    )


class UnavailabilityRemovalItem(BaseModel):
    order_id: str
    staff_id: str
    customer_id: str
    date: str
    start_time: str
    end_time: str


class ApplyUnavailabilityResponse(BaseModel):
    orders_modified: int = Field(description="変更したオーダー数")
    removals_count: int = Field(description="解除したスタッフ割当数")
    reverted_to_pending: int = Field(description="pendingに戻したオーダー数")
    removals: list[UnavailabilityRemovalItem] = Field(description="解除した割当の詳細")


# ---------------------------------------------------------------------------
# 不定期パターン自動判定
# ---------------------------------------------------------------------------


class ApplyIrregularPatternsRequest(BaseModel):
    week_start_date: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="対象週の開始日（月曜日）YYYY-MM-DD",
        examples=["2026-02-09"],
    )


class IrregularPatternExclusion(BaseModel):
    customer_id: str
    customer_name: str
    pattern_type: str
    description: str


class ApplyIrregularPatternsResponse(BaseModel):
    cancelled_count: int = Field(description="除外（キャンセル）したオーダー数")
    excluded_customers: list[IrregularPatternExclusion] = Field(description="除外された利用者リスト")


# ---------------------------------------------------------------------------
# オーダー変更通知
# ---------------------------------------------------------------------------


class OrderChangeNotifyRequest(BaseModel):
    order_id: str = Field(..., description="変更対象のオーダーID")
    change_type: Literal["reassigned", "time_changed", "cancelled"] = Field(
        ...,
        description="変更種別",
    )
    affected_staff_ids: list[str] = Field(
        ..., min_length=1, description="通知対象のスタッフIDリスト",
    )
    customer_name: str = Field(..., description="利用者名（通知メッセージ用）")
    date: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="オーダー日付 YYYY-MM-DD",
    )
    message: str | None = Field(
        default=None,
        description="カスタムメッセージ（省略時はデフォルトテンプレート使用）",
    )


class OrderChangeNotifyResultItem(BaseModel):
    staff_id: str
    email: str
    success: bool


class OrderChangeNotifyResponse(BaseModel):
    messages_sent: int = Field(description="送信成功件数")
    total_targets: int = Field(description="送信対象件数")
    results: list[OrderChangeNotifyResultItem]


# ---------------------------------------------------------------------------
# 翌日チェックリスト
# ---------------------------------------------------------------------------


class ChecklistOrderItem(BaseModel):
    order_id: str
    customer_id: str
    customer_name: str
    start_time: str
    end_time: str
    service_type: str
    status: str


class StaffChecklist(BaseModel):
    staff_id: str
    staff_name: str
    orders: list[ChecklistOrderItem]


class DailyChecklistResponse(BaseModel):
    date: str
    total_orders: int = Field(description="対象オーダー数")
    staff_checklists: list[StaffChecklist]


# ---------------------------------------------------------------------------
# 翌日通知
# ---------------------------------------------------------------------------


class NextDayNotifyRequest(BaseModel):
    date: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="通知対象日 YYYY-MM-DD",
    )
    channel: Literal["chat", "email"] = Field(
        default="chat",
        description="通知チャネル（emailは未実装）",
    )


class NextDayNotifyResultItem(BaseModel):
    staff_id: str
    staff_name: str
    email: str
    success: bool
    orders_count: int


class NextDayNotifyResponse(BaseModel):
    date: str
    messages_sent: int = Field(description="送信成功件数")
    total_targets: int = Field(description="送信対象件数")
    results: list[NextDayNotifyResultItem]
