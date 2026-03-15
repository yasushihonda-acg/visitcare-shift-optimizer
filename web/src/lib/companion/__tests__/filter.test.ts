import { describe, it, expect } from 'vitest';
import { getCompanionCandidates } from '../filter';
import type { Order, Customer, Helper } from '@/types';

/** テスト用ヘルパー生成ヘルパー */
function makeHelper(id: string, lastName: string): Helper {
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
  } as Helper;
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    customer_id: 'c1',
    assigned_staff_ids: ['h1'],
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
});
