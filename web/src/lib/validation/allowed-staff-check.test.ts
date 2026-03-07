import { describe, it, expect } from 'vitest';
import { checkAllowedStaff } from './allowed-staff-check';
import type { Customer, Helper, Order, StaffUnavailability } from '@/types';

// ── テスト用ファクトリ ──────────────────────────────────────────────────────

function makeHelper(overrides: Partial<Helper> & Pick<Helper, 'id'>): Helper {
  return {
    name: { family: 'テスト', given: '太郎', short: overrides.id },
    qualifications: [],
    can_physical_care: true,
    transportation: 'car',
    weekly_availability: {},
    preferred_hours: { min: 0, max: 40 },
    available_hours: { min: 0, max: 40 },
    customer_training_status: {},
    employment_type: 'full_time',
    gender: 'male',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<Customer> & Pick<Customer, 'id'>): Customer {
  return {
    name: { family: 'テスト', given: '利用者' },
    address: '東京都千代田区1-1-1',
    location: { lat: 35.0, lng: 139.0 },
    ng_staff_ids: [],
    allowed_staff_ids: [],
    preferred_staff_ids: [],
    same_household_customer_ids: [],
    same_facility_customer_ids: [],
    weekly_services: {},
    service_manager: 'サ責A',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// 2026-02-23 = 月曜日
const MONDAY = new Date('2026-02-23T09:00:00');
// 2026-02-24 = 火曜日
const TUESDAY = new Date('2026-02-24T09:00:00');

function makeOrder(overrides: Partial<Order> & Pick<Order, 'id' | 'customer_id'>): Order {
  return {
    week_start_date: MONDAY,
    date: MONDAY,
    start_time: '09:00',
    end_time: '10:00',
    service_type: '生活援助',
    assigned_staff_ids: [],
    status: 'pending',
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ── テストケース ───────────────────────────────────────────────────────────

describe('checkAllowedStaff', () => {
  describe('allowed_staff_ids が空', () => {
    it('制限なし（空）の利用者は警告なし', () => {
      const customer = makeCustomer({ id: 'C001', allowed_staff_ids: [] });
      const helper = makeHelper({
        id: 'H001',
        weekly_availability: { monday: [{ start_time: '08:00', end_time: '17:00' }] },
      });
      const order = makeOrder({ id: 'ORD-001', customer_id: 'C001' });

      const result = checkAllowedStaff({
        customers: new Map([['C001', customer]]),
        helpers: new Map([['H001', helper]]),
        orders: [order],
        unavailability: [],
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('allowed helper が有効な場合', () => {
    it('当日の稼働時間帯をカバーしている allowed helper がいれば警告なし', () => {
      const customer = makeCustomer({ id: 'C001', allowed_staff_ids: ['H001'] });
      const helper = makeHelper({
        id: 'H001',
        weekly_availability: { monday: [{ start_time: '08:00', end_time: '17:00' }] },
      });
      const order = makeOrder({ id: 'ORD-001', customer_id: 'C001', start_time: '09:00', end_time: '10:00' });

      const result = checkAllowedStaff({
        customers: new Map([['C001', customer]]),
        helpers: new Map([['H001', helper]]),
        orders: [order],
        unavailability: [],
      });

      expect(result).toHaveLength(0);
    });

    it('複数 allowed helper のうち 1 人でも有効なら警告なし', () => {
      const customer = makeCustomer({ id: 'C001', allowed_staff_ids: ['H001', 'H002'] });
      const h1 = makeHelper({ id: 'H001', weekly_availability: {} }); // 月曜なし
      const h2 = makeHelper({
        id: 'H002',
        weekly_availability: { monday: [{ start_time: '08:00', end_time: '17:00' }] },
      });
      const order = makeOrder({ id: 'ORD-001', customer_id: 'C001' });

      const result = checkAllowedStaff({
        customers: new Map([['C001', customer]]),
        helpers: new Map([['H001', h1], ['H002', h2]]),
        orders: [order],
        unavailability: [],
      });

      expect(result).toHaveLength(0);
    });

    it('希望休がオーダーと重複しない時間帯のみなら警告なし', () => {
      const customer = makeCustomer({ id: 'C001', allowed_staff_ids: ['H001'] });
      const helper = makeHelper({
        id: 'H001',
        weekly_availability: { monday: [{ start_time: '08:00', end_time: '17:00' }] },
      });
      const order = makeOrder({ id: 'ORD-001', customer_id: 'C001', start_time: '09:00', end_time: '10:00' });
      // 希望休は 14:00-17:00（オーダー 09:00-10:00 と重複しない）
      const unavailability: StaffUnavailability[] = [
        {
          id: 'U001',
          staff_id: 'H001',
          week_start_date: MONDAY,
          unavailable_slots: [{ date: MONDAY, all_day: false, start_time: '14:00', end_time: '17:00' }],
          submitted_at: new Date(),
        },
      ];

      const result = checkAllowedStaff({
        customers: new Map([['C001', customer]]),
        helpers: new Map([['H001', helper]]),
        orders: [order],
        unavailability,
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('全員対応不可 → 警告あり', () => {
    it('allowed helper 全員が対象曜日に availability なし → 警告', () => {
      const customer = makeCustomer({ id: 'C001', allowed_staff_ids: ['H001'] });
      const helper = makeHelper({
        id: 'H001',
        weekly_availability: { tuesday: [{ start_time: '08:00', end_time: '17:00' }] }, // 月曜なし
      });
      const order = makeOrder({ id: 'ORD-001', customer_id: 'C001', date: MONDAY });

      const result = checkAllowedStaff({
        customers: new Map([['C001', customer]]),
        helpers: new Map([['H001', helper]]),
        orders: [order],
        unavailability: [],
      });

      expect(result).toHaveLength(1);
      expect(result[0].order_id).toBe('ORD-001');
      expect(result[0].day_of_week).toBe('monday');
      expect(result[0].customer_id).toBe('C001');
    });

    it('allowed helper 全員が希望休（全日）→ 警告', () => {
      const customer = makeCustomer({ id: 'C001', allowed_staff_ids: ['H001'] });
      const helper = makeHelper({
        id: 'H001',
        weekly_availability: { monday: [{ start_time: '08:00', end_time: '17:00' }] },
      });
      const order = makeOrder({ id: 'ORD-001', customer_id: 'C001', date: MONDAY });
      const unavailability: StaffUnavailability[] = [
        {
          id: 'U001',
          staff_id: 'H001',
          week_start_date: MONDAY,
          unavailable_slots: [{ date: MONDAY, all_day: true }],
          submitted_at: new Date(),
        },
      ];

      const result = checkAllowedStaff({
        customers: new Map([['C001', customer]]),
        helpers: new Map([['H001', helper]]),
        orders: [order],
        unavailability,
      });

      expect(result).toHaveLength(1);
      expect(result[0].allowed_helper_names).toContain('H001');
    });

    it('allowed helper 全員が時間帯不一致 → 警告', () => {
      const customer = makeCustomer({ id: 'C001', allowed_staff_ids: ['H001'] });
      const helper = makeHelper({
        id: 'H001',
        weekly_availability: { monday: [{ start_time: '13:00', end_time: '17:00' }] }, // 9-10時をカバーしない
      });
      const order = makeOrder({ id: 'ORD-001', customer_id: 'C001', start_time: '09:00', end_time: '10:00' });

      const result = checkAllowedStaff({
        customers: new Map([['C001', customer]]),
        helpers: new Map([['H001', helper]]),
        orders: [order],
        unavailability: [],
      });

      expect(result).toHaveLength(1);
    });

    it('希望休の時間帯がオーダーと重複する場合 → 警告', () => {
      const customer = makeCustomer({ id: 'C001', allowed_staff_ids: ['H001'] });
      const helper = makeHelper({
        id: 'H001',
        weekly_availability: { monday: [{ start_time: '08:00', end_time: '17:00' }] },
      });
      const order = makeOrder({ id: 'ORD-001', customer_id: 'C001', start_time: '09:00', end_time: '10:00' });
      // 希望休 09:30-10:30（一部重複）
      const unavailability: StaffUnavailability[] = [
        {
          id: 'U001',
          staff_id: 'H001',
          week_start_date: MONDAY,
          unavailable_slots: [{ date: MONDAY, all_day: false, start_time: '09:30', end_time: '10:30' }],
          submitted_at: new Date(),
        },
      ];

      const result = checkAllowedStaff({
        customers: new Map([['C001', customer]]),
        helpers: new Map([['H001', helper]]),
        orders: [order],
        unavailability,
      });

      expect(result).toHaveLength(1);
    });

    it('allowed helper が helpers マスタに存在しない場合 → 警告', () => {
      const customer = makeCustomer({ id: 'C001', allowed_staff_ids: ['H999'] }); // 存在しないID
      const order = makeOrder({ id: 'ORD-001', customer_id: 'C001' });

      const result = checkAllowedStaff({
        customers: new Map([['C001', customer]]),
        helpers: new Map(), // H999 なし
        orders: [order],
        unavailability: [],
      });

      expect(result).toHaveLength(1);
      expect(result[0].allowed_helper_names).toHaveLength(0); // 名前リストは空
    });
  });

  describe('複数オーダー・複数利用者', () => {
    it('複数オーダーのうち問題あるものだけ警告に含まれる', () => {
      const customer = makeCustomer({ id: 'C001', allowed_staff_ids: ['H001'] });
      const helper = makeHelper({
        id: 'H001',
        weekly_availability: { monday: [{ start_time: '08:00', end_time: '17:00' }] },
      });
      const orderOk = makeOrder({ id: 'ORD-001', customer_id: 'C001', date: MONDAY }); // 月曜 OK
      const orderNg = makeOrder({ id: 'ORD-002', customer_id: 'C001', date: TUESDAY }); // 火曜 → H001 は月曜のみ

      const result = checkAllowedStaff({
        customers: new Map([['C001', customer]]),
        helpers: new Map([['H001', helper]]),
        orders: [orderOk, orderNg],
        unavailability: [],
      });

      expect(result).toHaveLength(1);
      expect(result[0].order_id).toBe('ORD-002');
      expect(result[0].day_of_week).toBe('tuesday');
    });

    it('allowed_staff_ids が空の利用者と非空の利用者が混在', () => {
      const c1 = makeCustomer({ id: 'C001', allowed_staff_ids: [] });
      const c2 = makeCustomer({ id: 'C002', allowed_staff_ids: ['H001'] });
      const helper = makeHelper({ id: 'H001', weekly_availability: {} }); // 月曜なし
      const o1 = makeOrder({ id: 'ORD-001', customer_id: 'C001' });
      const o2 = makeOrder({ id: 'ORD-002', customer_id: 'C002' });

      const result = checkAllowedStaff({
        customers: new Map([['C001', c1], ['C002', c2]]),
        helpers: new Map([['H001', helper]]),
        orders: [o1, o2],
        unavailability: [],
      });

      expect(result).toHaveLength(1);
      expect(result[0].customer_id).toBe('C002');
    });
  });
});
