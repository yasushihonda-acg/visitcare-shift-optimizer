/** ガントチャート時間軸定数 */
export const GANTT_START_HOUR = 7;
export const GANTT_END_HOUR = 21;
export const MINUTES_PER_SLOT = 5;
export const TOTAL_HOURS = GANTT_END_HOUR - GANTT_START_HOUR; // 14
export const TOTAL_SLOTS = TOTAL_HOURS * (60 / MINUTES_PER_SLOT); // 168
export const SLOT_WIDTH_PX = 4; // 各5分スロットの幅
export const HELPER_NAME_WIDTH_PX = 120;

/** "HH:MM" → グリッド列番号（1-based） */
export function timeToColumn(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m;
  const startMinutes = GANTT_START_HOUR * 60;
  const slot = Math.round((totalMinutes - startMinutes) / MINUTES_PER_SLOT);
  return Math.max(1, Math.min(slot + 1, TOTAL_SLOTS + 1));
}

/** "HH:MM" → 開始からの分数 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 2つの時間帯が重複するかチェック */
export function isOverlapping(
  start1: string, end1: string,
  start2: string, end2: string
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}
