import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomerGanttChart } from '../CustomerGanttChart';
import type { Customer, Helper, Order, DayOfWeek } from '@/types';
import type { DaySchedule, HelperScheduleRow } from '@/hooks/useScheduleData';

// ResizeObserver のモック
class ResizeObserverMock {
  private cb: (entries: { contentRect: { width: number } }[]) => void;
  observe = vi.fn((el: Element) => {
    this.cb([{ contentRect: { width: 700 } }]);
  });
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(cb: (entries: { contentRect: { width: number } }[]) => void) {
    this.cb = cb;
  }
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// --- フィクスチャ ---
function makeHelper(overrides: Partial<Helper> = {}): Helper {
  return {
    id: 'helper-1',
    name: { family: '田中', given: '花子', short: '田中' },
    qualifications: [],
    can_physical_care: true,
    transportation: 'bicycle',
    weekly_availability: {},
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

describe('CustomerGanttChart', () => {
  const helper = makeHelper();
  const customer = makeCustomer();
  const helpers = new Map([['helper-1', helper]]);
  const customers = new Map([['cust-1', customer]]);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('オーダーが0件の場合「この日のオーダーはありません」が表示される', () => {
    const schedule = makeDaySchedule();

    render(
      <CustomerGanttChart
        schedule={schedule}
        customers={customers}
        helpers={helpers}
      />,
    );

    expect(screen.getByText('この日のオーダーはありません')).toBeInTheDocument();
  });

  it('「利用者」ヘッダーが表示される', () => {
    const order = makeOrder();
    const schedule = makeDaySchedule([{ helper, orders: [order] }]);

    render(
      <CustomerGanttChart
        schedule={schedule}
        customers={customers}
        helpers={helpers}
      />,
    );

    expect(screen.getByText('利用者')).toBeInTheDocument();
  });

  it('顧客名が行として表示される', () => {
    const order = makeOrder();
    const schedule = makeDaySchedule([{ helper, orders: [order] }]);

    render(
      <CustomerGanttChart
        schedule={schedule}
        customers={customers}
        helpers={helpers}
      />,
    );

    expect(screen.getByText('佐藤')).toBeInTheDocument();
  });

  it('ヘルパー名がバーに表示される', () => {
    const order = makeOrder();
    const schedule = makeDaySchedule([{ helper, orders: [order] }]);

    render(
      <CustomerGanttChart
        schedule={schedule}
        customers={customers}
        helpers={helpers}
      />,
    );

    expect(screen.getByTitle('09:00-10:00 田中')).toBeInTheDocument();
  });

  it('未割当のヘルパーは「未割当」と表示される', () => {
    const order = makeOrder({ assigned_staff_ids: [] });
    const schedule = makeDaySchedule([{ helper, orders: [order] }]);

    render(
      <CustomerGanttChart
        schedule={schedule}
        customers={customers}
        helpers={helpers}
      />,
    );

    expect(screen.getByTitle('09:00-10:00 未割当')).toBeInTheDocument();
  });

  it('バークリックでonOrderClickが呼ばれる', () => {
    const onOrderClick = vi.fn();
    const order = makeOrder();
    const schedule = makeDaySchedule([{ helper, orders: [order] }]);

    render(
      <CustomerGanttChart
        schedule={schedule}
        customers={customers}
        helpers={helpers}
        onOrderClick={onOrderClick}
      />,
    );

    fireEvent.click(screen.getByTitle('09:00-10:00 田中'));
    expect(onOrderClick).toHaveBeenCalledWith(order);
  });

  it('未割当オーダーがある場合に「未割当」行が表示される', () => {
    const unassignedOrder = makeOrder({ id: 'u-1', assigned_staff_ids: [] });
    const schedule = makeDaySchedule([], [unassignedOrder]);

    render(
      <CustomerGanttChart
        schedule={schedule}
        customers={customers}
        helpers={helpers}
      />,
    );

    expect(screen.getByText('未割当')).toBeInTheDocument();
  });

  it('未割当オーダーがない場合は「未割当」行が表示されない', () => {
    const order = makeOrder();
    const schedule = makeDaySchedule([{ helper, orders: [order] }]);

    render(
      <CustomerGanttChart
        schedule={schedule}
        customers={customers}
        helpers={helpers}
      />,
    );

    expect(screen.queryByText('未割当')).not.toBeInTheDocument();
  });

  it('未割当バーに顧客名がtitleに含まれる', () => {
    const unassignedOrder = makeOrder({ id: 'u-1', assigned_staff_ids: [] });
    const schedule = makeDaySchedule([], [unassignedOrder]);

    render(
      <CustomerGanttChart
        schedule={schedule}
        customers={customers}
        helpers={helpers}
      />,
    );

    expect(screen.getByTitle('佐藤 09:00-10:00')).toBeInTheDocument();
  });
});
