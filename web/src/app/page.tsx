'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { addDays } from 'date-fns';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { ScheduleProvider, useScheduleContext } from '@/contexts/ScheduleContext';
import { Header } from '@/components/layout/Header';
import { WelcomeDialog } from '@/components/onboarding/WelcomeDialog';
import { useWelcomeDialog } from '@/components/onboarding/useWelcomeDialog';
import { DayTabs } from '@/components/schedule/DayTabs';
import { ViewModeToggle } from '@/components/schedule/ViewModeToggle';
import { StatsBar } from '@/components/schedule/StatsBar';
import { NoteImportButton } from '@/components/schedule/NoteImportButton';
import { OptimizeButton } from '@/components/schedule/OptimizeButton';
import { ResetButton } from '@/components/schedule/ResetButton';
import { BulkCompleteButton } from '@/components/schedule/BulkCompleteButton';
import { UndoRedoButtons } from '@/components/schedule/UndoRedoButtons';
import { GanttChart } from '@/components/gantt/GanttChart';
import { WeeklyGanttChart } from '@/components/gantt/WeeklyGanttChart';
import { CustomerGanttChart } from '@/components/gantt/CustomerGanttChart';
import { OrderDetailPanel } from '@/components/schedule/OrderDetailPanel';
import { useScheduleData } from '@/hooks/useScheduleData';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import { useOrderEdit } from '@/hooks/useOrderEdit';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useUndoRedoKeyboard } from '@/hooks/useUndoRedoKeyboard';
import { useAssignmentDiff } from '@/hooks/useAssignmentDiff';
import { useAdjacentAddressGroups } from '@/hooks/useAddressGroups';
import { checkConstraints } from '@/lib/constraints/checker';
import { createConfirmEditCommand } from '@/lib/undo/commands';
import { useServiceTypes } from '@/hooks/useServiceTypes';
import { ViolationPanel } from '@/components/schedule/ViolationPanel';
import { ViolationSummaryBar } from '@/components/schedule/ViolationSummaryBar';
import { SLOT_WIDTH_PX } from '@/components/gantt/constants';
import { DAY_OF_WEEK_ORDER } from '@/types';
import type { Order, DayOfWeek } from '@/types';
import type { ViolationSeverity } from '@/lib/constraints/checker';

