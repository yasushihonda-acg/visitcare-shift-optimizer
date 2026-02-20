import type { Order, Helper, Customer, ServiceType, ServiceTypeDoc } from '@/types';

// ── 型定義 ────────────────────────────────────────────────────

export interface StaffSummaryRow {
  helperId: string;
  name: string;
  visitCount: number;
  totalMinutes: number;
}

export interface CustomerSummaryRow {
  customerId: string;
  name: string;
  visitCount: number;
  totalMinutes: number;
}

export interface StatusSummary {
  pending: number;
  assigned: number;
  completed: number;
  cancelled: number;
  total: number;
  completionRate: number;
}

export interface ServiceTypeSummaryItem {
  serviceType: ServiceType;
  label: string;
  visitCount: number;
  totalMinutes: number;
}

/** @deprecated serviceTypes Map を使用してください */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  physical_care: '身体介護',
  daily_living: '生活援助',
  mixed: '混合（身体+生活）',
  prevention: '介護予防',
  private: '自費サービス',
  disability: '障がい福祉',
  transport_support: '移動支援',
  severe_visiting: '重度訪問介護',
};

/** 分数を "X時間Y分" 形式にフォーマット */
export function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

// ── ユーティリティ ─────────────────────────────────────────────

/** "HH:MM" → 分数 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** オーダーのサービス時間（分）*/
export function orderDurationMinutes(order: Order): number {
  return timeToMinutes(order.end_time) - timeToMinutes(order.start_time);
}

// ── 集計関数 ───────────────────────────────────────────────────

/** スタッフ別稼働集計（totalMinutes 降順）*/
export function aggregateStaffSummary(
  orders: Order[],
  helpers: Map<string, Helper>
): StaffSummaryRow[] {
  const map = new Map<string, { name: string; visitCount: number; totalMinutes: number }>();

  for (const order of orders) {
    const duration = orderDurationMinutes(order);
    for (const helperId of order.assigned_staff_ids) {
      const existing = map.get(helperId);
      const helper = helpers.get(helperId);
      const name = helper ? `${helper.name.family} ${helper.name.given}` : '(不明)';
      if (existing) {
        existing.visitCount += 1;
        existing.totalMinutes += duration;
      } else {
        map.set(helperId, { name, visitCount: 1, totalMinutes: duration });
      }
    }
  }

  return Array.from(map.entries())
    .map(([helperId, data]) => ({ helperId, ...data }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/** 利用者別サービス実績集計（totalMinutes 降順）*/
export function aggregateCustomerSummary(
  orders: Order[],
  customers: Map<string, Customer>
): CustomerSummaryRow[] {
  const map = new Map<string, { name: string; visitCount: number; totalMinutes: number }>();

  for (const order of orders) {
    const duration = orderDurationMinutes(order);
    const customerId = order.customer_id;
    const existing = map.get(customerId);
    const customer = customers.get(customerId);
    const name = customer ? `${customer.name.family} ${customer.name.given}` : '(不明)';
    if (existing) {
      existing.visitCount += 1;
      existing.totalMinutes += duration;
    } else {
      map.set(customerId, { name, visitCount: 1, totalMinutes: duration });
    }
  }

  return Array.from(map.entries())
    .map(([customerId, data]) => ({ customerId, ...data }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/** 実績確認ステータス集計 */
export function aggregateStatusSummary(orders: Order[]): StatusSummary {
  const summary: StatusSummary = {
    pending: 0,
    assigned: 0,
    completed: 0,
    cancelled: 0,
    total: orders.length,
    completionRate: 0,
  };

  for (const order of orders) {
    summary[order.status] += 1;
  }

  const denominator = summary.total - summary.cancelled;
  summary.completionRate =
    denominator > 0 ? Math.round((summary.completed / denominator) * 100) : 0;

  return summary;
}

/** サービス種別内訳集計（visitCount 降順）*/
export function aggregateServiceTypeSummary(orders: Order[], serviceTypes?: Map<string, ServiceTypeDoc>): ServiceTypeSummaryItem[] {
  const map = new Map<ServiceType, { visitCount: number; totalMinutes: number }>();

  for (const order of orders) {
    const duration = orderDurationMinutes(order);
    const existing = map.get(order.service_type);
    if (existing) {
      existing.visitCount += 1;
      existing.totalMinutes += duration;
    } else {
      map.set(order.service_type, { visitCount: 1, totalMinutes: duration });
    }
  }

  return Array.from(map.entries())
    .map(([serviceType, data]) => ({
      serviceType,
      label: serviceTypes?.get(serviceType)?.label ?? SERVICE_TYPE_LABELS[serviceType] ?? serviceType,
      ...data,
    }))
    .sort((a, b) => b.visitCount - a.visitCount);
}
