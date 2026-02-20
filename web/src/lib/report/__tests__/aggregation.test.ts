import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  orderDurationMinutes,
  aggregateStaffSummary,
  aggregateCustomerSummary,
  aggregateStatusSummary,
  aggregateServiceTypeSummary,
} from '../aggregation';
import type { Order, Helper, Customer, ServiceTypeDoc } from '@/types';

// ── テストデータファクトリ ──────────────────────────────────────

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customer_id: 'customer-1',
    week_start_date: new Date('2026-02-02'),
    date: new Date('2026-02-03'),
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    assigned_staff_ids: ['helper-1'],
    status: 'completed',
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeHelper(id: string, family: string, given: string): Helper {
  return {
    id,
    name: { family, given },
    qualifications: [],
    can_physical_care: true,
    transportation: 'car',
    weekly_availability: {},
    preferred_hours: { min: 20, max: 40 },
    available_hours: { min: 20, max: 40 },
    customer_training_status: {},
    employment_type: 'full_time',
    gender: 'female',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function makeCustomer(id: string, family: string, given: string): Customer {
  return {
    id,
    name: { family, given },
    address: '東京都',
    location: { lat: 35.0, lng: 139.0 },
    ng_staff_ids: [],
    preferred_staff_ids: [],
    weekly_services: {},
    service_manager: 'sm-1',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

// ── timeToMinutes ─────────────────────────────────────────────

describe('timeToMinutes', () => {
  it('09:00 → 540', () => {
    expect(timeToMinutes('09:00')).toBe(540);
  });

  it('00:00 → 0', () => {
    expect(timeToMinutes('00:00')).toBe(0);
  });

  it('23:59 → 1439', () => {
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('10:30 → 630', () => {
    expect(timeToMinutes('10:30')).toBe(630);
  });
});

// ── orderDurationMinutes ──────────────────────────────────────

describe('orderDurationMinutes', () => {
  it('09:00〜10:00 → 60分', () => {
    const order = makeOrder({ start_time: '09:00', end_time: '10:00' });
    expect(orderDurationMinutes(order)).toBe(60);
  });

  it('09:00〜09:30 → 30分', () => {
    const order = makeOrder({ start_time: '09:00', end_time: '09:30' });
    expect(orderDurationMinutes(order)).toBe(30);
  });

  it('09:00〜10:45 → 105分', () => {
    const order = makeOrder({ start_time: '09:00', end_time: '10:45' });
    expect(orderDurationMinutes(order)).toBe(105);
  });
});

// ── aggregateStaffSummary ─────────────────────────────────────

describe('aggregateStaffSummary', () => {
  it('空配列の場合は空を返す', () => {
    const result = aggregateStaffSummary([], new Map());
    expect(result).toHaveLength(0);
  });

  it('ヘルパーのvisitCountとtotalMinutesを集計する', () => {
    const helpers = new Map([['h1', makeHelper('h1', '山田', '太郎')]]);
    const orders = [
      makeOrder({ id: 'o1', assigned_staff_ids: ['h1'], start_time: '09:00', end_time: '10:00' }),
      makeOrder({ id: 'o2', assigned_staff_ids: ['h1'], start_time: '13:00', end_time: '14:30' }),
    ];
    const result = aggregateStaffSummary(orders, helpers);
    expect(result).toHaveLength(1);
    expect(result[0].helperId).toBe('h1');
    expect(result[0].name).toBe('山田 太郎');
    expect(result[0].visitCount).toBe(2);
    expect(result[0].totalMinutes).toBe(150); // 60 + 90
  });

  it('同一オーダーに複数スタッフが割り当てられている場合、それぞれに計上する', () => {
    const helpers = new Map([
      ['h1', makeHelper('h1', '山田', '太郎')],
      ['h2', makeHelper('h2', '鈴木', '花子')],
    ]);
    const orders = [
      makeOrder({ assigned_staff_ids: ['h1', 'h2'], start_time: '09:00', end_time: '10:00' }),
    ];
    const result = aggregateStaffSummary(orders, helpers);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.helperId === 'h1')?.visitCount).toBe(1);
    expect(result.find((r) => r.helperId === 'h2')?.visitCount).toBe(1);
  });

  it('割当なし（assigned_staff_ids が空）のオーダーは集計しない', () => {
    const helpers = new Map([['h1', makeHelper('h1', '山田', '太郎')]]);
    const orders = [makeOrder({ assigned_staff_ids: [] })];
    const result = aggregateStaffSummary(orders, helpers);
    expect(result).toHaveLength(0);
  });

  it('totalMinutes降順でソートされる', () => {
    const helpers = new Map([
      ['h1', makeHelper('h1', '山田', '太郎')],
      ['h2', makeHelper('h2', '鈴木', '花子')],
    ]);
    const orders = [
      makeOrder({ id: 'o1', assigned_staff_ids: ['h1'], start_time: '09:00', end_time: '09:30' }), // 30分
      makeOrder({ id: 'o2', assigned_staff_ids: ['h2'], start_time: '09:00', end_time: '10:30' }), // 90分
    ];
    const result = aggregateStaffSummary(orders, helpers);
    expect(result[0].helperId).toBe('h2'); // 90分が先
    expect(result[1].helperId).toBe('h1');
  });

  it('helpersマップにないIDは name を "(不明)" とする', () => {
    const orders = [makeOrder({ assigned_staff_ids: ['unknown-h'] })];
    const result = aggregateStaffSummary(orders, new Map());
    expect(result[0].name).toBe('(不明)');
  });
});

// ── aggregateCustomerSummary ──────────────────────────────────

describe('aggregateCustomerSummary', () => {
  it('空配列の場合は空を返す', () => {
    const result = aggregateCustomerSummary([], new Map());
    expect(result).toHaveLength(0);
  });

  it('利用者ごとにvisitCountとtotalMinutesを集計する', () => {
    const customers = new Map([
      ['c1', makeCustomer('c1', '田中', '一郎')],
      ['c2', makeCustomer('c2', '佐藤', '二郎')],
    ]);
    const orders = [
      makeOrder({ id: 'o1', customer_id: 'c1', start_time: '09:00', end_time: '10:00' }),
      makeOrder({ id: 'o2', customer_id: 'c1', start_time: '11:00', end_time: '11:30' }),
      makeOrder({ id: 'o3', customer_id: 'c2', start_time: '13:00', end_time: '14:00' }),
    ];
    const result = aggregateCustomerSummary(orders, customers);
    const c1 = result.find((r) => r.customerId === 'c1')!;
    const c2 = result.find((r) => r.customerId === 'c2')!;
    expect(c1.visitCount).toBe(2);
    expect(c1.totalMinutes).toBe(90); // 60 + 30
    expect(c2.visitCount).toBe(1);
    expect(c2.totalMinutes).toBe(60);
  });

  it('totalMinutes降順でソートされる', () => {
    const customers = new Map([
      ['c1', makeCustomer('c1', '田中', '一郎')],
      ['c2', makeCustomer('c2', '佐藤', '二郎')],
    ]);
    const orders = [
      makeOrder({ id: 'o1', customer_id: 'c1', start_time: '09:00', end_time: '09:30' }), // 30分
      makeOrder({ id: 'o2', customer_id: 'c2', start_time: '09:00', end_time: '10:30' }), // 90分
    ];
    const result = aggregateCustomerSummary(orders, customers);
    expect(result[0].customerId).toBe('c2');
  });
});

// ── aggregateStatusSummary ────────────────────────────────────

describe('aggregateStatusSummary', () => {
  it('空配列の場合はすべて0', () => {
    const result = aggregateStatusSummary([]);
    expect(result).toEqual({ pending: 0, assigned: 0, completed: 0, cancelled: 0, total: 0, completionRate: 0 });
  });

  it('各ステータスの件数を集計する', () => {
    const orders = [
      makeOrder({ status: 'pending' }),
      makeOrder({ status: 'assigned' }),
      makeOrder({ status: 'completed' }),
      makeOrder({ status: 'completed' }),
      makeOrder({ status: 'cancelled' }),
    ];
    const result = aggregateStatusSummary(orders);
    expect(result.pending).toBe(1);
    expect(result.assigned).toBe(1);
    expect(result.completed).toBe(2);
    expect(result.cancelled).toBe(1);
    expect(result.total).toBe(5);
  });

  it('completionRate = completed / (total - cancelled)', () => {
    const orders = [
      makeOrder({ status: 'completed' }),
      makeOrder({ status: 'completed' }),
      makeOrder({ status: 'assigned' }),
      makeOrder({ status: 'cancelled' }), // 分母から除外
    ];
    const result = aggregateStatusSummary(orders);
    // completed=2, total=4, cancelled=1 → 2/(4-1) = 66.67 → 67
    expect(result.completionRate).toBe(67);
  });

  it('全件キャンセルの場合のcompletionRateは0（ゼロ除算回避）', () => {
    const orders = [makeOrder({ status: 'cancelled' })];
    const result = aggregateStatusSummary(orders);
    expect(result.completionRate).toBe(0);
  });
});

// ── aggregateServiceTypeSummary ───────────────────────────────

describe('aggregateServiceTypeSummary', () => {
  it('空配列の場合は空を返す', () => {
    const result = aggregateServiceTypeSummary([]);
    expect(result).toHaveLength(0);
  });

  it('サービス種別ごとのvisitCountとtotalMinutesを集計する', () => {
    const orders = [
      makeOrder({ service_type: 'physical_care', start_time: '09:00', end_time: '10:00' }),
      makeOrder({ service_type: 'physical_care', start_time: '11:00', end_time: '11:30' }),
      makeOrder({ service_type: 'daily_living', start_time: '13:00', end_time: '14:00' }),
    ];
    const result = aggregateServiceTypeSummary(orders);
    const physical = result.find((r) => r.serviceType === 'physical_care')!;
    const daily = result.find((r) => r.serviceType === 'daily_living')!;
    expect(physical.visitCount).toBe(2);
    expect(physical.totalMinutes).toBe(90); // 60 + 30
    expect(daily.visitCount).toBe(1);
    expect(daily.totalMinutes).toBe(60);
  });

  it('physical_care には "身体介護" のラベルが付く', () => {
    const orders = [makeOrder({ service_type: 'physical_care' })];
    const result = aggregateServiceTypeSummary(orders);
    expect(result[0].label).toBe('身体介護');
  });

  it('daily_living には "生活援助" のラベルが付く', () => {
    const orders = [makeOrder({ service_type: 'daily_living' })];
    const result = aggregateServiceTypeSummary(orders);
    expect(result[0].label).toBe('生活援助');
  });

  it('visitCount降順でソートされる', () => {
    const orders = [
      makeOrder({ id: 'o1', service_type: 'physical_care' }),
      makeOrder({ id: 'o2', service_type: 'daily_living' }),
      makeOrder({ id: 'o3', service_type: 'daily_living' }),
    ];
    const result = aggregateServiceTypeSummary(orders);
    expect(result[0].serviceType).toBe('daily_living');
  });

  it('serviceTypes を渡すと動的ラベルが使われる', () => {
    const serviceTypes = new Map<string, ServiceTypeDoc>([
      ['physical_care', { id: 'physical_care', code: 'physical_care', label: 'カスタム身体', short_label: '身体', requires_physical_care_cert: true, sort_order: 1, created_at: new Date(), updated_at: new Date() }],
    ]);
    const orders = [makeOrder({ service_type: 'physical_care' })];
    const result = aggregateServiceTypeSummary(orders, serviceTypes);
    expect(result[0].label).toBe('カスタム身体');
  });

  it('serviceTypes に該当がない場合は静的フォールバック', () => {
    const serviceTypes = new Map<string, ServiceTypeDoc>(); // 空
    const orders = [makeOrder({ service_type: 'physical_care' })];
    const result = aggregateServiceTypeSummary(orders, serviceTypes);
    expect(result[0].label).toBe('身体介護'); // 静的フォールバック
  });
});
