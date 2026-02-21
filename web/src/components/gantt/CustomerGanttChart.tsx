'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  GANTT_START_HOUR,
  GANTT_END_HOUR,
  HELPER_NAME_WIDTH_PX,
  ROW_HEIGHT_PX,
  timeToMinutes,
  SERVICE_COLORS,
} from './constants';
import type { DaySchedule } from '@/hooks/useScheduleData';
import type { Customer, Helper, Order } from '@/types';

const GANTT_START_MIN = GANTT_START_HOUR * 60;
const GANTT_END_MIN = GANTT_END_HOUR * 60;
const GANTT_DURATION_MIN = GANTT_END_MIN - GANTT_START_MIN;
const HOURS = Array.from(
  { length: GANTT_END_HOUR - GANTT_START_HOUR },
  (_, i) => GANTT_START_HOUR + i,
);

export interface CustomerGanttChartProps {
  schedule: DaySchedule;
  customers: Map<string, Customer>;
  helpers: Map<string, Helper>;
  onOrderClick?: (order: Order) => void;
}

interface CustomerOrderBarProps {
  order: Order;
  chartWidth: number;
  helpers: Map<string, Helper>;
  onOrderClick?: (order: Order) => void;
}

function CustomerOrderBar({ order, chartWidth, helpers, onOrderClick }: CustomerOrderBarProps) {
  const startMin = timeToMinutes(order.start_time);
  const endMin = timeToMinutes(order.end_time);
  const left = Math.max(0, ((startMin - GANTT_START_MIN) / GANTT_DURATION_MIN) * chartWidth);
  const width = Math.max(8, ((endMin - startMin) / GANTT_DURATION_MIN) * chartWidth);
  const colors = SERVICE_COLORS[order.service_type] ?? SERVICE_COLORS.physical_care;
  const helperLabel =
    order.assigned_staff_ids
      .map((id) => {
        const h = helpers.get(id);
        return h ? (h.name.short ?? `${h.name.family}${h.name.given}`) : id;
      })
      .join(' ') || '未割当';

  return (
    <button
      className={cn(
        'absolute top-1 rounded overflow-hidden text-left px-1 text-[10px] leading-tight',
        colors.bar,
        'transition-opacity hover:opacity-80',
      )}
      style={{ left, width, height: ROW_HEIGHT_PX - 8 }}
      title={`${order.start_time}-${order.end_time} ${helperLabel}`}
      onClick={() => onOrderClick?.(order)}
    >
      <span className="truncate block">{helperLabel}</span>
    </button>
  );
}

interface UnassignedOrderBarProps {
  order: Order;
  chartWidth: number;
  customerName: string;
  onOrderClick?: (order: Order) => void;
}

function UnassignedOrderBar({ order, chartWidth, customerName, onOrderClick }: UnassignedOrderBarProps) {
  const startMin = timeToMinutes(order.start_time);
  const endMin = timeToMinutes(order.end_time);
  const left = Math.max(0, ((startMin - GANTT_START_MIN) / GANTT_DURATION_MIN) * chartWidth);
  const width = Math.max(8, ((endMin - startMin) / GANTT_DURATION_MIN) * chartWidth);

  return (
    <button
      className="absolute top-1 rounded overflow-hidden text-left px-1 text-[10px] leading-tight bg-amber-200 text-amber-900 transition-opacity hover:opacity-80"
      style={{ left, width, height: ROW_HEIGHT_PX - 8 }}
      title={`${customerName} ${order.start_time}-${order.end_time}`}
      onClick={() => onOrderClick?.(order)}
    >
      <span className="truncate block">{customerName}</span>
    </button>
  );
}

export function CustomerGanttChart({
  schedule,
  customers,
  helpers,
  onOrderClick,
}: CustomerGanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setChartWidth(Math.max(0, width - HELPER_NAME_WIDTH_PX));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const customerRows = useMemo(() => {
    const allOrders = schedule.helperRows.flatMap((r) => r.orders);
    const ordersByCustomer = new Map<string, Order[]>();
    for (const order of allOrders) {
      const existing = ordersByCustomer.get(order.customer_id) ?? [];
      existing.push(order);
      ordersByCustomer.set(order.customer_id, existing);
    }
    return Array.from(ordersByCustomer.entries())
      .map(([customerId, orders]) => ({
        customer: customers.get(customerId),
        customerId,
        orders,
      }))
      .sort((a, b) => {
        const nameA = a.customer
          ? (a.customer.name.short ?? `${a.customer.name.family}${a.customer.name.given}`)
          : a.customerId;
        const nameB = b.customer
          ? (b.customer.name.short ?? `${b.customer.name.family}${b.customer.name.given}`)
          : b.customerId;
        return nameA.localeCompare(nameB, 'ja');
      });
  }, [schedule, customers]);

  if (schedule.totalOrders === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        この日のオーダーはありません
      </div>
    );
  }

  return (
    <div ref={containerRef} className="overflow-auto border rounded-lg shadow-brand-sm">
      {/* 時刻ヘッダー */}
      <div className="flex border-b bg-accent/30 sticky top-0 z-10" style={{ height: 28 }}>
        <div
          className="shrink-0 border-r px-2 py-1.5 text-xs font-semibold text-primary"
          style={{ width: HELPER_NAME_WIDTH_PX }}
        >
          利用者
        </div>
        <div className="relative flex-1">
          {HOURS.map((hour) => {
            const left = ((hour * 60 - GANTT_START_MIN) / GANTT_DURATION_MIN) * chartWidth;
            return (
              <div
                key={hour}
                className="absolute top-0 h-full border-l border-border/40"
                style={{ left }}
              >
                <span className="px-1 text-[10px] font-medium text-muted-foreground">
                  {hour}:00
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 利用者行 */}
      {customerRows.map(({ customer, customerId, orders }) => {
        const customerName = customer
          ? (customer.name.short ?? `${customer.name.family}${customer.name.given}`)
          : customerId;
        return (
          <div key={customerId} className="flex border-b" style={{ height: ROW_HEIGHT_PX }}>
            <div
              className="sticky left-0 z-10 flex items-center bg-background border-r px-2 shrink-0 text-xs font-medium truncate"
              style={{ width: HELPER_NAME_WIDTH_PX, height: ROW_HEIGHT_PX }}
              title={customerName}
            >
              {customerName}
            </div>
            <div className="relative flex-1" style={{ height: ROW_HEIGHT_PX }}>
              {orders.map((order) => (
                <CustomerOrderBar
                  key={order.id}
                  order={order}
                  chartWidth={chartWidth}
                  helpers={helpers}
                  onOrderClick={onOrderClick}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* 未割当行 */}
      {schedule.unassignedOrders.length > 0 && (
        <div className="flex border-b bg-amber-50/30" style={{ height: ROW_HEIGHT_PX }}>
          <div
            className="sticky left-0 z-10 flex items-center bg-amber-50/30 border-r px-2 shrink-0 text-xs font-medium text-amber-700"
            style={{ width: HELPER_NAME_WIDTH_PX, height: ROW_HEIGHT_PX }}
          >
            未割当
          </div>
          <div className="relative flex-1" style={{ height: ROW_HEIGHT_PX }}>
            {schedule.unassignedOrders.map((order) => {
              const customer = customers.get(order.customer_id);
              const customerName = customer
                ? (customer.name.short ?? `${customer.name.family}${customer.name.given}`)
                : order.customer_id;
              return (
                <UnassignedOrderBar
                  key={order.id}
                  order={order}
                  chartWidth={chartWidth}
                  customerName={customerName}
                  onOrderClick={onOrderClick}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
