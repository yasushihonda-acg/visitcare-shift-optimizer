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
import { serviceTypeSchema, type ServiceTypeFormValues } from '@/lib/validation/schemas';
import { createServiceType, updateServiceType } from '@/lib/firestore/service-types';
import type { ServiceTypeDoc } from '@/types';

interface ServiceTypeEditDialogProps {
  open: boolean;
  onClose: () => void;
  serviceType?: ServiceTypeDoc;
}

export function ServiceTypeEditDialog({
  open,
  onClose,
  serviceType,
}: ServiceTypeEditDialogProps) {
  const isNew = !serviceType;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ServiceTypeFormValues>({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: getDefaults(serviceType),
  });

  useEffect(() => {
    if (open) {
      reset(getDefaults(serviceType));
    }
  }, [open, serviceType, reset]);

  const onSubmit = async (data: ServiceTypeFormValues) => {
    try {
      if (isNew) {
        await createServiceType(data);
        toast.success('サービス種別を追加しました');
      } else {
        const { code: _, ...updateData } = data;
        await updateServiceType(serviceType.code, updateData);
        toast.success('サービス種別を更新しました');
      }
      onClose();
    } catch (err) {
      console.error('Failed to save service type:', err);
      toast.error('保存に失敗しました');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isNew ? 'サービス種別を追加' : 'サービス種別を編集'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="code">コード</Label>
            {isNew ? (
              <>
                <Input
                  id="code"
                  {...register('code')}
                  placeholder="physical_care"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  英小文字とアンダースコアのみ。保存後は変更できません。
                </p>
              </>
            ) : (
              <>
                <Input
                  id="code"
                  value={serviceType.code}
                  readOnly
                  className="font-mono bg-muted"
                />
                <input type="hidden" {...register('code')} value={serviceType.code} />
              </>
            )}
            {errors.code && (
              <p className="text-xs text-destructive">{errors.code.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="label">表示名</Label>
            <Input
              id="label"
              {...register('label')}
              placeholder="身体介護"
            />
            {errors.label && (
              <p className="text-xs text-destructive">{errors.label.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="short_label">短縮名</Label>
            <Input
              id="short_label"
              {...register('short_label')}
              placeholder="身体"
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              ガントチャートやバッジで表示される短縮名
            </p>
            {errors.short_label && (
              <p className="text-xs text-destructive">{errors.short_label.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="sort_order">表示順</Label>
            <Input
              id="sort_order"
              type="number"
              min={1}
              {...register('sort_order', { valueAsNumber: true })}
              placeholder="1"
              className="max-w-[120px]"
            />
            {errors.sort_order && (
              <p className="text-xs text-destructive">{errors.sort_order.message}</p>
            )}
          </div>

          <Controller
            name="requires_physical_care_cert"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                身体介護資格（can_physical_care）が必要
              </label>
            )}
          />

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

function getDefaults(serviceType?: ServiceTypeDoc): ServiceTypeFormValues {
  if (!serviceType) {
    return {
      code: '',
      label: '',
      short_label: '',
      requires_physical_care_cert: false,
      sort_order: 1,
    };
  }
  return {
    code: serviceType.code,
    label: serviceType.label,
    short_label: serviceType.short_label,
    requires_physical_care_cert: serviceType.requires_physical_care_cert,
    sort_order: serviceType.sort_order,
  };
}
