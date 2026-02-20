'use client';

import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Check, X } from 'lucide-react';
import { timeToColumn, SERVICE_COLORS } from './constants';
import { useSlotWidth } from './GanttScaleContext';
import type { Order, Customer } from '@/types';
import type { DragData } from '@/lib/dnd/types';
import { cn } from '@/lib/utils';

interface GanttBarProps {
  order: Order;
  customer?: Customer;
  hasViolation?: boolean;
  violationType?: 'error' | 'warning';
  violationMessages?: string[];
  onClick?: (order: Order) => void;
  /** ドラッグ元のヘルパーID（null = 未割当） */
  sourceHelperId: string | null;
}

export const GanttBar = memo(function GanttBar({ order, customer, hasViolation, violationType, violationMessages, onClick, sourceHelperId }: GanttBarProps) {
  const slotWidth = useSlotWidth();
  const startCol = timeToColumn(order.start_time);
  const endCol = timeToColumn(order.end_time);
  const width = (endCol - startCol) * slotWidth;
  const left = (startCol - 1) * slotWidth;

  const isFinalized = order.status === 'completed' || order.status === 'cancelled';

  const dragData: DragData = { orderId: order.id, sourceHelperId };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: dragData,
    disabled: isFinalized,
  });

  const colors = SERVICE_COLORS[order.service_type] ?? SERVICE_COLORS.physical_care;
  const customerName = customer
    ? (customer.name.short ?? `${customer.name.family}${customer.name.given}`)
    : order.customer_id;

  const style = {
    left,
    width: Math.max(width, slotWidth * 2),
    transform: CSS.Translate.toString(transform),
  };

  return (
    <button
      ref={setNodeRef}
      data-testid={`gantt-bar-${order.id}`}
      className={cn(
        'absolute top-1 h-8 rounded-lg text-xs font-medium leading-8 px-2 shadow-brand-sm',
        'overflow-visible whitespace-nowrap text-shadow-bar',
        isDragging ? 'transition-none' : 'transition-all duration-150',
        isFinalized
          ? 'opacity-50 cursor-default grayscale-[30%]'
          : 'cursor-grab',
        colors.bar,
        !isFinalized && colors.hover,
        !isFinalized && 'hover:shadow-brand hover:brightness-105 hover:-translate-y-px hover:z-20',
        hasViolation && violationType === 'error' && 'ring-2 ring-red-500 ring-offset-1',
        hasViolation && violationType === 'warning' && 'ring-2 ring-yellow-500 ring-offset-1',
        !hasViolation && !isFinalized && order.manually_edited && 'ring-2 ring-blue-500 ring-offset-1',
        isDragging && 'opacity-50 z-50 shadow-lg cursor-grabbing scale-105'
      )}
      style={style}
      onClick={() => !isDragging && onClick?.(order)}
      title={
        violationMessages && violationMessages.length > 0
          ? `${customerName} ${order.start_time}-${order.end_time}\n---\n${violationMessages.join('\n')}`
          : `${customerName} ${order.start_time}-${order.end_time}`
      }
      {...attributes}
      {...listeners}
    >
      <span className="flex items-center gap-1">
        {order.status === 'completed' && <Check className="h-3 w-3 shrink-0" />}
        {order.status === 'cancelled' && <X className="h-3 w-3 shrink-0" />}
        {customerName}
      </span>
    </button>
  );
});
