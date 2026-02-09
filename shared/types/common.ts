import { Timestamp } from 'firebase-admin/firestore';

/** サービス種別（Phase 1: 身体/生活のみ） */
export type ServiceType = 'physical_care' | 'daily_living';

/** 曜日 */
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** 時刻文字列 "HH:MM" 形式 */
export type TimeString = string;

/** 雇用形態 */
export type EmploymentType = 'full_time' | 'part_time';

/** 移動手段 */
export type TransportationType = 'car' | 'bicycle' | 'walk';

/** 研修状態 */
export type TrainingStatus = 'training' | 'independent';

/** オーダーステータス */
export type OrderStatus = 'pending' | 'assigned' | 'completed' | 'cancelled';

/** 移動時間のデータソース */
export type TravelTimeSource = 'dummy' | 'google_maps';

/** スタッフ制約タイプ */
export type StaffConstraintType = 'ng' | 'preferred';

/** サービス枠（利用者の曜日別サービス定義） */
export interface ServiceSlot {
  start_time: TimeString;
  end_time: TimeString;
  service_type: ServiceType;
  staff_count: number;
}

/** 可用性枠（ヘルパーの曜日別勤務可能時間） */
export interface AvailabilitySlot {
  start_time: TimeString;
  end_time: TimeString;
}

/** 不定期パターン */
export interface IrregularPattern {
  type: 'biweekly' | 'monthly' | 'temporary_stop';
  description: string;
  active_weeks?: number[];
}

/** 休み枠 */
export interface UnavailableSlot {
  date: Timestamp;
  all_day: boolean;
  start_time?: TimeString;
  end_time?: TimeString;
}

/** 名前 */
export interface PersonName {
  family: string;
  given: string;
  short?: string;
}

/** 座標 */
export interface GeoLocation {
  lat: number;
  lng: number;
}

export { Timestamp };
