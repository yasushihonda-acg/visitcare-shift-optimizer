import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BulkCompleteButton } from '../BulkCompleteButton';
import type { DaySchedule } from '@/hooks/useScheduleData';
import type { Order } from '@/types';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="bulk-dialog-content">{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/firestore/updateOrder', () => ({
  bulkUpdateOrderStatus: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── ヘルパー ──────────────────────────────────────────────────

function makeOrder(id: string, status: Order['status'] = 'assigned'): Order {
  return {
    id,
    customer_id: 'c1',
    week_start_date: new Date('2026-03-09'),
    date: new Date('2026-03-10'),
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    staff_count: 1,
    assigned_staff_ids: status === 'assigned' ? ['h1'] : [],
    status,
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function makeSchedule(orders: Order[]): DaySchedule {
  const assigned = orders.filter((o) => o.status === 'assigned');
  const unassigned = orders.filter((o) => o.status !== 'assigned');
  return {
    day: 'tuesday',
    date: new Date('2026-03-10'),
    helperRows: assigned.length > 0
      ? [{
          helper: {
            id: 'h1',
            name: { family: '佐藤', given: '一郎' },
            qualifications: [],
            can_physical_care: false,
            transportation: 'bicycle',
            weekly_availability: {},
            preferred_hours: { min: 0, max: 40 },
            available_hours: { min: 0, max: 40 },
            customer_training_status: {},
            employment_type: 'part_time',
            gender: 'female',
            split_shift_allowed: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
          orders: assigned,
        }]
      : [],
    unassignedOrders: unassigned,
    totalOrders: orders.length,
  };
}

// ── テスト ──────────────────────────────────────────────────────

describe('BulkCompleteButton', () => {
  it('ボタンが表示される', () => {
    const schedule = makeSchedule([makeOrder('o1')]);
    render(<BulkCompleteButton schedule={schedule} />);
    expect(screen.getByTestId('bulk-complete-button')).toBeInTheDocument();
  });

  it('割当済みオーダーが0件のときボタンがdisabledになる', () => {
    const schedule = makeSchedule([makeOrder('o1', 'completed')]);
    render(<BulkCompleteButton schedule={schedule} />);
    expect(screen.getByTestId('bulk-complete-button')).toBeDisabled();
  });

  it('割当済みオーダーがあるときボタンがenabledになる', () => {
    const schedule = makeSchedule([makeOrder('o1', 'assigned')]);
    render(<BulkCompleteButton schedule={schedule} />);
    expect(screen.getByTestId('bulk-complete-button')).not.toBeDisabled();
  });

  it('ダイアログのタイトルが表示される', () => {
    const schedule = makeSchedule([makeOrder('o1')]);
    render(<BulkCompleteButton schedule={schedule} />);
    expect(screen.getByText('一括実績確認')).toBeInTheDocument();
  });

  it('割当済みオーダー件数がダイアログに表示される', () => {
    const schedule = makeSchedule([makeOrder('o1'), makeOrder('o2')]);
    render(<BulkCompleteButton schedule={schedule} />);
    expect(screen.getByText('2件を完了にする')).toBeInTheDocument();
  });
});
