import { useMemo } from 'react';
import type { Customer } from '@/types';

/** グループ種別: 世帯 / 施設 / 混在 */
export type AddressGroupType = 'household' | 'facility' | 'mixed';

/** 同一住所グループの情報 */
export interface AddressGroupInfo {
  /** グループインデックス（色の決定に使用） */
  index: number;
  /** グループ種別 */
  type: AddressGroupType;
}

/**
 * 同一住所グループの情報マップを計算するフック。
 *
 * same_household_customer_ids / same_facility_customer_ids を Union-Find で
 * 統合し、2名以上のグループに情報を割り当てる。
 *
 * @param customers 全顧客マップ
 * @param activeCustomerIds 当日オーダーがある顧客IDのSet（省略時はフィルタなし）。
 *   指定した場合、グループメンバーのうち当日オーダーがある顧客が2名以上の
 *   グループのみインジケーターを表示する。
 * @returns addressGroupMap — Map<customerId, AddressGroupInfo>（単独顧客は含まない）
 */
export function useAddressGroups(
  customers: Map<string, Customer>,
  activeCustomerIds?: Set<string>,
): Map<string, AddressGroupInfo> {
  return useMemo(
    () => buildAddressGroupMap(customers, activeCustomerIds),
    [customers, activeCustomerIds],
  );
}

// ────────── Union-Find ──────────

class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // path compression
    let cur = x;
    while (cur !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const rankA = this.rank.get(ra)!;
    const rankB = this.rank.get(rb)!;
    if (rankA < rankB) {
      this.parent.set(ra, rb);
    } else if (rankA > rankB) {
      this.parent.set(rb, ra);
    } else {
      this.parent.set(rb, ra);
      this.rank.set(ra, rankA + 1);
    }
  }
}

/** テスト用にエクスポート */
export function buildAddressGroupMap(
  customers: Map<string, Customer>,
  activeCustomerIds?: Set<string>,
): Map<string, AddressGroupInfo> {
  const uf = new UnionFind();
  const customerIds = new Set(customers.keys());

  for (const [id, customer] of customers) {
    for (const relatedId of customer.same_household_customer_ids) {
      if (customerIds.has(relatedId)) {
        uf.union(id, relatedId);
      }
    }
    for (const relatedId of customer.same_facility_customer_ids) {
      if (customerIds.has(relatedId)) {
        uf.union(id, relatedId);
      }
    }
  }

  // グループを集約
  const groups = new Map<string, string[]>();
  for (const id of customerIds) {
    const root = uf.find(id);
    const members = groups.get(root) ?? [];
    members.push(id);
    groups.set(root, members);
  }

  // 各グループの種別を判定
  const groupTypes = new Map<string, AddressGroupType>();
  for (const [root, members] of groups) {
    if (members.length < 2) continue;
    let hasHousehold = false;
    let hasFacility = false;
    // メンバーペアがhousehold/facilityのどちらに属するか確認
    for (const id of members) {
      const customer = customers.get(id)!;
      for (const relatedId of customer.same_household_customer_ids) {
        if (customerIds.has(relatedId)) hasHousehold = true;
      }
      for (const relatedId of customer.same_facility_customer_ids) {
        if (customerIds.has(relatedId)) hasFacility = true;
      }
    }
    groupTypes.set(root, hasHousehold && hasFacility ? 'mixed' : hasHousehold ? 'household' : 'facility');
  }

  // 2名以上のグループに情報を割り当て
  // activeCustomerIds 指定時は、当日オーダーがあるメンバーが2名以上のグループのみ対象
  const result = new Map<string, AddressGroupInfo>();
  let groupIndex = 0;
  for (const [root, members] of groups) {
    if (members.length < 2) continue;
    const activeMembers = activeCustomerIds
      ? members.filter((id) => activeCustomerIds.has(id))
      : members;
    if (activeMembers.length < 2) continue;
    const type = groupTypes.get(root)!;
    for (const id of activeMembers) {
      result.set(id, { index: groupIndex, type });
    }
    groupIndex++;
  }

  return result;
}

/** アンダーライン色パレット（5色ローテーション） */
export const ADDRESS_GROUP_COLORS = [
  'oklch(0.65 0.22 330)',  // ローズ
  'oklch(0.65 0.18 195)',  // シアン
  'oklch(0.72 0.18 85)',   // イエロー
  'oklch(0.58 0.18 145)',  // エメラルド
  'oklch(0.60 0.18 275)',  // パープル
] as const;

/** groupIndex → インラインスタイル色を返す */
export function getAddressGroupColor(groupIndex: number): string {
  return ADDRESS_GROUP_COLORS[groupIndex % ADDRESS_GROUP_COLORS.length]!;
}
