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

  test('NGスタッフのバッジが詳細シートに表示される', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // C004（小林よし子, AZ-004）を検索
    const searchInput = page.getByPlaceholder('あおぞらID・名前・ふりがな・住所・ケアマネで検索...');
    await searchInput.fill('AZ-004');
    await page.waitForTimeout(500);

    // C004の行をクリック
    const row = page.getByRole('row').filter({ hasText: '小林' });
    await row.first().click();

    const sheet = page.locator('[data-testid="customer-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // NGスタッフバッジが表示される（H006: 伊藤翔太, H014: 井上和也）
    const ngBadges = sheet.locator('[data-testid="ng-staff-badges"]');
    await expect(ngBadges).toBeVisible();
    await expect(ngBadges.getByText('伊藤 翔太')).toBeVisible();
  });

  test('同一世帯メンバーが詳細シートに表示される', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // C001（山田太郎, AZ-001）を検索
    const searchInput = page.getByPlaceholder('あおぞらID・名前・ふりがな・住所・ケアマネで検索...');
    await searchInput.fill('AZ-001');
    await page.waitForTimeout(500);

    const row = page.getByRole('row').filter({ hasText: '山田' });
    await row.first().click();

    const sheet = page.locator('[data-testid="customer-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // 同一世帯セクションにC002（山田花子）が表示される
    await expect(sheet.getByText('同一世帯')).toBeVisible();
    await expect(sheet.getByText('山田 花子')).toBeVisible();
  });

  test('同一施設メンバーが詳細シートに表示される', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // C018（池田政夫, AZ-018）を検索 — C043と同一住所だが世帯関係なし → 施設グループ
    const searchInput = page.getByPlaceholder('あおぞらID・名前・ふりがな・住所・ケアマネで検索...');
    await searchInput.fill('AZ-018');
    await page.waitForTimeout(500);

    const row = page.getByRole('row').filter({ hasText: '池田' });
    await row.first().click();

    const sheet = page.locator('[data-testid="customer-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // 同一施設セクションにC043（中島喜一）が表示される
    await expect(sheet.getByText('同一施設')).toBeVisible();
    await expect(sheet.getByText('中島 喜一').first()).toBeVisible();
  });

  test('週間サービスが詳細シートに表示される', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // C001（山田太郎, AZ-001）を検索
    const searchInput = page.getByPlaceholder('あおぞらID・名前・ふりがな・住所・ケアマネで検索...');
    await searchInput.fill('AZ-001');
    await page.waitForTimeout(500);

    const row = page.getByRole('row').filter({ hasText: '山田' });
    await row.first().click();

    const sheet = page.locator('[data-testid="customer-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // 週間サービスセクションと曜日ラベルが表示される（C001は月/水/金にサービスあり）
    await expect(sheet.getByText('週間サービス')).toBeVisible();
    await expect(sheet.getByText('月')).toBeVisible();
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