function SchedulePage() {
  const { welcomeOpen, closeWelcome, reopenWelcome } = useWelcomeDialog();
  const { weekStart, selectedDay, setSelectedDay, viewMode, setViewMode, ganttAxis } = useScheduleContext();
  const { customers, helpers, orderCounts, getDaySchedule, unavailability, loading, travelTimeLookup } =
    useScheduleData(weekStart);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [violationPanelOpen, setViolationPanelOpen] = useState(false);
  const [violationPanelFilter, setViolationPanelFilter] = useState<ViolationSeverity | 'all'>('all');

  const handleViolationClick = useCallback((severity: ViolationSeverity) => {
    setViolationPanelFilter(severity);
    setViolationPanelOpen(true);
  }, []);

  const { canUndo, canRedo, undo, redo, pushCommand, clearHistory, undoLabel, redoLabel } = useUndoRedo();
  useUndoRedoKeyboard({ undo, redo, canUndo, canRedo });

  const { saving, handleStaffChange, handleCompanionChange } = useOrderEdit({ onCommand: pushCommand });
  const { serviceTypes } = useServiceTypes();

  const allOrders = useMemo(() => {
    const orders: Order[] = [];
    for (const [dayIdx, day] of DAY_OF_WEEK_ORDER.entries()) {
      const date = addDays(weekStart, dayIdx);
      const s = getDaySchedule(day, date);
      orders.push(...s.helperRows.flatMap((r) => r.orders), ...s.unassignedOrders);
    }
    return orders;
  }, [weekStart, getDaySchedule]);

  const selectedOrder = useMemo(
    () => (selectedOrderId ? allOrders.find((o) => o.id === selectedOrderId) ?? null : null),
    [selectedOrderId, allOrders],
  );

  const { diffMap } = useAssignmentDiff(weekStart, allOrders);

  const dayIndex = DAY_OF_WEEK_ORDER.indexOf(selectedDay);
  const dayDate = useMemo(() => addDays(weekStart, dayIndex), [weekStart, dayIndex]);
  const schedule = useMemo(
    () => getDaySchedule(selectedDay, dayDate),
    [getDaySchedule, selectedDay, dayDate]
  );

  // 同じヘルパー行で隣接する同一住所ペアのみインジケーター表示
  const addressGroupMap = useAdjacentAddressGroups(customers, schedule.helperRows);

  const violations = useMemo(
    () =>
      checkConstraints({
        orders: [...new Map(
          schedule.helperRows.flatMap((r) => r.orders).concat(schedule.unassignedOrders)
            .map(o => [o.id, o])
        ).values()],
        helpers,
        customers,
        unavailability,
        day: selectedDay,
        serviceTypes,
        travelTimeLookup,
      }),
    [schedule, helpers, customers, unavailability, selectedDay, serviceTypes, travelTimeLookup]
  );

  // 最適化完了後に違反があれば自動でViolationPanelを表示
  const pendingViolationCheckRef = useRef(false);
  const handleOptimizeComplete = useCallback(() => {
    pendingViolationCheckRef.current = true;
  }, []);
  useEffect(() => {
    if (pendingViolationCheckRef.current && violations.size > 0) {
      pendingViolationCheckRef.current = false;
      setViolationPanelFilter('all');
      setViolationPanelOpen(true);
    }
  }, [violations]);

  // 週変更時に履歴をクリア
  useEffect(() => {
    clearHistory();
  }, [weekStart]);

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
    serviceTypes,
    travelTimeLookup,
    onCommand: pushCommand,
  });

  const handleDayNavigation = useCallback(
    (day: DayOfWeek) => {
      setSelectedDay(day);
      setViewMode('day');
    },
    [setSelectedDay, setViewMode],
  );

  const weeklySchedule = useMemo(() => {
    const assigned = allOrders.filter((o) => o.assigned_staff_ids.length > 0);
    const unassigned = allOrders.filter((o) => o.assigned_staff_ids.length === 0);
    const helperOrderMap = new Map<string, Order[]>();
    for (const order of assigned) {
      for (const staffId of order.assigned_staff_ids) {
        const existing = helperOrderMap.get(staffId) ?? [];
        existing.push(order);
        helperOrderMap.set(staffId, existing);
      }
    }
    const helperRows = Array.from(helpers.values()).map((helper) => ({
      helper,
      orders: helperOrderMap.get(helper.id) ?? [],
    }));
    return { day: selectedDay, date: dayDate, helperRows, unassignedOrders: unassigned, totalOrders: allOrders.length };
  }, [allOrders, helpers, selectedDay, dayDate]);

  const handleOrderClick = (order: Order) => {
    setSelectedOrderId(order.id);
    setDetailOpen(true);
  };

  const handleConfirmManualEdit = useCallback(async (orderId: string) => {
    const cmd = createConfirmEditCommand(orderId);
    await cmd.redo();
    pushCommand(cmd);
  }, [pushCommand]);

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
        <div className="flex items-center">
          <ViewModeToggle />
          {viewMode === 'day' && <DayTabs orderCounts={orderCounts} />}
        </div>
        <div className="flex items-center gap-2 px-4">
          <UndoRedoButtons
            canUndo={canUndo}
            canRedo={canRedo}
            undoLabel={undoLabel}
            redoLabel={redoLabel}
            onUndo={undo}
            onRedo={redo}
          />
          {viewMode === 'day' && <BulkCompleteButton schedule={schedule} />}
          <NoteImportButton />
          <ResetButton onHistoryClear={clearHistory} />
          <OptimizeButton onHistoryClear={clearHistory} onComplete={handleOptimizeComplete} />
        </div>
      </div>
      <StatsBar
        schedule={viewMode === 'week' ? weeklySchedule : schedule}
        violations={viewMode === 'week' ? (new Map() as typeof violations) : violations}
        diffMap={diffMap}
        onViolationClick={handleViolationClick}
      />
      {viewMode === 'day' && (
        <ViolationSummaryBar
          violations={violations}
          onOpenPanel={() => { setViolationPanelFilter('all'); setViolationPanelOpen(true); }}
        />
      )}
      <main className="flex-1 overflow-auto p-4">
        {viewMode === 'day' ? (
          ganttAxis === 'customer' ? (
            <CustomerGanttChart
              schedule={schedule}
              customers={customers}
              helpers={helpers}
              onOrderClick={handleOrderClick}
            />
          ) : (
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
                onConfirmManualEdit={handleConfirmManualEdit}
                addressGroupMap={addressGroupMap}
              />
            </DndContext>
          )
        ) : (
          <WeeklyGanttChart
            weekStart={weekStart}
            getDaySchedule={getDaySchedule}
            helpers={helpers}
            customers={customers}
            unavailability={unavailability}
            onDayClick={handleDayNavigation}
            onOrderClick={handleOrderClick}
          />
        )}
      </main>
      <ViolationPanel
        open={violationPanelOpen}
        onOpenChange={setViolationPanelOpen}
        violations={violations}
        customers={customers}
        helpers={helpers}
        initialFilter={violationPanelFilter}
      />
      <OrderDetailPanel
        order={selectedOrder}
        customer={selectedOrder ? customers.get(selectedOrder.customer_id) : undefined}
        assignedHelpers={assignedHelpers}
        violations={selectedOrder ? violations.get(selectedOrder.id) ?? [] : []}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        helpers={helpers}
        onStaffChange={handleStaffChange}
        onCompanionChange={handleCompanionChange}
        diff={selectedOrder ? diffMap.get(selectedOrder.id) : undefined}
        saving={saving}
        unavailability={unavailability}
        day={selectedDay}
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
