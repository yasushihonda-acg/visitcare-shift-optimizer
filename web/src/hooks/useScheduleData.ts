'use client';

import { useMemo } from 'react';
import { useHelpers } from './useHelpers';
import { useCustomers } from './useCustomers';
import { useOrders } from './useOrders';
import { useStaffUnavailability } from './useStaffUnavailability';
import { useTravelTimes } from './useTravelTimes';
import type { DayOfWeek, Order, Helper, Customer } from '@/types';
import { DAY_OF_WEEK_ORDER } from '@/types';

export interface HelperScheduleRow {
  helper: Helper;
  orders: Order[];
}

export interface DaySchedule {
  day: DayOfWeek;
  date: Date;
  helperRows: HelperScheduleRow[];
  unassignedOrders: Order[];
  totalOrders: number;
}

function getDayOfWeekFromDate(date: Date): DayOfWeek {
  const jsDay = date.getDay();
  return DAY_OF_WEEK_ORDER[jsDay === 0 ? 6 : jsDay - 1];
}

export function useScheduleData(weekStart: Date) {
  const { helpers, loading: helpersLoading } = useHelpers();
  const { customers, loading: customersLoading } = useCustomers();
  const { orders, loading: ordersLoading } = useOrders(weekStart);
  const { unavailability, loading: unavailabilityLoading } = useStaffUnavailability(weekStart);
  const { travelTimeLookup } = useTravelTimes();

  const loading = helpersLoading || customersLoading || ordersLoading || unavailabilityLoading;

  const ordersByDay = useMemo(() => {
    const map: Record<DayOfWeek, Order[]> = {
      monday: [], tuesday: [], wednesday: [], thursday: [],
      friday: [], saturday: [], sunday: [],
    };
    for (const order of orders) {
      const day = getDayOfWeekFromDate(order.date);
      map[day].push(order);
    }
    return map;
  }, [orders]);

  const orderCounts = useMemo(() => {
    const counts: Partial<Record<DayOfWeek, number>> = {};
    for (const day of DAY_OF_WEEK_ORDER) {
      if (ordersByDay[day].length > 0) {
        counts[day] = ordersByDay[day].length;
      }
    }
    return counts;
  }, [ordersByDay]);

  const getDaySchedule = useMemo(() => {
    return (day: DayOfWeek, dayDate: Date): DaySchedule => {
      const dayOrders = ordersByDay[day];
      const assigned = dayOrders.filter((o) => o.assigned_staff_ids.length > 0);
      const unassigned = dayOrders.filter((o) => o.assigned_staff_ids.length === 0);

      const helperOrderMap = new Map<string, Order[]>();
      for (const order of assigned) {
        for (const staffId of order.assigned_staff_ids) {
          const existing = helperOrderMap.get(staffId) ?? [];
          existing.push(order);
          helperOrderMap.set(staffId, existing);
        }
      }

      // 全ヘルパーを行として表示（オーダーがないヘルパーも含む）
      const helperRows: HelperScheduleRow[] = [];
      for (const helper of helpers.values()) {
        const helperOrders = helperOrderMap.get(helper.id) ?? [];
        helperRows.push({
          helper,
          orders: helperOrders.sort(
            (a, b) => a.start_time.localeCompare(b.start_time)
          ),
        });
      }
      helperRows.sort((a, b) => a.helper.id.localeCompare(b.helper.id));

      return {
        day,
        date: dayDate,
        helperRows,
        unassignedOrders: unassigned,
        totalOrders: dayOrders.length,
      };
    };
  }, [ordersByDay, helpers]);

  return {
    helpers,
    customers,
    orders,
    unavailability,
    ordersByDay,
    orderCounts,
    getDaySchedule,
    loading,
    travelTimeLookup,
  };
}
