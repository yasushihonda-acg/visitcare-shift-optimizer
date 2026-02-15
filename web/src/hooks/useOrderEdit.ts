'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { updateOrderAssignment } from '@/lib/firestore/updateOrder';

export function useOrderEdit() {
  const [saving, setSaving] = useState(false);

  const handleStaffChange = useCallback(
    async (orderId: string, staffIds: string[]) => {
      setSaving(true);
      try {
        await updateOrderAssignment(orderId, staffIds);
        toast.success('割当スタッフを更新しました');
      } catch (e) {
        console.error('Failed to update assignment:', e);
        toast.error('割当スタッフの更新に失敗しました');
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return { saving, handleStaffChange };
}
