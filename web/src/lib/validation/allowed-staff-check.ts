import type { Customer, Helper, Order, StaffUnavailability, DayOfWeek } from '@/types';

export interface AllowedStaffWarning {
  customer_id: string;
  customer_name: string;
  order_id: string;
  date: Date;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  /** 設定中の allowed ヘルパー名（全員対応不可の説明用） */
  allowed_helper_names: string[];
}

export interface CheckAllowedStaffInput {
  customers: Map<string, Customer>;
  helpers: Map<string, Helper>;
  orders: Order[];
  unavailability: StaffUnavailability[];
}

const DAY_OF_WEEK_ORDER: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getDayOfWeek(date: Date): DayOfWeek {
  const jsDay = date.getDay();
  return DAY_OF_WEEK_ORDER[jsDay === 0 ? 6 : jsDay - 1];
}

/** ヘルパーの weekly_availability が指定時間帯をカバーしているか */
function isHelperAvailableForSlot(
  helper: Helper,
  dayOfWeek: DayOfWeek,
  startTime: string,
  endTime: string,
): boolean {
  const slots = helper.weekly_availability[dayOfWeek];
  if (!slots || slots.length === 0) return false;
  const orderStart = timeToMinutes(startTime);
  const orderEnd = timeToMinutes(endTime);
  return slots.some(
    (slot) =>
      timeToMinutes(slot.start_time) <= orderStart &&
      orderEnd <= timeToMinutes(slot.end_time),
  );
}

/** ヘルパーの希望休がオーダーの日時と重複しているか */
function isHelperUnavailableForSlot(
  helperId: string,
  orderDate: Date,
  startTime: string,
  endTime: string,
  unavailability: StaffUnavailability[],
): boolean {
  const orderStart = timeToMinutes(startTime);
  const orderEnd = timeToMinutes(endTime);
  const orderDateStr = orderDate.toDateString();

  for (const u of unavailability) {
    if (u.staff_id !== helperId) continue;
    for (const slot of u.unavailable_slots) {
      if (slot.date.toDateString() !== orderDateStr) continue;
      if (slot.all_day) return true;
      if (slot.start_time && slot.end_time) {
        const slotStart = timeToMinutes(slot.start_time);
        const slotEnd = timeToMinutes(slot.end_time);
        // 部分重複でも不可
        if (slotStart < orderEnd && slotEnd > orderStart) return true;
      }
    }
  }
  return false;
}

/**
 * allowed_staff_ids が設定されている利用者のオーダーを走査し、
 * allowed ヘルパーが全員対応不可なオーダーを警告として返す。
 *
 * 空の orders / customers / helpers を渡しても安全（警告 0 件を返す）。
 */
export function checkAllowedStaff(input: CheckAllowedStaffInput): AllowedStaffWarning[] {
  const warnings: AllowedStaffWarning[] = [];

  for (const order of input.orders) {
    const customer = input.customers.get(order.customer_id);
    if (!customer || (customer.allowed_staff_ids?.length ?? 0) === 0) continue;

    const dayOfWeek = getDayOfWeek(order.date);

    const allowedHelpers = customer.allowed_staff_ids
      .map((id) => input.helpers.get(id))
      .filter((h): h is Helper => h !== undefined);

    const feasible = allowedHelpers.filter(
      (h) =>
        isHelperAvailableForSlot(h, dayOfWeek, order.start_time, order.end_time) &&
        !isHelperUnavailableForSlot(h.id, order.date, order.start_time, order.end_time, input.unavailability),
    );

    if (feasible.length === 0) {
      warnings.push({
        customer_id: customer.id,
        customer_name: customer.name.short ?? `${customer.name.family}${customer.name.given}`,
        order_id: order.id,
        date: order.date,
        day_of_week: dayOfWeek,
        start_time: order.start_time,
        end_time: order.end_time,
        allowed_helper_names: allowedHelpers.map(
          (h) => h.name.short ?? `${h.name.family}${h.name.given}`,
        ),
      });
    }
  }

  return warnings;
}
