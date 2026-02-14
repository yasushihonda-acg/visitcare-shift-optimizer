'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { PackageOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Order, Customer } from '@/types';
import type { DragData, DropZoneStatus } from '@/lib/dnd/types';
import { cn } from '@/lib/utils';

const DROP_ZONE_STYLES: Record<DropZoneStatus, string> = {
  idle: '',
  valid: 'bg-green-50 ring-2 ring-inset ring-green-400',
  warning: 'bg-yellow-50 ring-2 ring-inset ring-yellow-400',
  invalid: 'bg-red-50 ring-2 ring-inset ring-red-400 cursor-not-allowed',
};

interface UnassignedSectionProps {
  orders: Order[];
  customers: Map<string, Customer>;
  onOrderClick?: (order: Order) => void;
  dropZoneStatus?: DropZoneStatus;
}

const SERVICE_LABELS: Record<string, string> = {
  physical_care: '身体',
  daily_living: '生活',
  prevention: '予防',
};

const SERVICE_BADGE_COLORS: Record<string, string> = {
  physical_care: 'bg-[oklch(0.55_0.15_230)]/10 text-[oklch(0.45_0.15_230)] border-[oklch(0.55_0.15_230)]/30',
  daily_living: 'bg-[oklch(0.55_0.15_160)]/10 text-[oklch(0.45_0.15_160)] border-[oklch(0.55_0.15_160)]/30',
  prevention: 'bg-[oklch(0.60_0.12_300)]/10 text-[oklch(0.50_0.12_300)] border-[oklch(0.60_0.12_300)]/30',
};

function UnassignedOrderItem({
  order,
  customers,
  onOrderClick,
}: {
  order: Order;
  customers: Map<string, Customer>;
  onOrderClick?: (order: Order) => void;
}) {
  const customer = customers.get(order.customer_id);
  const name = customer
    ? (customer.name.short ?? `${customer.name.family}${customer.name.given}`)
    : order.customer_id;

  const dragData: DragData = { orderId: order.id, sourceHelperId: null };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: dragData,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const badgeColor = SERVICE_BADGE_COLORS[order.service_type] ?? '';

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={() => !isDragging && onOrderClick?.(order)}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border border-dashed border-border/60 bg-card px-2.5 py-1.5 text-xs hover:bg-muted/50 hover:border-primary/30 transition-all duration-150 cursor-grab shadow-sm',
        isDragging && 'opacity-50 shadow-lg cursor-grabbing'
      )}
      {...attributes}
      {...listeners}
    >
      <Badge variant="outline" className={cn('text-[10px] border', badgeColor)}>
        {SERVICE_LABELS[order.service_type] ?? order.service_type}
      </Badge>
      <span className="font-medium">{name}</span>
      <span className="text-muted-foreground">
        {order.start_time}-{order.end_time}
      </span>
    </button>
  );
}

export function UnassignedSection({ orders, customers, onOrderClick, dropZoneStatus = 'idle' }: UnassignedSectionProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned-section',
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mt-4 rounded-xl border bg-card p-4 shadow-sm transition-colors duration-150',
        isOver && DROP_ZONE_STYLES[dropZoneStatus]
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <PackageOpen className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          未割当
        </h3>
        <Badge variant="secondary" className="text-xs">
          {orders.length}件
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {orders.map((order) => (
          <UnassignedOrderItem
            key={order.id}
            order={order}
            customers={customers}
            onOrderClick={onOrderClick}
          />
        ))}
        {orders.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            オーダーをここにドロップして割当を解除
          </p>
        )}
      </div>
    </div>
  );
}
