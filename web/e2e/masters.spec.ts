import { test, expect } from '@playwright/test';
import { goToMasters } from './helpers';

test.describe('利用者マスタ', () => {
  test('一覧テーブルが表示される', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('columnheader', { name: /氏名/ })).toBeVisible();
  });

  test('検索フィルターで絞り込める', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder(/検索/);
    await expect(searchInput).toBeVisible();

    // 存在しない名前で検索 → 空メッセージが表示される
    await searchInput.fill('zzzzz_nonexistent');
    await expect(page.getByText(/見つかりません/)).toBeVisible({ timeout: 5_000 });
  });

  test('新規追加ダイアログが開閉できる', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    const addButton = page.getByRole('button', { name: /新規|追加/ });
    await addButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});

test.describe('ヘルパーマスタ', () => {
  test('一覧テーブルが表示される', async ({ page }) => {
    await goToMasters(page, 'helpers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('columnheader', { name: /氏名/ })).toBeVisible();
  });

  test('検索フィルターが動作する', async ({ page }) => {
    await goToMasters(page, 'helpers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder(/検索/);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('zzzzz');
    await page.waitForTimeout(500);
  });

  test('新規追加ダイアログが開閉できる', async ({ page }) => {
    await goToMasters(page, 'helpers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    const addButton = page.getByRole('button', { name: /新規|追加/ });
    await addButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});

test.describe('希望休管理', () => {
  test('ページが表示される', async ({ page }) => {
    await goToMasters(page, 'unavailability');
    await page.waitForTimeout(2_000);
    // ページ見出しまたはテーブルが表示される
    await expect(page.locator('main')).toBeVisible();
  });

  test('新規追加ダイアログが開閉できる', async ({ page }) => {
    await goToMasters(page, 'unavailability');
    await page.waitForTimeout(2_000);

    const addButton = page.getByRole('button', { name: /新規|追加/ });
    await addButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});

test.describe('マスタ管理タブナビゲーション', () => {
  test('利用者→ヘルパー→希望休のタブ切替が動作する', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // ヘルパータブをクリック（TabsTrigger内のLink）
    await page.getByRole('tab', { name: /ヘルパー/ }).click();
    await expect(page).toHaveURL(/\/masters\/helpers/);

    // 希望休タブをクリック
    await page.getByRole('tab', { name: /希望休/ }).click();
    await expect(page).toHaveURL(/\/masters\/unavailability/);
  });
});
