import { test, expect } from '@playwright/test';
import { goToSchedule, goToSettings } from './helpers';

test.describe('設定画面', () => {
  test.describe.configure({ retries: 2, timeout: 60_000 });

  test('設定ページが表示される（タイトル・通知設定カード）', async ({ page }) => {
    await goToSettings(page);

    await expect(page.getByRole('heading', { name: '設定' })).toBeVisible();
    await expect(page.getByText('通知設定').first()).toBeVisible();
    await expect(page.getByLabel('送信元メールアドレス')).toBeVisible();
  });

  test('デモモードでは入力が読み取り専用になる', async ({ page }) => {
    await goToSettings(page);

    // デモモードは admin ロールなし（customClaims 未設定の匿名ユーザー）
    // → isAdmin = false → input が disabled（readOnly）
    const input = page.getByLabel('送信元メールアドレス');
    await expect(input).toBeDisabled();

    // 保存ボタンが表示されないことを確認
    await expect(page.getByRole('button', { name: '保存' })).toHaveCount(0);
  });

  test('ヘッダーメニューから通知設定ページへ遷移できる', async ({ page }) => {
    await goToSchedule(page);

    // Settings アイコンボタン（ヘッダー内の最後のボタン）でドロップダウンを開く
    const menuTrigger = page.locator('header button').last();
    await menuTrigger.click();

    // 「通知設定」リンクをクリック
    await page.getByText('通知設定').click();

    // /settings ページに遷移していることを URL で確認
    // （SPA ナビゲーション後に dev overlay が出る場合があるため、URL のみ検証）
    await expect(page).toHaveURL(/\/settings/, { timeout: 10_000 });
  });
});
