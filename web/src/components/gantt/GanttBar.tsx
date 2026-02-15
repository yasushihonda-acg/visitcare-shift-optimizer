'use client';

import { memo } from 'react';
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

const SERVICE_COLORS: Record<string, { bar: string; hover: string }> = {
  physical_care: {
    bar: 'bg-gradient-to-r from-[oklch(0.55_0.15_230)] to-[oklch(0.60_0.12_210)] text-white',
    hover: 'hover:from-[oklch(0.50_0.16_230)] hover:to-[oklch(0.55_0.13_210)]',
  },
  daily_living: {
    bar: 'bg-gradient-to-r from-[oklch(0.55_0.15_160)] to-[oklch(0.60_0.12_145)] text-white',
    hover: 'hover:from-[oklch(0.50_0.16_160)] hover:to-[oklch(0.55_0.13_145)]',
  },
  prevention: {
    bar: 'bg-gradient-to-r from-[oklch(0.60_0.12_300)] to-[oklch(0.65_0.10_280)] text-white',
    hover: 'hover:from-[oklch(0.55_0.13_300)] hover:to-[oklch(0.60_0.11_280)]',
  },
};

export const GanttBar = memo(function GanttBar({ order, customer, hasViolation, violationType, onClick, sourceHelperId }: GanttBarProps) {
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
        'absolute top-1 h-8 rounded-md text-[11px] leading-8 px-1.5 truncate cursor-grab shadow-sm transition-all duration-150',
        colors.bar,
        colors.hover,
        'hover:shadow-md hover:scale-y-105',
        hasViolation && violationType === 'error' && 'ring-2 ring-red-500 ring-offset-1',
        hasViolation && violationType === 'warning' && 'ring-2 ring-yellow-500 ring-offset-1',
        isDragging && 'opacity-50 z-50 shadow-lg cursor-grabbing scale-105'
      )}
      style={style}
      onClick={() => !isDragging && onClick?.(order)}
      title={`${customerName} ${order.start_time}-${order.end_time}`}
      {...attributes}
      {...listeners}
    >
      {width > 20 ? customerName : ''}
    </button>
  );
});
