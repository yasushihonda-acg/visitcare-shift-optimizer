'use client';

import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Order, Customer, Helper } from '@/types';
import type { Violation } from '@/lib/constraints/checker';

interface OrderDetailPanelProps {
  order: Order | null;
  customer?: Customer;
  assignedHelpers: Helper[];
  violations: Violation[];
  open: boolean;
  onClose: () => void;
}

const SERVICE_LABELS: Record<string, string> = {
  physical_care: '身体介護',
  daily_living: '生活援助',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '未割当',
  assigned: '割当済',
  completed: '完了',
  cancelled: 'キャンセル',
};

export function OrderDetailPanel({
  order,
  customer,
  assignedHelpers,
  violations,
  open,
  onClose,
}: OrderDetailPanelProps) {
  if (!order) return null;

  const customerName = customer
    ? `${customer.name.family} ${customer.name.given}`
    : order.customer_id;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{customerName}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">時間</div>
            <div>{order.start_time} - {order.end_time}</div>
            <div className="text-muted-foreground">サービス種別</div>
            <div>{SERVICE_LABELS[order.service_type]}</div>
            <div className="text-muted-foreground">ステータス</div>
            <div>
              <Badge variant={order.status === 'assigned' ? 'default' : 'outline'}>
                {STATUS_LABELS[order.status]}
              </Badge>
            </div>
          </div>

          {assignedHelpers.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">割当スタッフ</h4>
              <ul className="text-sm space-y-1">
                {assignedHelpers.map((h) => (
                  <li key={h.id} className="flex items-center gap-2">
                    <span>{h.name.family} {h.name.given}</span>
                    {h.can_physical_care && (
                      <Badge variant="secondary" className="text-[10px]">身体可</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {violations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1 text-destructive">制約違反</h4>
              <ul className="text-sm space-y-1">
                {violations.map((v, i) => (
                  <li key={i} className={v.severity === 'error' ? 'text-destructive' : 'text-yellow-600'}>
                    {v.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {customer?.address && (
            <div>
              <h4 className="text-sm font-medium mb-1">住所</h4>
              <p className="text-sm text-muted-foreground">{customer.address}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
