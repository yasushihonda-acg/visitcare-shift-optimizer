import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

type ServiceTypeInput = {
  code: string;
  label: string;
  short_label: string;
  requires_physical_care_cert: boolean;
  sort_order: number;
};

/**
 * サービス種別を新規作成する。
 * ドキュメントID = code のため setDoc を使用。
 * onSnapshot リスナーが自動でUI反映するため、ローカルstate更新は不要。
 */
export async function createServiceType(data: ServiceTypeInput): Promise<void> {
  await setDoc(doc(getDb(), 'service_types', data.code), {
    ...data,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

/**
 * サービス種別情報を更新する。
 * onSnapshot リスナーが自動でUI反映するため、ローカルstate更新は不要。
 */
export async function updateServiceType(
  code: string,
  data: Partial<Omit<ServiceTypeInput, 'code'>>
): Promise<void> {
  await updateDoc(doc(getDb(), 'service_types', code), {
    ...data,
    updated_at: serverTimestamp(),
  });
}
