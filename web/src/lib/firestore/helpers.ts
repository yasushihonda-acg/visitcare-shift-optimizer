import { collection, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { Helper } from '@/types';

type HelperInput = Omit<Helper, 'id' | 'created_at' | 'updated_at' | 'customer_training_status'>;

/**
 * ヘルパーを新規作成する。
 * onSnapshot リスナーが自動でUI反映するため、ローカルstate更新は不要。
 */
export async function createHelper(data: HelperInput): Promise<string> {
  const docRef = await addDoc(collection(getDb(), 'helpers'), {
    ...data,
    customer_training_status: {},
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * ヘルパー情報を更新する。
 * onSnapshot リスナーが自動でUI反映するため、ローカルstate更新は不要。
 */
export async function updateHelper(
  id: string,
  data: Partial<HelperInput>
): Promise<void> {
  const helperRef = doc(getDb(), 'helpers', id);
  await updateDoc(helperRef, {
    ...data,
    updated_at: serverTimestamp(),
  });
}
