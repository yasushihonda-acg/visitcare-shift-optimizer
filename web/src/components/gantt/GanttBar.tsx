'use client';

import { timeToColumn, SLOT_WIDTH_PX } from './constants';
import type { Order, Customer } from '@/types';
import { cn } from '@/lib/utils';

interface GanttBarProps {
  order: Order;
  customer?: Customer;
  hasViolation?: boolean;
  violationType?: 'error' | 'warning';
  onClick?: (order: Order) => void;
}

const SERVICE_COLORS: Record<string, { bg: string; text: string }> = {
  physical_care: { bg: 'bg-blue-500', text: 'text-white' },
  daily_living: { bg: 'bg-green-500', text: 'text-white' },
};

export function GanttBar({ order, customer, hasViolation, violationType, onClick }: GanttBarProps) {
  const startCol = timeToColumn(order.start_time);
  const endCol = timeToColumn(order.end_time);
  const width = (endCol - startCol) * SLOT_WIDTH_PX;
  const left = (startCol - 1) * SLOT_WIDTH_PX;

  const colors = SERVICE_COLORS[order.service_type] ?? SERVICE_COLORS.physical_care;
  const customerName = customer
    ? (customer.name.short ?? `${customer.name.family}${customer.name.given}`)
    : order.customer_id;

  return (
    <button
      className={cn(
        'absolute top-0.5 h-6 rounded text-[10px] leading-6 px-1 truncate cursor-pointer transition-opacity hover:opacity-80',
        colors.bg,
        colors.text,
        hasViolation && violationType === 'error' && 'ring-2 ring-red-500',
        hasViolation && violationType === 'warning' && 'ring-2 ring-yellow-500'
      )}
      style={{ left, width: Math.max(width, SLOT_WIDTH_PX * 2) }}
      onClick={() => onClick?.(order)}
      title={`${customerName} ${order.start_time}-${order.end_time}`}
    >
      {width > 40 ? customerName : ''}
    </button>
  );
}
