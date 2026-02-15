import { test, expect } from '@playwright/test';
import { goToHistory } from './helpers';

test.describe('最適化履歴画面', () => {
  test('ヘッダーと見出しが表示される', async ({ page }) => {
    await goToHistory(page);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByText('最適化実行履歴')).toBeVisible();
  });

  test('戻るボタンでスケジュール画面に遷移できる', async ({ page }) => {
    await goToHistory(page);
    await page.getByRole('link', { name: /戻る/ }).click();
    await expect(page).toHaveURL('/');
  });

  test('テーブル・空状態・エラーのいずれかが表示される', async ({ page }) => {
    await goToHistory(page);
    // API未起動時はエラー、データなしは空メッセージ、データありはテーブル
    const table = page.getByRole('table');
    const emptyMessage = page.getByText('最適化の実行履歴はまだありません');
    const errorMessage = page.getByText(/履歴の取得に失敗しました/);
    await expect(table.or(emptyMessage).or(errorMessage)).toBeVisible({ timeout: 10_000 });
  });
});
