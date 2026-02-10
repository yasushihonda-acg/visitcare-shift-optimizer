'use client';

import { Badge } from '@/components/ui/badge';
import type { DaySchedule } from '@/hooks/useScheduleData';
import type { ViolationMap } from '@/lib/constraints/checker';

interface StatsBarProps {
  schedule: DaySchedule;
  violations: ViolationMap;
}

export function StatsBar({ schedule, violations }: StatsBarProps) {
  const assignedCount = schedule.helperRows.reduce(
    (sum, row) => sum + row.orders.length, 0
  );
  const errorCount = Array.from(violations.values())
    .flat()
    .filter((v) => v.severity === 'error').length;
  const warningCount = Array.from(violations.values())
    .flat()
    .filter((v) => v.severity === 'warning').length;

  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm">
      <span>
        オーダー: <strong>{schedule.totalOrders}</strong>件
      </span>
      <span>
        割当済: <strong>{assignedCount}</strong>件
      </span>
      <span>
        未割当: <strong>{schedule.unassignedOrders.length}</strong>件
      </span>
      <span>
        ヘルパー: <strong>{schedule.helperRows.length}</strong>名
      </span>
      {errorCount > 0 && (
        <Badge variant="destructive" className="text-xs">
          違反 {errorCount}
        </Badge>
      )}
      {warningCount > 0 && (
        <Badge variant="outline" className="border-yellow-500 text-yellow-600 text-xs">
          警告 {warningCount}
        </Badge>
      )}
    </div>
  );
}
