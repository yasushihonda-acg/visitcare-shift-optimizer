'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { updateOrderAssignment, updateCompanion } from '@/lib/firestore/updateOrder';
import { createStaffChangeCommand, createCompanionChangeCommand } from '@/lib/undo/commands';
import type { UndoCommand } from '@/lib/undo/types';

interface UseOrderEditInput {
  onCommand?: (cmd: UndoCommand) => void;
}

export function useOrderEdit({ onCommand }: UseOrderEditInput = {}) {
  const [saving, setSaving] = useState(false);

  const handleStaffChange = useCallback(
    async (
      orderId: string,
      staffIds: string[],
      beforeState?: { assigned_staff_ids: string[]; manually_edited: boolean }
    ) => {
      setSaving(true);
      try {
        await updateOrderAssignment(orderId, staffIds);
        toast.success('割当スタッフを更新しました');
        if (onCommand && beforeState) {
          onCommand(createStaffChangeCommand({
            orderId,
            label: 'スタッフ割当変更',
            before: beforeState,
            after: { assigned_staff_ids: staffIds, manually_edited: true },
          }));
        }
      } catch (e) {
        console.error('Failed to update assignment:', e);
        toast.error('割当スタッフの更新に失敗しました');
      } finally {
        setSaving(false);
      }
    },
    [onCommand]
  );

  const handleCompanionChange = useCallback(
    async (
      orderId: string,
      companionStaffId: string | null,
      beforeState: {
        companion_staff_id?: string | null;
        assigned_staff_ids: string[];
        staff_count?: number;
        manually_edited: boolean;
      },
      /** 同行設定時の新しいassigned_staff_ids */
      newAssignedStaffIds: string[],
      newStaffCount: number,
    ) => {
      setSaving(true);
      try {
        await updateCompanion(orderId, companionStaffId, newAssignedStaffIds, newStaffCount);
        toast.success(companionStaffId ? '同行スタッフを設定しました' : '同行スタッフを解除しました');
        if (onCommand) {
          onCommand(createCompanionChangeCommand({
            orderId,
            label: companionStaffId ? '同行設定' : '同行解除',
            before: {
              companion_staff_id: beforeState.companion_staff_id,
              assigned_staff_ids: beforeState.assigned_staff_ids,
              staff_count: beforeState.staff_count,
              manually_edited: beforeState.manually_edited,
            },
            after: {
              companion_staff_id: companionStaffId,
              assigned_staff_ids: newAssignedStaffIds,
              staff_count: newStaffCount,
              manually_edited: true,
            },
          }));
        }
      } catch (e) {
        console.error('Failed to update companion:', e);
        toast.error('同行スタッフの更新に失敗しました');
      } finally {
        setSaving(false);
      }
    },
    [onCommand]
  );

  return { saving, handleStaffChange, handleCompanionChange };
}
