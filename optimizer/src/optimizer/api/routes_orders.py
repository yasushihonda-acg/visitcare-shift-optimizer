"""オーダー操作ルート（週複製・休み希望反映・不定期パターン）"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from optimizer.api.auth import require_manager_or_above
from optimizer.api.routes_common import _parse_monday
from optimizer.api.schemas import (
    ApplyIrregularPatternsRequest,
    ApplyIrregularPatternsResponse,
    ApplyUnavailabilityRequest,
    ApplyUnavailabilityResponse,
    DuplicateWeekRequest,
    DuplicateWeekResponse,
    ErrorResponse,
    IrregularPatternExclusion,
    UnavailabilityRemovalItem,
)
from optimizer.data.firestore_loader import get_firestore_client
from optimizer.data.firestore_writer import (
    apply_irregular_patterns,
    apply_unavailability_to_orders,
    duplicate_week_orders,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# 基本→当週シフト一括複製
# ---------------------------------------------------------------------------


@router.post(
    "/orders/duplicate-week",
    response_model=DuplicateWeekResponse,
    responses={409: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def duplicate_week(
    req: DuplicateWeekRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> DuplicateWeekResponse:
    """基本シフト（ソース週）のオーダーをターゲット週に一括複製"""
    source_week = _parse_monday(req.source_week_start)
    target_week = _parse_monday(req.target_week_start)

    # 同一週チェック
    if source_week == target_week:
        raise HTTPException(
            status_code=422,
            detail="コピー元とコピー先が同じ週です",
        )

    try:
        db = get_firestore_client()
        created, skipped = duplicate_week_orders(db, source_week, target_week)
    except Exception as e:
        logger.error("オーダー複製失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"オーダー複製エラー: {e}"
        ) from e

    if skipped > 0:
        raise HTTPException(
            status_code=409,
            detail=f"ターゲット週 {req.target_week_start} に既存オーダーが"
            f"あるため複製をスキップしました（{skipped}件）",
        )

    return DuplicateWeekResponse(
        created_count=created,
        skipped_count=skipped,
        target_week_start=req.target_week_start,
    )


# ---------------------------------------------------------------------------
# 休み希望の自動反映
# ---------------------------------------------------------------------------


@router.post(
    "/orders/apply-unavailability",
    response_model=ApplyUnavailabilityResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
def apply_unavailability_endpoint(
    req: ApplyUnavailabilityRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> ApplyUnavailabilityResponse:
    """対象週の休み希望をオーダーに反映し、該当スタッフの割当を解除"""
    week_start = _parse_monday(req.week_start_date)

    try:
        db = get_firestore_client()
        result = apply_unavailability_to_orders(db, week_start)
    except Exception as e:
        logger.error("休み希望反映失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"休み希望反映エラー: {e}"
        ) from e

    return ApplyUnavailabilityResponse(
        orders_modified=result.orders_modified,
        removals_count=result.removals_count,
        reverted_to_pending=result.reverted_to_pending,
        removals=[
            UnavailabilityRemovalItem(
                order_id=r.order_id,
                staff_id=r.staff_id,
                customer_id=r.customer_id,
                date=r.date,
                start_time=r.start_time,
                end_time=r.end_time,
            )
            for r in result.removals
        ],
    )


# ---------------------------------------------------------------------------
# 不定期パターン自動判定
# ---------------------------------------------------------------------------


@router.post(
    "/orders/apply-irregular-patterns",
    response_model=ApplyIrregularPatternsResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
def apply_irregular_patterns_endpoint(
    req: ApplyIrregularPatternsRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> ApplyIrregularPatternsResponse:
    """対象週の不定期パターンを評価し、該当オーダーをキャンセル"""
    week_start = _parse_monday(req.week_start_date)

    try:
        db = get_firestore_client()
        result = apply_irregular_patterns(db, week_start)
    except Exception as e:
        logger.error("不定期パターン適用失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"不定期パターン適用エラー: {e}"
        ) from e

    return ApplyIrregularPatternsResponse(
        cancelled_count=result.cancelled_count,
        excluded_customers=[
            IrregularPatternExclusion(
                customer_id=ex.customer_id,
                customer_name=ex.customer_name,
                pattern_type=ex.pattern_type,
                description=ex.description,
            )
            for ex in result.excluded_customers
        ],
    )
