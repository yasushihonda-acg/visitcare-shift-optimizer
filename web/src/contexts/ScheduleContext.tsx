'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { startOfWeek, addWeeks, subWeeks } from 'date-fns';
import type { DayOfWeek } from '@/types';
import { DAY_OF_WEEK_ORDER } from '@/types';

interface ScheduleContextValue {
  weekStart: Date;
  selectedDay: DayOfWeek;
  setSelectedDay: (day: DayOfWeek) => void;
  goToNextWeek: () => void;
  goToPrevWeek: () => void;
  goToWeek: (date: Date) => void;
  viewMode: 'day' | 'week';
  setViewMode: (mode: 'day' | 'week') => void;
  ganttAxis: 'staff' | 'customer';
  setGanttAxis: (axis: 'staff' | 'customer') => void;
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

function getMonday(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(
    DAY_OF_WEEK_ORDER[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
  );
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [ganttAxis, setGanttAxis] = useState<'staff' | 'customer'>('staff');

  const goToNextWeek = useCallback(() => setWeekStart((w) => addWeeks(w, 1)), []);
  const goToPrevWeek = useCallback(() => setWeekStart((w) => subWeeks(w, 1)), []);
  const goToWeek = useCallback((date: Date) => setWeekStart(getMonday(date)), []);

  return (
    <ScheduleContext.Provider
      value={{ weekStart, selectedDay, setSelectedDay, goToNextWeek, goToPrevWeek, goToWeek, viewMode, setViewMode, ganttAxis, setGanttAxis }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useScheduleContext() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error('useScheduleContext must be used within ScheduleProvider');
  return ctx;
}
