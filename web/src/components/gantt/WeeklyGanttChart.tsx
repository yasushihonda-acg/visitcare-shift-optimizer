'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { addDays, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { SERVICE_COLORS, GANTT_START_HOUR, GANTT_END_HOUR, timeToMinutes } from './constants';
import { DAY_OF_WEEK_ORDER, DAY_OF_WEEK_LABELS } from '@/types';
import type { DayOfWeek, Helper, Customer, Order, StaffUnavailability } from '@/types';
import type { DaySchedule } from '@/hooks/useScheduleData';

const HELPER_COL_WIDTH = 100;
const ROW_HEIGHT = 28;
const GANTT_START_MIN = GANTT_START_HOUR * 60;
const GANTT_END_MIN = GANTT_END_HOUR * 60;
const GANTT_DURATION_MIN = GANTT_END_MIN - GANTT_START_MIN;

export interface WeeklyGanttChartProps {
  weekStart: Date;
  getDaySchedule: (day: DayOfWeek, date: Date) => DaySchedule;
  helpers: Map<string, Helper>;
  customers: Map<string, Customer>;
  unavailability: StaffUnavailability[];
  onDayClick: (day: DayOfWeek) => void;
  onOrderClick?: (order: Order) => void;
}

function getDayDate(weekStart: Date, day: DayOfWeek): Date {
  const idx = DAY_OF_WEEK_ORDER.indexOf(day);
  return addDays(weekStart, idx);
}

function isWorkingDay(helper: Helper, day: DayOfWeek): boolean {
  const slots = helper.weekly_availability[day];
  return !!(slots && slots.length > 0);
}

function isUnavailableAllDay(
  helper: Helper,
  day: DayOfWeek,
  dayDate: Date,
  unavailability: StaffUnavailability[],
): boolean {
  const helperUnavail = unavailability.find((u) => u.staff_id === helper.id);
  if (!helperUnavail) return false;
  for (const slot of helperUnavail.unavailable_slots) {
    if (!slot.all_day) continue;
    const d = slot.date;
    if (
      d.getFullYear() === dayDate.getFullYear() &&
      d.getMonth() === dayDate.getMonth() &&
      d.getDate() === dayDate.getDate()
    ) {
      return true;
    }
  }
  return false;
}

interface WeeklyMiniBarProps {
  order: Order;
  customer?: Customer;
  dayColWidth: number;
  onDayClick: () => void;
}

function WeeklyMiniBar({ order, customer, dayColWidth, onDayClick }: WeeklyMiniBarProps) {
  const startMin = timeToMinutes(order.start_time);
  const endMin = timeToMinutes(order.end_time);
  const left = Math.max(0, ((startMin - GANTT_START_MIN) / GANTT_DURATION_MIN) * dayColWidth);
  const width = Math.max(3, ((endMin - startMin) / GANTT_DURATION_MIN) * dayColWidth);

  const colors = SERVICE_COLORS[order.service_type] ?? SERVICE_COLORS.physical_care;
  const customerName = customer
    ? (customer.name.short ?? `${customer.name.family}${customer.name.given}`)
    : order.customer_id;

  return (
    <button
      className={cn(
        'absolute top-0.5 rounded-sm overflow-hidden',
        'cursor-pointer',
        colors.bar,
      )}
      style={{
        left,
        width,
        height: ROW_HEIGHT - 6,
      }}
      title={`${customerName} ${order.start_time}-${order.end_time}`}
      onClick={onDayClick}
    />
  );
}

interface WeeklyDayCellProps {
  orders: Order[];
  customers: Map<string, Customer>;
  dayColWidth: number;
  isNonWorking: boolean;
  onDayClick: () => void;
}

function WeeklyDayCell({ orders, customers, dayColWidth, isNonWorking, onDayClick }: WeeklyDayCellProps) {
  return (
    <div
      className={cn(
        'relative border-r flex-shrink-0',
        isNonWorking && 'bg-muted/40',
      )}
      style={{ width: dayColWidth, height: ROW_HEIGHT }}
    >
      {orders.map((order) => (
        <WeeklyMiniBar
          key={order.id}
          order={order}
          customer={customers.get(order.customer_id)}
          dayColWidth={dayColWidth}
          onDayClick={onDayClick}
        />
      ))}
    </div>
  );
}

interface WeeklyHelperRowProps {
  helper: Helper;
  schedules: Map<DayOfWeek, DaySchedule>;
  customers: Map<string, Customer>;
  dayColWidth: number;
  unavailability: StaffUnavailability[];
  weekStart: Date;
  onDayClick: (day: DayOfWeek) => void;
}

