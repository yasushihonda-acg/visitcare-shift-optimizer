import { test, expect } from '@playwright/test';
import { goToMasters, waitForToast } from './helpers';

test.describe('利用者マスタ CRUD', () => {
  test('利用者を新規追加できる', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // 新規追加ダイアログを開く
    await page.getByRole('button', { name: /新規|追加/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('利用者を追加')).toBeVisible();

    // フォーム入力
    await dialog.locator('#name\\.family').fill('テスト');
    await dialog.locator('#name\\.given').fill('太郎');
    await dialog.locator('#service_manager').fill('テストサ責');
    await dialog.locator('#address').fill('東京都テスト区1-2-3');
    await dialog.locator('#location\\.lat').fill('35.6895');
    await dialog.locator('#location\\.lng').fill('139.6917');

    // 保存
    await dialog.getByRole('button', { name: '保存' }).click();

    // 成功トースト
    await waitForToast(page, '利用者を追加しました');

    // テーブルに新規行が表示される（リトライで複数行ありえるため.first()）
    await expect(page.getByRole('cell', { name: /テスト\s*太郎/ }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('利用者を編集できる', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
    // データ行がロードされるまで待機
    await page.getByRole('row').nth(1).waitFor({ timeout: 15_000 });

    // 最初の行の編集ボタン（Pencilアイコン）をクリック
    const editButton = page.getByRole('row').nth(1).getByRole('button').first();
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('利用者を編集')).toBeVisible();

    // 住所を変更（fill()は自動的にクリア→入力を行う）
    await dialog.locator('#address').fill('東京都更新区9-9-9');

    // 保存
    await dialog.getByRole('button', { name: '保存' }).click();

    // 成功トースト
    await waitForToast(page, '利用者情報を更新しました');
  });
});

test.describe('ヘルパーマスタ CRUD', () => {
  test('ヘルパーを新規追加できる', async ({ page }) => {
    await goToMasters(page, 'helpers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // 新規追加ダイアログを開く
    await page.getByRole('button', { name: /新規|追加/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('ヘルパーを追加')).toBeVisible();

    // 基本情報の入力
    await dialog.locator('#name\\.family').fill('E2E');
    await dialog.locator('#name\\.given').fill('テスト');

    // 保存
    await dialog.getByRole('button', { name: '保存' }).click();

    // 成功トースト
    await waitForToast(page, 'ヘルパーを追加しました');

    // テーブルに新規行が表示される（リトライで複数行ありえるため.first()）
    await expect(page.getByRole('cell', { name: /E2E\s*テスト/ }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('ヘルパーを編集できる', async ({ page }) => {
    await goToMasters(page, 'helpers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
    // データ行がロードされるまで待機
    await page.getByRole('row').nth(1).waitFor({ timeout: 15_000 });

    // 最初の行の編集ボタンをクリック
    const editButton = page.getByRole('row').nth(1).getByRole('button').first();
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('ヘルパーを編集')).toBeVisible();

    // 身体介護対応可チェックボックスをトグル
    const physicalCareCheckbox = dialog.getByLabel('身体介護対応可');
    await physicalCareCheckbox.click();

    // 保存
    await dialog.getByRole('button', { name: '保存' }).click();

    // 成功トースト
    await waitForToast(page, 'ヘルパー情報を更新しました');
  });
});

test.describe('希望休管理 CRUD', () => {
  test('希望休を新規追加できる', async ({ page }) => {
    await goToMasters(page, 'unavailability');
    await expect(page.getByRole('button', { name: /新規|追加/ })).toBeVisible({ timeout: 10_000 });

    // 新規追加ダイアログを開く
    await page.getByRole('button', { name: /新規|追加/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('希望休を追加')).toBeVisible();

    // スタッフ選択（Radix UI Select: trigger→portal listbox→option）
    const staffTrigger = dialog.locator('[role="combobox"]').first();
    await staffTrigger.click();
    // ドロップダウンがPortalで表示されるまで待機
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5_000 });
    // オプションが操作可能になるまで待機してクリック
    const firstOption = listbox.locator('[role="option"]').first();
    await expect(firstOption).toBeVisible();
    await firstOption.click();
    // ドロップダウンが閉じるのを待機（選択成功の指標）
    await expect(listbox).toBeHidden({ timeout: 3_000 });

    // 不在スロットを追加し、スロットが表示されるのを確認
    await dialog.getByRole('button', { name: '追加' }).click();
    await expect(dialog.getByText(/終日/)).toBeVisible({ timeout: 3_000 });

    // 保存
    await dialog.getByRole('button', { name: '保存' }).click();

    // 成功トースト
    await waitForToast(page, '希望休を登録しました');
  });

  test('希望休を削除できる', async ({ page }) => {
    await goToMasters(page, 'unavailability');
    await expect(page.getByRole('button', { name: /新規|追加/ })).toBeVisible({ timeout: 10_000 });

    // データ行がない場合は先に追加する
    const hasDataRow = await page.getByRole('row').nth(1).isVisible().catch(() => false);
    if (!hasDataRow) {
      await page.getByRole('button', { name: /新規|追加/ }).click();
      const addDialog = page.getByRole('dialog');
      await expect(addDialog).toBeVisible();

      const staffTrigger = addDialog.locator('[role="combobox"]').first();
      await staffTrigger.click();
      const listbox = page.locator('[role="listbox"]');
      await expect(listbox).toBeVisible({ timeout: 5_000 });
      const firstOpt = listbox.locator('[role="option"]').first();
      await expect(firstOpt).toBeVisible();
      await firstOpt.click();
      await expect(listbox).toBeHidden({ timeout: 3_000 });

      await addDialog.getByRole('button', { name: '追加' }).click();
      await expect(addDialog.getByText(/終日/)).toBeVisible({ timeout: 3_000 });
      await addDialog.getByRole('button', { name: '保存' }).click();
      await waitForToast(page, '希望休を登録しました');
      await expect(addDialog).toBeHidden({ timeout: 5_000 });
    }

    // データ行の編集ボタンをクリック
    await page.getByRole('row').nth(1).waitFor({ timeout: 10_000 });
    const editButton = page.getByRole('row').nth(1).getByRole('button').first();
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 削除ボタンをクリック
    await dialog.getByRole('button', { name: '削除' }).click();

    // 成功トースト
    await waitForToast(page, '希望休を削除しました');
  });
});
