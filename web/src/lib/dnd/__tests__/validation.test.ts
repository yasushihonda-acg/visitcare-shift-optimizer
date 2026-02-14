import { describe, it, expect } from 'vitest';
import { validateDrop } from '../validation';
import type { Order, Helper, Customer, StaffUnavailability, DayOfWeek } from '@/types';

// --- テストヘルパー関数 ---

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    week_start_date: new Date('2026-02-09'),
    date: new Date('2026-02-09'),
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    assigned_staff_ids: ['helper-a'],
    status: 'assigned',
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeHelper(overrides: Partial<Helper> = {}): Helper {
  return {
    id: 'helper-b',
    name: { family: '田中', given: '太郎' },
    qualifications: ['初任者研修'],
    can_physical_care: true,
    transportation: 'car',
    weekly_availability: {
      monday: [{ start_time: '08:00', end_time: '18:00' }],
    },
    preferred_hours: { min: 20, max: 40 },
    available_hours: { min: 0, max: 40 },
    customer_training_status: {},
    employment_type: 'full_time',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    name: { family: '山田', given: '花子' },
    address: '東京都',
    location: { lat: 35.6, lng: 139.7 },
    ng_staff_ids: [],
    preferred_staff_ids: [],
    weekly_services: {},
    service_manager: 'mgr-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function baseInput() {
  const helper = makeHelper();
  const customer = makeCustomer();
  return {
    order: makeOrder(),
    targetHelperId: 'helper-b',
    helpers: new Map([['helper-b', helper]]),
    customers: new Map([['cust-1', customer]]),
    targetHelperOrders: [] as Order[],
    unavailability: [] as StaffUnavailability[],
    day: 'monday' as DayOfWeek,
  };
}

// --- テストケース ---

describe('validateDrop', () => {
  describe('成功パス', () => {
    it('制約なしで割当可能', () => {
      const result = validateDrop(baseInput());
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings).toHaveLength(0);
      }
    });
  });

  describe('error制約（ドロップ拒否）', () => {
    it('NGスタッフ → 拒否', () => {
      const input = baseInput();
      input.customers.set('cust-1', makeCustomer({ ng_staff_ids: ['helper-b'] }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('NG');
      }
    });

    it('資格不適合（身体介護 + can_physical_care=false） → 拒否', () => {
      const input = baseInput();
      input.helpers.set('helper-b', makeHelper({ can_physical_care: false }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('資格');
      }
    });

    it('生活援助は資格不問 → 許可', () => {
      const input = baseInput();
      input.order = makeOrder({ service_type: 'daily_living' });
      input.helpers.set('helper-b', makeHelper({ can_physical_care: false }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
    });

    it('時間重複 → 拒否', () => {
      const input = baseInput();
      input.targetHelperOrders = [makeOrder({ id: 'existing', start_time: '09:30', end_time: '10:30' })];

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('重複');
      }
    });

    it('時間が隣接（重複なし） → 許可', () => {
      const input = baseInput();
      input.targetHelperOrders = [makeOrder({ id: 'existing', start_time: '10:00', end_time: '11:00' })];

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
    });

    it('希望休（終日） → 拒否', () => {
      const input = baseInput();
      input.unavailability = [{
        id: 'unavail-1',
        staff_id: 'helper-b',
        week_start_date: new Date('2026-02-09'),
        unavailable_slots: [{ date: new Date('2026-02-09'), all_day: true }],
        submitted_at: new Date(),
      }];

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('希望休');
      }
    });

    it('希望休（時間帯重複） → 拒否', () => {
      const input = baseInput();
      input.unavailability = [{
        id: 'unavail-2',
        staff_id: 'helper-b',
        week_start_date: new Date('2026-02-09'),
        unavailable_slots: [{
          date: new Date('2026-02-09'),
          all_day: false,
          start_time: '09:00',
          end_time: '12:00',
        }],
        submitted_at: new Date(),
      }];

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
    });
  });

  describe('warning制約（ドロップ許可+警告）', () => {
    it('勤務時間外 → 許可 + 警告', () => {
      const input = baseInput();
      // ヘルパーの勤務時間を午後のみに設定
      input.helpers.set('helper-b', makeHelper({
        weekly_availability: {
          monday: [{ start_time: '13:00', end_time: '18:00' }],
        },
      }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('勤務時間外');
      }
    });

    it('勤務時間内 → 許可 + 警告なし', () => {
      const input = baseInput();

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings).toHaveLength(0);
      }
    });
  });

  describe('ヘルパー不在', () => {
    it('存在しないヘルパー → 拒否', () => {
      const input = baseInput();
      input.targetHelperId = 'nonexistent';

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
    });
  });
});
