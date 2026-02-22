import type { Order, Customer, DayOfWeek } from '@/types';

/**
 * オーダーに必要なスタッフ数を返す（3段階フォールバック）。
 * 1. order.staff_count があればそれを使用
 * 2. customer.weekly_services[day] から時刻・サービス種別マッチで導出
 * 3. デフォルト 1
 */
export function getStaffCount(
  order: Order,
  customer?: Customer,
  day?: DayOfWeek,
): number {
  // フォールバック1: order に直接定義されている場合
  if (order.staff_count != null) {
    return order.staff_count;
  }

  // フォールバック2: customer の weekly_services から導出
  if (customer && day) {
    const slots = customer.weekly_services[day];
    if (slots) {
      const matched = slots.find(
        (slot) =>
          slot.start_time === order.start_time &&
          slot.end_time === order.end_time &&
          slot.service_type === order.service_type,
      );
      if (matched != null) {
        return matched.staff_count;
      }
    }
  }

  // フォールバック3: デフォルト
  return 1;
}
