"""APIルーティング"""

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from optimizer.api.auth import verify_auth
from optimizer.api.schemas import (
    AssignmentResponse,
    ErrorResponse,
    OptimizeRequest,
    OptimizeResponse,
)
from optimizer.data.firestore_loader import get_firestore_client, load_optimization_input
from optimizer.data.firestore_writer import write_assignments
from optimizer.engine.solver import solve

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post(
    "/optimize",
    response_model=OptimizeResponse,
    responses={409: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def optimize(req: OptimizeRequest, _auth: dict | None = Depends(verify_auth)) -> OptimizeResponse:
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
    result = solve(inp, time_limit_seconds=req.time_limit_seconds)

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
