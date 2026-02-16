'use client';

import { GanttTimeHeader } from './GanttTimeHeader';
import { GanttRow } from './GanttRow';
import { UnassignedSection } from './UnassignedSection';
import { SLOT_WIDTH_PX, HELPER_NAME_WIDTH_PX, timeToColumn } from './constants';
import type { DaySchedule } from '@/hooks/useScheduleData';
import type { Customer, Order, StaffUnavailability } from '@/types';
import type { ViolationMap } from '@/lib/constraints/checker';
import type { DropZoneStatus } from '@/lib/dnd/types';

/** 10分 = 2スロット（5分×2） */
const SLOTS_PER_10MIN = 2;
const PX_PER_10MIN = SLOTS_PER_10MIN * SLOT_WIDTH_PX;

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
  if (schedule.totalOrders === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        この日のオーダーはありません
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto border rounded-lg shadow-sm">
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
            const left = HELPER_NAME_WIDTH_PX + startBlock * PX_PER_10MIN;
            const width = Math.max((endBlock - startBlock) * PX_PER_10MIN, PX_PER_10MIN);
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
  );
}
