import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderDetailPanel } from '../OrderDetailPanel';
import type { Order } from '@/types';

// useServiceTypes は Firebase 接続が必要なためモック
vi.mock('@/hooks/useServiceTypes', () => ({
  useServiceTypes: () => ({
    serviceTypes: new Map(),
    sortedList: [],
    loading: false,
    error: null,
  }),
}));

// Radix Sheet uses portal — mock to render inline
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
    <div {...props}>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    week_start_date: new Date('2026-02-09'),
    date: new Date('2026-02-09'),
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    assigned_staff_ids: [],
    status: 'pending',
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const defaultProps = {
  assignedHelpers: [],
  violations: [],
  open: true,
  onClose: vi.fn(),
};

describe('OrderDetailPanel - 手動編集バッジ', () => {
  it('manually_edited: true → 「手動編集済み」バッジが表示される', () => {
    const order = makeOrder({ manually_edited: true });
    render(<OrderDetailPanel order={order} {...defaultProps} />);

    expect(screen.getByText('手動編集済み')).toBeInTheDocument();
  });

  it('manually_edited: false → 「手動編集済み」バッジが表示されない', () => {
    const order = makeOrder({ manually_edited: false });
    render(<OrderDetailPanel order={order} {...defaultProps} />);

    expect(screen.queryByText('手動編集済み')).not.toBeInTheDocument();
  });
});
