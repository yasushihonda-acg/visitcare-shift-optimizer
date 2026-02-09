import { Timestamp } from 'firebase-admin/firestore';
import { UnavailableSlot } from './common';

/** スタッフ希望休 */
export interface StaffUnavailability {
  id: string;
  staff_id: string;
  week_start_date: Timestamp;
  unavailable_slots: UnavailableSlot[];
  notes?: string;
  submitted_at: Timestamp;
}
