import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OptimizeButton } from '../OptimizeButton';
import type { AllowedStaffWarning } from '@/lib/validation/allowed-staff-check';
import type { Order } from '@/types';

// ── モック ──────────────────────────────────────────────────────

const mockCheckAllowedStaff = vi.fn<() => AllowedStaffWarning[]>();
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

// orders をテストごとに制御できるよう factory で提供する
const mockOrders: Order[] = [];
vi.mock('@/hooks/useScheduleData', () => ({
  useScheduleData: () => ({
    customers: new Map(),
    helpers: new Map(),
    orders: mockOrders,
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

const mockPatchOrder = vi.fn();
vi.mock('@/lib/firestore/updateOrder', () => ({
  patchOrder: (...args: unknown[]) => mockPatchOrder(...args),
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

/** 同行設定ありのオーダーフィクスチャを生成する */
function makeOrderWithCompanion(id: string): Order {
  return {
    id,
    customer_id: 'C001',
    week_start_date: new Date('2026-03-09'),
    date: new Date('2026-03-10'),
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    assigned_staff_ids: ['h1', 'h2'],
    companion_staff_id: 'h2',
    status: 'assigned',
    manually_edited: true,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

// ── テスト ──────────────────────────────────────────────────────

describe('OptimizeButton 事前チェック', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトは同行設定なし
    mockOrders.length = 0;
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

describe('OptimizeButton 同行（OJT）設定の警告とクリア', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrders.length = 0;
    mockCheckAllowedStaff.mockReturnValue([]);
    mockPatchOrder.mockResolvedValue(undefined);
  });

  it('同行設定なし → 直接最適化ダイアログが開き、同行警告は表示されない', () => {
    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));

    expect(screen.getByText('シフト最適化の実行')).toBeInTheDocument();
    expect(screen.queryByText('同行設定のリセット確認')).not.toBeInTheDocument();
  });

  it('同行設定あり → 同行警告ダイアログが表示される', () => {
    mockOrders.push(makeOrderWithCompanion('O1'));

    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));

    expect(screen.getByText('同行設定のリセット確認')).toBeInTheDocument();
    expect(screen.queryByText('シフト最適化の実行')).not.toBeInTheDocument();
  });

  it('同行設定2件 → 警告メッセージに件数が表示される', () => {
    mockOrders.push(makeOrderWithCompanion('O1'));
    mockOrders.push(makeOrderWithCompanion('O2'));

    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));

    expect(screen.getByText(/同行設定が2件あります/)).toBeInTheDocument();
  });

  it('同行警告でキャンセル → ダイアログが閉じ、最適化は実行されない', async () => {
    mockOrders.push(makeOrderWithCompanion('O1'));

    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));
    fireEvent.click(screen.getByText('キャンセル'));

    await waitFor(() => {
      expect(screen.queryByText('同行設定のリセット確認')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('シフト最適化の実行')).not.toBeInTheDocument();
    expect(mockRunOptimize).not.toHaveBeenCalled();
  });

  it('同行警告で「リセットして実行」→ 最適化ダイアログへ遷移する', async () => {
    mockOrders.push(makeOrderWithCompanion('O1'));

    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));

    expect(screen.getByText('同行設定のリセット確認')).toBeInTheDocument();
    fireEvent.click(screen.getByText('リセットして実行'));

    await waitFor(() => {
      expect(screen.getByText('シフト最適化の実行')).toBeInTheDocument();
    });
    expect(screen.queryByText('同行設定のリセット確認')).not.toBeInTheDocument();
  });

  it('最適化成功後に同行設定が companion_staff_id: null でクリアされる', async () => {
    mockOrders.push(makeOrderWithCompanion('O1'));
    mockOrders.push(makeOrderWithCompanion('O2'));
    mockRunOptimize.mockResolvedValue({
      assigned_count: 5,
      total_orders: 5,
      solve_time_seconds: 1.2,
    });

    render(<OptimizeButton />);
    // 同行警告を経由して最適化ダイアログを開く
    fireEvent.click(screen.getByText('最適化実行'));
    fireEvent.click(screen.getByText('リセットして実行'));
    await waitFor(() => screen.getByText('シフト最適化の実行'));
    fireEvent.click(screen.getByText('実行'));

    await waitFor(() => {
      expect(mockPatchOrder).toHaveBeenCalledTimes(2);
    });
    expect(mockPatchOrder).toHaveBeenCalledWith('O1', { companion_staff_id: null });
    expect(mockPatchOrder).toHaveBeenCalledWith('O2', { companion_staff_id: null });
  });

  it('同行設定なしで最適化成功 → patchOrder は呼ばれない', async () => {
    mockRunOptimize.mockResolvedValue({
      assigned_count: 3,
      total_orders: 3,
      solve_time_seconds: 0.8,
    });

    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));
    await waitFor(() => screen.getByText('シフト最適化の実行'));
    fireEvent.click(screen.getByText('実行'));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
    });
    expect(mockPatchOrder).not.toHaveBeenCalled();
  });

  it('最適化失敗時 → patchOrder は呼ばれない', async () => {
    mockOrders.push(makeOrderWithCompanion('O1'));
    mockRunOptimize.mockRejectedValue(new Error('network error'));

    render(<OptimizeButton />);
    fireEvent.click(screen.getByText('最適化実行'));
    fireEvent.click(screen.getByText('リセットして実行'));
    await waitFor(() => screen.getByText('シフト最適化の実行'));
    fireEvent.click(screen.getByText('実行'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    expect(mockPatchOrder).not.toHaveBeenCalled();
  });
});
