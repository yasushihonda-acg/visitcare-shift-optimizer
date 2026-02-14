'use client';

import { ClipboardList, CheckCircle2, AlertCircle, Users } from 'lucide-react';
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
  const totalViolations = errorCount + warningCount;
  const assignRate = schedule.totalOrders > 0
    ? Math.round((assignedCount / schedule.totalOrders) * 100)
    : 0;

  return (
    <div className="grid grid-cols-4 gap-3 px-4 py-3">
      {/* オーダー数 */}
      <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <ClipboardList className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground leading-none">オーダー</p>
          <p className="text-lg font-bold leading-tight">{schedule.totalOrders}<span className="text-xs font-normal text-muted-foreground ml-0.5">件</span></p>
        </div>
      </div>

      {/* 割当済 */}
      <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground leading-none">割当済</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg font-bold leading-tight">{assignedCount}</p>
            <span className="text-xs text-muted-foreground">{assignRate}%</span>
          </div>
          <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${assignRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* 未割当 */}
      <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-sm">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${schedule.unassignedOrders.length > 0 ? 'bg-amber-500/10' : 'bg-muted'}`}>
          <AlertCircle className={`h-4.5 w-4.5 ${schedule.unassignedOrders.length > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground leading-none">未割当</p>
          <p className={`text-lg font-bold leading-tight ${schedule.unassignedOrders.length > 0 ? 'text-amber-600' : ''}`}>
            {schedule.unassignedOrders.length}<span className="text-xs font-normal text-muted-foreground ml-0.5">件</span>
          </p>
        </div>
      </div>

      {/* ヘルパー */}
      <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Users className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground leading-none">ヘルパー</p>
          <div className="flex items-center gap-1.5">
            <p className="text-lg font-bold leading-tight">{schedule.helperRows.length}<span className="text-xs font-normal text-muted-foreground ml-0.5">名</span></p>
            {totalViolations > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {errorCount > 0 ? `違反${errorCount}` : `警告${warningCount}`}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
