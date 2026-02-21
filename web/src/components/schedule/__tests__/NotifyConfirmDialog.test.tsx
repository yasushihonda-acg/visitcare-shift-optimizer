import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotifyConfirmDialog } from '../NotifyConfirmDialog';

const mockNotifyShiftConfirmed = vi.fn();

vi.mock('@/lib/api/optimizer', () => ({
  notifyShiftConfirmed: (...args: unknown[]) => mockNotifyShiftConfirmed(...args),
  OptimizeApiError: class extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.name = 'OptimizeApiError';
    }
  },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('NotifyConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    weekStartDate: '2026-02-09',
    assignedCount: 20,
    totalOrders: 25,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('open=true でダイアログを表示する', () => {
    render(<NotifyConfirmDialog {...defaultProps} />);
    expect(screen.getByText('シフト確定通知')).toBeInTheDocument();
    expect(screen.getByText(/2026-02-09/)).toBeInTheDocument();
    expect(screen.getByText(/20 \/ 25 件割当/)).toBeInTheDocument();
  });

  it('open=false でダイアログを非表示にする', () => {
    render(<NotifyConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('シフト確定通知')).not.toBeInTheDocument();
  });

  it('スキップクリックで onClose を呼ぶ', () => {
    const onClose = vi.fn();
    render(<NotifyConfirmDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'スキップ' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('送信クリックで API を呼び成功トーストを表示する', async () => {
    mockNotifyShiftConfirmed.mockResolvedValue({ emails_sent: 2, recipients: [] });
    const onClose = vi.fn();
    render(<NotifyConfirmDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /送信/ }));
    await waitFor(() => {
      expect(mockNotifyShiftConfirmed).toHaveBeenCalledWith({
        week_start_date: '2026-02-09',
        assigned_count: 20,
        total_orders: 25,
      });
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('通知送信完了: 2名に送信しました');
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('API エラーでエラートーストを表示する', async () => {
    const { OptimizeApiError } = await import('@/lib/api/optimizer');
    mockNotifyShiftConfirmed.mockRejectedValue(new OptimizeApiError(500, 'サーバーエラー'));
    render(<NotifyConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /送信/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('通知エラー: サーバーエラー');
    });
  });
});
