import { describe, it, expect } from 'vitest';
import { buildHouseholdFacilityGroups } from '../scripts/utils/household-groups.js';

describe('buildHouseholdFacilityGroups', () => {
  it('should link household members by household_id', () => {
    const customers = [
      { id: 'C001', address: '東京都新宿区1-1', household_id: 'H001' },
      { id: 'C002', address: '東京都新宿区1-1', household_id: 'H001' },
      { id: 'C003', address: '東京都渋谷区2-2', household_id: '' },
    ];

    const groups = buildHouseholdFacilityGroups(customers);

    expect(groups.get('C001')!.sameHousehold).toEqual(['C002']);
    expect(groups.get('C002')!.sameHousehold).toEqual(['C001']);
    expect(groups.get('C003')!.sameHousehold).toEqual([]);
  });

  it('should link facility members by normalized address', () => {
    const customers = [
      { id: 'C001', address: '東京都新宿区１ー１', household_id: '' },
      { id: 'C002', address: '東京都新宿区1-1', household_id: '' },
    ];

    const groups = buildHouseholdFacilityGroups(customers);

    // 正規化後に同一住所 → 施設グループ
    expect(groups.get('C001')!.sameFacility).toEqual(['C002']);
    expect(groups.get('C002')!.sameFacility).toEqual(['C001']);
  });

  it('should exclude household members from facility group', () => {
    const customers = [
      { id: 'C001', address: '東京都新宿区1-1', household_id: 'H001' },
      { id: 'C002', address: '東京都新宿区1-1', household_id: 'H001' },
    ];

    const groups = buildHouseholdFacilityGroups(customers);

    // 同一住所かつ同一世帯 → 世帯のみ、施設には含まれない
    expect(groups.get('C001')!.sameHousehold).toEqual(['C002']);
    expect(groups.get('C001')!.sameFacility).toEqual([]);
    expect(groups.get('C002')!.sameHousehold).toEqual(['C001']);
    expect(groups.get('C002')!.sameFacility).toEqual([]);
  });

  it('should handle mixed household and facility at same address', () => {
    const customers = [
      { id: 'C001', address: '鹿児島市中央1-1', household_id: 'H001' },
      { id: 'C002', address: '鹿児島市中央1-1', household_id: 'H001' },
      { id: 'C003', address: '鹿児島市中央1-1', household_id: '' },
    ];

    const groups = buildHouseholdFacilityGroups(customers);

    // C001/C002: 世帯ペア、C003は施設のみ
    expect(groups.get('C001')!.sameHousehold).toEqual(['C002']);
    expect(groups.get('C001')!.sameFacility).toEqual(['C003']);
    expect(groups.get('C003')!.sameHousehold).toEqual([]);
    expect(groups.get('C003')!.sameFacility).toEqual(['C001', 'C002']);
  });

  it('should return empty arrays for solo customers', () => {
    const customers = [
      { id: 'C001', address: '東京都新宿区1-1', household_id: '' },
      { id: 'C002', address: '東京都渋谷区2-2', household_id: '' },
    ];

    const groups = buildHouseholdFacilityGroups(customers);

    expect(groups.get('C001')!.sameHousehold).toEqual([]);
    expect(groups.get('C001')!.sameFacility).toEqual([]);
    expect(groups.get('C002')!.sameHousehold).toEqual([]);
    expect(groups.get('C002')!.sameFacility).toEqual([]);
  });

  it('should handle household with 3+ members', () => {
    const customers = [
      { id: 'C001', address: '東京都新宿区1-1', household_id: 'H001' },
      { id: 'C002', address: '東京都新宿区1-1', household_id: 'H001' },
      { id: 'C003', address: '東京都新宿区1-1', household_id: 'H001' },
    ];

    const groups = buildHouseholdFacilityGroups(customers);

    expect(groups.get('C001')!.sameHousehold).toEqual(['C002', 'C003']);
    expect(groups.get('C002')!.sameHousehold).toEqual(['C001', 'C003']);
    expect(groups.get('C003')!.sameHousehold).toEqual(['C001', 'C002']);
    // 全員世帯なので施設は空
    expect(groups.get('C001')!.sameFacility).toEqual([]);
  });

  it('should return empty map for empty input', () => {
    const groups = buildHouseholdFacilityGroups([]);
    expect(groups.size).toBe(0);
  });
});
