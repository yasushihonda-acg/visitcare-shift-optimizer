import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeeklyGanttChart } from '../WeeklyGanttChart';
import type { Helper, Customer, Order, StaffUnavailability, DayOfWeek } from '@/types';
import type { DaySchedule, HelperScheduleRow } from '@/hooks/useScheduleData';

// ResizeObserver のモック
// vi.fn().mockImplementation はアロー関数を返すため new で呼び出せない。
// クラス構文を使うことで new ResizeObserver(...) が正しく動作する。
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
    weekly_availability: {
      monday: [{ start_time: '09:00', end_time: '18:00' }],
      tuesday: [{ start_time: '09:00', end_time: '18:00' }],
      wednesday: [{ start_time: '09:00', end_time: '18:00' }],
      thursday: [{ start_time: '09:00', end_time: '18:00' }],
      friday: [{ start_time: '09:00', end_time: '18:00' }],
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
    preferred_staff_ids: [],
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
  day: DayOfWeek,
  date: Date,
  helperRows: HelperScheduleRow[] = [],
  unassignedOrders: Order[] = [],
): DaySchedule {
  return {
    day,
    date,
    helperRows,
    unassignedOrders,
    totalOrders: helperRows.flatMap((r) => r.orders).length + unassignedOrders.length,
  };
}

describe('WeeklyGanttChart', () => {
  const weekStart = new Date('2026-02-16'); // 月曜日
  const helper = makeHelper();
  const customer = makeCustomer();
  const helpers = new Map([['helper-1', helper]]);
  const customers = new Map([['cust-1', customer]]);
  const unavailability: StaffUnavailability[] = [];
  const onDayClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeGetDaySchedule(
    scheduleMap: Partial<Record<DayOfWeek, DaySchedule>> = {},
  ) {
    return (day: DayOfWeek, date: Date): DaySchedule =>
      scheduleMap[day] ?? makeDaySchedule(day, date);
  }

  it('7曜日のヘッダーが表示される（月〜日）', () => {
    render(
      <WeeklyGanttChart
        weekStart={weekStart}
        getDaySchedule={makeGetDaySchedule()}
        helpers={helpers}
        customers={customers}
        unavailability={unavailability}
        onDayClick={onDayClick}
      />,
    );

    expect(screen.getByTestId('weekly-day-header-monday')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-day-header-tuesday')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-day-header-wednesday')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-day-header-thursday')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-day-header-friday')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-day-header-saturday')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-day-header-sunday')).toBeInTheDocument();
  });

  it('ヘルパー名が行として表示される', () => {
    render(
      <WeeklyGanttChart
        weekStart={weekStart}
        getDaySchedule={makeGetDaySchedule()}
        helpers={helpers}
        customers={customers}
        unavailability={unavailability}
        onDayClick={onDayClick}
      />,
    );

    expect(screen.getByText('田中')).toBeInTheDocument();
  });

  it('日ヘッダークリックでonDayClickが発火する', () => {
    render(
      <WeeklyGanttChart
        weekStart={weekStart}
        getDaySchedule={makeGetDaySchedule()}
        helpers={helpers}
        customers={customers}
        unavailability={unavailability}
        onDayClick={onDayClick}
      />,
    );

    fireEvent.click(screen.getByTestId('weekly-day-header-monday'));
    expect(onDayClick).toHaveBeenCalledWith('monday');
  });

  it('オーダーのバーがレンダリングされる（titleで確認）', () => {
    const order = makeOrder({ id: 'order-x', start_time: '09:00', end_time: '10:00' });
    const getDaySchedule = makeGetDaySchedule({
      monday: makeDaySchedule('monday', new Date('2026-02-16'), [
        { helper, orders: [order] },
      ]),
    });

    render(
      <WeeklyGanttChart
        weekStart={weekStart}
        getDaySchedule={getDaySchedule}
        helpers={helpers}
        customers={customers}
        unavailability={unavailability}
        onDayClick={onDayClick}
      />,
    );

    // title 属性で顧客名と時間が確認できる
    expect(screen.getByTitle('佐藤 09:00-10:00')).toBeInTheDocument();
  });

  it('バークリックでonDayClickが呼ばれる', () => {
    const order = makeOrder({ id: 'order-y' });
    const getDaySchedule = makeGetDaySchedule({
      tuesday: makeDaySchedule('tuesday', new Date('2026-02-17'), [
        { helper, orders: [order] },
      ]),
    });

    render(
      <WeeklyGanttChart
        weekStart={weekStart}
        getDaySchedule={getDaySchedule}
        helpers={helpers}
        customers={customers}
        unavailability={unavailability}
        onDayClick={onDayClick}
      />,
    );

    fireEvent.click(screen.getByTitle('佐藤 09:00-10:00'));
    expect(onDayClick).toHaveBeenCalledWith('tuesday');
  });

  it('未割当オーダーがある場合に件数バッジが表示される', () => {
    const unassigned = makeOrder({ id: 'u-1', assigned_staff_ids: [] });
    const getDaySchedule = makeGetDaySchedule({
      wednesday: makeDaySchedule('wednesday', new Date('2026-02-18'), [], [unassigned]),
    });

    render(
      <WeeklyGanttChart
        weekStart={weekStart}
        getDaySchedule={getDaySchedule}
        helpers={helpers}
        customers={customers}
        unavailability={unavailability}
        onDayClick={onDayClick}
      />,
    );

    expect(screen.getByTestId('weekly-unassigned-badge-wednesday')).toHaveTextContent('1');
  });

  it('全曜日0件の場合は未割当行が表示されない', () => {
    render(
      <WeeklyGanttChart
        weekStart={weekStart}
        getDaySchedule={makeGetDaySchedule()}
        helpers={helpers}
        customers={customers}
        unavailability={unavailability}
        onDayClick={onDayClick}
      />,
    );

    expect(screen.queryByTestId('weekly-unassigned-row')).not.toBeInTheDocument();
  });
});
