import type { Order, Customer, Helper, StaffUnavailability, DayOfWeek } from '@/types';
import { isOverlapping } from '@/components/gantt/constants';

export type ViolationSeverity = 'error' | 'warning';

export interface Violation {
  orderId: string;
  staffId?: string;
  type: 'ng_staff' | 'qualification' | 'overlap' | 'unavailability' | 'outside_hours';
  severity: ViolationSeverity;
  message: string;
}

/** orderId → Violation[] */
export type ViolationMap = Map<string, Violation[]>;

interface CheckInput {
  orders: Order[];
  helpers: Map<string, Helper>;
  customers: Map<string, Customer>;
  unavailability: StaffUnavailability[];
  day: DayOfWeek;
}

export function checkConstraints(input: CheckInput): ViolationMap {
  const violations: ViolationMap = new Map();

  const addViolation = (v: Violation) => {
    const list = violations.get(v.orderId) ?? [];
    list.push(v);
    violations.set(v.orderId, list);
  };

  const assignedOrders = input.orders.filter((o) => o.assigned_staff_ids.length > 0);

  for (const order of assignedOrders) {
    const customer = input.customers.get(order.customer_id);

    for (const staffId of order.assigned_staff_ids) {
      const helper = input.helpers.get(staffId);
      if (!helper) continue;

      // NGスタッフ
      if (customer?.ng_staff_ids.includes(staffId)) {
        addViolation({
          orderId: order.id,
          staffId,
          type: 'ng_staff',
          severity: 'error',
          message: `NGスタッフ ${helper.name.family} が割当済み`,
        });
      }

      // 資格不適合
      if (order.service_type === 'physical_care' && !helper.can_physical_care) {
        addViolation({
          orderId: order.id,
          staffId,
          type: 'qualification',
          severity: 'error',
          message: `${helper.name.family} は身体介護の資格なし`,
        });
      }

      // 勤務時間外
      const availability = helper.weekly_availability[input.day];
      if (availability) {
        const withinAny = availability.some(
          (slot) => slot.start_time <= order.start_time && slot.end_time >= order.end_time
        );
        if (!withinAny) {
          addViolation({
            orderId: order.id,
            staffId,
            type: 'outside_hours',
            severity: 'warning',
            message: `${helper.name.family} の勤務時間外`,
          });
        }
      }

      // 希望休
      const staffUnavail = input.unavailability.filter((u) => u.staff_id === staffId);
      for (const u of staffUnavail) {
        for (const slot of u.unavailable_slots) {
          if (slot.all_day) {
            addViolation({
              orderId: order.id,
              staffId,
              type: 'unavailability',
              severity: 'error',
              message: `${helper.name.family} は希望休（終日）`,
            });
          } else if (
            slot.start_time && slot.end_time &&
            isOverlapping(order.start_time, order.end_time, slot.start_time, slot.end_time)
          ) {
            addViolation({
              orderId: order.id,
              staffId,
              type: 'unavailability',
              severity: 'error',
              message: `${helper.name.family} は希望休（${slot.start_time}-${slot.end_time}）`,
            });
          }
        }
      }
    }
  }

  // 時間重複チェック（同一スタッフの複数オーダー間）
  const staffOrders = new Map<string, Order[]>();
  for (const order of assignedOrders) {
    for (const staffId of order.assigned_staff_ids) {
      const list = staffOrders.get(staffId) ?? [];
      list.push(order);
      staffOrders.set(staffId, list);
    }
  }

  for (const [staffId, orders] of staffOrders) {
    const helper = input.helpers.get(staffId);
    for (let i = 0; i < orders.length; i++) {
      for (let j = i + 1; j < orders.length; j++) {
        if (isOverlapping(orders[i].start_time, orders[i].end_time, orders[j].start_time, orders[j].end_time)) {
          const name = helper?.name.family ?? staffId;
          addViolation({
            orderId: orders[i].id,
            staffId,
            type: 'overlap',
            severity: 'error',
            message: `${name} の時間重複: ${orders[j].start_time}-${orders[j].end_time}`,
          });
          addViolation({
            orderId: orders[j].id,
            staffId,
            type: 'overlap',
            severity: 'error',
            message: `${name} の時間重複: ${orders[i].start_time}-${orders[i].end_time}`,
          });
        }
      }
    }
  }

  return violations;
}
