import type { ServiceSlot } from '@/types';
import { timeToMinutes } from '@/utils/time';

/**
 * 同一曜日のスロット配列の中から重複する時間帯のインデックスペアを返す。
 * 境界接触（09:00-10:00 と 10:00-11:00）は重複とみなさない。
 * @returns 重複しているスロットのインデックスセット
 */
export function detectOverlaps(slots: ServiceSlot[]): Set<number> {
  const overlappingIndices = new Set<number>();

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const aStart = timeToMinutes(slots[i].start_time);
      const aEnd = timeToMinutes(slots[i].end_time);
      const bStart = timeToMinutes(slots[j].start_time);
      const bEnd = timeToMinutes(slots[j].end_time);

      // 境界接触は重複としない（aEnd === bStart は OK）
      if (aStart < bEnd && bStart < aEnd) {
        overlappingIndices.add(i);
        overlappingIndices.add(j);
      }
    }
  }

  return overlappingIndices;
}
