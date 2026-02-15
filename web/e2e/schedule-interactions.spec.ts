import { test, expect } from '@playwright/test';
import { goToSchedule, waitForGanttBars, mockOptimizerAPI, waitForToast } from './helpers';

test.describe('スケジュール画面インタラクション', () => {
  test('ガントバーをクリックするとOrderDetailPanelが開く', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    const firstBar = page.locator('[data-testid^="gantt-bar-"]').first();
    await firstBar.click();

    await expect(page.locator('[data-testid="order-detail-panel"]')).toBeVisible();
  });

  test('OrderDetailPanelに利用者名・時間・サービス種別が表示される', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    const firstBar = page.locator('[data-testid^="gantt-bar-"]').first();
    await firstBar.click();

    const panel = page.locator('[data-testid="order-detail-panel"]');
    await expect(panel).toBeVisible();

    // 時間セクション
    await expect(panel.getByText('時間')).toBeVisible();
    // サービス種別（身体介護 or 生活援助 or 介護予防 のいずれか）
    await expect(panel.getByText(/身体介護|生活援助|介護予防/)).toBeVisible();
    // ステータス（割当済 or 未割当）
    await expect(panel.getByText(/割当済|未割当/)).toBeVisible();
  });

  test('OrderDetailPanelをEscapeキーで閉じられる', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    const firstBar = page.locator('[data-testid^="gantt-bar-"]').first();
    await firstBar.click();

    const panel = page.locator('[data-testid="order-detail-panel"]');
    await expect(panel).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });

  test('最適化ボタンクリックでダイアログが開く', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    await page.getByRole('button', { name: /最適化/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('シフト最適化の実行')).toBeVisible();
  });

  test('最適化ダイアログにテスト実行・実行・キャンセルの3ボタンが表示される', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    await page.getByRole('button', { name: /最適化/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await expect(dialog.getByRole('button', { name: 'キャンセル' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'テスト実行' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '実行' })).toBeVisible();
  });

  test('最適化ダイアログをキャンセルで閉じられる', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    await page.getByRole('button', { name: /最適化/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'キャンセル' }).click();
    await expect(dialog).toBeHidden();
  });

  test('テスト実行（APIモック）で成功トーストが表示される', async ({ page }) => {
    await mockOptimizerAPI(page, {
      body: {
        status: 'optimal',
        total_orders: 25,
        assigned_count: 23,
        solve_time_seconds: 1.5,
        objective_value: 100,
        assignments: [],
        orders_updated: 23,
      },
    });

    await goToSchedule(page);
    await waitForGanttBars(page);

    await page.getByRole('button', { name: /最適化/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'テスト実行' }).click();

    await waitForToast(page, /最適化（テスト）完了/);
  });

  test('API失敗時（409）にエラートーストが表示される', async ({ page }) => {
    await mockOptimizerAPI(page, {
      status: 409,
      body: { detail: '別の最適化が実行中です' },
    });

    await goToSchedule(page);
    await waitForGanttBars(page);

    await page.getByRole('button', { name: /最適化/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'テスト実行' }).click();

    await waitForToast(page, /最適化不可/);
  });
});
