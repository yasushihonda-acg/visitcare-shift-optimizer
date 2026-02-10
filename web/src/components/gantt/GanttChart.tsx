'use client';

import { GanttTimeHeader } from './GanttTimeHeader';
import { GanttRow } from './GanttRow';
import { UnassignedSection } from './UnassignedSection';
import type { DaySchedule } from '@/hooks/useScheduleData';
import type { Customer, Order } from '@/types';
import type { ViolationMap } from '@/lib/constraints/checker';

interface GanttChartProps {
  schedule: DaySchedule;
  customers: Map<string, Customer>;
  violations: ViolationMap;
  onOrderClick?: (order: Order) => void;
}

export function GanttChart({ schedule, customers, violations, onOrderClick }: GanttChartProps) {
  if (schedule.totalOrders === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        この日のオーダーはありません
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto border rounded-lg">
        <GanttTimeHeader />
        {schedule.helperRows.map((row) => (
          <GanttRow
            key={row.helper.id}
            row={row}
            customers={customers}
            violations={violations}
            onOrderClick={onOrderClick}
          />
        ))}
      </div>
      {schedule.unassignedOrders.length > 0 && (
        <UnassignedSection
          orders={schedule.unassignedOrders}
          customers={customers}
          onOrderClick={onOrderClick}
        />
      )}
    </div>
  );
}
