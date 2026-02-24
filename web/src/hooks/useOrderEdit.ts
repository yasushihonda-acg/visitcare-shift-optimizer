'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { updateOrderAssignment } from '@/lib/firestore/updateOrder';
import { createStaffChangeCommand } from '@/lib/undo/commands';
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

  return { saving, handleStaffChange };
}
