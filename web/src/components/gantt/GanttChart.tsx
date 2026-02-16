'use client';

import { useRef, useState, useLayoutEffect } from 'react';
import { GanttTimeHeader } from './GanttTimeHeader';
import { GanttRow } from './GanttRow';
import { UnassignedSection } from './UnassignedSection';
import { GanttScaleProvider } from './GanttScaleContext';
import { SLOT_WIDTH_PX, HELPER_NAME_WIDTH_PX, TOTAL_SLOTS, timeToColumn } from './constants';
import type { DaySchedule } from '@/hooks/useScheduleData';
import type { Customer, Order, StaffUnavailability } from '@/types';
import type { ViolationMap } from '@/lib/constraints/checker';
import type { DropZoneStatus } from '@/lib/dnd/types';

/** 10分 = 2スロット（5分×2） */
const SLOTS_PER_10MIN = 2;

interface GanttChartProps {
  schedule: DaySchedule;
  customers: Map<string, Customer>;
  violations: ViolationMap;
  onOrderClick?: (order: Order) => void;
  dropZoneStatuses?: Map<string, DropZoneStatus>;
  unavailability: StaffUnavailability[];
  activeOrder?: Order | null;
}

export function GanttChart({ schedule, customers, violations, onOrderClick, dropZoneStatuses, unavailability, activeOrder }: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [slotWidth, setSlotWidth] = useState(SLOT_WIDTH_PX);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const sw = Math.max(SLOT_WIDTH_PX, (w - HELPER_NAME_WIDTH_PX) / TOTAL_SLOTS);
      setSlotWidth(sw);
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (schedule.totalOrders === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        この日のオーダーはありません
      </div>
    );
  }

  const pxPer10Min = SLOTS_PER_10MIN * slotWidth;

  return (
    <GanttScaleProvider value={slotWidth}>
      <div className="flex flex-col">
        <div ref={containerRef} className="overflow-x-auto border rounded-lg shadow-sm">
          <GanttTimeHeader />
          <div className="relative">
            {schedule.helperRows.map((row, index) => (
              <GanttRow
                key={row.helper.id}
                row={row}
                customers={customers}
                violations={violations}
                onOrderClick={onOrderClick}
                dropZoneStatus={dropZoneStatuses?.get(row.helper.id)}
                index={index}
                unavailability={unavailability}
                day={schedule.day}
                dayDate={schedule.date}
                activeOrder={activeOrder}
              />
            ))}
            {/* ドラッグ中の時間帯ハイライト（全行横断） */}
            {activeOrder && (() => {
              const startCol = timeToColumn(activeOrder.start_time);
              const endCol = timeToColumn(activeOrder.end_time);
              // 10分単位にスナップ
              const startBlock = Math.floor((startCol - 1) / SLOTS_PER_10MIN);
              const endBlock = Math.ceil((endCol - 1) / SLOTS_PER_10MIN);
              const left = HELPER_NAME_WIDTH_PX + startBlock * pxPer10Min;
              const width = Math.max((endBlock - startBlock) * pxPer10Min, pxPer10Min);
              return (
                <div
                  className="absolute top-0 h-full pointer-events-none border-l border-r border-primary/30 bg-primary/[0.06] z-[1]"
                  style={{ left, width }}
                />
              );
            })()}
          </div>
        </div>
        <UnassignedSection
          orders={schedule.unassignedOrders}
          customers={customers}
          onOrderClick={onOrderClick}
          dropZoneStatus={dropZoneStatuses?.get('unassigned-section')}
        />
      </div>
    </GanttScaleProvider>
  );
}
