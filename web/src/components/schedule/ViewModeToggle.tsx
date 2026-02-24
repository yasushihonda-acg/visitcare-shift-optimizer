'use client';

import { CalendarDays, CalendarRange, Users, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScheduleContext } from '@/contexts/ScheduleContext';

export function ViewModeToggle() {
  const { viewMode, setViewMode, ganttAxis, setGanttAxis } = useScheduleContext();

  return (
    <div data-testid="view-mode-toggle" className="flex items-center border-r px-2 gap-2">
      <div className="flex rounded-md shadow-xs">
        <Button
          data-testid="view-mode-day"
          variant={viewMode === 'day' ? 'default' : 'outline'}
          size="sm"
          className="rounded-r-none border-r-0"
          onClick={() => setViewMode('day')}
          aria-pressed={viewMode === 'day'}
        >
          <CalendarDays className="size-4" />
          日
        </Button>
        <Button
          data-testid="view-mode-week"
          variant={viewMode === 'week' ? 'default' : 'outline'}
          size="sm"
          className="rounded-l-none"
          onClick={() => setViewMode('week')}
          aria-pressed={viewMode === 'week'}
        >
          <CalendarRange className="size-4" />
          週
        </Button>
      </div>
      {viewMode === 'day' && (
        <div className="flex rounded-md shadow-xs">
          <Button
            data-testid="gantt-axis-staff"
            variant={ganttAxis === 'staff' ? 'default' : 'outline'}
            size="sm"
            className="rounded-r-none border-r-0"
            onClick={() => setGanttAxis('staff')}
            aria-pressed={ganttAxis === 'staff'}
            title="スタッフ軸"
          >
            <Users className="size-4" />
            <span className="hidden xl:inline">スタッフ軸</span>
          </Button>
          <Button
            data-testid="gantt-axis-customer"
            variant={ganttAxis === 'customer' ? 'default' : 'outline'}
            size="sm"
            className="rounded-l-none"
            onClick={() => setGanttAxis('customer')}
            aria-pressed={ganttAxis === 'customer'}
            title="利用者軸"
          >
            <User className="size-4" />
            <span className="hidden xl:inline">利用者軸</span>
          </Button>
        </div>
      )}
    </div>
  );
}
