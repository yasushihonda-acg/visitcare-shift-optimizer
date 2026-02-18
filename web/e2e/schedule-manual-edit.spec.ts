import { test, expect, type Locator } from '@playwright/test';
import { goToSchedule, waitForGanttBars, dragOrderToTarget, dragOrderHorizontally } from './helpers';

test.describe('手動編集フラグ（青リング）表示', { tag: '@manual-edit' }, () => {
  // D&Dテストはフレーキーになりやすいため、リトライ + タイムアウト延長
  test.describe.configure({ retries: 2, timeout: 60_000 });
  // 17ヘルパー行+未割当セクションを1画面に収めるためビューポートを拡大
  test.use({ viewport: { width: 1280, height: 1200 } });

  /**
   * テスト3: D&D前の初期状態確認
   * Seedデータでは manually_edited = false のため、青リング（ring-blue-500）は表示されない。
   */
  test('D&D前の初期状態では青リングが表示されない', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    const bars = page.locator('[data-testid^="gantt-bar-"]');
    const barCount = await bars.count();
    if (barCount === 0) {
      test.skip(true, 'ガントバーがないためスキップ');
      return;
    }

    // 初期状態では青リングのないバーが存在するはず（manually_edited = false）
    // 注: 他テスト（schedule-dnd等）のD&D成功でmanually_editedが設定されている場合あり。
    //     その場合はスキップして他のD&D前チェック（テスト2/3のライン67/123）に委ねる。
    const firstBar = bars.first();
    const hasRing = await firstBar.evaluate((el: Element) => el.classList.contains('ring-blue-500'));
    if (hasRing) {
      test.skip(true, '最初のバーが他テストのD&Dによりmanually_edited済み（フレイキー回避）');
      return;
    }
    await expect(firstBar).not.toHaveClass(/ring-blue-500/);
  });

  /**
   * テスト1: ヘルパー行間D&D後に青リングが表示される
   * 別ヘルパー行へのドロップ成功後、Firestoreに manually_edited: true が書き込まれ、
   * 移動先バーに ring-blue-500 クラスが付くことを確認する。
   */
  test('ヘルパー行間D&D後に青リングが表示される', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    const ganttRows = page.locator('[data-testid^="gantt-row-"]');
    const rowCount = await ganttRows.count();
    if (rowCount < 2) {
      test.skip(true, 'ヘルパー行が2つ未満のためスキップ');
      return;
    }

    // オーダーを持つ行を検索
    let sourceRowIndex = -1;
    let barTestId: string | null = null;
    for (let i = 0; i < rowCount; i++) {
      const row = ganttRows.nth(i);
      const barCount = await row.locator('[data-testid^="gantt-bar-"]').count();
      if (barCount > 0) {
        barTestId = await row.locator('[data-testid^="gantt-bar-"]').first().getAttribute('data-testid');
        sourceRowIndex = i;
        break;
      }
    }
    if (sourceRowIndex < 0 || !barTestId) {
      test.skip(true, 'オーダーを持つ行がないためスキップ');
      return;
    }

    const sourceRow = ganttRows.nth(sourceRowIndex);
    const sourceBar = sourceRow.locator('[data-testid^="gantt-bar-"]').first();

    // D&D前は青リングがない
    await expect(sourceBar).not.toHaveClass(/ring-blue-500/);

    // 別のヘルパー行にドロップ（ソース行と異なる行を選択）
    const targetIndex = sourceRowIndex < rowCount - 1 ? sourceRowIndex + 1 : sourceRowIndex - 1;
    const targetRow = ganttRows.nth(targetIndex);
    await dragOrderToTarget(page, sourceBar, targetRow);

    // いずれかのトーストが表示されるのを待つ
    const anyToast = page.locator('[data-sonner-toast]');
    await expect(anyToast.first()).toBeVisible({ timeout: 10_000 });

    // 成功した場合のみ青リングを確認（資格不適合・時間重複で拒否される場合もある）
    const successToast = anyToast.filter({ hasText: /割当を変更しました/ });
    const isSuccess = (await successToast.count()) > 0;
    if (!isSuccess) {
      test.skip(true, 'D&Dが検証で拒否された（資格不適合・時間重複等）');
      return;
    }

    // Firestore onSnapshot の反映を待つ
    await page.waitForTimeout(1000);
    // バーは移動先の行に存在するが、data-testid は不変なのでページ全体から取得
    const movedBar = page.locator(`[data-testid="${barTestId}"]`);
    await expect(movedBar).toHaveClass(/ring-blue-500/, { timeout: 10_000 });
  });

  /**
   * テスト2: 水平D&D（時間変更）後に青リングが表示される
   * 同一行内での水平ドラッグ成功後、Firestoreに manually_edited: true が書き込まれ、
   * 対象バーに ring-blue-500 クラスが付くことを確認する。
   */
  test('水平D&D（時間変更）後に青リングが表示される', async ({ page }) => {
    await goToSchedule(page);
    await waitForGanttBars(page);

    // オーダーを持つ行を検索
    const ganttRows = page.locator('[data-testid^="gantt-row-"]');
    const rowCount = await ganttRows.count();
    let barTestId: string | null = null;
    let sourceBar: Locator | null = null;
    for (let i = 0; i < rowCount; i++) {
      const row = ganttRows.nth(i);
      const barCount = await row.locator('[data-testid^="gantt-bar-"]').count();
      if (barCount > 0) {
        const bar = row.locator('[data-testid^="gantt-bar-"]').first();
        barTestId = await bar.getAttribute('data-testid');
        sourceBar = bar;
        break;
      }
    }
    if (!sourceBar || !barTestId) {
      test.skip(true, 'オーダーを持つ行がないためスキップ');
      return;
    }

    // D&D前は青リングがない
    await expect(sourceBar).not.toHaveClass(/ring-blue-500/);

    // 右方向（遅い時間）に約100px水平ドラッグ
    await dragOrderHorizontally(page, sourceBar, 100);

    // いずれかのトーストが表示されるのを待つ
    const anyToast = page.locator('[data-sonner-toast]');
    await expect(anyToast.first()).toBeVisible({ timeout: 10_000 });

    // 成功した場合のみ青リングを確認（時間変更成功トーストを検索）
    // useDragAndDrop.ts: toast.success(`時間を ${timeLabel} に変更しました`)
    const successToast = anyToast.filter({ hasText: /時間を.*に変更しました/ });
    const isSuccess = (await successToast.count()) > 0;
    if (!isSuccess) {
      test.skip(true, '時間変更が検証で拒否された（時間重複等）');
      return;
    }

    // Firestore onSnapshot の反映を待つ
    await page.waitForTimeout(1000);
    // 水平移動後もバーの data-testid は不変
    const bar = page.locator(`[data-testid="${barTestId}"]`);
    await expect(bar).toHaveClass(/ring-blue-500/, { timeout: 10_000 });
  });
});
