import { test, expect } from '@playwright/test';
import { goToMasters } from './helpers';

test.describe('利用者マスタ 詳細シート', () => {
  test.describe.configure({ retries: 1, timeout: 30_000 });

  test('行をクリックすると詳細シートが開く', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // 最初のデータ行（ヘッダーを除く）をクリック
    const firstDataRow = page.getByRole('row').nth(1);
    await firstDataRow.click();

    await expect(page.locator('[data-testid="customer-detail-sheet"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('詳細シートに基本情報セクションが表示される', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('row').nth(1).click();

    const sheet = page.locator('[data-testid="customer-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // 住所・サ責などの基本情報セクション（ラベル要素のみにマッチさせるため exact: true）
    await expect(sheet.getByText('基本情報')).toBeVisible();
    await expect(sheet.getByText('住所', { exact: true })).toBeVisible();
    await expect(sheet.getByText('サ責', { exact: true })).toBeVisible();
  });

  test('詳細シートをEscapeキーで閉じられる', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('row').nth(1).click();

    const sheet = page.locator('[data-testid="customer-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden({ timeout: 5_000 });
  });

  test('詳細シートの編集ボタンをクリックするとEditDialogが開く', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('row').nth(1).click();

    const sheet = page.locator('[data-testid="customer-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    // Sheetのスライドインアニメーション完了を待つ
    await page.waitForTimeout(600);

    // 詳細シート内の「編集」ボタンをクリック（JavaScriptで直接実行してアニメーション中の座標ずれを回避）
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>('[data-testid="customer-detail-edit-button"]');
      btn?.click();
    });

    // シートが閉じてEditDialogが開く
    await expect(sheet).toBeHidden({ timeout: 5_000 });
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  });

  test('行のPencilボタンは詳細シートを経由せず直接EditDialogを開く', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // 行内のボタン（Pencilアイコンボタン）を直接クリック
    const firstDataRow = page.getByRole('row').nth(1);
    const pencilButton = firstDataRow.locator('button').last();
    await pencilButton.click({ force: true });

    // 詳細シートは開かず、EditDialogが直接表示される
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-testid="customer-detail-sheet"]'),
    ).toBeHidden();
  });

  test('入れるスタッフを持つ利用者の詳細シートにスタッフ制約セクションが表示される', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // 「山田 太郎」（C001: allowed_staff_ids あり）の行をクリック
    const row = page.getByRole('row').filter({ hasText: /山田.*太郎/ }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.click();

    const sheet = page.locator('[data-testid="customer-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // 「入れるスタッフ」バッジセクションが表示される
    await expect(sheet.locator('[data-testid="allowed-staff-badges"]')).toBeVisible();
  });
});

test.describe('ヘルパーマスタ 詳細シート', () => {
  test.describe.configure({ retries: 1, timeout: 30_000 });

  test('行をクリックすると詳細シートが開く', async ({ page }) => {
    await goToMasters(page, 'helpers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    const firstDataRow = page.getByRole('row').nth(1);
    await firstDataRow.click();

    await expect(page.locator('[data-testid="helper-detail-sheet"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('ヘルパー詳細シートに基本情報セクションが表示される', async ({ page }) => {
    await goToMasters(page, 'helpers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('row').nth(1).click();

    const sheet = page.locator('[data-testid="helper-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    await expect(sheet.getByText('基本情報')).toBeVisible();
  });
});
