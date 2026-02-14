'use client';

import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DAY_OF_WEEK_ORDER,
  DAY_OF_WEEK_LABELS,
  type DayOfWeek,
  type AvailabilitySlot,
} from '@/types';

interface WeeklyAvailabilityEditorProps {
  value: Partial<Record<DayOfWeek, AvailabilitySlot[]>>;
  onChange: (value: Partial<Record<DayOfWeek, AvailabilitySlot[]>>) => void;
}

const EMPTY_SLOT: AvailabilitySlot = {
  start_time: '09:00',
  end_time: '18:00',
};

export function WeeklyAvailabilityEditor({
  value,
  onChange,
}: WeeklyAvailabilityEditorProps) {
  const [expandedDays, setExpandedDays] = useState<Set<DayOfWeek>>(
    () => {
      const days = new Set<DayOfWeek>();
      for (const day of DAY_OF_WEEK_ORDER) {
        if (value[day] && value[day]!.length > 0) days.add(day);
      }
      return days;
    }
  );

  const toggleDay = (day: DayOfWeek) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const addSlot = (day: DayOfWeek) => {
    const current = value[day] ?? [];
    onChange({ ...value, [day]: [...current, { ...EMPTY_SLOT }] });
    setExpandedDays((prev) => new Set(prev).add(day));
  };

  const removeSlot = (day: DayOfWeek, index: number) => {
    const current = value[day] ?? [];
    const updated = current.filter((_, i) => i !== index);
    onChange({ ...value, [day]: updated });
  };

  const updateSlot = (
    day: DayOfWeek,
    index: number,
    field: keyof AvailabilitySlot,
    fieldValue: string
  ) => {
    const current = value[day] ?? [];
    const updated = current.map((slot, i) =>
      i === index ? { ...slot, [field]: fieldValue } : slot
    );
    onChange({ ...value, [day]: updated });
  };

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">週間勤務可能時間</label>
      <div className="space-y-1 rounded-md border p-2">
        {DAY_OF_WEEK_ORDER.map((day) => {
          const slots = value[day] ?? [];
          const isExpanded = expandedDays.has(day);

          return (
            <div key={day} className="border-b last:border-b-0 pb-1 last:pb-0">
              <div className="flex items-center justify-between py-1">
                <button
                  type="button"
                  onClick={() => toggleDay(day)}
                  className="flex items-center gap-1 text-sm font-medium hover:text-primary"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  {DAY_OF_WEEK_LABELS[day]}
                  {slots.length > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({slots.length}件)
                    </span>
                  )}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => addSlot(day)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  追加
                </Button>
              </div>

              {isExpanded && slots.length > 0 && (
                <div className="ml-4 space-y-2 pb-2">
                  {slots.map((slot, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded bg-muted/50 p-2"
                    >
                      <Input
                        type="time"
                        value={slot.start_time}
                        onChange={(e) =>
                          updateSlot(day, idx, 'start_time', e.target.value)
                        }
                        className="h-8 w-28"
                      />
                      <span className="text-sm text-muted-foreground">〜</span>
                      <Input
                        type="time"
                        value={slot.end_time}
                        onChange={(e) =>
                          updateSlot(day, idx, 'end_time', e.target.value)
                        }
                        className="h-8 w-28"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeSlot(day, idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
