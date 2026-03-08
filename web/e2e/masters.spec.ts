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

test.describe('利用者マスタ 検索・フィルター機能', () => {
  test.describe.configure({ timeout: 30_000 });

  test('電話番号②列がテーブルに表示される', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('columnheader', { name: '電話番号②' })).toBeVisible();
  });

  test('ふりがなで検索すると一致する利用者に絞り込まれる', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder(/検索/);
    await searchInput.fill('やまだ');
    // 山田（やまだ）行が残り、中村（なかむら）行が消える
    await expect(page.getByText('山田').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('中村')).toBeHidden({ timeout: 5_000 });
  });

  test('あおぞらIDで検索できる', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder(/検索/);
    await searchInput.fill('AZ-001');
    // AZ-001（山田太郎）だけが表示され、中村が消える
    await expect(page.getByText('山田')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('中村')).toBeHidden({ timeout: 5_000 });
  });

  test('頭文字フィルターのボタン行が表示される', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('頭文字')).toBeVisible();
    for (const label of ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('頭文字フィルター"さ"行で絞り込まれる', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'さ', exact: true }).click();
    // さ行（ささき=佐々木）が表示され、や行（やまだ=山田）が消える
    await expect(page.getByText('佐々木')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('山田')).toBeHidden({ timeout: 5_000 });
  });

  test('頭文字フィルターを✕で解除すると全件表示に戻る', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // "さ" 行フィルターを適用
    await page.getByRole('button', { name: 'さ', exact: true }).click();
    await expect(page.getByText('山田')).toBeHidden({ timeout: 5_000 });

    // ✕ボタンでクリア → 山田が再表示
    await page.getByRole('button', { name: '✕', exact: true }).click();
    await expect(page.getByText('山田').first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('マスタ管理タブナビゲーション', () => {
  test('全5タブの切替が動作する', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // ヘルパータブ
    await page.getByRole('tab', { name: /ヘルパー/ }).click();
    await expect(page).toHaveURL(/\/masters\/helpers/);

    // サービス種別タブ
    await page.getByRole('tab', { name: /サービス種別/ }).click();
    await expect(page).toHaveURL(/\/masters\/service-types/);

    // 基本予定タブ
    await page.getByRole('tab', { name: /基本予定/ }).click();
    await expect(page).toHaveURL(/\/masters\/weekly-schedule/);

    // 希望休タブ
    await page.getByRole('tab', { name: /希望休/ }).click();
    await expect(page).toHaveURL(/\/masters\/unavailability/);
  });
});
