import type { Order, Customer, Helper } from '@/types';

/**
 * 同行（OJT）候補ヘルパーを返す。
 * 除外: NG / 割当済み / (allowed非空時) allowed + preferred
 */
export function getCompanionCandidates(input: {
  order: Order;
  customer: Customer;
  helpers: Map<string, Helper>;
}): Helper[] {
  const { order, customer, helpers } = input;

  const excludeIds = new Set<string>([
    ...customer.ng_staff_ids,
    ...order.assigned_staff_ids,
  ]);

  // allowed_staff_ids が設定されている場合、allowed + preferred も除外
  // （同行は通常割当外のスタッフが対象）
  if (customer.allowed_staff_ids.length > 0) {
    for (const id of customer.allowed_staff_ids) excludeIds.add(id);
    for (const id of customer.preferred_staff_ids) excludeIds.add(id);
  }

  const candidates = Array.from(helpers.values())
    .filter(h => !excludeIds.has(h.id));

  // 名前順ソート
  candidates.sort((a, b) =>
    `${a.name.family}${a.name.given}`.localeCompare(
      `${b.name.family}${b.name.given}`,
      'ja',
    ),
  );

  return candidates;
}
