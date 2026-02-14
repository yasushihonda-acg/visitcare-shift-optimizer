import { collection, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { Customer } from '@/types';

type CustomerInput = Omit<Customer, 'id' | 'created_at' | 'updated_at'>;

/**
 * 利用者を新規作成する。
 * onSnapshot リスナーが自動でUI反映するため、ローカルstate更新は不要。
 */
export async function createCustomer(data: CustomerInput): Promise<string> {
  const docRef = await addDoc(collection(getDb(), 'customers'), {
    ...data,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * 利用者情報を更新する。
 * onSnapshot リスナーが自動でUI反映するため、ローカルstate更新は不要。
 */
export async function updateCustomer(
  id: string,
  data: Partial<CustomerInput>
): Promise<void> {
  const customerRef = doc(getDb(), 'customers', id);
  await updateDoc(customerRef, {
    ...data,
    updated_at: serverTimestamp(),
  });
}
