"""通知系ルート（催促・変更通知・翌日通知）"""

import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from optimizer.api.auth import require_manager_or_above
from optimizer.api.routes_common import APP_URL
from optimizer.api.schemas import (
    ChatReminderRequest,
    ChatReminderResponse,
    ChatReminderResultItem,
    ErrorResponse,
    NextDayNotifyRequest,
    NextDayNotifyResponse,
    NextDayNotifyResultItem,
    OrderChangeNotifyRequest,
    OrderChangeNotifyResponse,
    OrderChangeNotifyResultItem,
)
from optimizer.data.firestore_loader import get_firestore_client
from optimizer.notification.chat_sender import send_chat_dm, send_chat_dms

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Google Chat DM 催促
# ---------------------------------------------------------------------------

_CHAT_REMINDER_TEMPLATE = (
    "[VisitCare] 希望休提出のお願い\n\n"
    "{target_week}週 の希望休がまだ提出されていません。\n"
    "お手数ですが、以下のリンクから提出をお願いします。\n\n"
    "{app_url}/masters/unavailability"
)


@router.post(
    "/notify/chat-reminder",
    response_model=ChatReminderResponse,
    responses={500: {"model": ErrorResponse}},
)
def notify_chat_reminder(
    req: ChatReminderRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> ChatReminderResponse:
    """希望休催促を Google Chat DM で個別送信する"""
    message_text = req.message or _CHAT_REMINDER_TEMPLATE.format(
        target_week=req.target_week_start,
        app_url=APP_URL,
    )

    emails = [t.email for t in req.targets]
    sent_count, raw_results = send_chat_dms(emails, message_text)

    # raw_results を staff_id 付きに変換
    email_to_staff = {t.email: t.staff_id for t in req.targets}
    results = [
        ChatReminderResultItem(
            staff_id=email_to_staff.get(r["email"], ""),
            email=str(r["email"]),
            success=bool(r["success"]),
        )
        for r in raw_results
    ]

    logger.info(
        "Chat DM 催促送信: sent=%d/%d",
        sent_count,
        len(req.targets),
    )

    return ChatReminderResponse(
        messages_sent=sent_count,
        total_targets=len(req.targets),
        results=results,
    )


# ---------------------------------------------------------------------------
# オーダー変更通知
# ---------------------------------------------------------------------------

_CHANGE_TYPE_LABELS = {
    "reassigned": "担当変更",
    "time_changed": "時間変更",
    "cancelled": "キャンセル",
}

_ORDER_CHANGE_TEMPLATE = (
    "[VisitCare] 【シフト変更】\n\n"
    "日付: {date}\n"
    "利用者: {customer_name}\n"
    "変更内容: {change_type_label}\n\n"
    "詳細はシフト管理画面をご確認ください。\n"
    "{app_url}"
)


@router.post(
    "/notify/order-change",
    response_model=OrderChangeNotifyResponse,
    responses={500: {"model": ErrorResponse}},
)
def notify_order_change(
    req: OrderChangeNotifyRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> OrderChangeNotifyResponse:
    """オーダー変更を影響スタッフにGoogle Chat DMで通知"""
    # ヘルパーのメールアドレスを一括取得（N+1回避）
    try:
        db = get_firestore_client()
        staff_emails: dict[str, str] = {}
        helper_refs = [db.collection("helpers").document(sid) for sid in req.affected_staff_ids]
        for hdoc in db.get_all(helper_refs):
            if hdoc.exists:
                d = hdoc.to_dict()
                email = (d or {}).get("email", "")
                if email:
                    staff_emails[hdoc.id] = email
    except Exception as e:
        logger.error("ヘルパー情報取得失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"ヘルパー情報取得エラー: {e}"
        ) from e

    if not staff_emails:
        return OrderChangeNotifyResponse(
            messages_sent=0,
            total_targets=len(req.affected_staff_ids),
            results=[
                OrderChangeNotifyResultItem(
                    staff_id=sid, email="", success=False,
                )
                for sid in req.affected_staff_ids
            ],
        )

    change_label = _CHANGE_TYPE_LABELS.get(req.change_type, req.change_type)
    message_text = req.message or _ORDER_CHANGE_TEMPLATE.format(
        date=req.date,
        customer_name=req.customer_name,
        change_type_label=change_label,
        app_url=APP_URL,
    )

    emails = list(staff_emails.values())
    sent_count, raw_results = send_chat_dms(emails, message_text)

    # email → staff_id の逆引き
    email_to_staff = {v: k for k, v in staff_emails.items()}
    results = [
        OrderChangeNotifyResultItem(
            staff_id=email_to_staff.get(str(r["email"]), ""),
            email=str(r["email"]),
            success=bool(r["success"]),
        )
        for r in raw_results
    ]

    # email未登録のスタッフも結果に含める
    notified_staff = {r.staff_id for r in results}
    for sid in req.affected_staff_ids:
        if sid not in notified_staff:
            results.append(
                OrderChangeNotifyResultItem(
                    staff_id=sid, email="", success=False,
                )
            )

    logger.info(
        "オーダー変更通知: sent=%d/%d (order=%s, change=%s)",
        sent_count, len(req.affected_staff_ids), req.order_id, req.change_type,
    )

    return OrderChangeNotifyResponse(
        messages_sent=sent_count,
        total_targets=len(req.affected_staff_ids),
        results=results,
    )


# ---------------------------------------------------------------------------
# 翌日通知
# ---------------------------------------------------------------------------

_NEXT_DAY_NOTIFY_TEMPLATE = (
    "[VisitCare] 翌日の予定をお知らせします\n\n"
    "{date} の予定:\n"
    "{schedule_text}\n\n"
    "詳細はシフト管理画面をご確認ください。\n"
    "{app_url}"
)


@router.post(
    "/notify/next-day",
    response_model=NextDayNotifyResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
def notify_next_day(
    req: NextDayNotifyRequest,
    _auth: dict | None = Depends(require_manager_or_above),
) -> NextDayNotifyResponse:
    """翌日のチェックリストをヘルパーにChat DMで通知"""
    if req.channel == "email":
        raise HTTPException(
            status_code=422,
            detail="email通知は未実装です。channel=chatを使用してください。",
        )

    try:
        target_date = date.fromisoformat(req.date)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    JST = timezone(timedelta(hours=9))
    target_dt = datetime(target_date.year, target_date.month, target_date.day, tzinfo=JST)
    target_dt_end = target_dt + timedelta(days=1)

    try:
        db = get_firestore_client()

        # 対象日のassignedオーダーを取得
        order_docs = list(
            db.collection("orders")
            .where("date", ">=", target_dt)
            .where("date", "<", target_dt_end)
            .where("status", "==", "assigned")
            .stream()
        )

        if not order_docs:
            return NextDayNotifyResponse(
                date=req.date, messages_sent=0, total_targets=0, results=[],
            )

        # ヘルパー別にグルーピング
        staff_orders: dict[str, list[dict]] = {}
        customer_names: dict[str, str] = {}

        customer_ids_set: set[str] = set()
        for doc in order_docs:
            d = doc.to_dict()
            if d is None:
                continue
            for sid in d.get("assigned_staff_ids", []):
                staff_orders.setdefault(sid, []).append(d)
            cid = d.get("customer_id", "")
            if cid:
                customer_ids_set.add(cid)

        # 利用者名を一括取得（N+1回避）
        if customer_ids_set:
            cust_refs = [db.collection("customers").document(cid) for cid in customer_ids_set]
            for cdoc in db.get_all(cust_refs):
                if cdoc.exists:
                    cd = cdoc.to_dict() or {}
                    name = cd.get("name", {})
                    customer_names[cdoc.id] = f"{name.get('family', '')} {name.get('given', '')}"

        # ヘルパー情報を一括取得
        helper_refs = [db.collection("helpers").document(sid) for sid in staff_orders]
        helper_docs = db.get_all(helper_refs)
        helper_info: dict[str, tuple[str, str]] = {}  # sid → (name, email)
        for hdoc in helper_docs:
            if not hdoc.exists:
                continue
            hd = hdoc.to_dict() or {}
            hname = hd.get("name", {})
            helper_info[hdoc.id] = (
                f"{hname.get('family', '')} {hname.get('given', '')}",
                hd.get("email", ""),
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("翌日通知データ取得失敗: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"翌日通知エラー: {e}"
        ) from e

    # 各ヘルパーにChat DM送信（個別try/exceptで1件失敗しても継続）
    results: list[NextDayNotifyResultItem] = []
    sent_count = 0

    for sid, orders in staff_orders.items():
        staff_name, email = helper_info.get(sid, (sid, ""))

        if not email:
            results.append(NextDayNotifyResultItem(
                staff_id=sid, staff_name=staff_name, email="",
                success=False, orders_count=len(orders),
            ))
            continue

        try:
            sorted_orders = sorted(orders, key=lambda o: o.get("start_time", ""))
            schedule_lines = []
            for o in sorted_orders:
                cid = o.get("customer_id", "")
                cname = customer_names.get(cid, cid)
                schedule_lines.append(
                    f"  {o.get('start_time', '')}–{o.get('end_time', '')} {cname}"
                )

            message = _NEXT_DAY_NOTIFY_TEMPLATE.format(
                date=req.date,
                schedule_text="\n".join(schedule_lines),
                app_url=APP_URL,
            )

            success = send_chat_dm(email, message)
        except Exception:
            logger.exception("翌日通知DM送信失敗: staff=%s", sid)
            success = False

        if success:
            sent_count += 1

        results.append(NextDayNotifyResultItem(
            staff_id=sid, staff_name=staff_name, email=email,
            success=success, orders_count=len(orders),
        ))

    return NextDayNotifyResponse(
        date=req.date,
        messages_sent=sent_count,
        total_targets=len(staff_orders),
        results=results,
    )
