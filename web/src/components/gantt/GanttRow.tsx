'use client';

import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { GanttBar } from './GanttBar';
import { UnavailableBlocksOverlay } from './UnavailableBlocksOverlay';
import { SLOT_WIDTH_PX, TOTAL_SLOTS, HELPER_NAME_WIDTH_PX, GANTT_START_HOUR, GANTT_END_HOUR, calculateUnavailableBlocks } from './constants';
import type { Order, Customer, StaffUnavailability, DayOfWeek } from '@/types';
import type { HelperScheduleRow } from '@/hooks/useScheduleData';
import type { ViolationMap } from '@/lib/constraints/checker';
import type { DropZoneStatus } from '@/lib/dnd/types';
import { cn } from '@/lib/utils';

interface GanttRowProps {
  row: HelperScheduleRow;
  customers: Map<string, Customer>;
  violations: ViolationMap;
  onOrderClick?: (order: Order) => void;
  dropZoneStatus?: DropZoneStatus;
  index: number;
  unavailability: StaffUnavailability[];
  day: DayOfWeek;
  dayDate: Date;
}

const DROP_ZONE_STYLES: Record<DropZoneStatus, string> = {
  idle: '',
  valid: 'bg-green-50 ring-2 ring-inset ring-green-400',
  warning: 'bg-yellow-50 ring-2 ring-inset ring-yellow-400',
  invalid: 'bg-red-50 ring-2 ring-inset ring-red-400 cursor-not-allowed',
};

/** 時間グリッド背景線（全行で同一なので一度だけ生成） */
const GRID_LINES = Array.from({ length: GANTT_END_HOUR - GANTT_START_HOUR }, (_, i) => (
  <div
    key={i}
    className="absolute top-0 h-full border-l border-border/15"
    style={{ left: i * 12 * SLOT_WIDTH_PX }}
  />
));

export const GanttRow = memo(function GanttRow({ row, customers, violations, onOrderClick, dropZoneStatus = 'idle', index, unavailability, day, dayDate }: GanttRowProps) {
  const helperName = row.helper.name.short ?? `${row.helper.name.family}${row.helper.name.given}`;

  const staffUnavailSlots = unavailability
    .filter((u) => u.staff_id === row.helper.id)
    .flatMap((u) => u.unavailable_slots);

  const unavailableBlocks = calculateUnavailableBlocks(
    row.helper.weekly_availability,
    staffUnavailSlots,
    day,
    dayDate,
  );

  const { setNodeRef, isOver } = useDroppable({
    id: row.helper.id,
  });

  const isEven = index % 2 === 0;

  return (
    <div className={cn(
      'flex border-b border-border/50 transition-colors duration-100',
      isEven ? 'bg-card' : 'bg-muted/20',
      'hover:bg-primary/[0.03]'
    )}>
      <div
        className="shrink-0 border-r border-border/50 px-2 py-1 text-xs font-medium truncate flex items-center"
        style={{ width: HELPER_NAME_WIDTH_PX, height: 36 }}
        title={helperName}
      >
        {helperName}
      </div>
      <div
        ref={setNodeRef}
        data-testid={`gantt-row-${row.helper.id}`}
        className={cn(
          'relative transition-colors duration-150',
          isOver && DROP_ZONE_STYLES[dropZoneStatus]
        )}
        style={{ width: TOTAL_SLOTS * SLOT_WIDTH_PX, height: 36 }}
      >
        {/* 時間グリッド背景線 */}
        {GRID_LINES}
        {/* 勤務不可時間帯オーバーレイ */}
        <UnavailableBlocksOverlay blocks={unavailableBlocks} />
        {/* オーダーバー */}
        {row.orders.map((order) => {
          const orderViolations = violations.get(order.id);
          const hasError = orderViolations?.some((v) => v.severity === 'error');
          const hasWarning = orderViolations?.some((v) => v.severity === 'warning');
          return (
            <GanttBar
              key={order.id}
              order={order}
              customer={customers.get(order.customer_id)}
              hasViolation={!!orderViolations?.length}
              violationType={hasError ? 'error' : hasWarning ? 'warning' : undefined}
              onClick={onOrderClick}
              sourceHelperId={row.helper.id}
            />
          );
        })}
      </div>
    </div>
  );
});
