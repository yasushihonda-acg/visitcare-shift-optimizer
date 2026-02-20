import type { Order, Customer, Helper, StaffUnavailability, DayOfWeek, ServiceTypeDoc } from '@/types';
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
  serviceTypes?: Map<string, ServiceTypeDoc>;
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

      // 資格不適合（requires_physical_care_cert が true のサービス種別は can_physical_care 必須）
      const stDoc = input.serviceTypes?.get(order.service_type);
      const requiresCert = stDoc ? stDoc.requires_physical_care_cert : (order.service_type === 'physical_care' || order.service_type === 'mixed');
      if (requiresCert && !helper.can_physical_care) {
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
    // ソート+隣接比較で O(N log N) に最適化
    const sorted = [...orders].sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (let i = 0; i < sorted.length - 1; i++) {
      // 隣接する全てのオーダーとの重複をチェック（開始時刻順なので後続のみ）
      for (let j = i + 1; j < sorted.length; j++) {
        // sorted[j]の開始がsorted[i]の終了以降なら、それ以降も重複しない
        if (sorted[j].start_time >= sorted[i].end_time) break;
        const name = helper?.name.family ?? staffId;
        addViolation({
          orderId: sorted[i].id,
          staffId,
          type: 'overlap',
          severity: 'error',
          message: `${name} の時間重複: ${sorted[j].start_time}-${sorted[j].end_time}`,
        });
        addViolation({
          orderId: sorted[j].id,
          staffId,
          type: 'overlap',
          severity: 'error',
          message: `${name} の時間重複: ${sorted[i].start_time}-${sorted[i].end_time}`,
        });
      }
    }
  }

  return violations;
}
