'use client';

import { useCallback, useState } from 'react';
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { toast } from 'sonner';
import { validateDrop } from '@/lib/dnd/validation';
import { updateOrderAssignment, updateOrderAssignmentAndTime } from '@/lib/firestore/updateOrder';
import { deltaToTimeShift, computeShiftedTimes } from '@/components/gantt/constants';
import type { DragData, DropZoneStatus } from '@/lib/dnd/types';
import type { Order, Helper, Customer, StaffUnavailability, DayOfWeek } from '@/types';
import type { HelperScheduleRow } from './useScheduleData';

interface UseDragAndDropInput {
  helperRows: HelperScheduleRow[];
  unassignedOrders: Order[];
  helpers: Map<string, Helper>;
  customers: Map<string, Customer>;
  unavailability: StaffUnavailability[];
  day: DayOfWeek;
  slotWidth: number;
}

export function useDragAndDrop(input: UseDragAndDropInput) {
  const { helperRows, unassignedOrders, helpers, customers, unavailability, day, slotWidth } = input;
  const [dropZoneStatuses, setDropZoneStatuses] = useState<Map<string, DropZoneStatus>>(new Map());
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [previewTimes, setPreviewTimes] = useState<{ startTime: string; endTime: string } | null>(null);

  const findOrder = useCallback(
    (orderId: string): Order | undefined => {
      for (const row of helperRows) {
        const found = row.orders.find((o) => o.id === orderId);
        if (found) return found;
      }
      return unassignedOrders.find((o) => o.id === orderId);
    },
    [helperRows, unassignedOrders]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const dragData = event.active.data.current as DragData | undefined;
    if (dragData) {
      const order = findOrder(dragData.orderId);
      setActiveOrder(order ?? null);
    }
  }, [findOrder]);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const dragData = event.active.data.current as DragData | undefined;
      if (!dragData || !event.over) {
        setDropZoneStatuses(new Map());
        setPreviewTimes(null);
        return;
      }

      const order = findOrder(dragData.orderId);
      if (!order) return;

      const targetHelperId = event.over.id as string;

      // delta.x から時間シフトを計算
      const shiftMinutes = deltaToTimeShift(event.delta.x, slotWidth);
      const hasTimeShift = shiftMinutes !== 0;
      const shifted = hasTimeShift
        ? computeShiftedTimes(order.start_time, order.end_time, shiftMinutes)
        : null;

      // プレビュー時刻を更新
      setPreviewTimes(shifted ? { startTime: shifted.newStartTime, endTime: shifted.newEndTime } : null);

      // 未割当セクションへのドロップは常に許可（時間変更なし）
      if (targetHelperId === 'unassigned-section') {
        setDropZoneStatuses(new Map([['unassigned-section', 'valid']]));
        return;
      }

      // 同じヘルパー + 時間変更なし → idle
      if (dragData.sourceHelperId === targetHelperId && !hasTimeShift) {
        setDropZoneStatuses(new Map([[targetHelperId, 'idle']]));
        return;
      }

      const targetRow = helperRows.find((r) => r.helper.id === targetHelperId);
      const result = validateDrop({
        order,
        targetHelperId,
        helpers,
        customers,
        targetHelperOrders: targetRow?.orders ?? [],
        unavailability,
        day,
        newStartTime: shifted?.newStartTime,
        newEndTime: shifted?.newEndTime,
      });

      const status: DropZoneStatus = !result.allowed
        ? 'invalid'
        : result.warnings.length > 0
          ? 'warning'
          : 'valid';
      setDropZoneStatuses(new Map([[targetHelperId, status]]));
    },
    [findOrder, helperRows, helpers, customers, unavailability, day, slotWidth]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setDropZoneStatuses(new Map());
      setActiveOrder(null);
      setPreviewTimes(null);

      const dragData = event.active.data.current as DragData | undefined;
      if (!dragData || !event.over) return;

      const targetId = event.over.id as string;
      const order = findOrder(dragData.orderId);
      if (!order) return;

      // delta.x から時間シフトを計算
      const shiftMinutes = deltaToTimeShift(event.delta.x, slotWidth);
      const hasTimeShift = shiftMinutes !== 0;
      const shifted = hasTimeShift
        ? computeShiftedTimes(order.start_time, order.end_time, shiftMinutes)
        : null;

      const isSameHelper = dragData.sourceHelperId === targetId;

      // 同じ場所 + 時間変更なし → スキップ
      if (isSameHelper && !hasTimeShift) return;
      if (dragData.sourceHelperId === null && targetId === 'unassigned-section') return;

      // 未割当セクションへのドロップ → 割当解除（時間変更なし）
      if (targetId === 'unassigned-section') {
        try {
          await updateOrderAssignment(order.id, []);
          toast.success('割当を解除しました');
        } catch (err) {
          console.error('Failed to unassign order:', err);
          toast.error('割当解除に失敗しました');
        }
        return;
      }

      // ヘルパーへのドロップ → バリデーション + 割当/時間更新
      const targetRow = helperRows.find((r) => r.helper.id === targetId);
      const result = validateDrop({
        order,
        targetHelperId: targetId,
        helpers,
        customers,
        targetHelperOrders: targetRow?.orders ?? [],
        unavailability,
        day,
        newStartTime: shifted?.newStartTime,
        newEndTime: shifted?.newEndTime,
      });

      if (!result.allowed) {
        toast.error(result.reason);
        return;
      }

      try {
        const newStaffIds = isSameHelper
          ? order.assigned_staff_ids
          : [targetId];

        if (shifted) {
          // 時間変更あり
          await updateOrderAssignmentAndTime(
            order.id,
            newStaffIds,
            shifted.newStartTime,
            shifted.newEndTime,
          );
          const timeLabel = `${shifted.newStartTime}-${shifted.newEndTime}`;
          if (isSameHelper) {
            toast.success(`時間を ${timeLabel} に変更しました`);
          } else if (result.warnings.length > 0) {
            toast.warning(result.warnings.join('\n'));
          } else {
            toast.success(`割当を変更し、時間を ${timeLabel} に移動しました`);
          }
        } else {
          // 時間変更なし（ヘルパー変更のみ）
          await updateOrderAssignment(order.id, newStaffIds);
          if (result.warnings.length > 0) {
            toast.warning(result.warnings.join('\n'));
          } else {
            toast.success('割当を変更しました');
          }
        }
      } catch (err) {
        console.error('Failed to update order:', err);
        toast.error('更新に失敗しました');
      }
    },
    [findOrder, helperRows, helpers, customers, unavailability, day, slotWidth]
  );

  const handleDragCancel = useCallback(() => {
    setDropZoneStatuses(new Map());
    setActiveOrder(null);
    setPreviewTimes(null);
  }, []);

  return {
    dropZoneStatuses,
    activeOrder,
    previewTimes,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
