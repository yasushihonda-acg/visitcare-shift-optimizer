'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
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
import { WeeklyAvailabilityEditor } from './WeeklyAvailabilityEditor';
import { CustomerTrainingStatusEditor } from './CustomerTrainingStatusEditor';
import { helperSchema, type HelperFormValues } from '@/lib/validation/schemas';
import { createHelper, updateHelper } from '@/lib/firestore/helpers';
import type { Helper, Customer } from '@/types';

interface HelperEditDialogProps {
  open: boolean;
  onClose: () => void;
  helper?: Helper;
  customers: Map<string, Customer>;
}

const QUALIFICATION_OPTIONS = [
  '介護福祉士',
  '実務者研修',
  '初任者研修',
] as const;

export function HelperEditDialog({
  open,
  onClose,
  helper,
  customers,
}: HelperEditDialogProps) {
  const isNew = !helper;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<HelperFormValues>({
    resolver: zodResolver(helperSchema),
    defaultValues: getDefaults(helper),
  });

  useEffect(() => {
    if (open) {
      reset(getDefaults(helper));
    }
  }, [open, helper, reset]);

  const qualifications = watch('qualifications');

  const toggleQualification = (qual: string) => {
    const current = qualifications ?? [];
    if (current.includes(qual)) {
      setValue('qualifications', current.filter((q) => q !== qual));
    } else {
      setValue('qualifications', [...current, qual]);
    }
  };

  const onSubmit = async (data: HelperFormValues) => {
    const saveData = {
      ...data,
      customer_training_status: data.customer_training_status ?? {},
      split_shift_allowed: data.split_shift_allowed ?? false,
    };
    try {
      if (isNew) {
        await createHelper(saveData);
        toast.success('ヘルパーを追加しました');
      } else {
        await updateHelper(helper.id, saveData);
        toast.success('ヘルパー情報を更新しました');
      }
      onClose();
    } catch (err) {
      console.error('Failed to save helper:', err);
      toast.error('保存に失敗しました');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'ヘルパーを追加' : 'ヘルパーを編集'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* 基本情報セクション */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">基本情報</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="name.family">姓</Label>
                <Input
                  id="name.family"
                  {...register('name.family')}
                  placeholder="佐藤"
                />
                {errors.name?.family && (
                  <p className="text-xs text-destructive">
                    {errors.name.family.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="name.given">名</Label>
                <Input
                  id="name.given"
                  {...register('name.given')}
                  placeholder="花子"
                />
                {errors.name?.given && (
                  <p className="text-xs text-destructive">
                    {errors.name.given.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="name.short">短縮名</Label>
              <Input
                id="name.short"
                {...register('name.short')}
                placeholder="佐花"
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                ガントチャートやレポートで表示される名前
              </p>
            </div>

            <div className="space-y-2">
              <Label>資格</Label>
              <div className="flex flex-wrap gap-4">
                {QUALIFICATION_OPTIONS.map((qual) => (
                  <label key={qual} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={qualifications?.includes(qual) ?? false}
                      onCheckedChange={() => toggleQualification(qual)}
                    />
                    {qual}
                  </label>
                ))}
              </div>
            </div>

            <Controller
              name="can_physical_care"
              control={control}
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  身体介護対応可
                </label>
              )}
            />

            <Controller
              name="split_shift_allowed"
              control={control}
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                  分断勤務可（午前・午後の非連続勤務）
                </label>
              )}
            />
          </div>

          <hr className="my-4" />

          {/* 雇用条件セクション */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">雇用条件</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>移動手段</Label>
                <Controller
                  name="transportation"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">車</SelectItem>
                        <SelectItem value="bicycle">自転車</SelectItem>
                        <SelectItem value="walk">徒歩</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label>雇用形態</Label>
                <Controller
                  name="employment_type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">常勤</SelectItem>
                        <SelectItem value="part_time">非常勤</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>希望勤務時間（時間/週）</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">最小</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    {...register('preferred_hours.min', { valueAsNumber: true })}
                    placeholder="0"
                  />
                  {errors.preferred_hours?.min && (
                    <p className="text-xs text-destructive">
                      {errors.preferred_hours.min.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">最大</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    {...register('preferred_hours.max', { valueAsNumber: true })}
                    placeholder="40"
                  />
                  {errors.preferred_hours?.max && (
                    <p className="text-xs text-destructive">
                      {errors.preferred_hours.max.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label>対応可能時間（時間/週）</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">最小</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    {...register('available_hours.min', { valueAsNumber: true })}
                    placeholder="0"
                  />
                  {errors.available_hours?.min && (
                    <p className="text-xs text-destructive">
                      {errors.available_hours.min.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">最大</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    {...register('available_hours.max', { valueAsNumber: true })}
                    placeholder="40"
                  />
                  {errors.available_hours?.max && (
                    <p className="text-xs text-destructive">
                      {errors.available_hours.max.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <hr className="my-4" />

          {/* 勤務スケジュールセクション */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">勤務スケジュール</h3>
            <Controller
              name="weekly_availability"
              control={control}
              render={({ field }) => (
                <WeeklyAvailabilityEditor
                  value={field.value ?? {}}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <hr className="my-4" />

          {/* 利用者別研修状態セクション */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">利用者別研修状態</h3>
            <p className="text-xs text-muted-foreground">
              「同行研修中」の利用者には、このヘルパーを単独で割り当てません
            </p>
            <Controller
              name="customer_training_status"
              control={control}
              render={({ field }) => (
                <CustomerTrainingStatusEditor
                  value={field.value ?? {}}
                  onChange={field.onChange}
                  customers={customers}
                />
              )}
            />
          </div>

          <DialogFooter>
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

function getDefaults(helper?: Helper): HelperFormValues {
  if (!helper) {
    return {
      name: { family: '', given: '' },
      qualifications: [],
      can_physical_care: false,
      transportation: 'bicycle',
      weekly_availability: {},
      preferred_hours: { min: 0, max: 40 },
      available_hours: { min: 0, max: 40 },
      employment_type: 'part_time',
      customer_training_status: {},
      split_shift_allowed: false,
    };
  }
  return {
    name: helper.name,
    qualifications: helper.qualifications,
    can_physical_care: helper.can_physical_care,
    transportation: helper.transportation,
    weekly_availability: helper.weekly_availability,
    preferred_hours: helper.preferred_hours,
    available_hours: helper.available_hours,
    employment_type: helper.employment_type,
    customer_training_status: helper.customer_training_status ?? {},
    split_shift_allowed: helper.split_shift_allowed ?? false,
  };
}
