import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GanttChart } from '../GanttChart';
import type { Customer, Helper, Order, DayOfWeek } from '@/types';
import type { DaySchedule, HelperScheduleRow } from '@/hooks/useScheduleData';
import type { ViolationMap } from '@/lib/constraints/checker';

// ResizeObserver のモック
class ResizeObserverMock {
  private cb: ResizeObserverCallback;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// --- Mocks ---
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}));

vi.mock('@/hooks/useServiceTypes', () => ({
  useServiceTypes: () => ({
    serviceTypes: new Map([
      ['physical_care', { id: 'physical_care', short_label: '身体' }],
    ]),
  }),
}));

// --- フィクスチャ ---
function makeHelper(overrides: Partial<Helper> = {}): Helper {
  return {
    id: 'helper-1',
    name: { family: '田中', given: '花子', short: '田中' },
    qualifications: [],
    can_physical_care: true,
    transportation: 'bicycle',
    weekly_availability: {
      monday: [{ start_time: '09:00', end_time: '18:00' }],
    },
    preferred_hours: { min: 20, max: 40 },
    available_hours: { min: 0, max: 40 },
    customer_training_status: {},
    employment_type: 'part_time',
    gender: 'female',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    name: { family: '佐藤', given: '一郎', short: '佐藤' },
    address: '東京都渋谷区',
    location: { lat: 35.6, lng: 139.7 },
    ng_staff_ids: [],
    allowed_staff_ids: [],
    preferred_staff_ids: [],
    same_household_customer_ids: [],
    same_facility_customer_ids: [],
    weekly_services: {},
    service_manager: 'sm-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    week_start_date: new Date('2026-02-16'),
    date: new Date('2026-02-16'),
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    assigned_staff_ids: ['helper-1'],
    status: 'assigned',
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeDaySchedule(
  helperRows: HelperScheduleRow[] = [],
  unassignedOrders: Order[] = [],
): DaySchedule {
  return {
    day: 'monday' as DayOfWeek,
    date: new Date('2026-02-16'),
    helperRows,
    unassignedOrders,
    totalOrders: helperRows.flatMap((r) => r.orders).length + unassignedOrders.length,
  };
}

describe('GanttChart', () => {
  const helper = makeHelper();
  const customers = new Map([['cust-1', makeCustomer()]]);
  const violations: ViolationMap = new Map();

  it('オーダーが0件の場合「この日のオーダーはありません」が表示される', () => {
    const schedule = makeDaySchedule();

    render(
      <GanttChart
        schedule={schedule}
        customers={customers}
        violations={violations}
        unavailability={[]}
      />,
    );

    expect(screen.getByText('この日のオーダーはありません')).toBeInTheDocument();
  });

  it('ヘルパー行がレンダリングされる', () => {
    const order = makeOrder();
    const schedule = makeDaySchedule([{ helper, orders: [order] }]);

    render(
      <GanttChart
        schedule={schedule}
        customers={customers}
        violations={violations}
        unavailability={[]}
      />,
    );

    expect(screen.getByText('田中')).toBeInTheDocument();
  });

  it('GanttTimeHeaderが表示される（「ヘルパー」ラベル）', () => {
    const order = makeOrder();
    const schedule = makeDaySchedule([{ helper, orders: [order] }]);

    render(
      <GanttChart
        schedule={schedule}
        customers={customers}
        violations={violations}
        unavailability={[]}
      />,
    );

    expect(screen.getByText('ヘルパー')).toBeInTheDocument();
  });

  it('UnassignedSectionが表示される', () => {
    const order = makeOrder();
    const schedule = makeDaySchedule([{ helper, orders: [order] }]);

    render(
      <GanttChart
        schedule={schedule}
        customers={customers}
        violations={violations}
        unavailability={[]}
      />,
    );

    expect(screen.getByTestId('unassigned-section')).toBeInTheDocument();
  });

  it('複数ヘルパー行がレンダリングされる', () => {
    const helper2 = makeHelper({ id: 'helper-2', name: { family: '鈴木', given: '太郎', short: '鈴木' } });
    const order1 = makeOrder();
    const order2 = makeOrder({ id: 'order-2', assigned_staff_ids: ['helper-2'] });
    const schedule = makeDaySchedule([
      { helper, orders: [order1] },
      { helper: helper2, orders: [order2] },
    ]);

    render(
      <GanttChart
        schedule={schedule}
        customers={customers}
        violations={violations}
        unavailability={[]}
      />,
    );

    expect(screen.getByText('田中')).toBeInTheDocument();
    expect(screen.getByText('鈴木')).toBeInTheDocument();
  });
});
