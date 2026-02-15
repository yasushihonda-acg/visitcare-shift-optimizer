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
    await dialog.locator('#address').fill('東京都テスト区1-2-3');
    await dialog.locator('#location\\.lat').fill('35.6895');
    await dialog.locator('#location\\.lng').fill('139.6917');

    // 保存
    await dialog.getByRole('button', { name: '保存' }).click();

    // 成功トースト
    await waitForToast(page, '利用者を追加しました');

    // テーブルに新規行が表示される
    await expect(page.getByRole('cell', { name: /テスト/ })).toBeVisible({ timeout: 5_000 });
  });

  test('利用者を編集できる', async ({ page }) => {
    await goToMasters(page, 'customers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

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

    // テーブルに新規行が表示される
    await expect(page.getByRole('cell', { name: /E2E/ })).toBeVisible({ timeout: 5_000 });
  });

  test('ヘルパーを編集できる', async ({ page }) => {
    await goToMasters(page, 'helpers');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

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

    // スタッフ選択
    const staffSelect = dialog.locator('[role="combobox"]').first();
    await staffSelect.click();
    // ドロップダウンの最初のオプションを選択
    const firstOption = page.locator('[role="option"]').first();
    await firstOption.click();

    // 不在スロットを追加
    await dialog.getByRole('button', { name: '追加' }).click();

    // 保存
    await dialog.getByRole('button', { name: '保存' }).click();

    // 成功トースト
    await waitForToast(page, '希望休を登録しました');
  });

  test('希望休を削除できる', async ({ page }) => {
    await goToMasters(page, 'unavailability');
    await expect(page.getByRole('button', { name: /新規|追加/ })).toBeVisible({ timeout: 10_000 });

    // テーブルが存在し行がある場合のみ
    const rows = page.getByRole('row');
    const rowCount = await rows.count();
    if (rowCount <= 1) {
      // ヘッダー行のみ = データなし → 先に追加
      await page.getByRole('button', { name: /新規|追加/ }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const staffSelect = dialog.locator('[role="combobox"]').first();
      await staffSelect.click();
      const firstOption = page.locator('[role="option"]').first();
      await firstOption.click();

      await dialog.getByRole('button', { name: '追加' }).click();
      await dialog.getByRole('button', { name: '保存' }).click();
      await waitForToast(page, '希望休を登録しました');
      // ダイアログが閉じてテーブルが更新されるのを待つ
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
    }

    // 既存の行の編集ボタンをクリック
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