function WeeklyHelperRow({
  helper,
  schedules,
  customers,
  dayColWidth,
  unavailability,
  weekStart,
  onDayClick,
}: WeeklyHelperRowProps) {
  const helperName = helper.name.short ?? `${helper.name.family}${helper.name.given}`;

  return (
    <div className="flex border-b" style={{ height: ROW_HEIGHT }}>
      <div
        className="sticky left-0 z-10 flex items-center bg-background border-r px-2 shrink-0 text-xs font-medium truncate"
        style={{ width: HELPER_COL_WIDTH, height: ROW_HEIGHT }}
        title={helperName}
      >
        {helperName}
      </div>
      {DAY_OF_WEEK_ORDER.map((day) => {
        const schedule = schedules.get(day);
        const helperRow = schedule?.helperRows.find((r) => r.helper.id === helper.id);
        const orders = helperRow?.orders ?? [];
        const dayDate = getDayDate(weekStart, day);
        const nonWorking =
          !isWorkingDay(helper, day) || isUnavailableAllDay(helper, day, dayDate, unavailability);

        return (
          <WeeklyDayCell
            key={day}
            orders={orders}
            customers={customers}
            dayColWidth={dayColWidth}
            isNonWorking={nonWorking}
            onDayClick={() => onDayClick(day)}
          />
        );
      })}
    </div>
  );
}

interface WeeklyUnassignedRowProps {
  schedules: Map<DayOfWeek, DaySchedule>;
  dayColWidth: number;
  onDayClick: (day: DayOfWeek) => void;
}

function WeeklyUnassignedRow({ schedules, dayColWidth, onDayClick }: WeeklyUnassignedRowProps) {
  const hasCounts = DAY_OF_WEEK_ORDER.some(
    (day) => (schedules.get(day)?.unassignedOrders.length ?? 0) > 0,
  );
  if (!hasCounts) return null;

  return (
    <div className="flex border-b bg-red-50/30" data-testid="weekly-unassigned-row">
      <div
        className="sticky left-0 z-10 flex items-center bg-red-50/30 border-r px-2 shrink-0 text-xs font-medium text-muted-foreground"
        style={{ width: HELPER_COL_WIDTH, height: ROW_HEIGHT }}
      >
        未割当
      </div>
      {DAY_OF_WEEK_ORDER.map((day) => {
        const count = schedules.get(day)?.unassignedOrders.length ?? 0;
        return (
          <button
            key={day}
            data-testid={`weekly-unassigned-${day}`}
            className={cn(
              'border-r flex items-center justify-center text-xs flex-shrink-0',
              count > 0
                ? 'text-red-600 font-medium cursor-pointer hover:bg-red-50'
                : 'text-muted-foreground cursor-default',
            )}
            style={{ width: dayColWidth, height: ROW_HEIGHT }}
            onClick={() => count > 0 && onDayClick(day)}
            title={count > 0 ? `${count}件の未割当` : undefined}
          >
            {count > 0 && (
              <span
                data-testid={`weekly-unassigned-badge-${day}`}
                className="rounded-full bg-red-100 text-red-600 px-1.5 py-0.5 text-[10px] font-medium"
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function WeeklyGanttChart({
  weekStart,
  getDaySchedule,
  helpers,
  customers,
  unavailability,
  onDayClick,
}: WeeklyGanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dayColWidth = Math.max(60, (containerWidth - HELPER_COL_WIDTH) / 7);

  const schedules = useMemo(() => {
    const map = new Map<DayOfWeek, DaySchedule>();
    for (const day of DAY_OF_WEEK_ORDER) {
      const dayDate = getDayDate(weekStart, day);
      map.set(day, getDaySchedule(day, dayDate));
    }
    return map;
  }, [weekStart, getDaySchedule]);

  const helperList = useMemo(() => Array.from(helpers.values()), [helpers]);

  return (
    <div ref={containerRef} className="w-full overflow-auto">
      <div>
        {/* ヘッダー行 */}
        <div className="flex border-b sticky top-0 z-20 bg-background" data-testid="weekly-header">
          <div
            className="sticky left-0 z-30 bg-background border-r shrink-0"
            style={{ width: HELPER_COL_WIDTH }}
          />
          {DAY_OF_WEEK_ORDER.map((day, idx) => {
            const date = addDays(weekStart, idx);
            return (
              <button
                key={day}
                data-testid={`weekly-day-header-${day}`}
                className="border-r flex-shrink-0 flex flex-col items-center justify-center py-1 hover:bg-accent text-xs font-medium"
                style={{ width: dayColWidth }}
                onClick={() => onDayClick(day)}
              >
                <span>{DAY_OF_WEEK_LABELS[day]}</span>
                <span className="text-muted-foreground text-[10px]">{format(date, 'M/d')}</span>
              </button>
            );
          })}
        </div>

        {/* ヘルパー行 */}
        {helperList.map((helper) => (
          <WeeklyHelperRow
            key={helper.id}
            helper={helper}
            schedules={schedules}
            customers={customers}
            dayColWidth={dayColWidth}
            unavailability={unavailability}
            weekStart={weekStart}
            onDayClick={onDayClick}
          />
        ))}

        {/* 未割当行 */}
        <WeeklyUnassignedRow
          schedules={schedules}
          dayColWidth={dayColWidth}
          onDayClick={onDayClick}
        />
      </div>
    </div>
  );
}
