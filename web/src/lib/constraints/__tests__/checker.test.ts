import { describe, it, expect } from 'vitest';
import { checkConstraints } from '../checker';
import type { Order, Helper, Customer, StaffUnavailability } from '@/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'O001',
    customer_id: 'C001',
    week_start_date: new Date('2025-01-06'),
    date: new Date('2025-01-06'),
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    assigned_staff_ids: ['H001'],
    status: 'assigned',
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeHelper(overrides: Partial<Helper> = {}): Helper {
  return {
    id: 'H001',
    name: { family: '田中', given: '太郎' },
    qualifications: ['初任者研修'],
    can_physical_care: true,
    transportation: 'bicycle',
    weekly_availability: {
      monday: [{ start_time: '08:00', end_time: '17:00' }],
    },
    preferred_hours: { min: 4, max: 8 },
    available_hours: { min: 4, max: 8 },
    customer_training_status: {},
    employment_type: 'full_time',
    gender: 'female',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'C001',
    name: { family: '佐藤', given: '花子' },
    address: '東京都',
    location: { lat: 35.6, lng: 139.7 },
    ng_staff_ids: [],
    preferred_staff_ids: [],
    weekly_services: {},
    service_manager: '管理者A',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('checkConstraints', () => {
  it('違反なし', () => {
    const helpers = new Map([['H001', makeHelper()]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const result = checkConstraints({
      orders: [makeOrder()],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
    });
    expect(result.size).toBe(0);
  });

  it('NGスタッフの検出', () => {
    const helpers = new Map([['H001', makeHelper()]]);
    const customers = new Map([['C001', makeCustomer({ ng_staff_ids: ['H001'] })]]);
    const result = checkConstraints({
      orders: [makeOrder()],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'ng_staff')).toBe(true);
  });

  it('資格不適合（身体介護に無資格者）', () => {
    const helpers = new Map([['H001', makeHelper({ can_physical_care: false })]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const result = checkConstraints({
      orders: [makeOrder({ service_type: 'physical_care' })],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'qualification')).toBe(true);
  });

  it('生活援助は資格不問', () => {
    const helpers = new Map([['H001', makeHelper({ can_physical_care: false })]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const result = checkConstraints({
      orders: [makeOrder({ service_type: 'daily_living' })],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'qualification')).toBe(false);
  });

  it('時間重複の検出', () => {
    const helpers = new Map([['H001', makeHelper()]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const order1 = makeOrder({ id: 'O001', start_time: '09:00', end_time: '10:00' });
    const order2 = makeOrder({ id: 'O002', start_time: '09:30', end_time: '10:30' });
    const result = checkConstraints({
      orders: [order1, order2],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
    });
    expect(result.get('O001')?.some((v) => v.type === 'overlap')).toBe(true);
    expect(result.get('O002')?.some((v) => v.type === 'overlap')).toBe(true);
  });

  it('希望休（終日）の検出', () => {
    const helpers = new Map([['H001', makeHelper()]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const unavailability: StaffUnavailability[] = [{
      id: 'U001',
      staff_id: 'H001',
      week_start_date: new Date('2025-01-06'),
      unavailable_slots: [{ date: new Date('2025-01-06'), all_day: true }],
      submitted_at: new Date(),
    }];
    const result = checkConstraints({
      orders: [makeOrder()],
      helpers,
      customers,
      unavailability,
      day: 'monday',
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'unavailability')).toBe(true);
  });

  it('勤務時間外の警告', () => {
    const helpers = new Map([['H001', makeHelper({
      weekly_availability: { monday: [{ start_time: '10:00', end_time: '17:00' }] },
    })]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const result = checkConstraints({
      orders: [makeOrder({ start_time: '09:00', end_time: '10:00' })],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'outside_hours' && v.severity === 'warning')).toBe(true);
  });
});
