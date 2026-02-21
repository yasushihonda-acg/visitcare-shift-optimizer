import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotifyChangesButton } from '../NotifyChangesButton';
import type { AssignmentDiff } from '@/hooks/useAssignmentDiff';
import type { Order } from '@/types';

const mockNotifyShiftChanged = vi.fn();

vi.mock('@/lib/api/optimizer', () => ({
  notifyShiftChanged: (...args: unknown[]) => mockNotifyShiftChanged(...args),
  OptimizeApiError: class extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.name = 'OptimizeApiError';
    }
  },
}));

vi.mock('@/contexts/ScheduleContext', () => ({
  useScheduleContext: () => ({
    weekStart: new Date('2026-02-09'),
  }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const makeOrder = (id: string, assignedStaffIds: string[]): Order => ({
  id,
  customer_id: 'c-1',
  week_start_date: new Date('2026-02-09'),
  date: new Date('2026-02-09'),
  start_time: '09:00',
  end_time: '10:00',
  service_type: 'physical_care',
  assigned_staff_ids: assignedStaffIds,
  status: 'assigned',
  manually_edited: false,
  created_at: new Date(),
  updated_at: new Date(),
});

const helpers = new Map([
  ['h-1', { id: 'h-1', name: { family: '田中', given: '太郎' } }],
  ['h-2', { id: 'h-2', name: { family: '鈴木', given: '次郎' } }],
]);

const customers = new Map([
  ['c-1', { id: 'c-1', name: { family: '山田', given: '花子' } }],
]);

describe('NotifyChangesButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('diffMap が空のとき変更通知ボタンが disabled になる', () => {
    render(
      <NotifyChangesButton
        diffMap={new Map()}
        helpers={helpers}
        customers={customers}
        orders={[]}
      />
    );
    expect(screen.getByRole('button', { name: /変更通知/ })).toBeDisabled();
  });

  it('変更ありのとき変更通知ボタンが有効になり件数バッジを表示する', () => {
    const diffMap = new Map<string, AssignmentDiff>([
      ['o-1', { added: ['h-2'], removed: ['h-1'], isChanged: true }],
    ]);
    render(
      <NotifyChangesButton
        diffMap={diffMap}
        helpers={helpers}
        customers={customers}
        orders={[makeOrder('o-1', ['h-2'])]}
      />
    );
    expect(screen.getByRole('button', { name: /変更通知/ })).not.toBeDisabled();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('ボタンクリックでダイアログが開き変更内容を表示する', () => {
    const diffMap = new Map<string, AssignmentDiff>([
      ['o-1', { added: ['h-2'], removed: ['h-1'], isChanged: true }],
    ]);
    render(
      <NotifyChangesButton
        diffMap={diffMap}
        helpers={helpers}
        customers={customers}
        orders={[makeOrder('o-1', ['h-2'])]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /変更通知/ }));
    expect(screen.getByText('シフト変更通知')).toBeInTheDocument();
    expect(screen.getByText('山田 花子')).toBeInTheDocument();
    expect(screen.getByText('田中 太郎')).toBeInTheDocument();
    expect(screen.getByText('鈴木 次郎')).toBeInTheDocument();
  });

  it('送信クリックで API を呼び成功トーストを表示する', async () => {
    mockNotifyShiftChanged.mockResolvedValue({ emails_sent: 1, recipients: [] });
    const diffMap = new Map<string, AssignmentDiff>([
      ['o-1', { added: ['h-2'], removed: ['h-1'], isChanged: true }],
    ]);
    render(
      <NotifyChangesButton
        diffMap={diffMap}
        helpers={helpers}
        customers={customers}
        orders={[makeOrder('o-1', ['h-2'])]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /変更通知/ }));
    fireEvent.click(screen.getByRole('button', { name: /^送信$/ }));
    await waitFor(() => {
      expect(mockNotifyShiftChanged).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('変更通知送信完了: 1名に送信しました');
    });
  });

  it('API エラーでエラートーストを表示する', async () => {
    const { OptimizeApiError } = await import('@/lib/api/optimizer');
    mockNotifyShiftChanged.mockRejectedValue(new OptimizeApiError(500, 'サーバーエラー'));
    const diffMap = new Map<string, AssignmentDiff>([
      ['o-1', { added: ['h-2'], removed: ['h-1'], isChanged: true }],
    ]);
    render(
      <NotifyChangesButton
        diffMap={diffMap}
        helpers={helpers}
        customers={customers}
        orders={[makeOrder('o-1', ['h-2'])]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /変更通知/ }));
    fireEvent.click(screen.getByRole('button', { name: /^送信$/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('通知エラー: サーバーエラー');
    });
  });
});
