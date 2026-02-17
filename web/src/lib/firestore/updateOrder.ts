import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

/**
 * オーダーの割当スタッフを更新する。
 * onSnapshot リスナーが自動でUI反映するため、ローカルstate更新は不要。
 */
export async function updateOrderAssignment(
  orderId: string,
  newStaffIds: string[]
): Promise<void> {
  const orderRef = doc(getDb(), 'orders', orderId);
  await updateDoc(orderRef, {
    assigned_staff_ids: newStaffIds,
    manually_edited: true,
    updated_at: serverTimestamp(),
  });
}

/**
 * オーダーの割当スタッフと時刻を同時に更新する。
 * D&D 時間軸移動時に使用。
 */
export async function updateOrderAssignmentAndTime(
  orderId: string,
  newStaffIds: string[],
  newStartTime: string,
  newEndTime: string,
): Promise<void> {
  const orderRef = doc(getDb(), 'orders', orderId);
  await updateDoc(orderRef, {
    assigned_staff_ids: newStaffIds,
    start_time: newStartTime,
    end_time: newEndTime,
    manually_edited: true,
    updated_at: serverTimestamp(),
  });
}
