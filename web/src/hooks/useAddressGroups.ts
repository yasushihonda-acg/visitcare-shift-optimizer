import { useMemo } from 'react';
import type { Customer } from '@/types';

/**
 * 同一住所グループのインデックスマップを計算するフック。
 *
 * same_household_customer_ids / same_facility_customer_ids を Union-Find で
 * 統合し、2名以上のグループに 0,1,2… のインデックスを割り当てる。
 *
 * @returns addressGroupMap — Map<customerId, groupIndex>（単独顧客は含まない）
 */
export function useAddressGroups(customers: Map<string, Customer>): Map<string, number> {
  return useMemo(() => buildAddressGroupMap(customers), [customers]);
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
export function buildAddressGroupMap(customers: Map<string, Customer>): Map<string, number> {
  const uf = new UnionFind();
  const customerIds = new Set(customers.keys());

  for (const [id, customer] of customers) {
    // same_household / same_facility のメンバーを union
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

  // 2名以上のグループにインデックスを割り当て
  const result = new Map<string, number>();
  let groupIndex = 0;
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    for (const id of members) {
      result.set(id, groupIndex);
    }
    groupIndex++;
  }

  return result;
}

/** ストライプ色パレット（5色ローテーション） */
export const ADDRESS_GROUP_COLORS = [
  'oklch(0.72 0.18 330)',  // ローズ
  'oklch(0.72 0.16 195)',  // シアン
  'oklch(0.72 0.18 85)',   // イエロー
  'oklch(0.65 0.16 145)',  // エメラルド
  'oklch(0.68 0.14 275)',  // パープル
] as const;

/** groupIndex → Tailwind互換のインラインスタイル色を返す */
export function getAddressGroupColor(groupIndex: number): string {
  return ADDRESS_GROUP_COLORS[groupIndex % ADDRESS_GROUP_COLORS.length]!;
}
