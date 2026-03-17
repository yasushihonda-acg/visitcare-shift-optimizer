import { describe, it, expect } from 'vitest';
import { getCompanionCandidates } from '../filter';
import type { Order, Customer, Helper, StaffUnavailability } from '@/types';

/** テスト用ヘルパー生成ヘルパー */
function makeHelper(id: string, lastName: string, overrides: Partial<Helper> = {}): Helper {
  return {
    id,
    name: { family: lastName, given: 'テスト' },
    qualifications: ['介護福祉士'],
    can_physical_care: true,
    transportation: 'car',
    weekly_availability: {},
    preferred_hours: { min: 4, max: 8 },
    available_hours: { min: 0, max: 8 },
    customer_training_status: {},
    employment_type: 'full_time',
    gender: 'female',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as Helper;
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    customer_id: 'c1',
    assigned_staff_ids: ['h1'],
    date: new Date('2025-01-06'),
    start_time: '09:00',
    end_time: '10:00',
    status: 'assigned',
    manually_edited: false,
    ...overrides,
  } as Order;
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'c1',
    ng_staff_ids: [],
    allowed_staff_ids: [],
    preferred_staff_ids: [],
    ...overrides,
  } as Customer;
}

describe('getCompanionCandidates', () => {
  const h1 = makeHelper('h1', '山田');
  const h2 = makeHelper('h2', '鈴木');
  const h3 = makeHelper('h3', '佐藤');
  const h4 = makeHelper('h4', '田中');

  const helpers = new Map<string, Helper>([
    ['h1', h1],
    ['h2', h2],
    ['h3', h3],
    ['h4', h4],
  ]);

  it('NG除外: customer.ng_staff_idsに含まれるヘルパーを除外する', () => {
    const order = makeOrder({ assigned_staff_ids: ['h1'] });
    const customer = makeCustomer({ ng_staff_ids: ['h2'] });

    const result = getCompanionCandidates({ order, customer, helpers });

    expect(result.map(h => h.id)).not.toContain('h2');
    expect(result.map(h => h.id)).not.toContain('h1'); // 割当済みも除外
  });

  it('割当済み除外: order.assigned_staff_idsに含まれるヘルパーを除外する', () => {
    const order = makeOrder({ assigned_staff_ids: ['h1', 'h2'] });
    const customer = makeCustomer();

    const result = getCompanionCandidates({ order, customer, helpers });

    expect(result.map(h => h.id)).not.toContain('h1');
    expect(result.map(h => h.id)).not.toContain('h2');
    expect(result.map(h => h.id)).toContain('h3');
    expect(result.map(h => h.id)).toContain('h4');
  });

  it('allowed空 → 全員候補（NG・割当済み以外）', () => {
    const order = makeOrder({ assigned_staff_ids: ['h1'] });
    const customer = makeCustomer({ allowed_staff_ids: [] });

    const result = getCompanionCandidates({ order, customer, helpers });

    expect(result).toHaveLength(3); // h2, h3, h4
  });

  it('allowed有 → allowed + preferred を除外する', () => {
    const order = makeOrder({ assigned_staff_ids: ['h1'] });
    const customer = makeCustomer({
      allowed_staff_ids: ['h2', 'h3'],
      preferred_staff_ids: ['h4'],
    });

    // allowed=[h2,h3], preferred=[h4] → h2,h3,h4は除外
    // 残りのヘルパーはなし（h1は割当済み）
    const result = getCompanionCandidates({ order, customer, helpers });
    expect(result).toHaveLength(0);
  });

  it('名前順ソートで返却する', () => {
    const order = makeOrder({ assigned_staff_ids: [] });
    const customer = makeCustomer();

    const result = getCompanionCandidates({ order, customer, helpers });

    const names = result.map(h => h.name.family);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'ja'));
    expect(names).toEqual(sorted);
  });

  it('空Mapで空配列を返す', () => {
    const order = makeOrder();
    const customer = makeCustomer();

    const result = getCompanionCandidates({
      order,
      customer,
      helpers: new Map(),
    });

    expect(result).toEqual([]);
  });

  describe('希望休による除外', () => {
    it('終日希望休のスタッフを候補から除外する', () => {
      const order = makeOrder({ assigned_staff_ids: ['h1'] });
      const customer = makeCustomer();
      const unavailability: StaffUnavailability[] = [{
        id: 'u1',
        staff_id: 'h2',
        week_start_date: new Date('2025-01-06'),
        unavailable_slots: [{ date: new Date('2025-01-06'), all_day: true }],
        submitted_at: new Date(),
      }];

      const result = getCompanionCandidates({ order, customer, helpers, unavailability });

      expect(result.map(h => h.id)).not.toContain('h2');
      expect(result.map(h => h.id)).toContain('h3');
      expect(result.map(h => h.id)).toContain('h4');
    });

    it('時間帯重複の希望休のスタッフを候補から除外する', () => {
      const order = makeOrder({ assigned_staff_ids: ['h1'], start_time: '09:00', end_time: '10:00' });
      const customer = makeCustomer();
      const unavailability: StaffUnavailability[] = [{
        id: 'u1',
        staff_id: 'h3',
        week_start_date: new Date('2025-01-06'),
        unavailable_slots: [{
          date: new Date('2025-01-06'),
          all_day: false,
          start_time: '08:00',
          end_time: '09:30',
        }],
        submitted_at: new Date(),
      }];

      const result = getCompanionCandidates({ order, customer, helpers, unavailability });

      expect(result.map(h => h.id)).not.toContain('h3');
    });

    it('別日の希望休は影響しない', () => {
      const order = makeOrder({ assigned_staff_ids: ['h1'] });
      const customer = makeCustomer();
      const unavailability: StaffUnavailability[] = [{
        id: 'u1',
        staff_id: 'h2',
        week_start_date: new Date('2025-01-06'),
        unavailable_slots: [{ date: new Date('2025-01-07'), all_day: true }],
        submitted_at: new Date(),
      }];

      const result = getCompanionCandidates({ order, customer, helpers, unavailability });

      expect(result.map(h => h.id)).toContain('h2');
    });
  });

  describe('性別制限による除外', () => {
    it('gender_requirement=female → 男性スタッフを除外する', () => {
      const hMale = makeHelper('h2', '鈴木', { gender: 'male' });
      const hFemale = makeHelper('h3', '佐藤', { gender: 'female' });
      const helpersGender = new Map<string, Helper>([
        ['h1', h1],
        ['h2', hMale],
        ['h3', hFemale],
      ]);
      const order = makeOrder({ assigned_staff_ids: ['h1'] });
      const customer = makeCustomer({ gender_requirement: 'female' });

      const result = getCompanionCandidates({ order, customer, helpers: helpersGender });

      expect(result.map(h => h.id)).not.toContain('h2');
      expect(result.map(h => h.id)).toContain('h3');
    });

    it('gender_requirement=male → 女性スタッフを除外する', () => {
      const hMale = makeHelper('h2', '鈴木', { gender: 'male' });
      const hFemale = makeHelper('h3', '佐藤', { gender: 'female' });
      const helpersGender = new Map<string, Helper>([
        ['h1', h1],
        ['h2', hMale],
        ['h3', hFemale],
      ]);
      const order = makeOrder({ assigned_staff_ids: ['h1'] });
      const customer = makeCustomer({ gender_requirement: 'male' });

      const result = getCompanionCandidates({ order, customer, helpers: helpersGender });

      expect(result.map(h => h.id)).toContain('h2');
      expect(result.map(h => h.id)).not.toContain('h3');
    });

    it('gender_requirement=any → 性別フィルタなし', () => {
      const hMale = makeHelper('h2', '鈴木', { gender: 'male' });
      const hFemale = makeHelper('h3', '佐藤', { gender: 'female' });
      const helpersGender = new Map<string, Helper>([
        ['h1', h1],
        ['h2', hMale],
        ['h3', hFemale],
      ]);
      const order = makeOrder({ assigned_staff_ids: ['h1'] });
      const customer = makeCustomer({ gender_requirement: 'any' });

      const result = getCompanionCandidates({ order, customer, helpers: helpersGender });

      expect(result.map(h => h.id)).toContain('h2');
      expect(result.map(h => h.id)).toContain('h3');
    });

    it('gender_requirement未設定 → 性別フィルタなし', () => {
      const order = makeOrder({ assigned_staff_ids: ['h1'] });
      const customer = makeCustomer();

      const result = getCompanionCandidates({ order, customer, helpers });

      expect(result).toHaveLength(3);
    });
  });

  describe('勤務時間外による除外', () => {
    it('該当曜日に勤務時間がないスタッフを除外する', () => {
      const h2WithAvail = makeHelper('h2', '鈴木', {
        weekly_availability: { tuesday: [{ start_time: '08:00', end_time: '17:00' }] },
      });
      const helpersWithAvail = new Map<string, Helper>([
        ['h1', h1],
        ['h2', h2WithAvail],
        ['h3', h3],
        ['h4', h4],
      ]);
      const order = makeOrder({ assigned_staff_ids: ['h1'] });
      const customer = makeCustomer();

      const result = getCompanionCandidates({
        order, customer, helpers: helpersWithAvail, day: 'monday',
      });

      // h2はmondayに勤務時間なし → 除外
      expect(result.map(h => h.id)).not.toContain('h2');
    });

    it('オーダー時間が勤務時間外のスタッフを除外する', () => {
      const h2Late = makeHelper('h2', '鈴木', {
        weekly_availability: { monday: [{ start_time: '13:00', end_time: '17:00' }] },
      });
      const helpersWithAvail = new Map<string, Helper>([
        ['h1', h1],
        ['h2', h2Late],
        ['h3', h3],
        ['h4', h4],
      ]);
      const order = makeOrder({ assigned_staff_ids: ['h1'], start_time: '09:00', end_time: '10:00' });
      const customer = makeCustomer();

      const result = getCompanionCandidates({
        order, customer, helpers: helpersWithAvail, day: 'monday',
      });

      // h2はmondayの勤務時間が13:00-17:00で、09:00-10:00はカバーできない → 除外
      expect(result.map(h => h.id)).not.toContain('h2');
    });

    it('day未指定の場合は勤務時間フィルタをスキップする', () => {
      const order = makeOrder({ assigned_staff_ids: ['h1'] });
      const customer = makeCustomer();

      const result = getCompanionCandidates({ order, customer, helpers });

      // day未指定 → フィルタなし、h2,h3,h4が候補
      expect(result).toHaveLength(3);
    });
  });
});
