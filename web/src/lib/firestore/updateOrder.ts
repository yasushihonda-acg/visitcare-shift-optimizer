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
