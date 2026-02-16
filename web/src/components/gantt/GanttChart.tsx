'use client';

import { GanttTimeHeader } from './GanttTimeHeader';
import { GanttRow } from './GanttRow';
import { UnassignedSection } from './UnassignedSection';
import type { DaySchedule } from '@/hooks/useScheduleData';
import type { Customer, Order, StaffUnavailability } from '@/types';
import type { ViolationMap } from '@/lib/constraints/checker';
import type { DropZoneStatus } from '@/lib/dnd/types';

interface GanttChartProps {
  schedule: DaySchedule;
  customers: Map<string, Customer>;
  violations: ViolationMap;
  onOrderClick?: (order: Order) => void;
  dropZoneStatuses?: Map<string, DropZoneStatus>;
  unavailability: StaffUnavailability[];
}

export function GanttChart({ schedule, customers, violations, onOrderClick, dropZoneStatuses, unavailability }: GanttChartProps) {
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
          />
        ))}
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
