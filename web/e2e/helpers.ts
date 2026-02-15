import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Firebase Auth（匿名認証）完了を待機する。
 * demo mode では自動的に匿名サインインが走るので、
 * ローディング画面（「認証中...」）が消えるのを待つ。
 */
export async function waitForAuth(page: Page) {
  // 「認証中...」テキストが消えるまで待つ（最大10秒）
  await expect(page.getByText('認証中...')).toBeHidden({ timeout: 10_000 });
}

/**
 * スケジュール画面（トップページ）に遷移して認証完了を待つ
 */
export async function goToSchedule(page: Page) {
  await page.goto('/');
  await waitForAuth(page);
}

/**
 * マスタ管理画面に遷移して認証完了を待つ
 */
export async function goToMasters(page: Page, tab: 'customers' | 'helpers' | 'unavailability') {
  await page.goto(`/masters/${tab}/`);
  await waitForAuth(page);
}

/**
 * 履歴画面に遷移して認証完了を待つ
 */
export async function goToHistory(page: Page) {
  await page.goto('/history/');
  await waitForAuth(page);
}

/**
 * スケジュール画面でガントバーが表示されるまで待機する
 */
export async function waitForGanttBars(page: Page) {
  await page.locator('[data-testid^="gantt-bar-"]').first().waitFor({ timeout: 15_000 });
}

/**
 * 低レベルmouse制御でD&Dを実行する。
 * @dnd-kit PointerSensor (distance: 5px) を確実にトリガーするため、
 * 中間点を経由し、dragover発火のためdrop位置へ2回moveする。
 */
export async function dragOrderToTarget(page: Page, source: Locator, target: Locator) {
  const dragBox = await source.boundingBox();
  const dropBox = await target.boundingBox();
  if (!dragBox || !dropBox) throw new Error('Could not get bounding box for drag source or target');

  const startX = dragBox.x + dragBox.width / 2;
  const startY = dragBox.y + dragBox.height / 2;
  const endX = dropBox.x + dropBox.width / 2;
  const endY = dropBox.y + dropBox.height / 2;

  await source.hover();
  await page.mouse.down();
  // distance: 5px を確実に超えるため中間点を経由
  await page.mouse.move(startX + 10, startY + 10, { steps: 5 });
  await page.mouse.move(endX, endY, { steps: 10 });
  // dragover発火用に再度move
  await page.mouse.move(endX, endY);
  await page.mouse.up();
}

/**
 * Optimizer APIのレスポンスをモックする。
 * CI環境ではOptimizer APIが起動していないため、route interceptionで対応。
 */
export async function mockOptimizerAPI(
  page: Page,
  response: { status?: number; body: Record<string, unknown> },
) {
  await page.route('**/optimize', (route) =>
    route.fulfill({
      status: response.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(response.body),
    }),
  );
}

/**
 * sonnerトーストの表示を待機する。
 * sonnerは[data-sonner-toast]属性のli要素でトーストを表示する。
 */
export async function waitForToast(page: Page, text: string | RegExp) {
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: text });
  await expect(toast.first()).toBeVisible({ timeout: 10_000 });
}
