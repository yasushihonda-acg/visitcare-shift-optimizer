'use client';

import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { addDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScheduleContext } from '@/contexts/ScheduleContext';
import { cn } from '@/lib/utils';

interface WeekSelectorProps {
  variant?: 'default' | 'header';
}

export function WeekSelector({ variant = 'default' }: WeekSelectorProps) {
  const { weekStart, goToNextWeek, goToPrevWeek } = useScheduleContext();
  const weekEnd = addDays(weekStart, 6);

  const label = `${format(weekStart, 'M/d', { locale: ja })} - ${format(weekEnd, 'M/d', { locale: ja })}`;
  const isHeader = variant === 'header';

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant={isHeader ? 'ghost' : 'outline'}
        size="icon"
        onClick={goToPrevWeek}
        aria-label="前の週"
        className={cn(
          'h-8 w-8',
          isHeader && 'text-white/90 hover:bg-white/15 hover:text-white'
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span
        className={cn(
          'min-w-[110px] text-center text-sm font-semibold tabular-nums',
          isHeader ? 'text-white' : 'text-foreground'
        )}
      >
        {label}
      </span>
      <Button
        variant={isHeader ? 'ghost' : 'outline'}
        size="icon"
        onClick={goToNextWeek}
        aria-label="次の週"
        className={cn(
          'h-8 w-8',
          isHeader && 'text-white/90 hover:bg-white/15 hover:text-white'
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
