import { test, expect } from '@playwright/test';
import { goToSchedule } from './helpers';

test.describe('スケジュール画面', () => {
  test('ヘッダーとブランド名が表示される', async ({ page }) => {
    await goToSchedule(page);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByText('VisitCare')).toBeVisible();
  });

  test('曜日タブが7つ表示される', async ({ page }) => {
    await goToSchedule(page);
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(7);
    await expect(tabs.nth(0)).toContainText('月');
    await expect(tabs.nth(6)).toContainText('日');
  });

  test('曜日タブをクリックすると選択状態が変わる', async ({ page }) => {
    await goToSchedule(page);
    const tuesdayTab = page.getByRole('tab', { name: /火/ });
    await tuesdayTab.click();
    await expect(tuesdayTab).toHaveAttribute('aria-selected', 'true');
  });

  test('統計バー（StatsBar）が表示される', async ({ page }) => {
    await goToSchedule(page);
    await expect(page.getByText('オーダー', { exact: true })).toBeVisible();
    await expect(page.getByText('割当済', { exact: true })).toBeVisible();
  });

  test('最適化ボタンが存在する', async ({ page }) => {
    await goToSchedule(page);
    await expect(page.getByRole('button', { name: /最適化/ })).toBeVisible();
  });

  test('ヘッダーのドロップダウンメニューが開ける', async ({ page }) => {
    await goToSchedule(page);
    // Settings アイコンボタン（ヘッダー内の最後のボタン）
    const menuTrigger = page.locator('header button').last();
    await menuTrigger.click();
    await expect(page.getByText('利用者マスタ')).toBeVisible();
    await expect(page.getByText('ヘルパーマスタ')).toBeVisible();
    await expect(page.getByText('実行履歴')).toBeVisible();
  });

  test('メニューから履歴画面へ遷移できる', async ({ page }) => {
    await goToSchedule(page);
    // ドロップダウンメニューを開く
    const menuTrigger = page.locator('header button').last();
    await menuTrigger.click();
    await page.getByText('実行履歴').click();
    await expect(page).toHaveURL(/\/history/);
  });
});
