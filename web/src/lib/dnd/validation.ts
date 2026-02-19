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
  /** 時間軸移動時の新しい開始/終了時刻（省略時はorder元の時刻を使用） */
  newStartTime?: string;
  newEndTime?: string;
}

/**
 * ドロップ先ヘルパーへの割当可否を判定する。
 * error 制約 → 拒否、warning 制約 → 許可+警告
 */
export function validateDrop(input: ValidateDropInput): DropValidationResult {
  const { order, targetHelperId, helpers, customers, targetHelperOrders, unavailability, day, newStartTime, newEndTime } = input;

  // 時間軸移動対応: 新時刻が指定されている場合はそちらを使用
  const startTime = newStartTime ?? order.start_time;
  const endTime = newEndTime ?? order.end_time;

  const helper = helpers.get(targetHelperId);
  if (!helper) return { allowed: false, reason: 'ヘルパーが見つかりません' };

  const customer = customers.get(order.customer_id);

  // --- error 制約（ドロップ拒否） ---

  // NGスタッフ
  if (customer?.ng_staff_ids.includes(targetHelperId)) {
    return { allowed: false, reason: `${helper.name.family} はNGスタッフです` };
  }

  // 資格不適合（身体介護・混合は can_physical_care 必須）
  if ((order.service_type === 'physical_care' || order.service_type === 'mixed') && !helper.can_physical_care) {
    return { allowed: false, reason: `${helper.name.family} は身体介護の資格がありません` };
  }

  // 時間重複
  for (const existing of targetHelperOrders) {
    if (existing.id === order.id) continue;
    if (isOverlapping(startTime, endTime, existing.start_time, existing.end_time)) {
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
        isOverlapping(startTime, endTime, slot.start_time, slot.end_time)
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
      (slot) => slot.start_time <= startTime && slot.end_time >= endTime
    );
    if (!withinAny) {
      warnings.push(`${helper.name.family} の勤務時間外です`);
    }
  }

  return { allowed: true, warnings };
}
