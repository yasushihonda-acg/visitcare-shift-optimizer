'use client';

import { useCallback, useState } from 'react';
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { toast } from 'sonner';
import { validateDrop } from '@/lib/dnd/validation';
import { updateOrderAssignment } from '@/lib/firestore/updateOrder';
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
}

export function useDragAndDrop(input: UseDragAndDropInput) {
  const { helperRows, unassignedOrders, helpers, customers, unavailability, day } = input;
  const [dropZoneStatuses, setDropZoneStatuses] = useState<Map<string, DropZoneStatus>>(new Map());
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

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
        return;
      }

      const targetHelperId = event.over.id as string;

      // 未割当セクションへのドロップは常に許可
      if (targetHelperId === 'unassigned-section') {
        setDropZoneStatuses(new Map([['unassigned-section', 'valid']]));
        return;
      }

      // 同じヘルパーへのドロップはスキップ
      if (dragData.sourceHelperId === targetHelperId) {
        setDropZoneStatuses(new Map([[targetHelperId, 'idle']]));
        return;
      }

      const order = findOrder(dragData.orderId);
      if (!order) return;

      const targetRow = helperRows.find((r) => r.helper.id === targetHelperId);
      const result = validateDrop({
        order,
        targetHelperId,
        helpers,
        customers,
        targetHelperOrders: targetRow?.orders ?? [],
        unavailability,
        day,
      });

      const status: DropZoneStatus = !result.allowed
        ? 'invalid'
        : result.warnings.length > 0
          ? 'warning'
          : 'valid';
      setDropZoneStatuses(new Map([[targetHelperId, status]]));
    },
    [findOrder, helperRows, helpers, customers, unavailability, day]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setDropZoneStatuses(new Map());
      setActiveOrder(null);

      const dragData = event.active.data.current as DragData | undefined;
      if (!dragData || !event.over) return;

      const targetId = event.over.id as string;
      const order = findOrder(dragData.orderId);
      if (!order) return;

      // 同じ場所へのドロップはスキップ
      if (dragData.sourceHelperId === targetId) return;
      if (dragData.sourceHelperId === null && targetId === 'unassigned-section') return;

      // 未割当セクションへのドロップ → 割当解除
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

      // ヘルパーへのドロップ → バリデーション + 割当
      const targetRow = helperRows.find((r) => r.helper.id === targetId);
      const result = validateDrop({
        order,
        targetHelperId: targetId,
        helpers,
        customers,
        targetHelperOrders: targetRow?.orders ?? [],
        unavailability,
        day,
      });

      if (!result.allowed) {
        toast.error(result.reason);
        return;
      }

      try {
        await updateOrderAssignment(order.id, [targetId]);
        if (result.warnings.length > 0) {
          toast.warning(result.warnings.join('\n'));
        } else {
          toast.success('割当を変更しました');
        }
      } catch (err) {
        console.error('Failed to update order assignment:', err);
        toast.error('割当変更に失敗しました');
      }
    },
    [findOrder, helperRows, helpers, customers, unavailability, day]
  );

  const handleDragCancel = useCallback(() => {
    setDropZoneStatuses(new Map());
    setActiveOrder(null);
  }, []);

  return {
    dropZoneStatuses,
    activeOrder,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
