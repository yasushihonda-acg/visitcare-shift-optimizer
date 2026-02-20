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
function minutesToPx(minutes: number, slotWidth: number = SLOT_WIDTH_PX): number {
  const startMinutes = GANTT_START_HOUR * 60;
  return ((minutes - startMinutes) / MINUTES_PER_SLOT) * slotWidth;
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
  slotWidth: number = SLOT_WIDTH_PX,
): UnavailableBlock[] {
  const toPx = (minutes: number) => minutesToPx(minutes, slotWidth);
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
          left: toPx(cursor),
          width: toPx(slotStart) - toPx(cursor),
          label: '勤務時間外',
          type: 'off_hours',
        });
      }
      cursor = Math.max(cursor, slotEnd);
    }

    if (cursor < ganttEndMin) {
      blocks.push({
        left: toPx(cursor),
        width: toPx(ganttEndMin) - toPx(cursor),
        label: '勤務時間外',
        type: 'off_hours',
      });
    }
  } else {
    // 勤務時間未設定 → 非勤務日として全域をグレーアウト
    blocks.push({
      left: toPx(ganttStartMin),
      width: toPx(ganttEndMin) - toPx(ganttStartMin),
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
        left: toPx(ganttStartMin),
        width: toPx(ganttEndMin) - toPx(ganttStartMin),
        label: '希望休',
        type: 'unavailable',
      });
    } else if (slot.start_time && slot.end_time) {
      const start = Math.max(timeToMinutes(slot.start_time), ganttStartMin);
      const end = Math.min(timeToMinutes(slot.end_time), ganttEndMin);
      if (end > start) {
        blocks.push({
          left: toPx(start),
          width: toPx(end) - toPx(start),
          label: '希望休',
          type: 'unavailable',
        });
      }
    }
  }

  return blocks;
}

/** 分数 → "HH:MM" 文字列 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "HH:MM" に分数を加算し、ガント範囲(7:00-21:00)にクランプ */
export function addMinutesToTime(time: string, deltaMinutes: number): string {
  const total = timeToMinutes(time) + deltaMinutes;
  const ganttStartMin = GANTT_START_HOUR * 60;
  const ganttEndMin = GANTT_END_HOUR * 60;
  const clamped = Math.max(ganttStartMin, Math.min(total, ganttEndMin));
  return minutesToTime(clamped);
}

/** 分数を10分単位にスナップ */
export function snapTo10Min(minutes: number): number {
  return Math.round(minutes / 10) * 10;
}

/** delta.x (px) から10分スナップ済みの時間オフセット(分)を計算 */
export function deltaToTimeShift(deltaX: number, slotWidth: number): number {
  const rawMinutes = (deltaX / slotWidth) * MINUTES_PER_SLOT;
  return snapTo10Min(rawMinutes);
}

/** 時間シフト適用後のstart/endを計算（duration保持、ガント範囲クランプ） */
export function computeShiftedTimes(
  startTime: string,
  endTime: string,
  shiftMinutes: number,
): { newStartTime: string; newEndTime: string } {
  const duration = timeToMinutes(endTime) - timeToMinutes(startTime);
  const ganttStartMin = GANTT_START_HOUR * 60;
  const ganttEndMin = GANTT_END_HOUR * 60;

  let newStartMin = timeToMinutes(startTime) + shiftMinutes;
  // duration 保持のままクランプ
  newStartMin = Math.max(ganttStartMin, Math.min(newStartMin, ganttEndMin - duration));
  const newEndMin = newStartMin + duration;

  return {
    newStartTime: minutesToTime(newStartMin),
    newEndTime: minutesToTime(newEndMin),
  };
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

/** サービス種別の色マッピング */
export const SERVICE_COLORS: Record<string, { bar: string; hover: string }> = {
  physical_care: {
    bar: 'bg-gradient-to-r from-[oklch(0.55_0.15_225)] to-[oklch(0.60_0.12_205)] text-white',
    hover: 'hover:from-[oklch(0.50_0.16_225)] hover:to-[oklch(0.55_0.13_205)]',
  },
  daily_living: {
    bar: 'bg-gradient-to-r from-[oklch(0.55_0.15_162)] to-[oklch(0.60_0.12_147)] text-white',
    hover: 'hover:from-[oklch(0.50_0.16_162)] hover:to-[oklch(0.55_0.13_147)]',
  },
  mixed: {
    bar: 'bg-gradient-to-r from-[oklch(0.58_0.14_50)] to-[oklch(0.63_0.11_35)] text-white',
    hover: 'hover:from-[oklch(0.53_0.15_50)] hover:to-[oklch(0.58_0.12_35)]',
  },
  prevention: {
    bar: 'bg-gradient-to-r from-[oklch(0.60_0.12_298)] to-[oklch(0.65_0.10_278)] text-white',
    hover: 'hover:from-[oklch(0.55_0.13_298)] hover:to-[oklch(0.60_0.11_278)]',
  },
  private: {
    bar: 'bg-gradient-to-r from-[oklch(0.60_0.12_350)] to-[oklch(0.65_0.10_330)] text-white',
    hover: 'hover:from-[oklch(0.55_0.13_350)] hover:to-[oklch(0.60_0.11_330)]',
  },
  disability: {
    bar: 'bg-gradient-to-r from-[oklch(0.58_0.14_120)] to-[oklch(0.63_0.11_105)] text-white',
    hover: 'hover:from-[oklch(0.53_0.15_120)] hover:to-[oklch(0.58_0.12_105)]',
  },
  transport_support: {
    bar: 'bg-gradient-to-r from-[oklch(0.60_0.12_200)] to-[oklch(0.65_0.10_185)] text-white',
    hover: 'hover:from-[oklch(0.55_0.13_200)] hover:to-[oklch(0.60_0.11_185)]',
  },
  severe_visiting: {
    bar: 'bg-gradient-to-r from-[oklch(0.53_0.18_25)] to-[oklch(0.58_0.15_10)] text-white',
    hover: 'hover:from-[oklch(0.48_0.19_25)] hover:to-[oklch(0.53_0.16_10)]',
  },
};
