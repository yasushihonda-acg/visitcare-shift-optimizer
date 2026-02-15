'use client';

import { useState } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useScheduleContext } from '@/contexts/ScheduleContext';
import { cn } from '@/lib/utils';

interface WeekSelectorProps {
  variant?: 'default' | 'header';
}

export function WeekSelector({ variant = 'default' }: WeekSelectorProps) {
  const { weekStart, goToNextWeek, goToPrevWeek, goToWeek } =
    useScheduleContext();
  const [open, setOpen] = useState(false);

  const weekEnd = addDays(weekStart, 6);
  const today = new Date();
  const isCurrentWeek = isSameDay(weekStart, getMonday(today));

  const label = `${format(weekStart, 'M/d', { locale: ja })} - ${format(weekEnd, 'M/d', { locale: ja })}`;
  const isHeader = variant === 'header';

  function handleSelect(date: Date | undefined) {
    if (date) {
      goToWeek(date);
      setOpen(false);
    }
  }

  function handleToday() {
    goToWeek(new Date());
    setOpen(false);
  }

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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={isHeader ? 'ghost' : 'outline'}
            className={cn(
              'min-w-[130px] justify-center gap-1.5 text-sm font-semibold tabular-nums',
              isHeader
                ? 'text-white hover:bg-white/15 hover:text-white'
                : 'text-foreground'
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 opacity-70" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={weekStart}
            onSelect={handleSelect}
            defaultMonth={weekStart}
            locale={ja}
            className="p-3"
          />
          {!isCurrentWeek && (
            <div className="border-t px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={handleToday}
              >
                今週に戻る
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

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

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
