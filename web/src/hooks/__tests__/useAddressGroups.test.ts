import { describe, it, expect } from 'vitest';
import { buildAddressGroupMap, buildAdjacentAddressOrderMap, getAddressGroupColor, ADDRESS_GROUP_COLORS } from '../useAddressGroups';
import type { Customer, Order } from '@/types';

function makeCustomer(id: string, overrides: Partial<Customer> = {}): Customer {
  return {
    id,
    name: { family: 'テスト', given: id },
    address: '東京都新宿区1-1-1',
    location: { lat: 35.68, lng: 139.69 },
    ng_staff_ids: [],
    allowed_staff_ids: [],
    preferred_staff_ids: [],
    same_household_customer_ids: [],
    same_facility_customer_ids: [],
    weekly_services: {},
    service_manager: 'テスト',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as Customer;
}

function makeOrder(id: string, customerId: string, startTime: string, endTime: string): Order {
  return {
    id,
    customer_id: customerId,
    start_time: startTime,
    end_time: endTime,
    assigned_staff_ids: [],
    service_type: 'physical_care',
    status: 'pending',
    day_of_week: 'monday',
    week_start_date: new Date('2026-03-09'),
    date: new Date('2026-03-09'),
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
  } as Order;
}

describe('buildAddressGroupMap', () => {
  it('空のMapでは空を返す', () => {
    const result = buildAddressGroupMap(new Map());
    expect(result.size).toBe(0);
  });

  it('同一世帯メンバーが同じグループになる', () => {
    const customers = new Map<string, Customer>([
      ['C001', makeCustomer('C001', { same_household_customer_ids: ['C002'] })],
      ['C002', makeCustomer('C002', { same_household_customer_ids: ['C001'] })],
      ['C003', makeCustomer('C003')],
    ]);
    const result = buildAddressGroupMap(customers);
    expect(result.has('C001')).toBe(true);
    expect(result.has('C002')).toBe(true);
    expect(result.get('C001')!.index).toBe(result.get('C002')!.index);
    expect(result.get('C001')!.type).toBe('household');
    expect(result.has('C003')).toBe(false);
  });

  it('同一施設メンバーが同じグループになる', () => {
    const customers = new Map<string, Customer>([
      ['C001', makeCustomer('C001', { same_facility_customer_ids: ['C002'] })],
      ['C002', makeCustomer('C002', { same_facility_customer_ids: ['C001'] })],
    ]);
    const result = buildAddressGroupMap(customers);
    expect(result.get('C001')!.index).toBe(result.get('C002')!.index);
    expect(result.get('C001')!.type).toBe('facility');
  });

  it('複数の独立グループに異なるインデックスを割り当てる', () => {
    const customers = new Map<string, Customer>([
      ['C001', makeCustomer('C001', { same_household_customer_ids: ['C002'] })],
      ['C002', makeCustomer('C002', { same_household_customer_ids: ['C001'] })],
      ['C003', makeCustomer('C003', { same_household_customer_ids: ['C004'] })],
      ['C004', makeCustomer('C004', { same_household_customer_ids: ['C003'] })],
    ]);
    const result = buildAddressGroupMap(customers);
    expect(result.get('C001')!.index).not.toBe(result.get('C003')!.index);
  });

  it('存在しない顧客IDへの参照を無視する', () => {
    const customers = new Map<string, Customer>([
      ['C001', makeCustomer('C001', { same_household_customer_ids: ['C999'] })],
    ]);
    const result = buildAddressGroupMap(customers);
    expect(result.has('C001')).toBe(false);
  });
});

describe('buildAdjacentAddressOrderMap', () => {
  const customers = new Map<string, Customer>([
    ['C001', makeCustomer('C001', { same_household_customer_ids: ['C002'] })],
    ['C002', makeCustomer('C002', { same_household_customer_ids: ['C001'] })],
    ['C003', makeCustomer('C003')],
  ]);

  it('隣接する同一住所ペアにインジケーターを付与する', () => {
    const helperRows = [{
      helper: { id: 'H1' },
      orders: [
        makeOrder('O1', 'C001', '09:00', '10:00'),
        makeOrder('O2', 'C002', '10:00', '11:00'),
      ],
    }];
    const result = buildAdjacentAddressOrderMap(helperRows, customers);
    expect(result.has('O1')).toBe(true);
    expect(result.has('O2')).toBe(true);
    expect(result.get('O1')!.index).toBe(result.get('O2')!.index);
  });

  it('隣接していない同一住所ペアにはインジケーターなし', () => {
    const helperRows = [{
      helper: { id: 'H1' },
      orders: [
        makeOrder('O1', 'C001', '09:00', '10:00'),
        makeOrder('O3', 'C003', '10:00', '11:00'),
        makeOrder('O2', 'C002', '11:00', '12:00'),
      ],
    }];
    const result = buildAdjacentAddressOrderMap(helperRows, customers);
    expect(result.size).toBe(0);
  });

  it('異なるヘルパー行の隣接はカウントしない', () => {
    const helperRows = [
      { helper: { id: 'H1' }, orders: [makeOrder('O1', 'C001', '09:00', '10:00')] },
      { helper: { id: 'H2' }, orders: [makeOrder('O2', 'C002', '10:00', '11:00')] },
    ];
    const result = buildAdjacentAddressOrderMap(helperRows, customers);
    expect(result.size).toBe(0);
  });

  it('同一住所でないペアは隣接でもインジケーターなし', () => {
    const helperRows = [{
      helper: { id: 'H1' },
      orders: [
        makeOrder('O1', 'C001', '09:00', '10:00'),
        makeOrder('O3', 'C003', '10:00', '11:00'),
      ],
    }];
    const result = buildAdjacentAddressOrderMap(helperRows, customers);
    expect(result.size).toBe(0);
  });

  it('空のヘルパー行では空を返す', () => {
    const result = buildAdjacentAddressOrderMap([], customers);
    expect(result.size).toBe(0);
  });

  it('3連続の同一住所オーダー（A→B→A）でも隣接ペアごとに判定', () => {
    const helperRows = [{
      helper: { id: 'H1' },
      orders: [
        makeOrder('O1', 'C001', '09:00', '10:00'),
        makeOrder('O2', 'C002', '10:00', '11:00'),
        makeOrder('O3', 'C001', '11:00', '12:00'),
      ],
    }];
    const result = buildAdjacentAddressOrderMap(helperRows, customers);
    expect(result.has('O1')).toBe(true);
    expect(result.has('O2')).toBe(true);
    expect(result.has('O3')).toBe(true);
  });
});

describe('getAddressGroupColor', () => {
  it('インデックス0-4で異なる色を返す', () => {
    const colors = [0, 1, 2, 3, 4].map(getAddressGroupColor);
    const unique = new Set(colors);
    expect(unique.size).toBe(5);
  });

  it('5以上のインデックスはローテーションする', () => {
    expect(getAddressGroupColor(5)).toBe(ADDRESS_GROUP_COLORS[0]);
    expect(getAddressGroupColor(6)).toBe(ADDRESS_GROUP_COLORS[1]);
  });
});
