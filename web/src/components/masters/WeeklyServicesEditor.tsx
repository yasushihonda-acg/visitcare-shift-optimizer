'use client';

import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DAY_OF_WEEK_ORDER,
  DAY_OF_WEEK_LABELS,
  type DayOfWeek,
  type ServiceSlot,
} from '@/types';
import { detectOverlaps } from '@/lib/validation/timeOverlap';
import { useServiceTypes } from '@/hooks/useServiceTypes';

interface WeeklyServicesEditorProps {
  value: Partial<Record<DayOfWeek, ServiceSlot[]>>;
  onChange: (value: Partial<Record<DayOfWeek, ServiceSlot[]>>) => void;
}

const EMPTY_SLOT: ServiceSlot = {
  start_time: '09:00',
  end_time: '10:00',
  service_type: 'physical_care',
  staff_count: 1,
};

export function WeeklyServicesEditor({
  value,
  onChange,
}: WeeklyServicesEditorProps) {
  const { sortedList: serviceTypeList } = useServiceTypes();
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
    field: keyof ServiceSlot,
    fieldValue: string | number
  ) => {
    const current = value[day] ?? [];
    const updated = current.map((slot, i) =>
      i === index ? { ...slot, [field]: fieldValue } : slot
    );
    onChange({ ...value, [day]: updated });
  };

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">週間サービス</label>
      <div className="space-y-1 rounded-md border p-2">
        {DAY_OF_WEEK_ORDER.map((day) => {
          const slots = value[day] ?? [];
          const isExpanded = expandedDays.has(day);
          const overlaps = detectOverlaps(slots);

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
                  {overlaps.size > 0 && (
                    <span className="ml-1 text-xs text-destructive font-semibold">
                      時間帯重複
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
                  {slots.map((slot, idx) => {
                    const hasOverlap = overlaps.has(idx);
                    return (
                      <div
                        key={idx}
                        className={`flex flex-wrap items-center gap-2 rounded p-2 ${
                          hasOverlap
                            ? 'border border-destructive bg-destructive/5'
                            : 'bg-muted/50'
                        }`}
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
                        <Select
                          value={slot.service_type}
                          onValueChange={(v) =>
                            updateSlot(day, idx, 'service_type', v)
                          }
                        >
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {serviceTypeList.map((st) => (
                              <SelectItem key={st.code} value={st.code}>
                                {st.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            max={3}
                            value={slot.staff_count}
                            onChange={(e) =>
                              updateSlot(
                                day,
                                idx,
                                'staff_count',
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="h-8 w-16"
                          />
                          <span className="text-xs text-muted-foreground">名</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeSlot(day, idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {hasOverlap && (
                          <p className="w-full text-xs text-destructive">
                            他のスロットと時間帯が重複しています
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
