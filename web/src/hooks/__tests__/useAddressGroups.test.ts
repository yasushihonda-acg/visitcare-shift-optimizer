import { describe, it, expect } from 'vitest';
import { buildAddressGroupMap, getAddressGroupColor, ADDRESS_GROUP_COLORS } from '../useAddressGroups';
import type { Customer } from '@/types';

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
    expect(result.get('C001')).toBe(result.get('C002'));
    expect(result.has('C003')).toBe(false); // 単独 → 含まない
  });

  it('同一施設メンバーが同じグループになる', () => {
    const customers = new Map<string, Customer>([
      ['C001', makeCustomer('C001', { same_facility_customer_ids: ['C002'] })],
      ['C002', makeCustomer('C002', { same_facility_customer_ids: ['C001'] })],
    ]);
    const result = buildAddressGroupMap(customers);
    expect(result.get('C001')).toBe(result.get('C002'));
  });

  it('世帯と施設が混在するグループを統合する', () => {
    const customers = new Map<string, Customer>([
      ['C001', makeCustomer('C001', { same_household_customer_ids: ['C002'] })],
      ['C002', makeCustomer('C002', { same_household_customer_ids: ['C001'], same_facility_customer_ids: ['C003'] })],
      ['C003', makeCustomer('C003', { same_facility_customer_ids: ['C002'] })],
    ]);
    const result = buildAddressGroupMap(customers);
    // C001, C002, C003 が全て同一グループ
    expect(result.get('C001')).toBe(result.get('C002'));
    expect(result.get('C002')).toBe(result.get('C003'));
  });

  it('複数の独立グループに異なるインデックスを割り当てる', () => {
    const customers = new Map<string, Customer>([
      ['C001', makeCustomer('C001', { same_household_customer_ids: ['C002'] })],
      ['C002', makeCustomer('C002', { same_household_customer_ids: ['C001'] })],
      ['C003', makeCustomer('C003', { same_household_customer_ids: ['C004'] })],
      ['C004', makeCustomer('C004', { same_household_customer_ids: ['C003'] })],
    ]);
    const result = buildAddressGroupMap(customers);
    expect(result.get('C001')).not.toBe(result.get('C003'));
  });

  it('存在しない顧客IDへの参照を無視する', () => {
    const customers = new Map<string, Customer>([
      ['C001', makeCustomer('C001', { same_household_customer_ids: ['C999'] })],
    ]);
    const result = buildAddressGroupMap(customers);
    expect(result.has('C001')).toBe(false); // 相方が存在しないので単独扱い
  });

  it('全員が単独 → 空Mapを返す', () => {
    const customers = new Map<string, Customer>([
      ['C001', makeCustomer('C001')],
      ['C002', makeCustomer('C002')],
    ]);
    const result = buildAddressGroupMap(customers);
    expect(result.size).toBe(0);
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
