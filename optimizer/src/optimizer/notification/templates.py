"""メール通知HTMLテンプレート（string.Template ベース）"""

from string import Template

APP_URL = "https://visitcare-shift-optimizer.web.app"

_BASE_STYLE = """
<style>
  body { font-family: sans-serif; color: #333; background: #f9fafb; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 24px auto; background: #fff;
               border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; }
  .header { background: linear-gradient(135deg, #0e7490, #0891b2);
            color: #fff; padding: 20px 24px; }
  .header h1 { margin: 0; font-size: 18px; }
  .body { padding: 24px; }
  .footer { background: #f1f5f9; color: #64748b; font-size: 12px;
            text-align: center; padding: 12px; }
  .btn { display: inline-block; background: #0891b2; color: #fff;
         text-decoration: none; padding: 10px 20px; border-radius: 6px;
         font-weight: bold; margin-top: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  th { background: #f1f5f9; font-weight: 600; }
  ul { margin: 8px 0; padding-left: 20px; }
  li { margin: 4px 0; }
</style>
"""

# ---------------------------------------------------------------------------
# シフト確定通知
# ---------------------------------------------------------------------------
_SHIFT_CONFIRMED_TMPL = Template("""<!DOCTYPE html><html><head><meta charset="utf-8">
$style
</head><body>
<div class="container">
  <div class="header"><h1>[VisitCare] シフト確定: $week_label</h1></div>
  <div class="body">
    <p>お疲れ様です。<strong>$week_label</strong> のシフトが確定しました。</p>
    <table>
      <tr><th>対象週</th><td>$week_label</td></tr>
      <tr><th>割当件数</th><td>$assigned_count / $total_orders 件</td></tr>
    </table>
    $message_block
    <a class="btn" href="$app_url">アプリで確認する</a>
  </div>
  <div class="footer">VisitCare シフト最適化システム</div>
</div>
</body></html>""")


def render_shift_confirmed(
    week_start_date: str,
    assigned_count: int,
    total_orders: int,
    message: str | None = None,
) -> tuple[str, str]:
    """(subject, html_content) を返す"""
    week_label = week_start_date + "週"
    message_block = f"<p>{message}</p>" if message else ""
    html = _SHIFT_CONFIRMED_TMPL.safe_substitute(
        style=_BASE_STYLE,
        week_label=week_label,
        assigned_count=assigned_count,
        total_orders=total_orders,
        message_block=message_block,
        app_url=APP_URL,
    )
    subject = f"[VisitCare] シフト確定: {week_label}"
    return subject, html


# ---------------------------------------------------------------------------
# シフト変更通知
# ---------------------------------------------------------------------------
_SHIFT_CHANGED_TMPL = Template("""<!DOCTYPE html><html><head><meta charset="utf-8">
$style
</head><body>
<div class="container">
  <div class="header"><h1>[VisitCare] シフト変更: $week_label ($count件)</h1></div>
  <div class="body">
    <p><strong>$week_label</strong> のシフトに <strong>$count 件</strong>の変更があります。</p>
    <table>
      <tr>
        <th>利用者</th><th>日付</th><th>時間帯</th>
        <th>変更前スタッフ</th><th>変更後スタッフ</th>
      </tr>
      $rows
    </table>
    <a class="btn" href="$app_url">アプリで確認する</a>
  </div>
  <div class="footer">VisitCare シフト最適化システム</div>
</div>
</body></html>""")


def render_shift_changed(
    week_start_date: str,
    changes: list[dict],
) -> tuple[str, str]:
    """(subject, html_content) を返す"""
    week_label = week_start_date + "週"
    rows = "".join(
        f"<tr><td>{c['customer_name']}</td><td>{c['date']}</td>"
        f"<td>{c['time_range']}</td><td>{c['old_staff']}</td><td>{c['new_staff']}</td></tr>"
        for c in changes
    )
    html = _SHIFT_CHANGED_TMPL.safe_substitute(
        style=_BASE_STYLE,
        week_label=week_label,
        count=len(changes),
        rows=rows,
        app_url=APP_URL,
    )
    subject = f"[VisitCare] シフト変更: {len(changes)}件"
    return subject, html


# ---------------------------------------------------------------------------
# 希望休催促通知
# ---------------------------------------------------------------------------
_REMINDER_TMPL = Template("""<!DOCTYPE html><html><head><meta charset="utf-8">
$style
</head><body>
<div class="container">
  <div class="header"><h1>[VisitCare] 希望休提出のお願い</h1></div>
  <div class="body">
    <p><strong>$target_week</strong> の希望休が未提出のスタッフがいます。</p>
    <p>以下のスタッフに提出を促してください。</p>
    <ul>$items</ul>
    <a class="btn" href="$app_url/masters/unavailability">希望休管理を開く</a>
  </div>
  <div class="footer">VisitCare シフト最適化システム</div>
</div>
</body></html>""")


def render_unavailability_reminder(
    target_week_start: str,
    helpers_not_submitted: list[dict],
) -> tuple[str, str]:
    """(subject, html_content) を返す"""
    items = "".join(f"<li>{h['name']}</li>" for h in helpers_not_submitted)
    html = _REMINDER_TMPL.safe_substitute(
        style=_BASE_STYLE,
        target_week=target_week_start + "週",
        items=items,
        app_url=APP_URL,
    )
    subject = "[VisitCare] 希望休提出のお願い"
    return subject, html
