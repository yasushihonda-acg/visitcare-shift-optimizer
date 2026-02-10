'use client';

import { useState, useMemo } from 'react';
import { addDays } from 'date-fns';
import { ScheduleProvider, useScheduleContext } from '@/contexts/ScheduleContext';
import { Header } from '@/components/layout/Header';
import { DayTabs } from '@/components/schedule/DayTabs';
import { StatsBar } from '@/components/schedule/StatsBar';
import { OptimizeButton } from '@/components/schedule/OptimizeButton';
import { GanttChart } from '@/components/gantt/GanttChart';
import { OrderDetailPanel } from '@/components/schedule/OrderDetailPanel';
import { useScheduleData } from '@/hooks/useScheduleData';
import { checkConstraints } from '@/lib/constraints/checker';
import { DAY_OF_WEEK_ORDER } from '@/types';
import type { Order } from '@/types';

function SchedulePage() {
  const { weekStart, selectedDay } = useScheduleContext();
  const { customers, helpers, orderCounts, getDaySchedule, unavailability, loading } =
    useScheduleData(weekStart);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const dayIndex = DAY_OF_WEEK_ORDER.indexOf(selectedDay);
  const dayDate = addDays(weekStart, dayIndex);
  const schedule = useMemo(
    () => getDaySchedule(selectedDay, dayDate),
    [getDaySchedule, selectedDay, dayDate]
  );

  const violations = useMemo(
    () =>
      checkConstraints({
        orders: schedule.helperRows.flatMap((r) => r.orders).concat(schedule.unassignedOrders),
        helpers,
        customers,
        unavailability,
        day: selectedDay,
      }),
    [schedule, helpers, customers, unavailability, selectedDay]
  );

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  const assignedHelpers = useMemo(() => {
    if (!selectedOrder) return [];
    return selectedOrder.assigned_staff_ids
      .map((id) => helpers.get(id))
      .filter(Boolean) as NonNullable<ReturnType<typeof helpers.get>>[];
  }, [selectedOrder, helpers]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex items-center justify-between border-b">
        <DayTabs orderCounts={orderCounts} />
        <div className="px-4">
          <OptimizeButton />
        </div>
      </div>
      <StatsBar schedule={schedule} violations={violations} />
      <main className="flex-1 overflow-auto p-4">
        <GanttChart
          schedule={schedule}
          customers={customers}
          violations={violations}
          onOrderClick={handleOrderClick}
        />
      </main>
      <OrderDetailPanel
        order={selectedOrder}
        customer={selectedOrder ? customers.get(selectedOrder.customer_id) : undefined}
        assignedHelpers={assignedHelpers}
        violations={selectedOrder ? violations.get(selectedOrder.id) ?? [] : []}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <ScheduleProvider>
      <SchedulePage />
    </ScheduleProvider>
  );
}
