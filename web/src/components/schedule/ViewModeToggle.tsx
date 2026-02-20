'use client';

import { CalendarDays, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScheduleContext } from '@/contexts/ScheduleContext';

export function ViewModeToggle() {
  const { viewMode, setViewMode } = useScheduleContext();

  return (
    <div data-testid="view-mode-toggle" className="flex items-center border-r px-2">
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
    </div>
  );
}
