"""APIルーティング"""

import logging
import os
import re
from datetime import UTC, date, datetime

import google.auth  # type: ignore[import-untyped]
import google.auth.compute_engine  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, Query
from googleapiclient.discovery import build  # type: ignore[import-untyped]

_SHEETS_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def _get_sheets_credentials() -> object:
    """Sheets/Drive API用の認証情報を取得する。

    ローカル開発: ADC（gcloud auth application-default login --scopes=... で設定済み）をそのまま使用。
    Cloud Run: Compute Engine Credentials は cloud-platform スコープしか持てないため、
    IAM Credentials API を経由した SA self-impersonation でSheets/Drive スコープのトークンを取得する。
    """
    creds, _ = google.auth.default()

    if isinstance(creds, google.auth.compute_engine.Credentials):
        from google.auth import impersonated_credentials  # type: ignore[import-untyped]

        sa_email = os.getenv(
            "SHEETS_SA_EMAIL",
            "1045989697649-compute@developer.gserviceaccount.com",
        )
        creds = impersonated_credentials.Credentials(
            source_credentials=creds,
            target_principal=sa_email,
            target_scopes=_SHEETS_SCOPES,
        )

    return creds


from optimizer.api.auth import require_manager_or_above
from optimizer.api.schemas import (
    AssignmentResponse,
    ErrorResponse,
    ExportReportRequest,
    ExportReportResponse,
    NotificationResponse,
    OptimizationParametersResponse,
    OptimizationRunDetailResponse,
    OptimizationRunListResponse,
    OptimizationRunResponse,
    OptimizeRequest,
    OptimizeResponse,
    ResetAssignmentsRequest,
    ResetAssignmentsResponse,
    ShiftChangedNotifyRequest,
    ShiftConfirmedNotifyRequest,
    UnavailabilityReminderRequest,
)
from optimizer.notification.recipients import list_manager_emails
from optimizer.notification.sender import send_email
from optimizer.notification.templates import (
    render_shift_changed,
    render_shift_confirmed,
    render_unavailability_reminder,
)
from optimizer.data.firestore_loader import (
    get_firestore_client,
    load_all_customers,
    load_all_helpers,
    load_all_service_types,
    load_monthly_orders,
    load_optimization_input,
)
from optimizer.data.firestore_writer import reset_assignments, save_optimization_run, write_assignments
from optimizer.engine.solver import SoftWeights, solve
from optimizer.models import Assignment, OptimizationParameters, OptimizationRunRecord
from optimizer.report.aggregation import (
    aggregate_customer_summary,
    aggregate_service_type_summary,
    aggregate_staff_summary,
    aggregate_status_summary,
)
from optimizer.report.sheets_writer import create_monthly_report_spreadsheet

logger = logging.getLogger(__name__)


