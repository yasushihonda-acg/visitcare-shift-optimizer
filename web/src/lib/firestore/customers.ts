import { collection, doc, addDoc, updateDoc, getDoc, serverTimestamp, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { Customer } from '@/types';

type CustomerInput = Omit<Customer, 'id' | 'created_at' | 'updated_at'>;

/**
 * 利用者を新規作成する。
 * 同一世帯・同一施設の双方向同期も行う。
 */
export async function createCustomer(data: CustomerInput): Promise<string> {
  const docRef = await addDoc(collection(getDb(), 'customers'), {
    ...data,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  // 双方向同期: 新規作成した利用者を相手側のリストにも追加
  await syncBidirectionalAdd(
    docRef.id,
    data.same_household_customer_ids ?? [],
    data.same_facility_customer_ids ?? [],
  );

  return docRef.id;
}

/**
 * 利用者情報を更新する。
 * 同一世帯・同一施設の変更がある場合、双方向同期を行う。
 */
export async function updateCustomer(
  id: string,
  data: Partial<CustomerInput>
): Promise<void> {
  // 変更前のデータを取得（双方向同期のdiff用）
  const prevDoc = await getDoc(doc(getDb(), 'customers', id));
  const prevData = prevDoc.exists() ? prevDoc.data() : {};
  const prevHousehold: string[] = prevData?.same_household_customer_ids ?? [];
  const prevFacility: string[] = prevData?.same_facility_customer_ids ?? [];

  const customerRef = doc(getDb(), 'customers', id);
  await updateDoc(customerRef, {
    ...data,
    updated_at: serverTimestamp(),
  });

  // 双方向同期
  const newHousehold = data.same_household_customer_ids;
  const newFacility = data.same_facility_customer_ids;

  if (newHousehold !== undefined) {
    await syncBidirectionalDiff(id, 'same_household_customer_ids', prevHousehold, newHousehold);
  }
  if (newFacility !== undefined) {
    await syncBidirectionalDiff(id, 'same_facility_customer_ids', prevFacility, newFacility);
  }
}

/**
 * 新規作成時の双方向同期: 自分を相手のリストに追加
 */
async function syncBidirectionalAdd(
  myId: string,
  householdMembers: string[],
  facilityMembers: string[],
): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);

  for (const memberId of householdMembers) {
    batch.update(doc(db, 'customers', memberId), {
      same_household_customer_ids: arrayUnion(myId),
      updated_at: serverTimestamp(),
    });
  }
  for (const memberId of facilityMembers) {
    batch.update(doc(db, 'customers', memberId), {
      same_facility_customer_ids: arrayUnion(myId),
      updated_at: serverTimestamp(),
    });
  }

  if (householdMembers.length > 0 || facilityMembers.length > 0) {
    await batch.commit();
  }
}

/**
 * 更新時の双方向同期: 追加されたメンバーには自分を追加、削除されたメンバーからは自分を削除
 */
async function syncBidirectionalDiff(
  myId: string,
  field: 'same_household_customer_ids' | 'same_facility_customer_ids',
  prev: string[],
  next: string[],
): Promise<void> {
  const added = next.filter((id) => !prev.includes(id));
  const removed = prev.filter((id) => !next.includes(id));

  if (added.length === 0 && removed.length === 0) return;

  const db = getDb();
  const batch = writeBatch(db);

  for (const memberId of added) {
    batch.update(doc(db, 'customers', memberId), {
      [field]: arrayUnion(myId),
      updated_at: serverTimestamp(),
    });
  }
  for (const memberId of removed) {
    batch.update(doc(db, 'customers', memberId), {
      [field]: arrayRemove(myId),
      updated_at: serverTimestamp(),
    });
  }

  await batch.commit();
}
