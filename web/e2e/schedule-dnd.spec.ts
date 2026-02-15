import { test, expect } from '@playwright/test';
import { goToSchedule, waitForGanttBars, dragOrderToTarget } from './helpers';

test.describe('スケジュール画面 D&D', { tag: '@dnd' }, () => {
  // D&Dテストはフレーキーになりやすいため、ローカルでもリトライを設定
  test.describe.configure({ retries: 2 });

  test('ガントバーをドラッグ開始するとopacityが変化する', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    const firstBar = page.locator('[data-testid^="gantt-bar-"]').first();
    const box = await firstBar.boundingBox();
    if (!box) throw new Error('Could not get bounding box');

    // ドラッグ開始（mousedown + 5px以上移動）
    await firstBar.hover();
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 15, box.y + box.height / 2 + 15, { steps: 5 });

    // isDragging状態ではopacity-50クラスが付く
    await expect(firstBar).toHaveCSS('opacity', '0.5');

    // ドラッグキャンセル
    await page.keyboard.press('Escape');
  });

  test('ヘルパー行間でオーダーをドラッグ&ドロップして移動できる', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    const ganttRows = page.locator('[data-testid^="gantt-row-"]');
    const rowCount = await ganttRows.count();
    if (rowCount < 2) {
      test.skip(true, 'ヘルパー行が2つ未満のためスキップ');
      return;
    }

    // 最初の行にあるバーを取得
    const firstRow = ganttRows.first();
    const firstRowBar = firstRow.locator('[data-testid^="gantt-bar-"]').first();
    const barTestId = await firstRowBar.getAttribute('data-testid');
    if (!barTestId) {
      test.skip(true, '最初の行にオーダーがないためスキップ');
      return;
    }

    // 2番目の行にドロップ
    const secondRow = ganttRows.nth(1);
    await dragOrderToTarget(page, firstRowBar, secondRow);

    // ドロップ後、新しい行にバーが表示される（状態ベース待機）
    const movedBar = secondRow.locator(`[data-testid="${barTestId}"]`);
    await expect(movedBar).toBeVisible({ timeout: 5_000 });
  });

  test('割当済みオーダーを未割当セクションにドロップして割当解除できる', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    const firstBar = page.locator('[data-testid^="gantt-bar-"]').first();
    const barTestId = await firstBar.getAttribute('data-testid');
    const orderId = barTestId?.replace('gantt-bar-', '');

    const unassignedSection = page.locator('[data-testid="unassigned-section"]');

    await dragOrderToTarget(page, firstBar, unassignedSection);

    // 未割当セクションに移動したオーダーが表示される（状態ベース待機）
    if (orderId) {
      await expect(
        page.locator(`[data-testid="unassigned-order-${orderId}"]`)
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('未割当オーダーをヘルパー行にドロップして割当できる', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    const unassignedOrders = page.locator('[data-testid^="unassigned-order-"]');
    const unassignedCount = await unassignedOrders.count();
    if (unassignedCount === 0) {
      test.skip(true, '未割当オーダーがないためスキップ');
      return;
    }

    const firstUnassigned = unassignedOrders.first();
    const testId = await firstUnassigned.getAttribute('data-testid');
    const orderId = testId?.replace('unassigned-order-', '');

    const targetRow = page.locator('[data-testid^="gantt-row-"]').first();

    await dragOrderToTarget(page, firstUnassigned, targetRow);

    // ヘルパー行にガントバーとして表示される（状態ベース待機）
    if (orderId) {
      await expect(
        targetRow.locator(`[data-testid="gantt-bar-${orderId}"]`)
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('ドラッグ中にEscapeキーで元の位置に戻る', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    const firstBar = page.locator('[data-testid^="gantt-bar-"]').first();
    const barTestId = await firstBar.getAttribute('data-testid');

    const box = await firstBar.boundingBox();
    if (!box) throw new Error('Could not get bounding box');

    // ドラッグ開始
    await firstBar.hover();
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50, { steps: 5 });

    // ドラッグキャンセル
    await page.keyboard.press('Escape');

    // 元の位置にバーが残っている
    if (barTestId) {
      const bar = page.locator(`[data-testid="${barTestId}"]`);
      await expect(bar).toBeVisible();
      // opacity が元に戻っている（opacity-50クラスが外れる）
      await expect(bar).not.toHaveCSS('opacity', '0.5');
    }
  });
});
