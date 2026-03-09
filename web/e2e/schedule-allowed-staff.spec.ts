import { test, expect } from '@playwright/test';
import { goToSchedule, waitForGanttBars } from './helpers';

// ── Firestore Emulator REST API helpers ──

const EMULATOR_HOST = 'http://localhost:8080';
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-visitcare';
const FIRESTORE_BASE = `${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/** Get current Monday in YYYY-MM-DD format, matching seed import logic (JST) */
function getCurrentMondayJST(): string {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const day = jst.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  jst.setDate(jst.getDate() + diff);
  return `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, '0')}-${String(jst.getDate()).padStart(2, '0')}`;
}

/** Add all-day staff unavailability via Firestore emulator REST API */
async function addAllDayUnavailability(
  staffId: string,
  weekStart: string,
  dayOffsets: number[],
): Promise<void> {
  const weekStartDate = new Date(weekStart + 'T00:00:00+09:00');

  const slots = dayOffsets.map((offset) => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + offset);
    return {
      mapValue: {
        fields: {
          date: { timestampValue: d.toISOString() },
          all_day: { booleanValue: true },
        },
      },
    };
  });

  const docId = `${staffId}_${weekStart}`;

  const res = await fetch(`${FIRESTORE_BASE}/staff_unavailability/${docId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({
      fields: {
        staff_id: { stringValue: staffId },
        week_start_date: { timestampValue: weekStartDate.toISOString() },
        unavailable_slots: {
          arrayValue: { values: slots },
        },
        submitted_at: { timestampValue: new Date().toISOString() },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to add unavailability for ${staffId}: ${res.status} ${await res.text()}`);
  }
}

/** Remove staff unavailability document from emulator */
async function removeUnavailability(staffId: string, weekStart: string): Promise<void> {
  const docId = `${staffId}_${weekStart}`;
  await fetch(`${FIRESTORE_BASE}/staff_unavailability/${docId}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer owner' },
  });
}

// ── Tests ──

test.describe('allowed_staff_ids 事前チェックダイアログ', () => {
  // 全テストが同一workerで逐次実行されるよう mode: 'serial' を指定。
  // beforeAll/afterAll のデータセットアップ・クリーンアップがworker間で競合しないようにする。
  test.describe.configure({ retries: 2, timeout: 60_000, mode: 'serial' });

  const weekStart = getCurrentMondayJST();

  // C010（吉田勝）は allowed_staff_ids = [H001, H009]
  // Monday に両者の希望休を追加 → C010 の月曜オーダーで全員対応不可
  test.beforeAll(async () => {
    await addAllDayUnavailability('H001', weekStart, [0]); // Monday
    await addAllDayUnavailability('H009', weekStart, [0]); // Monday
  });

  test.afterAll(async () => {
    // H001/H009 は seed に希望休なし → DELETE で安全にクリーンアップ
    await removeUnavailability('H001', weekStart);
    await removeUnavailability('H009', weekStart);
  });

  test('allowed helper全員が希望休の場合、警告ダイアログが表示される', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    await page.getByRole('button', { name: /最適化/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('最適化前の注意')).toBeVisible();
    // C010（吉田勝）の利用者名が表示される
    await expect(dialog.getByText('吉田').first()).toBeVisible();
    // 月曜の表示
    await expect(dialog.getByText(/月曜/)).toBeVisible();
    // allowed ヘルパー名の表示（設定中: ... → 全員対応不可）
    await expect(dialog.getByText(/全員対応不可/)).toBeVisible();
  });

  test('「戻って修正する」で警告ダイアログが閉じる', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    await page.getByRole('button', { name: /最適化/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('最適化前の注意')).toBeVisible();

    await dialog.getByRole('button', { name: '戻って修正する' }).click();
    await expect(dialog).toBeHidden();
  });

  test('「警告を無視して実行」でウェイト設定ダイアログに遷移する', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    await page.getByRole('button', { name: /最適化/ }).click();

    const warnDialog = page.getByRole('dialog');
    await expect(warnDialog.getByText('最適化前の注意')).toBeVisible();

    await warnDialog.getByRole('button', { name: '警告を無視して実行' }).click();

    // ウェイト設定ダイアログに遷移
    await expect(page.getByRole('dialog').getByText('シフト最適化の実行')).toBeVisible();
  });
});
