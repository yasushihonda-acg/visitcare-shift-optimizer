import { Timestamp } from 'firebase-admin/firestore';
import {
  AvailabilitySlot,
  DayOfWeek,
  EmploymentType,
  Gender,
  PersonName,
  TrainingStatus,
  TransportationType,
} from './common';

/** ヘルパー/スタッフ */
export interface Helper {
  id: string;
  name: PersonName;
  qualifications: string[];
  can_physical_care: boolean;
  transportation: TransportationType;
  weekly_availability: Partial<Record<DayOfWeek, AvailabilitySlot[]>>;
  preferred_hours: { min: number; max: number };
  available_hours: { min: number; max: number };
  customer_training_status: Record<string, TrainingStatus>;
  employment_type: EmploymentType;
  gender?: Gender;
  split_shift_allowed?: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}
