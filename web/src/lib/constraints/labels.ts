import type { Violation } from './checker';

export const VIOLATION_TYPE_LABELS: Record<Violation['type'], string> = {
  ng_staff: 'NGスタッフ',
  qualification: '資格不適合',
  overlap: '時間重複',
  unavailability: '希望休',
  gender: '性別要件',
  training: '研修状態',
  preferred_staff: '推奨スタッフ外',
  staff_count_under: '人員不足',
  staff_count_over: '人員超過',
  outside_hours: '勤務時間外',
  travel_time: '移動時間不足',
};
