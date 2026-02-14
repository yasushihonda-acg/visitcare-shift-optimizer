'use client';

import { useDroppable } from '@dnd-kit/core';
import { GanttBar } from './GanttBar';
import { SLOT_WIDTH_PX, TOTAL_SLOTS, HELPER_NAME_WIDTH_PX, GANTT_START_HOUR, GANTT_END_HOUR } from './constants';
import type { Order, Customer } from '@/types';
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
}

const DROP_ZONE_STYLES: Record<DropZoneStatus, string> = {
  idle: '',
  valid: 'bg-green-50 ring-2 ring-inset ring-green-400',
  warning: 'bg-yellow-50 ring-2 ring-inset ring-yellow-400',
  invalid: 'bg-red-50 ring-2 ring-inset ring-red-400 cursor-not-allowed',
};

export function GanttRow({ row, customers, violations, onOrderClick, dropZoneStatus = 'idle' }: GanttRowProps) {
  const helperName = row.helper.name.short ?? `${row.helper.name.family}${row.helper.name.given}`;

  const { setNodeRef, isOver } = useDroppable({
    id: row.helper.id,
  });

  return (
    <div className="flex border-b hover:bg-muted/30">
      <div
        className="shrink-0 border-r px-2 py-1 text-xs font-medium truncate flex items-center"
        style={{ width: HELPER_NAME_WIDTH_PX }}
        title={helperName}
      >
        {helperName}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'relative h-7 transition-colors duration-150',
          isOver && DROP_ZONE_STYLES[dropZoneStatus]
        )}
        style={{ width: TOTAL_SLOTS * SLOT_WIDTH_PX }}
      >
        {/* 時間グリッド背景線 */}
        {Array.from({ length: GANTT_END_HOUR - GANTT_START_HOUR }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 h-full border-l border-border/20"
            style={{ left: i * 12 * SLOT_WIDTH_PX }}
          />
        ))}
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
}
