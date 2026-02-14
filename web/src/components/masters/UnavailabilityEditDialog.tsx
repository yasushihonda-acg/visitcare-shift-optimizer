'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { addDays, format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  unavailabilitySchema,
  type UnavailabilityFormValues,
} from '@/lib/validation/schemas';
import {
  createStaffUnavailability,
  updateStaffUnavailability,
  deleteStaffUnavailability,
} from '@/lib/firestore/staff-unavailability';
import type { Helper, StaffUnavailability, DayOfWeek } from '@/types';
import { DAY_OF_WEEK_ORDER, DAY_OF_WEEK_LABELS } from '@/types';

interface UnavailabilityEditDialogProps {
  open: boolean;
  onClose: () => void;
  unavailability?: StaffUnavailability;
  helpers: Map<string, Helper>;
  weekStart: Date;
}

export function UnavailabilityEditDialog({
  open,
  onClose,
  unavailability,
  helpers,
  weekStart,
}: UnavailabilityEditDialogProps) {
  const isNew = !unavailability;

  const weekDates = useMemo(() => {
    return DAY_OF_WEEK_ORDER.map((day, i) => ({
      day,
      label: DAY_OF_WEEK_LABELS[day],
      date: addDays(weekStart, i),
      dateStr: format(addDays(weekStart, i), 'yyyy-MM-dd'),
    }));
  }, [weekStart]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UnavailabilityFormValues>({
    resolver: zodResolver(unavailabilitySchema),
    defaultValues: getDefaults(unavailability, weekStart),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'unavailable_slots',
  });

  useEffect(() => {
    if (open) {
      reset(getDefaults(unavailability, weekStart));
    }
  }, [open, unavailability, weekStart, reset]);

  const onSubmit = async (data: UnavailabilityFormValues) => {
    try {
      const input = {
        staff_id: data.staff_id,
        week_start_date: weekStart,
        unavailable_slots: data.unavailable_slots.map((slot) => ({
          date: new Date(slot.date),
          all_day: slot.all_day,
          ...(slot.start_time && { start_time: slot.start_time }),
          ...(slot.end_time && { end_time: slot.end_time }),
        })),
        notes: data.notes || undefined,
      };

      if (isNew) {
        await createStaffUnavailability(input);
        toast.success('希望休を登録しました');
      } else {
        await updateStaffUnavailability(unavailability.id, input);
        toast.success('希望休を更新しました');
      }
      onClose();
    } catch (err) {
      console.error('Failed to save unavailability:', err);
      toast.error('保存に失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!unavailability) return;
    try {
      await deleteStaffUnavailability(unavailability.id);
      toast.success('希望休を削除しました');
      onClose();
    } catch (err) {
      console.error('Failed to delete unavailability:', err);
      toast.error('削除に失敗しました');
    }
  };

  const helperList = useMemo(
    () => Array.from(helpers.values()).sort((a, b) => a.name.family.localeCompare(b.name.family)),
    [helpers]
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? '希望休を追加' : '希望休を編集'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* スタッフ選択 */}
          <div className="space-y-1">
            <Label>スタッフ</Label>
            <Select
              value={watch('staff_id')}
              onValueChange={(v) => setValue('staff_id', v)}
              disabled={!isNew}
            >
              <SelectTrigger>
                <SelectValue placeholder="スタッフを選択" />
              </SelectTrigger>
              <SelectContent>
                {helperList.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name.family} {h.name.given}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.staff_id && (
              <p className="text-xs text-destructive">{errors.staff_id.message}</p>
            )}
          </div>

          {/* 対象週 */}
          <div className="space-y-1">
            <Label>対象週</Label>
            <Input
              value={`${format(weekStart, 'yyyy/MM/dd')}（月）〜`}
              disabled
              className="bg-muted"
            />
            <input type="hidden" {...register('week_start_date')} />
          </div>

          {/* 不在スロット */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>不在スロット</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  append({
                    date: weekDates[0].dateStr,
                    all_day: true,
                    start_time: '',
                    end_time: '',
                  })
                }
              >
                <Plus className="mr-1 h-3 w-3" />
                追加
              </Button>
            </div>

            {errors.unavailable_slots?.root && (
              <p className="text-xs text-destructive">
                {errors.unavailable_slots.root.message}
              </p>
            )}

            {fields.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                不在スロットを追加してください
              </p>
            )}

            {fields.map((field, index) => {
              const allDay = watch(`unavailable_slots.${index}.all_day`);
              return (
                <div
                  key={field.id}
                  className="rounded-md border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Select
                      value={watch(`unavailable_slots.${index}.date`)}
                      onValueChange={(v) =>
                        setValue(`unavailable_slots.${index}.date`, v)
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {weekDates.map((wd) => (
                          <SelectItem key={wd.dateStr} value={wd.dateStr}>
                            {format(wd.date, 'MM/dd')}（{wd.label}）
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={allDay}
                      onCheckedChange={(checked) =>
                        setValue(
                          `unavailable_slots.${index}.all_day`,
                          checked === true
                        )
                      }
                    />
                    <span className="text-sm">終日</span>
                  </label>

                  {!allDay && (
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <Input
                        type="time"
                        {...register(`unavailable_slots.${index}.start_time`)}
                      />
                      <span className="text-sm text-muted-foreground">〜</span>
                      <Input
                        type="time"
                        {...register(`unavailable_slots.${index}.end_time`)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 備考 */}
          <div className="space-y-1">
            <Label htmlFor="notes">備考（任意）</Label>
            <Input id="notes" {...register('notes')} placeholder="理由など" />
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {!isNew && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="sm:mr-auto"
              >
                削除
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getDefaults(
  unavailability: StaffUnavailability | undefined,
  weekStart: Date
): UnavailabilityFormValues {
  if (!unavailability) {
    return {
      staff_id: '',
      week_start_date: format(weekStart, 'yyyy-MM-dd'),
      unavailable_slots: [],
      notes: '',
    };
  }
  return {
    staff_id: unavailability.staff_id,
    week_start_date: format(weekStart, 'yyyy-MM-dd'),
    unavailable_slots: unavailability.unavailable_slots.map((slot) => ({
      date: format(slot.date, 'yyyy-MM-dd'),
      all_day: slot.all_day,
      start_time: slot.start_time ?? '',
      end_time: slot.end_time ?? '',
    })),
    notes: unavailability.notes ?? '',
  };
}
