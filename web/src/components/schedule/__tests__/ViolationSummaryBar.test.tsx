import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViolationSummaryBar } from '../ViolationSummaryBar';
import type { ViolationMap, Violation } from '@/lib/constraints/checker';

function makeViolation(overrides: Partial<Violation> & Pick<Violation, 'orderId' | 'type' | 'severity' | 'message'>): Violation {
  return overrides as Violation;
}

describe('ViolationSummaryBar', () => {
  it('違反も警告もない場合は何も表示しない', () => {
    const violations: ViolationMap = new Map();
    const { container } = render(
      <ViolationSummaryBar violations={violations} onOpenPanel={() => {}} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('エラー違反がタイプ別に件数表示される', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        makeViolation({ orderId: 'o1', type: 'overlap', severity: 'error', message: '重複1' }),
        makeViolation({ orderId: 'o1', type: 'overlap', severity: 'error', message: '重複2' }),
        makeViolation({ orderId: 'o1', type: 'ng_staff', severity: 'error', message: 'NG1' }),
      ]],
    ]);
    render(
      <ViolationSummaryBar violations={violations} onOpenPanel={() => {}} />
    );
    expect(screen.getByText('時間重複')).toBeInTheDocument();
    expect(screen.getByText('2件')).toBeInTheDocument();
    expect(screen.getByText('NGスタッフ')).toBeInTheDocument();
    expect(screen.getByText('1件')).toBeInTheDocument();
  });

  it('警告がタイプ別に件数表示される', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        makeViolation({ orderId: 'o1', type: 'preferred_staff', severity: 'warning', message: '推奨外' }),
        makeViolation({ orderId: 'o1', type: 'outside_hours', severity: 'warning', message: '時間外' }),
      ]],
    ]);
    render(
      <ViolationSummaryBar violations={violations} onOpenPanel={() => {}} />
    );
    expect(screen.getByText('推奨スタッフ外')).toBeInTheDocument();
    expect(screen.getByText('勤務時間外')).toBeInTheDocument();
  });

  it('クリックでonOpenPanelが呼ばれる', () => {
    const onOpenPanel = vi.fn();
    const violations: ViolationMap = new Map([
      ['o1', [
        makeViolation({ orderId: 'o1', type: 'overlap', severity: 'error', message: '重複' }),
      ]],
    ]);
    render(
      <ViolationSummaryBar violations={violations} onOpenPanel={onOpenPanel} />
    );
    fireEvent.click(screen.getByRole('button', { name: '詳細を表示' }));
    expect(onOpenPanel).toHaveBeenCalledTimes(1);
  });

  it('エラーと警告が両方ある場合にセクション分けされる', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        makeViolation({ orderId: 'o1', type: 'overlap', severity: 'error', message: '重複' }),
        makeViolation({ orderId: 'o1', type: 'preferred_staff', severity: 'warning', message: '推奨外' }),
      ]],
    ]);
    render(
      <ViolationSummaryBar violations={violations} onOpenPanel={() => {}} />
    );
    expect(screen.getByText('時間重複')).toBeInTheDocument();
    expect(screen.getByText('推奨スタッフ外')).toBeInTheDocument();
  });
});
