import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// --- モック定義 ---

const mockHelpers = new Map();
const mockCustomers = new Map();

vi.mock('../useHelpers', () => ({
  useHelpers: vi.fn(() => ({ helpers: mockHelpers, loading: false, error: null })),
}));
vi.mock('../useCustomers', () => ({
  useCustomers: vi.fn(() => ({ customers: mockCustomers, loading: false, error: null })),
}));
vi.mock('../useOrders', () => ({
  useOrders: vi.fn(() => ({ orders: [], loading: false, error: null })),
}));
vi.mock('../useStaffUnavailability', () => ({
  useStaffUnavailability: vi.fn(() => ({ unavailability: [], loading: false, error: null })),
}));
vi.mock('../useTravelTimes', () => ({
  useTravelTimes: vi.fn(() => ({ travelTimeLookup: new Map(), loading: false, error: null })),
}));

import { useScheduleData } from '../useScheduleData';
import { useHelpers } from '../useHelpers';
import { useCustomers } from '../useCustomers';
import { useOrders } from '../useOrders';
import { useStaffUnavailability } from '../useStaffUnavailability';
import { useTravelTimes } from '../useTravelTimes';
import type { Order, Helper } from '@/types';

const weekStart = new Date('2025-01-06');

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    week_start_date: new Date('2025-01-06'),
    date: new Date('2025-01-06'), // Monday
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    assigned_staff_ids: [],
    status: 'pending',
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as Order;
}

function makeHelper(id: string): Helper {
  return {
    id,
    name: { family: '田中', given: id },
    qualifications: [],
    can_physical_care: false,
    transportation: 'bicycle',
    weekly_availability: {},
    preferred_hours: { min: 0, max: 8 },
    available_hours: { min: 0, max: 8 },
    customer_training_status: {},
    employment_type: 'part_time',
    gender: 'female',
    created_at: new Date(),
    updated_at: new Date(),
  } as Helper;
}

describe('useScheduleData loading', () => {
  it('全hookロード完了 → loading=false', () => {
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.loading).toBe(false);
  });

  it('helpersLoading=true → loading=true', () => {
    vi.mocked(useHelpers).mockReturnValue({ helpers: mockHelpers, loading: true, error: null });
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.loading).toBe(true);
    vi.mocked(useHelpers).mockReturnValue({ helpers: mockHelpers, loading: false, error: null });
  });

  it('customersLoading=true → loading=true', () => {
    vi.mocked(useCustomers).mockReturnValue({ customers: mockCustomers, loading: true, error: null });
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.loading).toBe(true);
    vi.mocked(useCustomers).mockReturnValue({ customers: mockCustomers, loading: false, error: null });
  });

  it('ordersLoading=true → loading=true', () => {
    vi.mocked(useOrders).mockReturnValue({ orders: [], loading: true, error: null });
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.loading).toBe(true);
    vi.mocked(useOrders).mockReturnValue({ orders: [], loading: false, error: null });
  });

  it('unavailabilityLoading=true → loading=true', () => {
    vi.mocked(useStaffUnavailability).mockReturnValue({ unavailability: [], loading: true, error: null });
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.loading).toBe(true);
    vi.mocked(useStaffUnavailability).mockReturnValue({ unavailability: [], loading: false, error: null });
  });

  it('travelTimesLoading=true → loading=true', () => {
    vi.mocked(useTravelTimes).mockReturnValue({ travelTimeLookup: new Map(), loading: true, error: null });
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.loading).toBe(true);
    vi.mocked(useTravelTimes).mockReturnValue({ travelTimeLookup: new Map(), loading: false, error: null });
  });

  it('travelTimeLookupが返される', () => {
    const lookup = new Map([['C001_C002', 15]]);
    vi.mocked(useTravelTimes).mockReturnValue({ travelTimeLookup: lookup, loading: false, error: null });
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.travelTimeLookup).toBe(lookup);
    vi.mocked(useTravelTimes).mockReturnValue({ travelTimeLookup: new Map(), loading: false, error: null });
  });
});

