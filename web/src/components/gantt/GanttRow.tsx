'use client';

import { memo, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { GanttBar } from './GanttBar';
import { UnavailableBlocksOverlay } from './UnavailableBlocksOverlay';
import { TOTAL_SLOTS, HELPER_NAME_WIDTH_PX, GANTT_START_HOUR, GANTT_END_HOUR, calculateUnavailableBlocks, timeToColumn } from './constants';
import { useSlotWidth } from './GanttScaleContext';
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
  activeOrder?: Order | null;
  /** ドラッグ中の時刻プレビュー（時間軸移動用） */
  previewTimes?: { startTime: string; endTime: string } | null;
}

/** ゴーストバー用の薄い背景色（サービスタイプ別） */
const GHOST_COLORS: Record<string, string> = {
  physical_care: 'bg-[oklch(0.55_0.15_230/0.3)]',
  daily_living: 'bg-[oklch(0.55_0.15_160/0.3)]',
  prevention: 'bg-[oklch(0.60_0.12_300/0.3)]',
};

const DROP_ZONE_STYLES: Record<DropZoneStatus, string> = {
  idle: '',
  valid: 'bg-green-50 ring-2 ring-inset ring-green-400',
  warning: 'bg-yellow-50 ring-2 ring-inset ring-yellow-400',
  invalid: 'bg-red-50 ring-2 ring-inset ring-red-400 cursor-not-allowed',
};

/** 10分 = 2スロット（5分×2） */
const SLOTS_PER_10MIN = 2;
const TOTAL_10MIN_INTERVALS = (GANTT_END_HOUR - GANTT_START_HOUR) * 6; // 14h × 6 = 84

export const GanttRow = memo(function GanttRow({ row, customers, violations, onOrderClick, dropZoneStatus = 'idle', index, unavailability, day, dayDate, activeOrder, previewTimes }: GanttRowProps) {
  const slotWidth = useSlotWidth();
  const pxPer10Min = SLOTS_PER_10MIN * slotWidth;
  const helperName = row.helper.name.short ?? `${row.helper.name.family}${row.helper.name.given}`;

  const staffUnavailSlots = unavailability
    .filter((u) => u.staff_id === row.helper.id)
    .flatMap((u) => u.unavailable_slots);

  const unavailableBlocks = calculateUnavailableBlocks(
    row.helper.weekly_availability,
    staffUnavailSlots,
    day,
    dayDate,
    slotWidth,
  );

  const gridLines = useMemo(() =>
    Array.from({ length: TOTAL_10MIN_INTERVALS }, (_, i) => {
      const isHour = i % 6 === 0;
      const isHalf = i % 3 === 0;
      return (
        <div
          key={i}
          className={cn(
            'absolute top-0 h-full border-l',
            isHour ? 'border-border/25' : isHalf ? 'border-border/15' : 'border-border/8',
          )}
          style={{ left: i * pxPer10Min }}
        />
      );
    }),
  [pxPer10Min]);

  // 休みの日かどうか判定（非勤務日 or 終日希望休）
  const isDayOff = unavailableBlocks.some((b) => b.type === 'day_off' || (b.type === 'unavailable' && b.label === '希望休' && b.left === 0));

  const { setNodeRef, isOver } = useDroppable({
    id: row.helper.id,
  });

  const isEven = index % 2 === 0;

  return (
    <div className={cn(
      'flex border-b border-border/50 transition-colors duration-100',
      isDayOff
        ? 'bg-muted/50'
        : isEven ? 'bg-card' : 'bg-muted/20',
      !isDayOff && 'hover:bg-primary/[0.03]'
    )}>
      <div
        className={cn(
          'shrink-0 border-r border-border/50 px-2 py-1 text-xs font-medium truncate flex items-center gap-1',
          isDayOff && 'text-muted-foreground/60',
        )}
        style={{ width: HELPER_NAME_WIDTH_PX, height: 36 }}
        title={helperName}
      >
        <span className="truncate">{helperName}</span>
        {isDayOff && (
          <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-muted-foreground/15 text-muted-foreground/70 leading-none">
            休
          </span>
        )}
      </div>
      <div
        ref={setNodeRef}
        data-testid={`gantt-row-${row.helper.id}`}
        className={cn(
          'relative transition-colors duration-150',
          isOver && DROP_ZONE_STYLES[dropZoneStatus]
        )}
        style={{ width: TOTAL_SLOTS * slotWidth, height: 36 }}
      >
        {/* 時間グリッド背景線 */}
        {gridLines}
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
        {/* ゴーストブロック（10分単位のドロップ先プレビュー） */}
        {isOver && dropZoneStatus !== 'idle' && dropZoneStatus !== 'invalid' && activeOrder && (() => {
          // previewTimes がある場合は新しい時刻位置にゴーストを表示
          const displayStart = previewTimes?.startTime ?? activeOrder.start_time;
          const displayEnd = previewTimes?.endTime ?? activeOrder.end_time;
          const ghostStartCol = timeToColumn(displayStart);
          const ghostEndCol = timeToColumn(displayEnd);
          const ghostColor = GHOST_COLORS[activeOrder.service_type] ?? GHOST_COLORS.physical_care;
          const customerName = customers.get(activeOrder.customer_id);
          const ghostLabel = customerName
            ? (customerName.name.short ?? `${customerName.name.family}${customerName.name.given}`)
            : '';

          // 10分単位（2スロット）にスナップ
          const startBlock = Math.floor((ghostStartCol - 1) / SLOTS_PER_10MIN);
          const endBlock = Math.ceil((ghostEndCol - 1) / SLOTS_PER_10MIN);
          const blockCount = Math.max(endBlock - startBlock, 1);

          return Array.from({ length: blockCount }, (_, i) => {
            const blockLeft = (startBlock + i) * pxPer10Min;
            const isFirst = i === 0;
            const isLast = i === blockCount - 1;
            return (
              <div
                key={i}
                className={cn(
                  'absolute top-1 h-8 border border-dashed border-current/50 pointer-events-none',
                  ghostColor,
                  isFirst && 'rounded-l-md',
                  isLast && 'rounded-r-md',
                  !isFirst && !isLast && 'rounded-none',
                  isFirst && isLast && 'rounded-md',
                )}
                style={{
                  left: blockLeft,
                  width: pxPer10Min,
                }}
                title={isFirst ? `${ghostLabel} ${displayStart}-${displayEnd}` : undefined}
              />
            );
          });
        })()}
      </div>
    </div>
  );
});
