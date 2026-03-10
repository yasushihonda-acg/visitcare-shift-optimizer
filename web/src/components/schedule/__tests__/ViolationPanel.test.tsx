import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViolationPanel } from '../ViolationPanel';
import type { ViolationMap, Violation } from '@/lib/constraints/checker';
import type { Customer, Helper } from '@/types';

// Sheet をモック（Radix Dialog ベース）
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

const mockCustomers = new Map([
  ['c1', { id: 'c1', name: '山田太郎' } as unknown as Customer],
  ['c2', { id: 'c2', name: '佐藤花子' } as unknown as Customer],
]);

const mockHelpers = new Map([
  ['h1', { id: 'h1', name: { last: '鈴木', first: '一郎' } } as unknown as Helper],
  ['h2', { id: 'h2', name: { last: '田中', first: '次郎' } } as unknown as Helper],
]);

function makeViolation(overrides: Partial<Violation> & Pick<Violation, 'orderId' | 'type' | 'severity' | 'message'>): Violation {
  return overrides as Violation;
}

describe('ViolationPanel', () => {
  it('open=false のとき何も表示しない', () => {
    const violations: ViolationMap = new Map();
    const { container } = render(
      <ViolationPanel
        open={false}
        onOpenChange={() => {}}
        violations={violations}
        customers={mockCustomers}
        helpers={mockHelpers}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('open=true でパネルが表示される', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        makeViolation({ orderId: 'o1', staffId: 'h1', type: 'overlap', severity: 'error', message: '時間重複テスト' }),
      ]],
    ]);
    render(
      <ViolationPanel
        open={true}
        onOpenChange={() => {}}
        violations={violations}
        customers={mockCustomers}
        helpers={mockHelpers}
      />
    );
    expect(screen.getByTestId('sheet')).toBeInTheDocument();
  });

  it('違反がない場合は「問題なし」メッセージが表示される', () => {
    const violations: ViolationMap = new Map();
    render(
      <ViolationPanel
        open={true}
        onOpenChange={() => {}}
        violations={violations}
        customers={mockCustomers}
        helpers={mockHelpers}
      />
    );
    expect(screen.getByText('問題は検出されませんでした')).toBeInTheDocument();
  });

  it('エラーと警告がそれぞれセクション分けして表示される', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        makeViolation({ orderId: 'o1', staffId: 'h1', type: 'overlap', severity: 'error', message: '時間重複: 10:00-11:00' }),
        makeViolation({ orderId: 'o1', type: 'outside_hours', severity: 'warning', message: '勤務時間外' }),
      ]],
    ]);
    render(
      <ViolationPanel
        open={true}
        onOpenChange={() => {}}
        violations={violations}
        customers={mockCustomers}
        helpers={mockHelpers}
      />
    );
    expect(screen.getByText(/違反.*1件/)).toBeInTheDocument();
    expect(screen.getByText(/警告.*1件/)).toBeInTheDocument();
  });

  it('違反タイプごとにグループ表示される', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        makeViolation({ orderId: 'o1', staffId: 'h1', type: 'overlap', severity: 'error', message: '鈴木 の時間重複: 10:00-11:00' }),
        makeViolation({ orderId: 'o1', staffId: 'h2', type: 'overlap', severity: 'error', message: '田中 の時間重複: 09:00-10:00' }),
        makeViolation({ orderId: 'o1', staffId: 'h1', type: 'ng_staff', severity: 'error', message: 'NGスタッフ割当' }),
      ]],
    ]);
    render(
      <ViolationPanel
        open={true}
        onOpenChange={() => {}}
        violations={violations}
        customers={mockCustomers}
        helpers={mockHelpers}
      />
    );
    expect(screen.getByText('時間重複')).toBeInTheDocument();
    expect(screen.getByText('NGスタッフ')).toBeInTheDocument();
  });

  it('各違反のメッセージが表示される', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        makeViolation({ orderId: 'o1', type: 'overlap', severity: 'error', message: '鈴木 の時間重複: 10:00-11:00' }),
      ]],
    ]);
    render(
      <ViolationPanel
        open={true}
        onOpenChange={() => {}}
        violations={violations}
        customers={mockCustomers}
        helpers={mockHelpers}
      />
    );
    expect(screen.getByText('鈴木 の時間重複: 10:00-11:00')).toBeInTheDocument();
  });

  it('severity フィルタで error のみ表示できる', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        makeViolation({ orderId: 'o1', type: 'overlap', severity: 'error', message: 'エラーメッセージ' }),
        makeViolation({ orderId: 'o1', type: 'outside_hours', severity: 'warning', message: '警告メッセージ' }),
      ]],
    ]);
    render(
      <ViolationPanel
        open={true}
        onOpenChange={() => {}}
        violations={violations}
        customers={mockCustomers}
        helpers={mockHelpers}
        initialFilter="error"
      />
    );
    expect(screen.getByText('エラーメッセージ')).toBeInTheDocument();
    expect(screen.queryByText('警告メッセージ')).not.toBeInTheDocument();
  });

  it('severity フィルタで warning のみ表示できる', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        makeViolation({ orderId: 'o1', type: 'overlap', severity: 'error', message: 'エラーメッセージ' }),
        makeViolation({ orderId: 'o1', type: 'outside_hours', severity: 'warning', message: '警告メッセージ' }),
      ]],
    ]);
    render(
      <ViolationPanel
        open={true}
        onOpenChange={() => {}}
        violations={violations}
        customers={mockCustomers}
        helpers={mockHelpers}
        initialFilter="warning"
      />
    );
    expect(screen.queryByText('エラーメッセージ')).not.toBeInTheDocument();
    expect(screen.getByText('警告メッセージ')).toBeInTheDocument();
  });

  it('「すべて」フィルタで全件表示される', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        makeViolation({ orderId: 'o1', type: 'overlap', severity: 'error', message: 'エラーメッセージ' }),
        makeViolation({ orderId: 'o1', type: 'outside_hours', severity: 'warning', message: '警告メッセージ' }),
      ]],
    ]);
    render(
      <ViolationPanel
        open={true}
        onOpenChange={() => {}}
        violations={violations}
        customers={mockCustomers}
        helpers={mockHelpers}
        initialFilter="all"
      />
    );
    expect(screen.getByText('エラーメッセージ')).toBeInTheDocument();
    expect(screen.getByText('警告メッセージ')).toBeInTheDocument();
  });

  it('フィルタボタンをクリックして切り替えできる', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        makeViolation({ orderId: 'o1', type: 'overlap', severity: 'error', message: 'エラーメッセージ' }),
        makeViolation({ orderId: 'o1', type: 'outside_hours', severity: 'warning', message: '警告メッセージ' }),
      ]],
    ]);
    render(
      <ViolationPanel
        open={true}
        onOpenChange={() => {}}
        violations={violations}
        customers={mockCustomers}
        helpers={mockHelpers}
        initialFilter="all"
      />
    );

    // 初期状態: 両方表示
    expect(screen.getByText('エラーメッセージ')).toBeInTheDocument();
    expect(screen.getByText('警告メッセージ')).toBeInTheDocument();

    // 「違反のみ」フィルタクリック
    fireEvent.click(screen.getByRole('button', { name: '違反のみ' }));
    expect(screen.getByText('エラーメッセージ')).toBeInTheDocument();
    expect(screen.queryByText('警告メッセージ')).not.toBeInTheDocument();

    // 「警告のみ」フィルタクリック
    fireEvent.click(screen.getByRole('button', { name: '警告のみ' }));
    expect(screen.queryByText('エラーメッセージ')).not.toBeInTheDocument();
    expect(screen.getByText('警告メッセージ')).toBeInTheDocument();
  });
});
