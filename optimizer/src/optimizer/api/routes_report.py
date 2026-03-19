"""レポート・チェックリスト ルート"""

import logging
import re
from datetime import date, datetime, timedelta, timezone

import google.auth  # type: ignore[import-untyped]  # noqa: F401 (テストのpatch対象)
from fastapi import APIRouter, Depends, HTTPException, Query
from googleapiclient.discovery import build  # type: ignore[import-untyped]

from optimizer.api.auth import require_manager_or_above
from optimizer.api.routes_common import _get_sheets_credentials
from optimizer.api.schemas import (
    ChecklistOrderItem,
    DailyChecklistResponse,
    ErrorResponse,
    ExportReportRequest,
    ExportReportResponse,
    StaffChecklist,
)
from optimizer.data.firestore_loader import (
    get_firestore_client,
    load_all_customers,
    load_all_helpers,
    load_all_service_types,
    load_monthly_orders,
)
from optimizer.report.aggregation import (
    aggregate_customer_summary,
    aggregate_service_type_summary,
    aggregate_staff_summary,
    aggregate_status_summary,
)
from optimizer.report.sheets_writer import create_monthly_report_spreadsheet

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# 月次レポートエクスポート
# ---------------------------------------------------------------------------


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
        detail = f"スプレッドシートの作成に失敗しました: {e}"
        if "403" in str(e) or "permission" in str(e).lower():
            detail += (
                "\n\nヒント: ローカル開発では ADC に Sheets/Drive スコープが必要です。"
                "\ngcloud auth application-default login "
                "--scopes=openid,https://www.googleapis.com/auth/userinfo.email,"
                "https://www.googleapis.com/auth/cloud-platform,"
                "https://www.googleapis.com/auth/spreadsheets,"
                "https://www.googleapis.com/auth/drive"
            )
        raise HTTPException(status_code=500, detail=detail) from e

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
# 翌日チェックリスト
# ---------------------------------------------------------------------------


@router.get(
    "/checklist/next-day",
    response_model=DailyChecklistResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
def get_daily_checklist(
    date_param: str = Query(
        ..., alias="date",
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="チェックリスト対象日 YYYY-MM-DD",
    ),
    _auth: dict | None = Depends(require_manager_or_above),
) -> DailyChecklistResponse:
    """指定日のオーダーをヘルパー別にグルーピングしたチェックリストを返す"""
    try:
        target_date = date.fromisoformat(date_param)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    JST = timezone(timedelta(hours=9))
    target_dt = datetime(target_date.year, target_date.month, target_date.day, tzinfo=JST)
    target_dt_end = target_dt + timedelta(days=1)

    try:
        db = get_firestore_client()

        # 対象日のオーダーを取得（pending + assigned）
        order_docs = list(
            db.collection("orders")
            .where("date", ">=", target_dt)
            .where("date", "<", target_dt_end)
            .where("status", "in", ["pending", "assigned"])
            .stream()
        )

        if not order_docs:
            return DailyChecklistResponse(
                date=date_param,
                total_orders=0,
                staff_checklists=[],
            )

        # ヘルパー名とcustomer名の取得
        helper_names: dict[str, str] = {}
        customer_names: dict[str, str] = {}

        helper_ids_needed: set[str] = set()
        customer_ids_needed: set[str] = set()

        orders_data: list[dict] = []
        for doc in order_docs:
            d = doc.to_dict()
            if d is None:
                continue
            d["_id"] = doc.id
            orders_data.append(d)
            for sid in d.get("assigned_staff_ids", []):
                helper_ids_needed.add(sid)
            customer_ids_needed.add(d.get("customer_id", ""))

        # ヘルパー名を一括取得（N+1回避）
        if helper_ids_needed:
            helper_refs = [db.collection("helpers").document(sid) for sid in helper_ids_needed]
            for hdoc in db.get_all(helper_refs):
                if hdoc.exists:
                    hd = hdoc.to_dict() or {}
                    name = hd.get("name", {})
                    helper_names[hdoc.id] = f"{name.get('family', '')} {name.get('given', '')}"

        # 利用者名を一括取得（N+1回避）
        customer_ids_needed.discard("")
        if customer_ids_needed:
            customer_refs = [db.collection("customers").document(cid) for cid in customer_ids_needed]
            for cdoc in db.get_all(customer_refs):
                if cdoc.exists:
                    cd = cdoc.to_dict() or {}
                    name = cd.get("name", {})
                    customer_names[cdoc.id] = f"{name.get('family', '')} {name.get('given', '')}"

        # ヘルパー別にグルーピング
        staff_orders: dict[str, list[ChecklistOrderItem]] = {}
        unassigned_orders: list[ChecklistOrderItem] = []

        for d in orders_data:
            cid = d.get("customer_id", "")
            item = ChecklistOrderItem(
                order_id=d["_id"],
                customer_id=cid,
                customer_name=customer_names.get(cid, ""),
                start_time=d.get("start_time", ""),
                end_time=d.get("end_time", ""),
                service_type=d.get("service_type", ""),
                status=d.get("status", ""),
            )

            assigned = d.get("assigned_staff_ids", [])
            if not assigned:
                unassigned_orders.append(item)
            else:
                for sid in assigned:
                    staff_orders.setdefault(sid, []).append(item)

        # 時間順ソート
        checklists: list[StaffChecklist] = []
        for sid in sorted(staff_orders.keys()):
            orders = sorted(staff_orders[sid], key=lambda o: o.start_time)
            checklists.append(StaffChecklist(
                staff_id=sid,
                staff_name=helper_names.get(sid, sid),
                orders=orders,
            ))

        # 未割当オーダー
        if unassigned_orders:
            checklists.append(StaffChecklist(
                staff_id="",
                staff_name="未割当",
                orders=sorted(unassigned_orders, key=lambda o: o.start_time),
            ))

    except Exception as e:
        logger.error("チェックリスト生成失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"チェックリスト生成エラー: {e}"
        ) from e

    return DailyChecklistResponse(
        date=date_param,
        total_orders=len(orders_data),
        staff_checklists=checklists,
    )
