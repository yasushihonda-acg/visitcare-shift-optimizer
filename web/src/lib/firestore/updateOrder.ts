import { doc, updateDoc, serverTimestamp, writeBatch, deleteField } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { Order, OrderStatus } from '@/types';

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

/** 有効な状態遷移マップ */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['cancelled'],
  assigned: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['pending'],
};

const ORDER_STATUSES: readonly string[] = ['pending', 'assigned', 'completed', 'cancelled'];

/** OrderStatus 型ガード */
export function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.includes(value);
}

/** 状態遷移が有効か判定する純粋関数 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * オーダーのステータスを更新する。
 * 状態遷移バリデーションを実施し、不正な遷移はエラーにする。
 */
export async function updateOrderStatus(
  orderId: string,
  currentStatus: OrderStatus,
  newStatus: OrderStatus,
): Promise<void> {
  if (!isValidTransition(currentStatus, newStatus)) {
    throw new Error(`Invalid status transition: ${currentStatus} → ${newStatus}`);
  }
  const orderRef = doc(getDb(), 'orders', orderId);
  await updateDoc(orderRef, {
    status: newStatus,
    updated_at: serverTimestamp(),
  });
}

/**
 * 複数オーダーのステータスを一括更新する。
 * Firestore batch write（最大500件）を使用。
 */
export async function bulkUpdateOrderStatus(
  orders: { id: string; currentStatus: OrderStatus }[],
  newStatus: OrderStatus,
): Promise<number> {
  const db = getDb();
  const batch = writeBatch(db);
  let count = 0;

  for (const { id, currentStatus } of orders) {
    if (isValidTransition(currentStatus, newStatus)) {
      const orderRef = doc(db, 'orders', id);
      batch.update(orderRef, {
        status: newStatus,
        updated_at: serverTimestamp(),
      });
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
  return count;
}

/**
 * 手動編集フラグをリセットして変更確認済みにする。
 * 青リング（manually_edited: true）を消す際に使用。
 */
export async function confirmManualEdit(orderId: string): Promise<void> {
  const orderRef = doc(getDb(), 'orders', orderId);
  await updateDoc(orderRef, {
    manually_edited: false,
    updated_at: serverTimestamp(),
  });
}

/**
 * 任意フィールドを書き込む汎用更新関数。
 * undo/redo コマンドが before/after の値を復元する際に使用。
 */
export async function patchOrder(
  orderId: string,
  fields: Partial<Pick<Order, 'assigned_staff_ids' | 'companion_staff_id' | 'staff_count' | 'start_time' | 'end_time' | 'manually_edited'>>
): Promise<void> {
  const ref = doc(getDb(), 'orders', orderId);
  await updateDoc(ref, { ...fields, updated_at: serverTimestamp() });
}

/**
 * 同行（OJT）スタッフを設定/解除する。
 * companion_staff_id + assigned_staff_ids + staff_count を原子的に更新。
 */
export async function updateCompanion(
  orderId: string,
  companionStaffId: string | null,
  newAssignedStaffIds: string[],
  staffCount: number,
): Promise<void> {
  const orderRef = doc(getDb(), 'orders', orderId);
  await updateDoc(orderRef, {
    companion_staff_id: companionStaffId ?? deleteField(),
    assigned_staff_ids: newAssignedStaffIds,
    staff_count: staffCount,
    manually_edited: true,
    updated_at: serverTimestamp(),
  });
}

/**
 * 同行設定を一括クリアする（最適化後のクリーンアップ用）。
 * フィールドをFirestoreから完全に削除する。
 */
export async function clearCompanionField(orderId: string): Promise<void> {
  const ref = doc(getDb(), 'orders', orderId);
  await updateDoc(ref, {
    companion_staff_id: deleteField(),
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
