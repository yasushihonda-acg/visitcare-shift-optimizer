import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { UnavailableSlot } from '@/types';

interface UnavailabilityInput {
  staff_id: string;
  week_start_date: Date;
  unavailable_slots: UnavailableSlot[];
  notes?: string;
}

/**
 * 希望休を新規作成する。
 * onSnapshot リスナーが自動でUI反映するため、ローカルstate更新は不要。
 */
export async function createStaffUnavailability(data: UnavailabilityInput): Promise<string> {
  const docRef = await addDoc(collection(getDb(), 'staff_unavailability'), {
    staff_id: data.staff_id,
    week_start_date: Timestamp.fromDate(data.week_start_date),
    unavailable_slots: data.unavailable_slots.map((slot) => ({
      date: Timestamp.fromDate(slot.date),
      all_day: slot.all_day,
      ...(slot.start_time && { start_time: slot.start_time }),
      ...(slot.end_time && { end_time: slot.end_time }),
    })),
    notes: data.notes ?? null,
    submitted_at: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * 希望休を更新する。
 * onSnapshot リスナーが自動でUI反映するため、ローカルstate更新は不要。
 */
export async function updateStaffUnavailability(
  id: string,
  data: UnavailabilityInput
): Promise<void> {
  const ref = doc(getDb(), 'staff_unavailability', id);
  await updateDoc(ref, {
    staff_id: data.staff_id,
    week_start_date: Timestamp.fromDate(data.week_start_date),
    unavailable_slots: data.unavailable_slots.map((slot) => ({
      date: Timestamp.fromDate(slot.date),
      all_day: slot.all_day,
      ...(slot.start_time && { start_time: slot.start_time }),
      ...(slot.end_time && { end_time: slot.end_time }),
    })),
    notes: data.notes ?? null,
    submitted_at: serverTimestamp(),
  });
}

/**
 * 希望休を削除する。
 * 希望休は週単位で再作成されるため、削除を許可する。
 */
export async function deleteStaffUnavailability(id: string): Promise<void> {
  const ref = doc(getDb(), 'staff_unavailability', id);
  await deleteDoc(ref);
}
