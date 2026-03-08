import { type Page, type Locator, expect } from '@playwright/test';

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
  // Welcome ダイアログが表示されないよう、ページロード前に localStorage を設定
  await page.addInitScript(() => {
    localStorage.setItem('visitcare-welcome-shown', 'true');
  });
  await page.goto('/');
  await waitForAuth(page);
  // データロード完了を待つ（並列ワーカー実行時のFirestore負荷を考慮し45秒）
  await expect(page.getByText('読み込み中...')).toBeHidden({ timeout: 45_000 });
}

/**
 * マスタ管理画面に遷移して認証完了を待つ
 */
export async function goToMasters(page: Page, tab: 'customers' | 'helpers' | 'unavailability') {
  await page.addInitScript(() => {
    localStorage.setItem('visitcare-welcome-shown', 'true');
  });
  await page.goto(`/masters/${tab}/`);
  await waitForAuth(page);
}

/**
 * 設定画面に遷移して認証完了を待つ
 */
export async function goToSettings(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('visitcare-welcome-shown', 'true');
  });
  await page.goto('/settings');
  await waitForAuth(page);
}

/**
 * 履歴画面に遷移して認証完了を待つ
 */
export async function goToHistory(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('visitcare-welcome-shown', 'true');
  });
  await page.goto('/history/');
  await waitForAuth(page);
}

/**
 * スケジュール画面でガントバーが表示されるまで待機する。
 * CI環境ではFirestore 4コレクションのデータロードに時間がかかるため、
 * まず「読み込み中...」スピナーの消失（=データロード完了）を待つ。
 * Playwright config で timezoneId: 'Asia/Tokyo' を設定しているため、
 * Seedデータ（JST）とブラウザの週計算が一致する。
 */
export async function waitForGanttBars(page: Page) {
  const barLocator = page.locator('[data-testid^="gantt-bar-"]').first();
  // データロード完了を待つ
  await expect(page.getByText('読み込み中...')).toBeHidden({ timeout: 30_000 });
  await barLocator.waitFor({ timeout: 30_000 });
}

/**
 * staff_count > 1 のオーダーが複数ガント行に同一 data-testid で表示されるため、
 * 単独バーの行を優先的に選択して strict mode violation を回避する。
 * 見つからない場合は最初のバーにフォールバック。
 * @returns { bar, row } — 選択されたバーとその親行
 */
export async function findSingleBarInRow(page: Page): Promise<{ bar: Locator; row: Locator }> {
  const ganttRows = page.locator('[data-testid^="gantt-row-"]');

  // 全行のバー数を一括取得（N回の非同期呼び出し → 1回のevaluateに削減）
  const singleBarIndex = await page.evaluate(() => {
    const rows = document.querySelectorAll('[data-testid^="gantt-row-"]');
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].querySelectorAll('[data-testid^="gantt-bar-"]').length === 1) return i;
    }
    return -1;
  });

  if (singleBarIndex >= 0) {
    const row = ganttRows.nth(singleBarIndex);
    return { bar: row.locator('[data-testid^="gantt-bar-"]').first(), row };
  }

  // フォールバック: 最初のバーとその実際の親行を返す
  console.warn('findSingleBarInRow: no single-bar row found, falling back to first bar');
  const firstBar = page.locator('[data-testid^="gantt-bar-"]').first();
  // barの実際の親gantt-rowを取得（barとrowの不整合を防止）
  const parentRow = firstBar.locator('xpath=ancestor::*[starts-with(@data-testid,"gantt-row-")]').first();
  return { bar: firstBar, row: parentRow };
}

/**
 * 低レベルmouse制御でD&Dを実行する。
 * @dnd-kit PointerSensor (distance: 5px) を確実にトリガーするため、
 * 中間点を経由し、dragover発火のためdrop位置へ2回moveする。
 *
 * スクロール順: target→source の順でスクロールし、ドラッグ開始時に
 * source が必ずビューポート内に収まるようにする。
 * （source→target 順ではソースが押し出される場合がある）
 */
