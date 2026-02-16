/** ガントチャート時間軸定数 */
export const GANTT_START_HOUR = 7;
export const GANTT_END_HOUR = 21;
export const MINUTES_PER_SLOT = 5;
export const TOTAL_HOURS = GANTT_END_HOUR - GANTT_START_HOUR; // 14
export const TOTAL_SLOTS = TOTAL_HOURS * (60 / MINUTES_PER_SLOT); // 168
export const SLOT_WIDTH_PX = 4; // 各5分スロットの幅
export const HELPER_NAME_WIDTH_PX = 120;
export const ROW_HEIGHT_PX = 36; // 行高さ（h-9相当）
export const BAR_HEIGHT_CLASS = 'h-8'; // バー高さ

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

/** 分数 → ピクセル位置（ガント開始からの相対位置） */
function minutesToPx(minutes: number): number {
  const startMinutes = GANTT_START_HOUR * 60;
  return ((minutes - startMinutes) / MINUTES_PER_SLOT) * SLOT_WIDTH_PX;
}

export type UnavailableBlockType = 'off_hours' | 'day_off' | 'unavailable';

export interface UnavailableBlock {
  left: number;
  width: number;
  label: string;
  type: UnavailableBlockType;
}

/** ヘルパーの勤務不可時間帯ブロックを計算 */
export function calculateUnavailableBlocks(
  weeklyAvailability: Partial<Record<import('@/types').DayOfWeek, import('@/types').AvailabilitySlot[]>>,
  unavailableSlots: import('@/types').UnavailableSlot[],
  day: import('@/types').DayOfWeek,
  dayDate: Date,
): UnavailableBlock[] {
  const ganttStartMin = GANTT_START_HOUR * 60;
  const ganttEndMin = GANTT_END_HOUR * 60;
  const blocks: UnavailableBlock[] = [];

  // 1. 勤務時間外ブロック
  const daySlots = weeklyAvailability[day];
  if (daySlots && daySlots.length > 0) {
    // スロットを開始時刻でソート
    const sorted = [...daySlots].sort(
      (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
    );

    let cursor = ganttStartMin;
    for (const slot of sorted) {
      const slotStart = Math.max(timeToMinutes(slot.start_time), ganttStartMin);
      const slotEnd = Math.min(timeToMinutes(slot.end_time), ganttEndMin);

      if (slotStart > cursor) {
        blocks.push({
          left: minutesToPx(cursor),
          width: minutesToPx(slotStart) - minutesToPx(cursor),
          label: '勤務時間外',
          type: 'off_hours',
        });
      }
      cursor = Math.max(cursor, slotEnd);
    }

    if (cursor < ganttEndMin) {
      blocks.push({
        left: minutesToPx(cursor),
        width: minutesToPx(ganttEndMin) - minutesToPx(cursor),
        label: '勤務時間外',
        type: 'off_hours',
      });
    }
  } else {
    // 勤務時間未設定 → 非勤務日として全域をグレーアウト
    blocks.push({
      left: minutesToPx(ganttStartMin),
      width: minutesToPx(ganttEndMin) - minutesToPx(ganttStartMin),
      label: '非勤務日',
      type: 'day_off',
    });
  }

  // 2. 希望休ブロック
  for (const slot of unavailableSlots) {
    // 日付比較（年月日のみ）
    const slotDate = slot.date;
    if (
      slotDate.getFullYear() !== dayDate.getFullYear() ||
      slotDate.getMonth() !== dayDate.getMonth() ||
      slotDate.getDate() !== dayDate.getDate()
    ) {
      continue;
    }

    if (slot.all_day) {
      blocks.push({
        left: minutesToPx(ganttStartMin),
        width: minutesToPx(ganttEndMin) - minutesToPx(ganttStartMin),
        label: '希望休',
        type: 'unavailable',
      });
    } else if (slot.start_time && slot.end_time) {
      const start = Math.max(timeToMinutes(slot.start_time), ganttStartMin);
      const end = Math.min(timeToMinutes(slot.end_time), ganttEndMin);
      if (end > start) {
        blocks.push({
          left: minutesToPx(start),
          width: minutesToPx(end) - minutesToPx(start),
          label: '希望休',
          type: 'unavailable',
        });
      }
    }
  }

  return blocks;
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
