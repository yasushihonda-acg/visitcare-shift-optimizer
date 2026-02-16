'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { APIProvider } from '@vis.gl/react-google-maps';
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
import { WeeklyServicesEditor } from './WeeklyServicesEditor';
import { StaffMultiSelect } from './StaffMultiSelect';
import { CustomerLocationPicker } from './CustomerLocationPicker';
import { customerSchema, type CustomerFormValues } from '@/lib/validation/schemas';
import { createCustomer, updateCustomer } from '@/lib/firestore/customers';
import { geocodeAddress } from '@/lib/geocoding';
import { useHelpers } from '@/hooks/useHelpers';
import type { Customer } from '@/types';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

interface CustomerEditDialogProps {
  open: boolean;
  onClose: () => void;
  customer?: Customer;
}

export function CustomerEditDialog({
  open,
  onClose,
  customer,
}: CustomerEditDialogProps) {
  const isNew = !customer;
  const { helpers } = useHelpers();
  const [isGeocoding, setIsGeocoding] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: getDefaults(customer),
  });

  useEffect(() => {
    if (open) {
      reset(getDefaults(customer));
    }
  }, [open, customer, reset]);

  const watchLat = watch('location.lat');
  const watchLng = watch('location.lng');

  const handleGeocodeAddress = useCallback(async () => {
    const address = watch('address');
    if (!address?.trim()) {
      toast.error('住所を入力してください');
      return;
    }

    setIsGeocoding(true);
    try {
      const result = await geocodeAddress(address);
      if (result) {
        setValue('location.lat', result.lat, { shouldDirty: true });
        setValue('location.lng', result.lng, { shouldDirty: true });
        toast.success('住所から座標を取得しました');
      } else {
        toast.error('住所が見つかりません');
      }
    } finally {
      setIsGeocoding(false);
    }
  }, [watch, setValue]);

  const handleLocationChange = useCallback(
    (lat: number, lng: number) => {
      setValue('location.lat', lat, { shouldDirty: true });
      setValue('location.lng', lng, { shouldDirty: true });
    },
    [setValue]
  );

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      if (isNew) {
        await createCustomer(data);
        toast.success('利用者を追加しました');
      } else {
        await updateCustomer(customer.id, data);
        toast.success('利用者情報を更新しました');
      }
      onClose();
    } catch (err) {
      console.error('Failed to save customer:', err);
      toast.error('保存に失敗しました');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? '利用者を追加' : '利用者を編集'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 氏名 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name.family">姓</Label>
              <Input
                id="name.family"
                {...register('name.family')}
                placeholder="田中"
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
                placeholder="太郎"
              />
              {errors.name?.given && (
                <p className="text-xs text-destructive">
                  {errors.name.given.message}
                </p>
              )}
            </div>
          </div>

          {/* 住所 + ジオコーディング */}
          <div className="space-y-1">
            <Label htmlFor="address">住所</Label>
            <div className="flex gap-2">
              <Input
                id="address"
                {...register('address')}
                placeholder="鹿児島市..."
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGeocodeAddress}
                disabled={isGeocoding}
                className="shrink-0"
              >
                {isGeocoding ? '検索中...' : '住所から検索'}
              </Button>
            </div>
            {errors.address && (
              <p className="text-xs text-destructive">
                {errors.address.message}
              </p>
            )}
          </div>

          {/* 座標 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="location.lat">緯度</Label>
              <Input
                id="location.lat"
                type="number"
                step="any"
                {...register('location.lat', { valueAsNumber: true })}
                placeholder="31.5916"
              />
              {errors.location?.lat && (
                <p className="text-xs text-destructive">
                  {errors.location.lat.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="location.lng">経度</Label>
              <Input
                id="location.lng"
                type="number"
                step="any"
                {...register('location.lng', { valueAsNumber: true })}
                placeholder="130.5571"
              />
              {errors.location?.lng && (
                <p className="text-xs text-destructive">
                  {errors.location.lng.message}
                </p>
              )}
            </div>
          </div>

          {/* ミニマップ */}
          {GOOGLE_MAPS_API_KEY && (
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
              <CustomerLocationPicker
                lat={watchLat}
                lng={watchLng}
                onLocationChange={handleLocationChange}
              />
            </APIProvider>
          )}

          {/* サービス提供責任者 */}
          <div className="space-y-1">
            <Label htmlFor="service_manager">サービス提供責任者</Label>
            <Input
              id="service_manager"
              {...register('service_manager')}
              placeholder="サ責名"
            />
            {errors.service_manager && (
              <p className="text-xs text-destructive">
                {errors.service_manager.message}
              </p>
            )}
          </div>

          {/* 世帯ID */}
          <div className="space-y-1">
            <Label htmlFor="household_id">世帯ID（任意）</Label>
            <Input
              id="household_id"
              {...register('household_id')}
              placeholder="同一世帯がある場合"
            />
          </div>

          {/* 備考 */}
          <div className="space-y-1">
            <Label htmlFor="notes">備考（任意）</Label>
            <Input id="notes" {...register('notes')} placeholder="特記事項" />
          </div>

          {/* NGスタッフ */}
          <Controller
            name="ng_staff_ids"
            control={control}
            render={({ field }) => (
              <StaffMultiSelect
                label="NGスタッフ"
                selected={field.value ?? []}
                onChange={field.onChange}
                helpers={helpers}
                excludeIds={watch('preferred_staff_ids') ?? []}
              />
            )}
          />

          {/* 推奨スタッフ */}
          <Controller
            name="preferred_staff_ids"
            control={control}
            render={({ field }) => (
              <StaffMultiSelect
                label="推奨スタッフ"
                selected={field.value ?? []}
                onChange={field.onChange}
                helpers={helpers}
                excludeIds={watch('ng_staff_ids') ?? []}
              />
            )}
          />

          {/* 週間サービス */}
          <Controller
            name="weekly_services"
            control={control}
            render={({ field }) => (
              <WeeklyServicesEditor
                value={field.value ?? {}}
                onChange={field.onChange}
              />
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

function getDefaults(customer?: Customer): CustomerFormValues {
  if (!customer) {
    return {
      name: { family: '', given: '' },
      address: '',
      location: { lat: 0, lng: 0 },
      ng_staff_ids: [],
      preferred_staff_ids: [],
      weekly_services: {},
      service_manager: '',
      household_id: '',
      notes: '',
    };
  }
  return {
    name: customer.name,
    address: customer.address,
    location: customer.location,
    ng_staff_ids: customer.ng_staff_ids,
    preferred_staff_ids: customer.preferred_staff_ids,
    weekly_services: customer.weekly_services,
    service_manager: customer.service_manager,
    household_id: customer.household_id ?? '',
    notes: customer.notes ?? '',
  };
}
