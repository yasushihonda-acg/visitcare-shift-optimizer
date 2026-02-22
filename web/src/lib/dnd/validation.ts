import type { Order, Helper, Customer, StaffUnavailability, DayOfWeek, ServiceTypeDoc } from '@/types';
import { isOverlapping } from '@/components/gantt/constants';
import type { DropValidationResult } from './types';
import { getStaffCount } from './staffCount';

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
  serviceTypes?: Map<string, ServiceTypeDoc>;
}

/**
 * ドロップ先ヘルパーへの割当可否を判定する。
 * error 制約 → 拒否、warning 制約 → 許可+警告
 */
export function validateDrop(input: ValidateDropInput): DropValidationResult {
  const { order, targetHelperId, helpers, customers, targetHelperOrders, unavailability, day, newStartTime, newEndTime, serviceTypes } = input;

  // 時間軸移動対応: 新時刻が指定されている場合はそちらを使用
  const startTime = newStartTime ?? order.start_time;
  const endTime = newEndTime ?? order.end_time;

  const helper = helpers.get(targetHelperId);
  if (!helper) return { allowed: false, reason: 'ヘルパーが見つかりません' };

  const customer = customers.get(order.customer_id);
  const staffCount = getStaffCount(order, customer, day);

  // --- error 制約（ドロップ拒否） ---

  // 同一ヘルパー二重割当防止
  if (order.assigned_staff_ids.includes(targetHelperId)) {
    return { allowed: false, reason: `${helper.name.family} はすでにこのオーダーに割当済みです` };
  }

  // NGスタッフ
  if (customer?.ng_staff_ids.includes(targetHelperId)) {
    return { allowed: false, reason: `${helper.name.family} はNGスタッフです` };
  }

  // 性別要件
  if (customer?.gender_requirement && customer.gender_requirement !== 'any') {
    if (helper.gender !== customer.gender_requirement) {
      const genderLabel = customer.gender_requirement === 'female' ? '女性' : '男性';
      return { allowed: false, reason: `性別要件を満たしていません（${genderLabel}専用）` };
    }
  }

  // 資格不適合（requires_physical_care_cert が true のサービス種別は can_physical_care 必須）
  const stDoc = serviceTypes?.get(order.service_type);
  const requiresCert = stDoc ? stDoc.requires_physical_care_cert : (order.service_type === 'physical_care' || order.service_type === 'mixed');
  if (requiresCert && !helper.can_physical_care) {
    return { allowed: false, reason: `${helper.name.family} は身体介護の資格がありません` };
  }

  // 研修状態: not_visited → staff_count=1 の場合は拒否、複数人体制は警告（同行するため）
  const trainingStatus = helper.customer_training_status[order.customer_id];
  if (trainingStatus === 'not_visited' && staffCount === 1) {
    return { allowed: false, reason: `${helper.name.family} は未訪問のため単独訪問できません` };
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

  // 研修状態: not_visited + staff_count>1 → 警告（他スタッフと同行のため許可）
  if (trainingStatus === 'not_visited' && staffCount > 1) {
    warnings.push(`${helper.name.family} は未訪問ですが複数人体制のため同行可能です`);
  }

  // 満員チェック: 必要人数に達している → 警告（置換されます）
  if (staffCount > 1 && order.assigned_staff_ids.length >= staffCount) {
    warnings.push(`必要人数に達しています（${staffCount}人）。置換されます`);
  }

  const availability = helper.weekly_availability[day];
  if (availability) {
    const withinAny = availability.some(
      (slot) => slot.start_time <= startTime && slot.end_time >= endTime
    );
    if (!withinAny) {
      warnings.push(`${helper.name.family} の勤務時間外です`);
    }
  }

  // 研修状態: training → 警告
  if (trainingStatus === 'training') {
    warnings.push(`${helper.name.family} は研修中（同行が必要です）`);
  }

  // 推奨スタッフ外 → 警告
  if (customer && customer.preferred_staff_ids.length > 0 && !customer.preferred_staff_ids.includes(targetHelperId)) {
    warnings.push(`${helper.name.family} は推奨スタッフ外です`);
  }

  return { allowed: true, warnings };
}
