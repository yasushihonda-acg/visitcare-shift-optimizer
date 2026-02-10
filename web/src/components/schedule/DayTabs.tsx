'use client';

import { Badge } from '@/components/ui/badge';
import { useScheduleContext } from '@/contexts/ScheduleContext';
import { DAY_OF_WEEK_ORDER, DAY_OF_WEEK_LABELS, type DayOfWeek } from '@/types';
import { cn } from '@/lib/utils';

interface DayTabsProps {
  orderCounts?: Partial<Record<DayOfWeek, number>>;
}

export function DayTabs({ orderCounts }: DayTabsProps) {
  const { selectedDay, setSelectedDay } = useScheduleContext();

  return (
    <div className="flex gap-1 border-b px-4 py-2" role="tablist">
      {DAY_OF_WEEK_ORDER.map((day) => {
        const count = orderCounts?.[day] ?? 0;
        const isSelected = selectedDay === day;
        const isWeekend = day === 'saturday' || day === 'sunday';

        return (
          <button
            key={day}
            role="tab"
            aria-selected={isSelected}
            onClick={() => setSelectedDay(day)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted',
              isWeekend && !isSelected && 'text-muted-foreground'
            )}
          >
            {DAY_OF_WEEK_LABELS[day]}
            {count > 0 && (
              <Badge
                variant={isSelected ? 'secondary' : 'outline'}
                className="h-5 min-w-[20px] px-1 text-xs"
              >
                {count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
