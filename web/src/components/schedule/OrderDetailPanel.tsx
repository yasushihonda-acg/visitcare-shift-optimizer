'use client';

import { useState } from 'react';
import { Clock, MapPin, User, AlertTriangle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StaffMultiSelect } from '@/components/masters/StaffMultiSelect';
import { AssignmentDiffBadge } from '@/components/schedule/AssignmentDiffBadge';
import { updateOrderStatus, isOrderStatus } from '@/lib/firestore/updateOrder';
import type { Order, Customer, Helper, OrderStatus } from '@/types';
import type { Violation } from '@/lib/constraints/checker';
import type { AssignmentDiff } from '@/hooks/useAssignmentDiff';

interface OrderDetailPanelProps {
  order: Order | null;
  customer?: Customer;
  assignedHelpers: Helper[];
  violations: Violation[];
  open: boolean;
  onClose: () => void;
  helpers?: Map<string, Helper>;
  onStaffChange?: (orderId: string, staffIds: string[]) => void;
  diff?: AssignmentDiff;
  saving?: boolean;
}

const NEXT_STATUSES: Record<OrderStatus, { value: OrderStatus; label: string }[]> = {
  pending: [{ value: 'cancelled', label: 'キャンセル' }],
  assigned: [
    { value: 'completed', label: '完了（実績確認済み）' },
    { value: 'cancelled', label: 'キャンセル' },
  ],
  completed: [],
  cancelled: [],
};

const SERVICE_LABELS: Record<string, string> = {
  physical_care: '身体介護',
  daily_living: '生活援助',
  mixed: '混合（身体+生活）',
  prevention: '介護予防',
  private: '自費サービス',
  disability: '障がい福祉',
  transport_support: '移動支援',
  severe_visiting: '重度訪問介護',
};

const SERVICE_BADGE_STYLES: Record<string, string> = {
  physical_care: 'bg-[oklch(0.55_0.15_225)]/10 text-[oklch(0.45_0.15_225)] border-[oklch(0.55_0.15_225)]/30',
  daily_living: 'bg-[oklch(0.55_0.15_162)]/10 text-[oklch(0.45_0.15_162)] border-[oklch(0.55_0.15_162)]/30',
  mixed: 'bg-[oklch(0.58_0.14_50)]/10 text-[oklch(0.48_0.14_50)] border-[oklch(0.58_0.14_50)]/30',
  prevention: 'bg-[oklch(0.60_0.12_298)]/10 text-[oklch(0.50_0.12_298)] border-[oklch(0.60_0.12_298)]/30',
  private: 'bg-[oklch(0.60_0.12_350)]/10 text-[oklch(0.50_0.12_350)] border-[oklch(0.60_0.12_350)]/30',
  disability: 'bg-[oklch(0.58_0.14_120)]/10 text-[oklch(0.48_0.14_120)] border-[oklch(0.58_0.14_120)]/30',
  transport_support: 'bg-[oklch(0.60_0.12_200)]/10 text-[oklch(0.50_0.12_200)] border-[oklch(0.60_0.12_200)]/30',
  severe_visiting: 'bg-[oklch(0.53_0.18_25)]/10 text-[oklch(0.43_0.18_25)] border-[oklch(0.53_0.18_25)]/30',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '未割当',
  assigned: '割当済',
  completed: '完了',
  cancelled: 'キャンセル',
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  assigned: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function OrderDetailPanel({
  order,
  customer,
  assignedHelpers,
  violations,
  open,
  onClose,
  helpers,
  onStaffChange,
  diff,
  saving,
}: OrderDetailPanelProps) {
  const [statusSaving, setStatusSaving] = useState(false);

  if (!order) return null;

  const customerName = customer
    ? `${customer.name.family} ${customer.name.given}`
    : order.customer_id;

  const nextStatuses = NEXT_STATUSES[order.status] ?? [];
  const isFinalized = order.status === 'completed' || order.status === 'cancelled';

  const handleStatusChange = async (newStatus: string) => {
    if (!isOrderStatus(newStatus)) return;
    setStatusSaving(true);
    try {
      await updateOrderStatus(order.id, order.status, newStatus);
      toast.success(`ステータスを「${STATUS_LABELS[newStatus]}」に変更しました`);
    } catch (e) {
      console.error('ステータス変更エラー:', e);
      toast.error('ステータス変更に失敗しました');
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent data-testid="order-detail-panel">
        <SheetHeader>
          <SheetTitle className="text-lg">{customerName}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-5">
          {/* 基本情報セクション */}
          <div className="space-y-3 rounded-lg border bg-accent/30 p-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">時間</span>
              <span className="ml-auto font-medium">{order.start_time} - {order.end_time}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="h-4 w-4" />
              <span className="text-muted-foreground">サービス種別</span>
              <Badge variant="outline" className={`ml-auto ${SERVICE_BADGE_STYLES[order.service_type] ?? ''}`}>
                {SERVICE_LABELS[order.service_type]}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="h-4 w-4" />
              <span className="text-muted-foreground">ステータス</span>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline" className={STATUS_BADGE_STYLES[order.status] ?? ''}>
                  {STATUS_LABELS[order.status]}
                </Badge>
                {nextStatuses.length > 0 && (
                  <Select
                    onValueChange={handleStatusChange}
                    disabled={statusSaving}
                  >
                    <SelectTrigger
                      className="h-7 w-auto min-w-[100px] text-xs"
                      data-testid="status-change-select"
                    >
                      <SelectValue placeholder="変更..." />
                    </SelectTrigger>
                    <SelectContent>
                      {nextStatuses.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            {order.manually_edited && (
              <div className="flex items-center gap-2 text-sm">
                <Pencil className="h-4 w-4 text-blue-500" />
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                  手動編集済み
                </Badge>
              </div>
            )}
          </div>

          {/* 割当スタッフ */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">割当スタッフ</h4>
              {diff && helpers && <AssignmentDiffBadge diff={diff} helpers={helpers} />}
            </div>
            {onStaffChange && helpers && !isFinalized ? (
              <div className={saving ? 'opacity-50 pointer-events-none' : ''}>
                <StaffMultiSelect
                  label="割当スタッフ"
                  selected={order.assigned_staff_ids}
                  onChange={(ids) => onStaffChange(order.id, ids)}
                  helpers={helpers}
                />
              </div>
            ) : assignedHelpers.length > 0 ? (
              <ul className="space-y-1.5 pl-6">
                {assignedHelpers.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 text-sm">
                    <span>{h.name.family} {h.name.given}</span>
                    {h.can_physical_care && (
                      <Badge variant="secondary" className="text-[10px] bg-[oklch(0.55_0.15_225)]/10 text-[oklch(0.45_0.15_225)]">身体可</Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground pl-6">未割当</p>
            )}
          </div>

          {/* 制約違反 */}
          {violations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h4 className="text-sm font-semibold text-destructive">制約違反</h4>
              </div>
              <ul className="space-y-1.5 pl-6">
                {violations.map((v, i) => (
                  <li
                    key={i}
                    className={`text-sm ${v.severity === 'error' ? 'text-destructive' : 'text-amber-600'}`}
                  >
                    {v.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 住所 */}
          {customer?.address && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">住所</h4>
              </div>
              <p className="text-sm text-muted-foreground pl-6">{customer.address}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
