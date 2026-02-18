import type { ServiceSlot } from '@/types';

/** "HH:MM" を分単位の整数に変換 */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * 同一曜日のスロット配列の中から重複する時間帯のインデックスペアを返す。
 * 境界接触（09:00-10:00 と 10:00-11:00）は重複とみなさない。
 * @returns 重複しているスロットのインデックスセット
 */
export function detectOverlaps(slots: ServiceSlot[]): Set<number> {
  const overlappingIndices = new Set<number>();

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const aStart = toMinutes(slots[i].start_time);
      const aEnd = toMinutes(slots[i].end_time);
      const bStart = toMinutes(slots[j].start_time);
      const bEnd = toMinutes(slots[j].end_time);

      // 境界接触は重複としない（aEnd === bStart は OK）
      if (aStart < bEnd && bStart < aEnd) {
        overlappingIndices.add(i);
        overlappingIndices.add(j);
      }
    }
  }

  return overlappingIndices;
}
