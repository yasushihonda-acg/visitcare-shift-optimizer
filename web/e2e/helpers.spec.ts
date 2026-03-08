import { test, expect } from '@playwright/test';
import { findSingleBarInRow } from './helpers';

test.describe('findSingleBarInRow', () => {
  test('単独バーの行がある場合: その行のバーと行を返す', async ({ page }) => {
    await page.setContent(`
      <div data-testid="gantt-row-H001">
        <div data-testid="gantt-bar-O001"></div>
        <div data-testid="gantt-bar-O002"></div>
      </div>
      <div data-testid="gantt-row-H002">
        <div data-testid="gantt-bar-O003"></div>
      </div>
      <div data-testid="gantt-row-H003">
        <div data-testid="gantt-bar-O004"></div>
        <div data-testid="gantt-bar-O005"></div>
      </div>
    `);

    const { bar, row } = await findSingleBarInRow(page);
    await expect(bar).toHaveAttribute('data-testid', 'gantt-bar-O003');
    await expect(row).toHaveAttribute('data-testid', 'gantt-row-H002');
  });

  test('フォールバック: 全行が複数バーの場合、最初のバーとその親行を返す', async ({ page }) => {
    await page.setContent(`
      <div data-testid="gantt-row-H001">
        <div data-testid="gantt-bar-O001"></div>
        <div data-testid="gantt-bar-O002"></div>
      </div>
      <div data-testid="gantt-row-H002">
        <div data-testid="gantt-bar-O003"></div>
        <div data-testid="gantt-bar-O004"></div>
      </div>
    `);

    const { bar, row } = await findSingleBarInRow(page);
    // 最初のバーを返す
    await expect(bar).toHaveAttribute('data-testid', 'gantt-bar-O001');
    // バーの実際の親行を返す（不整合なし）
    await expect(row).toHaveAttribute('data-testid', 'gantt-row-H001');
  });

  test('フォールバック: 最初の行にバーがない場合でも正しい親行を返す', async ({ page }) => {
    // 最初のgantt-rowにバーがなく、2行目以降にバーがあるケース
    // 旧実装（ganttRows.first()）ではbar/row不整合が発生していた
    await page.setContent(`
      <div data-testid="gantt-row-H001">
      </div>
      <div data-testid="gantt-row-H002">
        <div data-testid="gantt-bar-O001"></div>
        <div data-testid="gantt-bar-O002"></div>
      </div>
    `);

    const { bar, row } = await findSingleBarInRow(page);
    // 最初のバーはH002の行にある
    await expect(bar).toHaveAttribute('data-testid', 'gantt-bar-O001');
    // 親行はH002（旧実装ではH001を返していた = bar/row不整合）
    await expect(row).toHaveAttribute('data-testid', 'gantt-row-H002');
  });
});