export async function dragOrderToTarget(page: Page, source: Locator, target: Locator) {
  // ターゲットを先にスクロール、次にソース（ソースをビューポート内に確保）
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await source.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  // スクロール後に bounding box を再取得（スクロールで座標が変わるため）
  const dragBox = await source.boundingBox();
  if (!dragBox) throw new Error('Could not get bounding box for drag source');

  // overflow-visible バーの隣接テキスト遮蔽を回避するため、ソースは左端付近を使用
  const startX = dragBox.x + 5;
  const startY = dragBox.y + dragBox.height / 2;

  // overflow-visible バーの重なりによる intercept を回避するため座標ベースで移動
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // PointerSensor の初期検出を待つ
  await page.waitForTimeout(100);
  // distance: 5px を確実に超えるため中間点を経由
  await page.mouse.move(startX + 10, startY + 10, { steps: 5 });

  // ドラッグ開始後にターゲットを再スクロール → 座標再取得
  // （ソースとターゲットが離れている場合、最初のスクロールでターゲットがビューポート外に出る）
  // NOTE: mousedown中のscrollIntoViewIfNeededはdnd-kitの座標deltaをずらすリスクがある。
  // ビューポートが十分大きい場合はスキップし、delta ずれを回避する。
  const preDropBox = await target.boundingBox();
  const viewportSize = page.viewportSize();
  const isTargetInViewport = preDropBox && viewportSize &&
    preDropBox.y >= 0 &&
    preDropBox.y + preDropBox.height <= viewportSize.height &&
    preDropBox.x >= 0 &&
    preDropBox.x + preDropBox.width <= viewportSize.width;
  if (!isTargetInViewport) {
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
  }
  const freshDropBox = await target.boundingBox();
  if (!freshDropBox) throw new Error('Could not get bounding box for drop target after scroll');

  const endX = freshDropBox.x + freshDropBox.width / 2;
  const endY = freshDropBox.y + freshDropBox.height / 2;

  await page.mouse.move(endX, endY, { steps: 20 });
  // dragover発火用に再度move
  await page.mouse.move(endX, endY);
  await page.mouse.up();
  // Firestore書き込み完了の待機は呼び出し元のトースト確認に委ねる
}

/**
 * Optimizer APIのレスポンスをモックする。
 * CI環境ではOptimizer APIが起動していないため、route interceptionで対応。
 */
export async function mockOptimizerAPI(
  page: Page,
  response: { status?: number; body: Record<string, unknown> },
) {
  await page.route('**/optimize', (route) =>
    route.fulfill({
      status: response.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(response.body),
    }),
  );
}

/**
 * 同一行内で水平方向にドラッグする（時間軸移動用）。
 * @param offsetX 水平方向のピクセル移動量（正=右=遅い時間, 負=左=早い時間）
 */
export async function dragOrderHorizontally(page: Page, source: Locator, offsetX: number) {
  await source.scrollIntoViewIfNeeded();

  const box = await source.boundingBox();
  if (!box) throw new Error('Could not get bounding box for drag source');

  // overflow-visible バーの隣接テキスト遮蔽を回避するため、左端付近を使用
  const startX = box.x + 5;
  const startY = box.y + box.height / 2;
  const endX = startX + offsetX;

  // overflow-visible バーの重なりによる intercept を回避するため座標ベースで移動
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // distance: 5px を確実に超えるため中間点を経由
  await page.mouse.move(startX + 10, startY, { steps: 5 });
  await page.mouse.move(endX, startY, { steps: 15 });
  // dragover発火用に再度move
  await page.mouse.move(endX, startY);
  await page.mouse.up();
  // 非同期のhandleDragEnd（Firestore書き込み）完了を待つ
  await page.waitForTimeout(500);
}

/**
 * sonnerトーストの表示を待機する。
 * sonnerは[data-sonner-toast]属性のli要素でトーストを表示する。
 * CI環境でのダイアログ描画遅延（PR #93でHelperEditDialog住所セクション追加後）を考慮し15秒に設定。
 */
export async function waitForToast(page: Page, text: string | RegExp) {
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: text });
  await expect(toast.first()).toBeVisible({ timeout: 20_000 });
}
