/**
 * クライアント側型定義
 * shared/types/ の Timestamp → Date 変換版
 */

// リテラル型はそのまま再利用
export type ServiceType = 'physical_care' | 'daily_living';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type TimeString = string;
export type EmploymentType = 'full_time' | 'part_time';
export type TransportationType = 'car' | 'bicycle' | 'walk';
export type TrainingStatus = 'training' | 'independent';
export type OrderStatus = 'pending' | 'assigned' | 'completed' | 'cancelled';
export type StaffConstraintType = 'ng' | 'preferred';

export const DAY_OF_WEEK_ORDER: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  monday: '月', tuesday: '火', wednesday: '水', thursday: '木',
  friday: '金', saturday: '土', sunday: '日',
};

export interface PersonName {
  family: string;
  given: string;
  short?: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface ServiceSlot {
  start_time: TimeString;
  end_time: TimeString;
  service_type: ServiceType;
  staff_count: number;
}

export interface AvailabilitySlot {
  start_time: TimeString;
  end_time: TimeString;
}

export interface UnavailableSlot {
  date: Date;
  all_day: boolean;
  start_time?: TimeString;
  end_time?: TimeString;
}

export interface Customer {
  id: string;
  name: PersonName;
  address: string;
  location: GeoLocation;
  ng_staff_ids: string[];
  preferred_staff_ids: string[];
  weekly_services: Partial<Record<DayOfWeek, ServiceSlot[]>>;
  household_id?: string;
  service_manager: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

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
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: string;
  customer_id: string;
  week_start_date: Date;
  date: Date;
  start_time: TimeString;
  end_time: TimeString;
  service_type: ServiceType;
  assigned_staff_ids: string[];
  status: OrderStatus;
  linked_order_id?: string;
  manually_edited: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface StaffUnavailability {
  id: string;
  staff_id: string;
  week_start_date: Date;
  unavailable_slots: UnavailableSlot[];
  notes?: string;
  submitted_at: Date;
}

export type OptimizationStatus = 'Optimal' | 'Feasible' | 'Infeasible' | 'Not Solved';

export interface OptimizationRunSummary {
  id: string;
  week_start_date: string;
  executed_at: string;
  executed_by: string;
  dry_run: boolean;
  status: OptimizationStatus;
  objective_value: number;
  solve_time_seconds: number;
  total_orders: number;
  assigned_count: number;
  parameters: { time_limit_seconds: number };
}

export interface OptimizationRunDetail extends OptimizationRunSummary {
  assignments: Array<{ order_id: string; staff_ids: string[] }>;
}
