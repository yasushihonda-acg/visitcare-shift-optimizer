import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResetButton } from '../ResetButton';

const mockResetAssignments = vi.fn();

vi.mock('@/lib/api/optimizer', () => ({
  resetAssignments: (...args: unknown[]) => mockResetAssignments(...args),
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

describe('ResetButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('リセットボタンを表示', () => {
    render(<ResetButton />);
    expect(screen.getByText('リセット')).toBeInTheDocument();
  });

  it('クリックで確認ダイアログを表示', () => {
    render(<ResetButton />);
    fireEvent.click(screen.getByText('リセット'));
    expect(screen.getByText('割当をリセット')).toBeInTheDocument();
    expect(screen.getByText(/すべてのオーダー割当を解除/)).toBeInTheDocument();
  });

  it('キャンセルでダイアログを閉じる', () => {
    render(<ResetButton />);
    fireEvent.click(screen.getByText('リセット'));
    fireEvent.click(screen.getByText('キャンセル'));
    expect(screen.queryByText('割当をリセット')).not.toBeInTheDocument();
  });

  it('リセット実行でAPIを呼びトースト表示', async () => {
    mockResetAssignments.mockResolvedValue({ orders_reset: 30, week_start_date: '2026-02-09' });
    render(<ResetButton />);
    fireEvent.click(screen.getByText('リセット'));
    fireEvent.click(screen.getByText('リセット実行'));
    await waitFor(() => {
      expect(mockResetAssignments).toHaveBeenCalledWith('2026-02-09');
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('割当リセット完了: 30件');
    });
  });

  it('APIエラーでエラートースト表示', async () => {
    const { OptimizeApiError } = await import('@/lib/api/optimizer');
    mockResetAssignments.mockRejectedValue(new OptimizeApiError(500, 'サーバーエラー'));
    render(<ResetButton />);
    fireEvent.click(screen.getByText('リセット'));
    fireEvent.click(screen.getByText('リセット実行'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('リセットエラー: サーバーエラー');
    });
  });
});
