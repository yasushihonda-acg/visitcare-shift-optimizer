'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
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

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={() => !isDragging && onOrderClick?.(order)}
      className={cn(
        'flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-xs hover:bg-muted transition-colors cursor-grab',
        isDragging && 'opacity-50 shadow-lg cursor-grabbing'
      )}
      {...attributes}
      {...listeners}
    >
      <Badge variant="outline" className="text-[10px]">
        {SERVICE_LABELS[order.service_type] ?? order.service_type}
      </Badge>
      <span>{name}</span>
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
        'mt-4 border rounded-lg p-3 transition-colors duration-150',
        isOver && DROP_ZONE_STYLES[dropZoneStatus]
      )}
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-2">
        未割当 ({orders.length}件)
      </h3>
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
          <p className="text-xs text-muted-foreground">
            オーダーをここにドロップして割当を解除
          </p>
        )}
      </div>
    </div>
  );
}
