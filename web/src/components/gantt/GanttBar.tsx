'use client';

import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Check, X } from 'lucide-react';
import { timeToColumn, getServiceColor } from './constants';
import { useSlotWidth } from './GanttScaleContext';
import type { Order, Customer } from '@/types';
import type { DragData } from '@/lib/dnd/types';
import { cn } from '@/lib/utils';
import { getAddressGroupColor } from '@/hooks/useAddressGroups';

interface GanttBarProps {
  order: Order;
  customer?: Customer;
  hasViolation?: boolean;
  violationType?: 'error' | 'warning';
  violationMessages?: string[];
  onClick?: (order: Order) => void;
  /** ドラッグ元のヘルパーID（null = 未割当） */
  sourceHelperId: string | null;
  /** 必要スタッフ人数（バッジ表示用） */
  staffCount?: number;
  /** 変更確認済みにするコールバック */
  onConfirmManualEdit?: (orderId: string) => void;
  /** 同一住所グループインデックス（undefined = グループなし） */
  addressGroupIndex?: number;
}

export const GanttBar = memo(function GanttBar({ order, customer, hasViolation, violationType, violationMessages, onClick, sourceHelperId, staffCount, onConfirmManualEdit, addressGroupIndex }: GanttBarProps) {
  const slotWidth = useSlotWidth();
  const startCol = timeToColumn(order.start_time);
  const endCol = timeToColumn(order.end_time);
  const width = (endCol - startCol) * slotWidth;
  const left = (startCol - 1) * slotWidth;

  const isFinalized = order.status === 'completed' || order.status === 'cancelled';
  const isManuallyEdited = !isFinalized && order.manually_edited;

  const dragData: DragData = { orderId: order.id, sourceHelperId };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: dragData,
    disabled: isFinalized,
  });

  const colors = getServiceColor(order.service_type);
  const customerName = customer
    ? (customer.name.short ?? `${customer.name.family}${customer.name.given}`)
    : order.customer_id;

  const addressColor = addressGroupIndex != null ? getAddressGroupColor(addressGroupIndex) : undefined;

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
        !hasViolation && isManuallyEdited && 'ring-2 ring-amber-400 ring-offset-1',
        isDragging && 'opacity-50 z-50 shadow-lg cursor-grabbing scale-105'
      )}
      style={style}
      onClick={() => !isDragging && onClick?.(order)}
      title={[
        `${customerName} ${order.start_time}-${order.end_time}`,
        customer?.address && addressGroupIndex != null ? `📍 ${customer.address}` : '',
        violationMessages && violationMessages.length > 0 ? `---\n${violationMessages.join('\n')}` : '',
      ].filter(Boolean).join('\n')}
      {...attributes}
      {...listeners}
    >
      {/* 同一住所ストライプ — 左端4pxの色付きライン */}
      {addressColor && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg pointer-events-none"
          style={{ background: addressColor }}
          aria-hidden="true"
        />
      )}
      {/* 手動編集パルスドット — 右上に点滅する注意バッジ */}
      {isManuallyEdited && (
        <span
          className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-amber-400 ring-2 ring-white animate-pulse pointer-events-none z-10"
          aria-hidden="true"
        />
      )}
      <span className="flex items-center gap-1">
        {order.status === 'completed' && <Check className="h-3 w-3 shrink-0" />}
        {order.status === 'cancelled' && <X className="h-3 w-3 shrink-0" />}
        {customerName}
        {staffCount != null && staffCount > 1 && (
          <span className="shrink-0 ml-0.5 px-1 py-0.5 rounded text-[10px] font-bold leading-none bg-white/30 text-current">
            {order.assigned_staff_ids.length}/{staffCount}
          </span>
        )}
        {isManuallyEdited && onConfirmManualEdit && (
          <span
            role="button"
            tabIndex={0}
            data-testid={`confirm-edit-${order.id}`}
            className="shrink-0 ml-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-500 hover:bg-green-400 active:bg-green-600 text-white text-[10px] font-bold shadow-sm transition-all duration-150 leading-none cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onConfirmManualEdit(order.id); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onConfirmManualEdit(order.id); } }}
            onPointerDown={(e) => e.stopPropagation()}
            title="変更を確認済みにする"
          >
            <Check className="h-3 w-3 shrink-0" />
            確認
          </span>
        )}
      </span>
    </button>
  );
});
