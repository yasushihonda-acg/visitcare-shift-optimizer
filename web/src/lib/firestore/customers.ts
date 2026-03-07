import { collection, doc, serverTimestamp, arrayUnion, arrayRemove, writeBatch, runTransaction } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { Customer } from '@/types';

type CustomerInput = Omit<Customer, 'id' | 'created_at' | 'updated_at'>;

/**
 * 利用者を新規作成する。
 * 同一世帯・同一施設の双方向同期も単一バッチで原子的に行う。
 */
export async function createCustomer(data: CustomerInput): Promise<string> {
  const db = getDb();
  const newDocRef = doc(collection(db, 'customers'));
  const batch = writeBatch(db);

  // 自己参照を除外
  const sanitizedData = {
    ...data,
    same_household_customer_ids: (data.same_household_customer_ids ?? []).filter((mid) => mid !== newDocRef.id),
    same_facility_customer_ids: (data.same_facility_customer_ids ?? []).filter((mid) => mid !== newDocRef.id),
  };

  // 新規ドキュメント作成
  batch.set(newDocRef, {
    ...sanitizedData,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  // 双方向同期: 相手側のリストに自分を追加
  for (const memberId of sanitizedData.same_household_customer_ids) {
    batch.update(doc(db, 'customers', memberId), {
      same_household_customer_ids: arrayUnion(newDocRef.id),
      updated_at: serverTimestamp(),
    });
  }
  for (const memberId of sanitizedData.same_facility_customer_ids) {
    batch.update(doc(db, 'customers', memberId), {
      same_facility_customer_ids: arrayUnion(newDocRef.id),
      updated_at: serverTimestamp(),
    });
  }

  await batch.commit();
  return newDocRef.id;
}

/**
 * 利用者情報を更新する。
 * 同一世帯・同一施設の変更がある場合、トランザクションで原子的に双方向同期を行う。
 */
export async function updateCustomer(
  id: string,
  data: Partial<CustomerInput>
): Promise<void> {
  const db = getDb();

  // 自己参照を除外
  if (data.same_household_customer_ids) {
    data = { ...data, same_household_customer_ids: data.same_household_customer_ids.filter((mid) => mid !== id) };
  }
  if (data.same_facility_customer_ids) {
    data = { ...data, same_facility_customer_ids: data.same_facility_customer_ids.filter((mid) => mid !== id) };
  }

  await runTransaction(db, async (transaction) => {
    const customerRef = doc(db, 'customers', id);

    // 変更前データ取得（transaction内で読み取り）
    const prevDoc = await transaction.get(customerRef);
    const prevData = prevDoc.exists() ? prevDoc.data() : {};
    const prevHousehold: string[] = prevData?.same_household_customer_ids ?? [];
    const prevFacility: string[] = prevData?.same_facility_customer_ids ?? [];

    // 自ドキュメント更新
    transaction.update(customerRef, {
      ...data,
      updated_at: serverTimestamp(),
    });

    // 双方向同期
    if (data.same_household_customer_ids !== undefined) {
      applyBidirectionalDiff(transaction, db, id, 'same_household_customer_ids', prevHousehold, data.same_household_customer_ids);
    }
    if (data.same_facility_customer_ids !== undefined) {
      applyBidirectionalDiff(transaction, db, id, 'same_facility_customer_ids', prevFacility, data.same_facility_customer_ids);
    }
  });
}

/**
 * トランザクション内で双方向同期のdiffを適用する。
 * 追加されたメンバーには自分を追加、削除されたメンバーからは自分を削除。
 */
function applyBidirectionalDiff(
  transaction: Parameters<Parameters<typeof runTransaction>[1]>[0],
  db: ReturnType<typeof getDb>,
  myId: string,
  field: 'same_household_customer_ids' | 'same_facility_customer_ids',
  prev: string[],
  next: string[],
): void {
  const added = next.filter((id) => !prev.includes(id));
  const removed = prev.filter((id) => !next.includes(id));

  for (const memberId of added) {
    transaction.update(doc(db, 'customers', memberId), {
      [field]: arrayUnion(myId),
      updated_at: serverTimestamp(),
    });
  }
  for (const memberId of removed) {
    transaction.update(doc(db, 'customers', memberId), {
      [field]: arrayRemove(myId),
      updated_at: serverTimestamp(),
    });
  }
}
