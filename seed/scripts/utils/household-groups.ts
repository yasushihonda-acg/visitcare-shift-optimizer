import { normalizeAddress } from './normalize-address.js';

interface CustomerForGrouping {
  id: string;
  address: string;
  household_id: string;
}

export interface HouseholdFacilityResult {
  sameHousehold: string[];
  sameFacility: string[];
}

/**
 * 利用者リストから世帯/施設グループを構築し、各利用者のメンバーIDを返す
 *
 * - 同一 household_id → same_household_customer_ids
 * - 同一住所（正規化済み）で世帯メンバーでない → same_facility_customer_ids
 */
export function buildHouseholdFacilityGroups(
  customers: CustomerForGrouping[],
): Map<string, HouseholdFacilityResult> {
  // household_id → グループ構築
  const hhGroups: Record<string, string[]> = {};
  for (const c of customers) {
    if (c.household_id) {
      if (!hhGroups[c.household_id]) hhGroups[c.household_id] = [];
      hhGroups[c.household_id].push(c.id);
    }
  }

  // 住所ベースの同一施設グループ構築
  const addrGroups: Record<string, string[]> = {};
  for (const c of customers) {
    const norm = normalizeAddress(c.address);
    if (!addrGroups[norm]) addrGroups[norm] = [];
    addrGroups[norm].push(c.id);
  }

  const result = new Map<string, HouseholdFacilityResult>();

  for (const c of customers) {
    const sameHousehold = c.household_id
      ? (hhGroups[c.household_id] || []).filter((id) => id !== c.id)
      : [];
    const normAddr = normalizeAddress(c.address);
    const hhSet = new Set(sameHousehold);
    const sameFacility = (addrGroups[normAddr] || []).filter(
      (id) => id !== c.id && !hhSet.has(id),
    );
    result.set(c.id, { sameHousehold, sameFacility });
  }

  return result;
}
