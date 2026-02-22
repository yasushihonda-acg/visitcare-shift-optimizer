import { describe, it, expect } from 'vitest';
import { getStaffCount } from '../staffCount';
import type { Order, Customer, DayOfWeek } from '@/types';

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

describe('getStaffCount', () => {
  describe('フォールバック優先順位', () => {
    it('order.staff_count がある場合 → そのまま返す', () => {
      const order = makeOrder({ staff_count: 3 });
      expect(getStaffCount(order)).toBe(3);
    });

    it('order.staff_count=1 → 1を返す（0は除外）', () => {
      const order = makeOrder({ staff_count: 1 });
      expect(getStaffCount(order)).toBe(1);
    });

    it('customer の weekly_services からマッチ → staff_count を返す', () => {
      const order = makeOrder({ start_time: '09:00', end_time: '10:30', service_type: 'physical_care' });
      const customer = makeCustomer({
        weekly_services: {
          monday: [
            { start_time: '09:00', end_time: '10:30', service_type: 'physical_care', staff_count: 2 },
          ],
        },
      });
      expect(getStaffCount(order, customer, 'monday')).toBe(2);
    });

    it('時刻・サービス種別が一致しない → デフォルト 1', () => {
      const order = makeOrder({ start_time: '09:00', end_time: '10:00', service_type: 'physical_care' });
      const customer = makeCustomer({
        weekly_services: {
          monday: [
            { start_time: '11:00', end_time: '12:00', service_type: 'physical_care', staff_count: 2 },
          ],
        },
      });
      expect(getStaffCount(order, customer, 'monday')).toBe(1);
    });

    it('サービス種別が異なる → デフォルト 1', () => {
      const order = makeOrder({ start_time: '09:00', end_time: '10:00', service_type: 'physical_care' });
      const customer = makeCustomer({
        weekly_services: {
          monday: [
            { start_time: '09:00', end_time: '10:00', service_type: 'daily_living', staff_count: 2 },
          ],
        },
      });
      expect(getStaffCount(order, customer, 'monday')).toBe(1);
    });

    it('customer 未定義 → デフォルト 1', () => {
      const order = makeOrder();
      expect(getStaffCount(order, undefined, 'monday')).toBe(1);
    });

    it('day 未定義（customer あり） → weekly_services を参照せずデフォルト 1', () => {
      const order = makeOrder({ start_time: '09:00', end_time: '10:00', service_type: 'physical_care' });
      const customer = makeCustomer({
        weekly_services: {
          monday: [
            { start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 2 },
          ],
        },
      });
      // dayを渡さない
      expect(getStaffCount(order, customer)).toBe(1);
    });

    it('weekly_services が空 → デフォルト 1', () => {
      const order = makeOrder();
      const customer = makeCustomer({ weekly_services: {} });
      expect(getStaffCount(order, customer, 'monday')).toBe(1);
    });

    it('order.staff_count が優先（customer のマッチより上）', () => {
      const order = makeOrder({
        start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 3,
      });
      const customer = makeCustomer({
        weekly_services: {
          monday: [
            { start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 2 },
          ],
        },
      });
      expect(getStaffCount(order, customer, 'monday')).toBe(3);
    });
  });

  describe('エッジケース', () => {
    it('日曜日も正しく参照できる', () => {
      const order = makeOrder({ start_time: '10:00', end_time: '11:00', service_type: 'daily_living' });
      const customer = makeCustomer({
        weekly_services: {
          sunday: [
            { start_time: '10:00', end_time: '11:00', service_type: 'daily_living', staff_count: 2 },
          ],
        },
      });
      expect(getStaffCount(order, customer, 'sunday')).toBe(2);
    });

    it('複数のサービスから正しいものをマッチ', () => {
      const order = makeOrder({ start_time: '14:00', end_time: '15:00', service_type: 'mixed' });
      const customer = makeCustomer({
        weekly_services: {
          wednesday: [
            { start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 1 },
            { start_time: '14:00', end_time: '15:00', service_type: 'mixed', staff_count: 2 },
          ],
        },
      });
      expect(getStaffCount(order, customer, 'wednesday')).toBe(2);
    });
  });
});