describe('useScheduleData ordersByDay', () => {
  it('オーダーが曜日ごとに振り分けられる', () => {
    const mondayOrder = makeOrder({ id: 'o1', date: new Date('2025-01-06') }); // Monday
    const tuesdayOrder = makeOrder({ id: 'o2', date: new Date('2025-01-07') }); // Tuesday
    const fridayOrder = makeOrder({ id: 'o3', date: new Date('2025-01-10') }); // Friday

    vi.mocked(useOrders).mockReturnValue({
      orders: [mondayOrder, tuesdayOrder, fridayOrder],
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.ordersByDay.monday).toHaveLength(1);
    expect(result.current.ordersByDay.tuesday).toHaveLength(1);
    expect(result.current.ordersByDay.friday).toHaveLength(1);
    expect(result.current.ordersByDay.wednesday).toHaveLength(0);
    expect(result.current.ordersByDay.thursday).toHaveLength(0);
    expect(result.current.ordersByDay.saturday).toHaveLength(0);
    expect(result.current.ordersByDay.sunday).toHaveLength(0);

    vi.mocked(useOrders).mockReturnValue({ orders: [], loading: false, error: null });
  });

  it('日曜日のオーダーが正しく振り分けられる', () => {
    const sundayOrder = makeOrder({ id: 'o1', date: new Date('2025-01-12') }); // Sunday

    vi.mocked(useOrders).mockReturnValue({
      orders: [sundayOrder],
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.ordersByDay.sunday).toHaveLength(1);
    expect(result.current.ordersByDay.sunday[0].id).toBe('o1');

    vi.mocked(useOrders).mockReturnValue({ orders: [], loading: false, error: null });
  });
});

describe('useScheduleData orderCounts', () => {
  it('オーダーがある曜日のみカウントが返される', () => {
    const orders = [
      makeOrder({ id: 'o1', date: new Date('2025-01-06') }), // Monday
      makeOrder({ id: 'o2', date: new Date('2025-01-06') }), // Monday
      makeOrder({ id: 'o3', date: new Date('2025-01-08') }), // Wednesday
    ];

    vi.mocked(useOrders).mockReturnValue({ orders, loading: false, error: null });

    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.orderCounts.monday).toBe(2);
    expect(result.current.orderCounts.wednesday).toBe(1);
    expect(result.current.orderCounts.tuesday).toBeUndefined();

    vi.mocked(useOrders).mockReturnValue({ orders: [], loading: false, error: null });
  });

  it('オーダーなし → 空オブジェクト', () => {
    vi.mocked(useOrders).mockReturnValue({ orders: [], loading: false, error: null });

    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(Object.keys(result.current.orderCounts)).toHaveLength(0);
  });
});

describe('useScheduleData getDaySchedule', () => {
  it('割当済みオーダーがヘルパー行に振り分けられる', () => {
    const helperMap = new Map<string, Helper>([
      ['h1', makeHelper('h1')],
      ['h2', makeHelper('h2')],
    ]);
    vi.mocked(useHelpers).mockReturnValue({ helpers: helperMap, loading: false, error: null });

    const orders = [
      makeOrder({ id: 'o1', date: new Date('2025-01-06'), assigned_staff_ids: ['h1'], start_time: '10:00' }),
      makeOrder({ id: 'o2', date: new Date('2025-01-06'), assigned_staff_ids: ['h1'], start_time: '09:00' }),
      makeOrder({ id: 'o3', date: new Date('2025-01-06'), assigned_staff_ids: ['h2'] }),
    ];
    vi.mocked(useOrders).mockReturnValue({ orders, loading: false, error: null });

    const { result } = renderHook(() => useScheduleData(weekStart));
    const schedule = result.current.getDaySchedule('monday', new Date('2025-01-06'));

    expect(schedule.totalOrders).toBe(3);
    expect(schedule.unassignedOrders).toHaveLength(0);
    expect(schedule.helperRows).toHaveLength(2);

    // h1のオーダーが時間順にソートされている
    const h1Row = schedule.helperRows.find((r) => r.helper.id === 'h1')!;
    expect(h1Row.orders).toHaveLength(2);
    expect(h1Row.orders[0].start_time).toBe('09:00');
    expect(h1Row.orders[1].start_time).toBe('10:00');

    vi.mocked(useHelpers).mockReturnValue({ helpers: mockHelpers, loading: false, error: null });
    vi.mocked(useOrders).mockReturnValue({ orders: [], loading: false, error: null });
  });

  it('未割当オーダーがunassignedOrdersに入る', () => {
    vi.mocked(useHelpers).mockReturnValue({ helpers: new Map(), loading: false, error: null });

    const orders = [
      makeOrder({ id: 'o1', date: new Date('2025-01-06'), assigned_staff_ids: [] }),
    ];
    vi.mocked(useOrders).mockReturnValue({ orders, loading: false, error: null });

    const { result } = renderHook(() => useScheduleData(weekStart));
    const schedule = result.current.getDaySchedule('monday', new Date('2025-01-06'));

    expect(schedule.unassignedOrders).toHaveLength(1);
    expect(schedule.unassignedOrders[0].id).toBe('o1');

    vi.mocked(useHelpers).mockReturnValue({ helpers: mockHelpers, loading: false, error: null });
    vi.mocked(useOrders).mockReturnValue({ orders: [], loading: false, error: null });
  });

  it('オーダーなしのヘルパーも空の行として含まれる', () => {
    const helperMap = new Map<string, Helper>([
      ['h1', makeHelper('h1')],
    ]);
    vi.mocked(useHelpers).mockReturnValue({ helpers: helperMap, loading: false, error: null });
    vi.mocked(useOrders).mockReturnValue({ orders: [], loading: false, error: null });

    const { result } = renderHook(() => useScheduleData(weekStart));
    const schedule = result.current.getDaySchedule('monday', new Date('2025-01-06'));

    expect(schedule.helperRows).toHaveLength(1);
    expect(schedule.helperRows[0].helper.id).toBe('h1');
    expect(schedule.helperRows[0].orders).toHaveLength(0);

    vi.mocked(useHelpers).mockReturnValue({ helpers: mockHelpers, loading: false, error: null });
  });

  it('ヘルパー行がIDでソートされる', () => {
    const helperMap = new Map<string, Helper>([
      ['h3', makeHelper('h3')],
      ['h1', makeHelper('h1')],
      ['h2', makeHelper('h2')],
    ]);
    vi.mocked(useHelpers).mockReturnValue({ helpers: helperMap, loading: false, error: null });
    vi.mocked(useOrders).mockReturnValue({ orders: [], loading: false, error: null });

    const { result } = renderHook(() => useScheduleData(weekStart));
    const schedule = result.current.getDaySchedule('monday', new Date('2025-01-06'));

    expect(schedule.helperRows.map((r) => r.helper.id)).toEqual(['h1', 'h2', 'h3']);

    vi.mocked(useHelpers).mockReturnValue({ helpers: mockHelpers, loading: false, error: null });
  });

  it('1つのオーダーが複数スタッフに割当されている場合、各スタッフ行に含まれる', () => {
    const helperMap = new Map<string, Helper>([
      ['h1', makeHelper('h1')],
      ['h2', makeHelper('h2')],
    ]);
    vi.mocked(useHelpers).mockReturnValue({ helpers: helperMap, loading: false, error: null });

    const orders = [
      makeOrder({ id: 'o1', date: new Date('2025-01-06'), assigned_staff_ids: ['h1', 'h2'] }),
    ];
    vi.mocked(useOrders).mockReturnValue({ orders, loading: false, error: null });

    const { result } = renderHook(() => useScheduleData(weekStart));
    const schedule = result.current.getDaySchedule('monday', new Date('2025-01-06'));

    const h1Row = schedule.helperRows.find((r) => r.helper.id === 'h1')!;
    const h2Row = schedule.helperRows.find((r) => r.helper.id === 'h2')!;
    expect(h1Row.orders).toHaveLength(1);
    expect(h2Row.orders).toHaveLength(1);

    vi.mocked(useHelpers).mockReturnValue({ helpers: mockHelpers, loading: false, error: null });
    vi.mocked(useOrders).mockReturnValue({ orders: [], loading: false, error: null });
  });
});
