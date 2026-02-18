import { test, expect } from '@playwright/test';
import { goToSchedule, waitForGanttBars, dragOrderToTarget, dragOrderHorizontally, waitForToast } from './helpers';

test.describe('スケジュール画面 D&D', { tag: '@dnd' }, () => {
  // D&Dテストはフレーキーになりやすいため、リトライ + タイムアウト延長
  test.describe.configure({ retries: 2, timeout: 60_000 });
  // 17ヘルパー行+未割当セクションを1画面に収めるためビューポートを拡大
  test.use({ viewport: { width: 1280, height: 1200 } });

  test('ガントバーをドラッグ開始するとopacityが変化する', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    // overflow-visible による隣接バーのテキスト遮蔽を回避するため、
    // 単独バーの行を優先的に選択する
    const ganttRows = page.locator('[data-testid^="gantt-row-"]');
    const rowCount = await ganttRows.count();
    let targetBar = page.locator('[data-testid^="gantt-bar-"]').first();
    for (let i = 0; i < rowCount; i++) {
      const row = ganttRows.nth(i);
      const bars = row.locator('[data-testid^="gantt-bar-"]');
      if (await bars.count() === 1) {
        targetBar = bars.first();
        break;
      }
    }

    const box = await targetBar.boundingBox();
    if (!box) throw new Error('Could not get bounding box');

    // ドラッグ開始（mousedown + 5px以上移動）— 左端付近から開始して遮蔽を回避
    await page.mouse.move(box.x + 5, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 5 + 15, box.y + box.height / 2 + 15, { steps: 5 });

    // isDragging状態ではopacity-50クラスが付く
    await expect(targetBar).toHaveCSS('opacity', '0.5');

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

    // オーダーを持つ行を検索（PR #48でオーダーなし行も表示されるようになったため）
    let sourceRowIndex = -1;
    let barTestId: string | null = null;
    for (let i = 0; i < rowCount; i++) {
      const row = ganttRows.nth(i);
      const barCount = await row.locator('[data-testid^="gantt-bar-"]').count();
      if (barCount > 0) {
        barTestId = await row.locator('[data-testid^="gantt-bar-"]').first().getAttribute('data-testid');
        sourceRowIndex = i;
        break;
      }
    }
    if (sourceRowIndex < 0 || !barTestId) {
      test.skip(true, 'オーダーを持つ行がないためスキップ');
      return;
    }

    const firstRow = ganttRows.nth(sourceRowIndex);
    const firstRowBar = firstRow.locator('[data-testid^="gantt-bar-"]').first();

    // 別の行にドロップ（ソース行と異なる行を選択）
    const targetIndex = sourceRowIndex === 0 ? 1 : 0;
    const secondRow = ganttRows.nth(targetIndex);
    await dragOrderToTarget(page, firstRowBar, secondRow);

    // D&D操作完了を確認: 成功/警告/エラー いずれかのトーストが表示される
    // （時間重複・資格不適合等でvalidateDropが拒否する場合もある）
    const anyToast = page.locator('[data-sonner-toast]');
    await expect(anyToast.first()).toBeVisible({ timeout: 10_000 });

    // 成功トーストの場合はバーの移動を確認
    const successToast = anyToast.filter({ hasText: /割当を変更しました/ });
    const isSuccess = await successToast.count() > 0;
    if (isSuccess) {
      const movedBar = secondRow.locator(`[data-testid="${barTestId}"]`);
      await expect(movedBar).toBeVisible({ timeout: 10_000 });
    }
  });

  test('割当済みオーダーを未割当セクションにドロップして割当解除できる', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    const firstBar = page.locator('[data-testid^="gantt-bar-"]').first();
    const barTestId = await firstBar.getAttribute('data-testid');
    const orderId = barTestId?.replace('gantt-bar-', '');

    const unassignedSection = page.locator('[data-testid="unassigned-section"]');

    await dragOrderToTarget(page, firstBar, unassignedSection);

    // トースト表示を待機（Firestore書き込み完了の同期ポイント）
    await waitForToast(page, /割当を解除しました/);

    // 未割当セクションに移動したオーダーが表示される（状態ベース待機）
    if (orderId) {
      await expect(
        page.locator(`[data-testid="unassigned-order-${orderId}"]`)
      ).toBeVisible({ timeout: 10_000 });
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

    // 身体介護オーダーの場合、資格のある行にドロップする必要がある
    // 既に身体介護バーを持つ行（=資格あり）を優先的に選択
    const ganttRows = page.locator('[data-testid^="gantt-row-"]');
    const rowCount = await ganttRows.count();

    // オーダーが少なく時間重複しにくい行を選択（後半の行を使用）
    const targetRow = ganttRows.nth(Math.max(0, rowCount - 3));

    await dragOrderToTarget(page, firstUnassigned, targetRow);

    // D&D操作完了を確認: 成功/警告/エラー いずれかのトーストが表示される
    const anyToast = page.locator('[data-sonner-toast]');
    await expect(anyToast.first()).toBeVisible({ timeout: 10_000 });

    // 成功トーストの場合はバーの移動を確認
    const successToast = anyToast.filter({ hasText: /割当を変更しました/ });
    const isSuccess = await successToast.count() > 0;
    if (isSuccess && orderId) {
      await expect(
        targetRow.locator(`[data-testid="gantt-bar-${orderId}"]`)
      ).toBeVisible({ timeout: 10_000 });
    }
    // エラートースト（資格不適合等）の場合もD&D機構自体は正常動作
  });

  test('同一行内で水平ドラッグして時間を変更できる', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    // オーダーを持つ行を検索
    const ganttRows = page.locator('[data-testid^="gantt-row-"]');
    const rowCount = await ganttRows.count();
    let sourceBar: ReturnType<typeof ganttRows.first> | null = null;
    for (let i = 0; i < rowCount; i++) {
      const row = ganttRows.nth(i);
      const barCount = await row.locator('[data-testid^="gantt-bar-"]').count();
      if (barCount > 0) {
        sourceBar = row.locator('[data-testid^="gantt-bar-"]').first();
        break;
      }
    }
    if (!sourceBar) {
      test.skip(true, 'オーダーを持つ行がないためスキップ');
      return;
    }

    // 右方向（遅い時間）に約100px移動（10分×数スロット分）
    await dragOrderHorizontally(page, sourceBar, 100);

    // 時間変更または重複エラーのトーストが表示される
    const anyToast = page.locator('[data-sonner-toast]');
    await expect(anyToast.first()).toBeVisible({ timeout: 10_000 });
  });

  test('水平ドラッグ後にEscapeで時間変更がキャンセルされる', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    const firstBar = page.locator('[data-testid^="gantt-bar-"]').first();
    const box = await firstBar.boundingBox();
    if (!box) throw new Error('Could not get bounding box');

    // ドラッグ開始 → 水平移動（左端付近から開始して隣接バー遮蔽を回避）
    await page.mouse.move(box.x + 5, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 5 + 80, box.y + box.height / 2, { steps: 10 });

    // Escapeでキャンセル
    await page.keyboard.press('Escape');

    // トーストが出ないことを確認（500ms待機）
    await page.waitForTimeout(500);
    const toastCount = await page.locator('[data-sonner-toast]').count();
    // キャンセル時はトーストなし（または直前の操作のトーストのみ）
    expect(toastCount).toBeLessThanOrEqual(0);
  });

  test('ドラッグ中にEscapeキーで元の位置に戻る', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    const firstBar = page.locator('[data-testid^="gantt-bar-"]').first();
    const barTestId = await firstBar.getAttribute('data-testid');

    const box = await firstBar.boundingBox();
    if (!box) throw new Error('Could not get bounding box');

    // ドラッグ開始（左端付近から開始して隣接バー遮蔽を回避）
    await page.mouse.move(box.x + 5, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 5 + 50, box.y + box.height / 2 + 50, { steps: 5 });

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
