import { Timestamp } from 'firebase-admin/firestore';
import {
  DayOfWeek,
  GenderRequirement,
  GeoLocation,
  IrregularPattern,
  PersonName,
  ServiceSlot,
} from './common';

/** 利用者 */
export interface Customer {
  id: string;
  name: PersonName;
  address: string;
  location: GeoLocation;
  ng_staff_ids: string[];
  preferred_staff_ids: string[];
  weekly_services: Partial<Record<DayOfWeek, ServiceSlot[]>>;
  household_id?: string;
  irregular_patterns?: IrregularPattern[];
  service_manager: string;
  gender_requirement?: GenderRequirement;
  kaiso_id?: string;
  karakara_id?: string;
  cura_id?: string;
  aozora_id?: string;
  phone_number?: string;
  home_care_office?: string;
  consultation_support_office?: string;
  care_manager_name?: string;
  support_specialist_name?: string;
  notes?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}
