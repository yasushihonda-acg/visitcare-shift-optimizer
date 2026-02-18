'use client';

import { useState, useMemo, useCallback } from 'react';
import { addDays } from 'date-fns';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { ScheduleProvider, useScheduleContext } from '@/contexts/ScheduleContext';
import { Header } from '@/components/layout/Header';
import { WelcomeDialog } from '@/components/onboarding/WelcomeDialog';
import { useWelcomeDialog } from '@/components/onboarding/useWelcomeDialog';
import { DayTabs } from '@/components/schedule/DayTabs';
import { StatsBar } from '@/components/schedule/StatsBar';
import { OptimizeButton } from '@/components/schedule/OptimizeButton';
import { ResetButton } from '@/components/schedule/ResetButton';
import { BulkCompleteButton } from '@/components/schedule/BulkCompleteButton';
import { GanttChart } from '@/components/gantt/GanttChart';
import { OrderDetailPanel } from '@/components/schedule/OrderDetailPanel';
import { useScheduleData } from '@/hooks/useScheduleData';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import { useOrderEdit } from '@/hooks/useOrderEdit';
import { useAssignmentDiff } from '@/hooks/useAssignmentDiff';
import { checkConstraints } from '@/lib/constraints/checker';
import { SLOT_WIDTH_PX } from '@/components/gantt/constants';
import { DAY_OF_WEEK_ORDER } from '@/types';
import type { Order } from '@/types';

function SchedulePage() {
  const { welcomeOpen, closeWelcome, reopenWelcome } = useWelcomeDialog();
  const { weekStart, selectedDay } = useScheduleContext();
  const { customers, helpers, orderCounts, getDaySchedule, unavailability, loading } =
    useScheduleData(weekStart);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { saving, handleStaffChange } = useOrderEdit();

  const allOrders = useMemo(() => {
    const orders: Order[] = [];
    for (const day of DAY_OF_WEEK_ORDER) {
      const dayIdx = DAY_OF_WEEK_ORDER.indexOf(day);
      const date = addDays(weekStart, dayIdx);
      const s = getDaySchedule(day, date);
      orders.push(...s.helperRows.flatMap((r) => r.orders), ...s.unassignedOrders);
    }
    return orders;
  }, [weekStart, getDaySchedule]);

  const { diffMap } = useAssignmentDiff(weekStart, allOrders);

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

  // DnD — distance: 5px でクリックとドラッグを区別
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [slotWidth, setSlotWidth] = useState(SLOT_WIDTH_PX);
  const handleSlotWidthChange = useCallback((sw: number) => setSlotWidth(sw), []);

  const {
    dropZoneStatuses,
    activeOrder,
    previewTimes,
    dropMessage,
    handleDragStart,
    handleDragOver,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  } = useDragAndDrop({
    helperRows: schedule.helperRows,
    unassignedOrders: schedule.unassignedOrders,
    helpers,
    customers,
    unavailability,
    day: selectedDay,
    slotWidth,
  });

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
      <div className="flex h-screen flex-col">
        <header className="bg-gradient-to-r from-[oklch(0.50_0.13_200)] to-[oklch(0.56_0.14_188)] px-4 py-3 shadow-brand">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-white/20 animate-pulse" />
            <div className="h-5 w-24 rounded bg-white/20 animate-pulse" />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Header onShowWelcome={reopenWelcome} />
      <WelcomeDialog open={welcomeOpen} onClose={closeWelcome} />
      <div className="flex items-center justify-between border-b">
        <DayTabs orderCounts={orderCounts} />
        <div className="flex items-center gap-2 px-4">
          <BulkCompleteButton schedule={schedule} />
          <ResetButton />
          <OptimizeButton />
        </div>
      </div>
      <StatsBar schedule={schedule} violations={violations} />
      <main className="flex-1 overflow-auto p-4">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <GanttChart
            schedule={schedule}
            customers={customers}
            violations={violations}
            onOrderClick={handleOrderClick}
            dropZoneStatuses={dropZoneStatuses}
            unavailability={unavailability}
            activeOrder={activeOrder}
            onSlotWidthChange={handleSlotWidthChange}
            previewTimes={previewTimes}
            dropMessage={dropMessage}
          />
        </DndContext>
      </main>
      <OrderDetailPanel
        order={selectedOrder}
        customer={selectedOrder ? customers.get(selectedOrder.customer_id) : undefined}
        assignedHelpers={assignedHelpers}
        violations={selectedOrder ? violations.get(selectedOrder.id) ?? [] : []}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        helpers={helpers}
        onStaffChange={handleStaffChange}
        diff={selectedOrder ? diffMap.get(selectedOrder.id) : undefined}
        saving={saving}
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
