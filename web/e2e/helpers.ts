import { type Page, expect } from '@playwright/test';

/**
 * Firebase Auth（匿名認証）完了を待機する。
 * demo mode では自動的に匿名サインインが走るので、
 * ローディング画面（「認証中...」）が消えるのを待つ。
 */
export async function waitForAuth(page: Page) {
  // 「認証中...」テキストが消えるまで待つ（最大10秒）
  await expect(page.getByText('認証中...')).toBeHidden({ timeout: 10_000 });
}

/**
 * スケジュール画面（トップページ）に遷移して認証完了を待つ
 */
export async function goToSchedule(page: Page) {
  await page.goto('/');
  await waitForAuth(page);
}

/**
 * マスタ管理画面に遷移して認証完了を待つ
 */
export async function goToMasters(page: Page, tab: 'customers' | 'helpers' | 'unavailability') {
  await page.goto(`/masters/${tab}/`);
  await waitForAuth(page);
}

/**
 * 履歴画面に遷移して認証完了を待つ
 */
export async function goToHistory(page: Page) {
  await page.goto('/history/');
  await waitForAuth(page);
}
