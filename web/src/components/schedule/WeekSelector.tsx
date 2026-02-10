'use client';

import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { addDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScheduleContext } from '@/contexts/ScheduleContext';

export function WeekSelector() {
  const { weekStart, goToNextWeek, goToPrevWeek } = useScheduleContext();
  const weekEnd = addDays(weekStart, 6);

  const label = `${format(weekStart, 'M/d', { locale: ja })} - ${format(weekEnd, 'M/d', { locale: ja })}`;

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={goToPrevWeek} aria-label="前の週">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[120px] text-center text-sm font-medium">{label}</span>
      <Button variant="outline" size="icon" onClick={goToNextWeek} aria-label="次の週">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
