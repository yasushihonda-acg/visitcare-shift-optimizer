import { Timestamp } from 'firebase-admin/firestore';

/** サービス種別（8種） */
export type ServiceType =
  | 'physical_care'       // 身体介護
  | 'daily_living'        // 生活援助
  | 'mixed'               // 混合（身体+生活）
  | 'prevention'          // 介護予防
  | 'private'             // 自費サービス
  | 'disability'          // 障がい福祉サービス
  | 'transport_support'   // 移動支援
  | 'severe_visiting';    // 重度訪問介護

/** サービス種別マスタドキュメント */
export interface ServiceTypeDoc {
  code: string;                         // ドキュメントIDと同一
  label: string;                        // "身体介護"
  short_label: string;                  // "身体"
  requires_physical_care_cert: boolean; // true → can_physical_care 必要
  sort_order: number;                   // 表示順（1始まり）
}

/** 曜日 */
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** 時刻文字列 "HH:MM" 形式 */
export type TimeString = string;

/** 雇用形態 */
export type EmploymentType = 'full_time' | 'part_time';

/** 移動手段 */
export type TransportationType = 'car' | 'bicycle' | 'walk';

/** 研修状態 */
export type TrainingStatus = 'not_visited' | 'training' | 'independent';

/** 性別 */
export type Gender = 'male' | 'female';

/** 性別要件 */
export type GenderRequirement = 'any' | 'female' | 'male';

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
