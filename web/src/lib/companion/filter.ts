import { isOverlapping } from '@/components/gantt/constants';
import type { Order, Customer, Helper, StaffUnavailability, DayOfWeek } from '@/types';
import { formatCompactName } from '@/utils/name';

/**
 * 同行（OJT）候補ヘルパーを返す。
 * 除外: NG / 割当済み / (allowed非空時) allowed + preferred / 性別制限 / 希望休 / 勤務時間外
 */
export function getCompanionCandidates(input: {
  order: Order;
  customer: Customer;
  helpers: Map<string, Helper>;
  unavailability?: StaffUnavailability[];
  day?: DayOfWeek;
}): Helper[] {
  const { order, customer, helpers, unavailability, day } = input;

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

  // 性別制限
  const genderReq = customer.gender_requirement;
  const hasGenderFilter = genderReq && genderReq !== 'any';

  const candidates = Array.from(helpers.values())
    .filter(h => !excludeIds.has(h.id))
    .filter(h => !hasGenderFilter || h.gender === genderReq)
    .filter(h => !isUnavailable(h, order, unavailability))
    .filter(h => !isOutsideWorkingHours(h, order, day));

  // 名前順ソート
  candidates.sort((a, b) =>
    formatCompactName(a.name).localeCompare(
      formatCompactName(b.name),
      'ja',
    ),
  );

  return candidates;
}

/** 希望休（終日 or 時間帯重複）に該当するか */
function isUnavailable(
  helper: Helper,
  order: Order,
  unavailability?: StaffUnavailability[],
): boolean {
  if (!unavailability) return false;

  for (const u of unavailability) {
    if (u.staff_id !== helper.id) continue;
    for (const slot of u.unavailable_slots) {
      if (!isSameDate(slot.date, order.date)) continue;
      if (slot.all_day) return true;
      if (
        slot.start_time && slot.end_time &&
        isOverlapping(order.start_time, order.end_time, slot.start_time, slot.end_time)
      ) {
        return true;
      }
    }
  }
  return false;
}

/** 勤務時間外か */
function isOutsideWorkingHours(
  helper: Helper,
  order: Order,
  day?: DayOfWeek,
): boolean {
  if (!day || !helper.weekly_availability) return false;

  const availability = helper.weekly_availability[day];
  if (!availability || availability.length === 0) return true;

  const withinAny = availability.some(
    (slot) => slot.start_time <= order.start_time && slot.end_time >= order.end_time,
  );
  return !withinAny;
}

function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}