def _serialize_executed_at(value: object) -> str:
    """Firestore Timestamp/datetimeをISO 8601文字列に変換"""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value) if value else ""

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post(
    "/optimize",
    response_model=OptimizeResponse,
    responses={409: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def optimize(req: OptimizeRequest, _auth: dict | None = Depends(require_manager_or_above)) -> OptimizeResponse:
    """シフト最適化を実行し、結果をFirestoreに書き戻す"""
    # 日付パース
    try:
        week_start = date.fromisoformat(req.week_start_date)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    # 月曜日チェック
    if week_start.weekday() != 0:
        raise HTTPException(
            status_code=422,
            detail=f"{req.week_start_date} は月曜日ではありません"
            f"（weekday={week_start.weekday()}）",
        )

    # Firestoreからデータ読み込み
    try:
        db = get_firestore_client()
        inp = load_optimization_input(db, week_start)
    except Exception as e:
        logger.error("Firestore読み込み失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Firestore読み込みエラー: {e}"
        ) from e

    if not inp.orders:
        raise HTTPException(
            status_code=409,
            detail=f"対象週 {req.week_start_date} に最適化対象のオーダーがありません",
        )

    logger.info(
        "最適化開始: orders=%d, helpers=%d, customers=%d",
        len(inp.orders),
        len(inp.helpers),
        len(inp.customers),
    )

    # ソルバー実行
    weights = SoftWeights(
        travel=req.w_travel,
        preferred_staff=req.w_preferred_staff,
        workload_balance=req.w_workload_balance,
        continuity=req.w_continuity,
    )
    result = solve(inp, time_limit_seconds=req.time_limit_seconds, weights=weights)

    if result.status == "Infeasible":
        raise HTTPException(
            status_code=409,
            detail="制約を満たす割当が見つかりません",
        )

    # Firestore書き戻し
    orders_updated = 0
    if not req.dry_run and result.assignments:
        try:
            orders_updated = write_assignments(db, result.assignments)
        except Exception as e:
            logger.error("Firestore書き戻し失敗: %s", e, exc_info=True)
            raise HTTPException(
                status_code=500, detail="割当の保存に失敗しました"
            ) from e
        logger.info("Firestore書き戻し完了: %d件", orders_updated)

    # 最適化実行記録を保存
    executed_by = ""
    if _auth:
        executed_by = _auth.get("uid", "")

    run_record = OptimizationRunRecord(
        id="",  # save_optimization_run内で生成
        week_start_date=req.week_start_date,
        executed_at=datetime.now(UTC),
        executed_by=executed_by,
        dry_run=req.dry_run,
        status=result.status,
        objective_value=result.objective_value,
        solve_time_seconds=result.solve_time_seconds,
        total_orders=len(inp.orders),
        assigned_count=len(result.assignments),
        assignments=result.assignments,
        parameters=OptimizationParameters(
            time_limit_seconds=req.time_limit_seconds,
            w_travel=req.w_travel,
            w_preferred_staff=req.w_preferred_staff,
            w_workload_balance=req.w_workload_balance,
            w_continuity=req.w_continuity,
        ),
    )

    try:
        run_id = save_optimization_run(db, run_record)
        logger.info("最適化実行記録保存完了: id=%s", run_id)
    except Exception as e:
        logger.error("最適化実行記録の保存失敗: %s", e, exc_info=True)
        # 実行記録の保存失敗はAPIレスポンスには影響させない

    return OptimizeResponse(
        assignments=[
            AssignmentResponse(order_id=a.order_id, staff_ids=a.staff_ids)
            for a in result.assignments
        ],
        objective_value=result.objective_value,
        solve_time_seconds=result.solve_time_seconds,
        status=result.status,
        orders_updated=orders_updated,
        total_orders=len(inp.orders),
        assigned_count=len(result.assignments),
    )


@router.get(
    "/optimization-runs",
    response_model=OptimizationRunListResponse,
)
def list_optimization_runs(
    week_start_date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    limit: int = Query(20, ge=1, le=100),
    _auth: dict | None = Depends(require_manager_or_above),
) -> OptimizationRunListResponse:
    """最適化実行履歴一覧を取得"""
    db = get_firestore_client()
    query = db.collection("optimization_runs").order_by(
        "executed_at", direction="DESCENDING"
    )

    if week_start_date:
        query = query.where("week_start_date", "==", week_start_date)

    query = query.limit(limit)

    try:
        docs = list(query.stream())
    except Exception as e:
        logger.warning("Failed to query optimization_runs: %s", e)
        return OptimizationRunListResponse(runs=[])

    runs = []
    for doc in docs:
        data = doc.to_dict()
        params = data.get("parameters", {})

        runs.append(
            OptimizationRunResponse(
                id=data.get("id", doc.id),
                week_start_date=data.get("week_start_date", ""),
                executed_at=_serialize_executed_at(data.get("executed_at")),
                executed_by=data.get("executed_by", ""),
                dry_run=data.get("dry_run", False),
                status=data.get("status", ""),
                objective_value=data.get("objective_value", 0.0),
                solve_time_seconds=data.get("solve_time_seconds", 0.0),
                total_orders=data.get("total_orders", 0),
                assigned_count=data.get("assigned_count", 0),
                parameters=OptimizationParametersResponse(
                    time_limit_seconds=params.get("time_limit_seconds", 180),
                    w_travel=params.get("w_travel", 1.0),
                    w_preferred_staff=params.get("w_preferred_staff", 5.0),
                    w_workload_balance=params.get("w_workload_balance", 10.0),
                    w_continuity=params.get("w_continuity", 3.0),
                ),
            )
        )

    return OptimizationRunListResponse(runs=runs)


@router.get(
    "/optimization-runs/{run_id}",
    response_model=OptimizationRunDetailResponse,
    responses={404: {"model": ErrorResponse}},
)
def get_optimization_run(
    run_id: str,
    _auth: dict | None = Depends(require_manager_or_above),
) -> OptimizationRunDetailResponse:
    """最適化実行記録の詳細を取得"""
    db = get_firestore_client()
    doc = db.collection("optimization_runs").document(run_id).get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="実行記録が見つかりません")

    data = doc.to_dict()
    params = data.get("parameters", {})

    assignments = [
        AssignmentResponse(
            order_id=a.get("order_id", ""),
            staff_ids=a.get("staff_ids", []),
        )
        for a in data.get("assignments", [])
    ]

    return OptimizationRunDetailResponse(
        id=data.get("id", doc.id),
        week_start_date=data.get("week_start_date", ""),
        executed_at=_serialize_executed_at(data.get("executed_at")),
        executed_by=data.get("executed_by", ""),
        dry_run=data.get("dry_run", False),
        status=data.get("status", ""),
        objective_value=data.get("objective_value", 0.0),
        solve_time_seconds=data.get("solve_time_seconds", 0.0),
        total_orders=data.get("total_orders", 0),
        assigned_count=data.get("assigned_count", 0),
        parameters=OptimizationParametersResponse(
            time_limit_seconds=params.get("time_limit_seconds", 180),
            w_travel=params.get("w_travel", 1.0),
            w_preferred_staff=params.get("w_preferred_staff", 5.0),
            w_workload_balance=params.get("w_workload_balance", 10.0),
            w_continuity=params.get("w_continuity", 3.0),
        ),
        assignments=assignments,
    )


@router.post(
    "/reset-assignments",
    response_model=ResetAssignmentsResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
def reset_assignments_endpoint(
    req: ResetAssignmentsRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> ResetAssignmentsResponse:
    """対象週のオーダー割当をすべてリセット"""
    # 日付パース
    try:
        week_start = date.fromisoformat(req.week_start_date)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    # 月曜日チェック
    if week_start.weekday() != 0:
        raise HTTPException(
            status_code=422,
            detail=f"{req.week_start_date} は月曜日ではありません"
            f"（weekday={week_start.weekday()}）",
        )

    try:
        db = get_firestore_client()
        orders_reset = reset_assignments(db, week_start)
    except Exception as e:
        logger.error("リセット失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"リセットエラー: {e}"
        ) from e

    return ResetAssignmentsResponse(
        orders_reset=orders_reset,
        week_start_date=req.week_start_date,
    )


@router.post(
    "/export-report",
    response_model=ExportReportResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def export_report(
    req: ExportReportRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> ExportReportResponse:
    """月次レポートをGoogle Sheetsにエクスポートし、スプレッドシートURLを返す"""
    # フォーマット検証（patternで既にチェック済みだが念のため）
    if not re.match(r"^\d{4}-\d{2}$", req.year_month):
        raise HTTPException(status_code=400, detail="year_month は YYYY-MM 形式で指定してください")

    # Firestoreからデータ読み込み
    try:
        db = get_firestore_client()
        orders = load_monthly_orders(db, req.year_month)
        helpers = load_all_helpers(db)
        customers = load_all_customers(db)
        service_type_configs = load_all_service_types(db)
    except Exception as e:
        logger.error("Firestore読み込み失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Firestore読み込みエラー: {e}"
        ) from e

    if not orders:
        raise HTTPException(
            status_code=404,
            detail=f"{req.year_month} のオーダーデータが見つかりません",
        )

    # 集計
    status_summary = aggregate_status_summary(orders)
    service_type_summary = aggregate_service_type_summary(orders, service_type_configs=service_type_configs)
    staff_summary = aggregate_staff_summary(orders, helpers)
    customer_summary = aggregate_customer_summary(orders, customers)

    # Google Sheets APIクライアント構築
    try:
        credentials = _get_sheets_credentials()
        sheets_service = build("sheets", "v4", credentials=credentials)
        drive_service = build("drive", "v3", credentials=credentials)
    except Exception as e:
        logger.error("Google API クライアント構築失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=503, detail=f"Google Sheets API に接続できませんでした: {e}"
        ) from e

    # スプレッドシート作成
    try:
        result = create_monthly_report_spreadsheet(
            service=sheets_service,
            drive_service=drive_service,
            year_month=req.year_month,
            status_summary=status_summary.model_dump(),
            service_type_summary=[item.model_dump() for item in service_type_summary],
            staff_summary=[row.model_dump() for row in staff_summary],
            customer_summary=[row.model_dump() for row in customer_summary],
            share_with_email=req.user_email,
        )
    except Exception as e:
        logger.error("スプレッドシート作成失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"スプレッドシートの作成に失敗しました: {e}"
        ) from e

    year, month = req.year_month.split("-")
    title = f"月次レポート {year}年{int(month)}月"

    logger.info(
        "スプレッドシート作成完了: id=%s, year_month=%s",
        result["spreadsheet_id"],
        req.year_month,
    )

    return ExportReportResponse(
        spreadsheet_id=result["spreadsheet_id"],
        spreadsheet_url=result["spreadsheet_url"],
        title=title,
        year_month=req.year_month,
        sheets_created=4,
        shared_with=req.user_email,
    )


# ---------------------------------------------------------------------------
# 通知エンドポイント
# ---------------------------------------------------------------------------

@router.post(
    "/notify/shift-confirmed",
    response_model=NotificationResponse,
    responses={500: {"model": ErrorResponse}},
)
def notify_shift_confirmed(
    req: ShiftConfirmedNotifyRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> NotificationResponse:
    """シフト確定メールをサ責全員に送信する"""
    recipients = list_manager_emails()
    subject, html = render_shift_confirmed(
        week_start_date=req.week_start_date,
        assigned_count=req.assigned_count,
        total_orders=req.total_orders,
        message=req.message,
    )
    sent = send_email(recipients, subject, html)
    logger.info("シフト確定通知送信: sent=%d, recipients=%s", sent, recipients)
    return NotificationResponse(emails_sent=sent, recipients=recipients)


@router.post(
    "/notify/shift-changed",
    response_model=NotificationResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
def notify_shift_changed(
    req: ShiftChangedNotifyRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> NotificationResponse:
    """シフト変更メールをサ責全員に送信する"""
    recipients = list_manager_emails()
    subject, html = render_shift_changed(
        week_start_date=req.week_start_date,
        changes=[c.model_dump() for c in req.changes],
    )
    sent = send_email(recipients, subject, html)
    logger.info("シフト変更通知送信: sent=%d, changes=%d件", sent, len(req.changes))
    return NotificationResponse(emails_sent=sent, recipients=recipients)


@router.post(
    "/notify/unavailability-reminder",
    response_model=NotificationResponse,
    responses={500: {"model": ErrorResponse}},
)
def notify_unavailability_reminder(
    req: UnavailabilityReminderRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> NotificationResponse:
    """希望休催促メールをサ責全員に送信する"""
    recipients = list_manager_emails()
    subject, html = render_unavailability_reminder(
        target_week_start=req.target_week_start,
        helpers_not_submitted=req.helpers_not_submitted,
    )
    sent = send_email(recipients, subject, html)
    logger.info(
        "希望休催促通知送信: sent=%d, helpers=%d名",
        sent,
        len(req.helpers_not_submitted),
    )
    return NotificationResponse(emails_sent=sent, recipients=recipients)
