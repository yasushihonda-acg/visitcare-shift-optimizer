"""APIルーティング"""

import logging
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from optimizer.api.auth import require_manager_or_above
from optimizer.api.schemas import (
    AssignmentResponse,
    ErrorResponse,
    OptimizationParametersResponse,
    OptimizationRunDetailResponse,
    OptimizationRunListResponse,
    OptimizationRunResponse,
    OptimizeRequest,
    OptimizeResponse,
)
from optimizer.data.firestore_loader import get_firestore_client, load_optimization_input
from optimizer.data.firestore_writer import save_optimization_run, write_assignments
from optimizer.engine.solver import SoftWeights, solve
from optimizer.models import Assignment, OptimizationParameters, OptimizationRunRecord

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
