import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OptimizeButton } from '../OptimizeButton';
import type { AllowedStaffWarning } from '@/lib/validation/allowed-staff-check';

// ── モック ──────────────────────────────────────────────────────

const mockCheckAllowedStaff = vi.fn<[], AllowedStaffWarning[]>();
vi.mock('@/lib/validation/allowed-staff-check', () => ({
  checkAllowedStaff: (...args: unknown[]) => mockCheckAllowedStaff(),
}));

const mockRunOptimize = vi.fn();
vi.mock('@/lib/api/optimizer', () => ({
  runOptimize: (...args: unknown[]) => mockRunOptimize(...args),
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
    weekStart: new Date('2026-03-09'),
  }),
}));

vi.mock('@/hooks/useScheduleData', () => ({
  useScheduleData: () => ({
    customers: new Map(),
    helpers: new Map(),
    orders: [],
    unavailability: [],
    loading: false,
    ordersByDay: {},
    daySchedules: [],
    travelTimeLookup: new Map(),
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

// ── テストデータ ────────────────────────────────────────────────

const WARNING_FIXTURE: AllowedStaffWarning = {
  customer_id: 'C001',
  customer_name: '山田太郎',
  order_id: 'O001',
  date: new Date('2026-03-10'),
  day_of_week: 'tuesday',
  start_time: '09:00',
  end_time: '10:00',
  allowed_helper_names: ['佐藤一郎', '鈴木花子'],
};

// ── テスト ──────────────────────────────────────────────────────

describe('OptimizeButton 事前チェック', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('警告なし → 直接最適化ダイアログが開く', () => {
    mockCheckAllowedStaff.mockReturnValue([]);

    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));

    expect(screen.getByText('シフト最適化の実行')).toBeInTheDocument();
    expect(screen.queryByText('最適化前の注意')).not.toBeInTheDocument();
  });

  it('警告あり → 事前警告ダイアログが開く', () => {
    mockCheckAllowedStaff.mockReturnValue([WARNING_FIXTURE]);

    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));

    expect(screen.getByText('最適化前の注意')).toBeInTheDocument();
    expect(screen.queryByText('シフト最適化の実行')).not.toBeInTheDocument();
  });

  it('警告ダイアログに利用者名・曜日・時間帯が表示される', () => {
    mockCheckAllowedStaff.mockReturnValue([WARNING_FIXTURE]);

    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));

    expect(screen.getByText('山田太郎')).toBeInTheDocument();
    expect(screen.getByText(/火曜/)).toBeInTheDocument();
    expect(screen.getByText(/09:00/)).toBeInTheDocument();
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
  });

  it('警告ダイアログにallowedヘルパー名が表示される', () => {
    mockCheckAllowedStaff.mockReturnValue([WARNING_FIXTURE]);

    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));

    expect(screen.getByText(/佐藤一郎/)).toBeInTheDocument();
    expect(screen.getByText(/鈴木花子/)).toBeInTheDocument();
  });

  it('「戻って修正する」で警告ダイアログが閉じる', async () => {
    mockCheckAllowedStaff.mockReturnValue([WARNING_FIXTURE]);

    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));

    expect(screen.getByText('最適化前の注意')).toBeInTheDocument();

    fireEvent.click(screen.getByText('戻って修正する'));

    await waitFor(() => {
      expect(screen.queryByText('最適化前の注意')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('シフト最適化の実行')).not.toBeInTheDocument();
  });

  it('「警告を無視して実行」で最適化ダイアログに遷移する', async () => {
    mockCheckAllowedStaff.mockReturnValue([WARNING_FIXTURE]);

    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));

    expect(screen.getByText('最適化前の注意')).toBeInTheDocument();

    fireEvent.click(screen.getByText('警告を無視して実行'));

    await waitFor(() => {
      expect(screen.getByText('シフト最適化の実行')).toBeInTheDocument();
    });
    expect(screen.queryByText('最適化前の注意')).not.toBeInTheDocument();
  });

  it('複数警告がリスト表示される', () => {
    const warning2: AllowedStaffWarning = {
      ...WARNING_FIXTURE,
      customer_id: 'C002',
      customer_name: '中村花子',
      order_id: 'O002',
      day_of_week: 'wednesday',
      start_time: '14:00',
      end_time: '15:00',
      allowed_helper_names: ['田中三郎'],
    };
    mockCheckAllowedStaff.mockReturnValue([WARNING_FIXTURE, warning2]);

    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));

    expect(screen.getByText('山田太郎')).toBeInTheDocument();
    expect(screen.getByText('中村花子')).toBeInTheDocument();
    expect(screen.getByText(/水曜/)).toBeInTheDocument();
  });
});
