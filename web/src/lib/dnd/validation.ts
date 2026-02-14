import type { Order, Helper, Customer, StaffUnavailability, DayOfWeek } from '@/types';
import { isOverlapping } from '@/components/gantt/constants';
import type { DropValidationResult } from './types';

interface ValidateDropInput {
  order: Order;
  targetHelperId: string;
  helpers: Map<string, Helper>;
  customers: Map<string, Customer>;
  /** 同じ日のターゲットヘルパーに割当済みのオーダー */
  targetHelperOrders: Order[];
  unavailability: StaffUnavailability[];
  day: DayOfWeek;
}

/**
 * ドロップ先ヘルパーへの割当可否を判定する。
 * error 制約 → 拒否、warning 制約 → 許可+警告
 */
export function validateDrop(input: ValidateDropInput): DropValidationResult {
  const { order, targetHelperId, helpers, customers, targetHelperOrders, unavailability, day } = input;

  const helper = helpers.get(targetHelperId);
  if (!helper) return { allowed: false, reason: 'ヘルパーが見つかりません' };

  const customer = customers.get(order.customer_id);

  // --- error 制約（ドロップ拒否） ---

  // NGスタッフ
  if (customer?.ng_staff_ids.includes(targetHelperId)) {
    return { allowed: false, reason: `${helper.name.family} はNGスタッフです` };
  }

  // 資格不適合
  if (order.service_type === 'physical_care' && !helper.can_physical_care) {
    return { allowed: false, reason: `${helper.name.family} は身体介護の資格がありません` };
  }

  // 時間重複
  for (const existing of targetHelperOrders) {
    if (existing.id === order.id) continue;
    if (isOverlapping(order.start_time, order.end_time, existing.start_time, existing.end_time)) {
      return { allowed: false, reason: `${helper.name.family} の既存オーダーと時間が重複しています` };
    }
  }

  // 希望休
  const staffUnavail = unavailability.filter((u) => u.staff_id === targetHelperId);
  for (const u of staffUnavail) {
    for (const slot of u.unavailable_slots) {
      if (slot.all_day) {
        return { allowed: false, reason: `${helper.name.family} は希望休（終日）です` };
      }
      if (
        slot.start_time && slot.end_time &&
        isOverlapping(order.start_time, order.end_time, slot.start_time, slot.end_time)
      ) {
        return { allowed: false, reason: `${helper.name.family} は希望休（${slot.start_time}-${slot.end_time}）です` };
      }
    }
  }

  // --- warning 制約（ドロップ許可 + 警告表示） ---
  const warnings: string[] = [];

  const availability = helper.weekly_availability[day];
  if (availability) {
    const withinAny = availability.some(
      (slot) => slot.start_time <= order.start_time && slot.end_time >= order.end_time
    );
    if (!withinAny) {
      warnings.push(`${helper.name.family} の勤務時間外です`);
    }
  }

  return { allowed: true, warnings };
}
