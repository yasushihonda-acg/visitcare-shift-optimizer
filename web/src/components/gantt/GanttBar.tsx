'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { timeToColumn, SLOT_WIDTH_PX } from './constants';
import type { Order, Customer } from '@/types';
import type { DragData } from '@/lib/dnd/types';
import { cn } from '@/lib/utils';

interface GanttBarProps {
  order: Order;
  customer?: Customer;
  hasViolation?: boolean;
  violationType?: 'error' | 'warning';
  onClick?: (order: Order) => void;
  /** ドラッグ元のヘルパーID（null = 未割当） */
  sourceHelperId: string | null;
}

const SERVICE_COLORS: Record<string, { bg: string; text: string }> = {
  physical_care: { bg: 'bg-blue-500', text: 'text-white' },
  daily_living: { bg: 'bg-green-500', text: 'text-white' },
};

export function GanttBar({ order, customer, hasViolation, violationType, onClick, sourceHelperId }: GanttBarProps) {
  const startCol = timeToColumn(order.start_time);
  const endCol = timeToColumn(order.end_time);
  const width = (endCol - startCol) * SLOT_WIDTH_PX;
  const left = (startCol - 1) * SLOT_WIDTH_PX;

  const dragData: DragData = { orderId: order.id, sourceHelperId };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: dragData,
  });

  const colors = SERVICE_COLORS[order.service_type] ?? SERVICE_COLORS.physical_care;
  const customerName = customer
    ? (customer.name.short ?? `${customer.name.family}${customer.name.given}`)
    : order.customer_id;

  const style = {
    left,
    width: Math.max(width, SLOT_WIDTH_PX * 2),
    transform: CSS.Translate.toString(transform),
  };

  return (
    <button
      ref={setNodeRef}
      className={cn(
        'absolute top-0.5 h-6 rounded text-[10px] leading-6 px-1 truncate cursor-grab transition-opacity hover:opacity-80',
        colors.bg,
        colors.text,
        hasViolation && violationType === 'error' && 'ring-2 ring-red-500',
        hasViolation && violationType === 'warning' && 'ring-2 ring-yellow-500',
        isDragging && 'opacity-50 z-50 shadow-lg cursor-grabbing'
      )}
      style={style}
      onClick={() => !isDragging && onClick?.(order)}
      title={`${customerName} ${order.start_time}-${order.end_time}`}
      {...attributes}
      {...listeners}
    >
      {width > 40 ? customerName : ''}
    </button>
  );
}
