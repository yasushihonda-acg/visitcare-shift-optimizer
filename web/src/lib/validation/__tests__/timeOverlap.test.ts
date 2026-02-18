import { describe, it, expect } from 'vitest';
import { detectOverlaps } from '../timeOverlap';
import type { ServiceSlot } from '@/types';

function slot(start_time: string, end_time: string): ServiceSlot {
  return { start_time, end_time, service_type: 'physical_care', staff_count: 1 };
}

describe('detectOverlaps', () => {
  // ---- 重複なし ----
  it('スロットが1件のみの場合は重複なし', () => {
    const result = detectOverlaps([slot('09:00', '10:00')]);
    expect(result.size).toBe(0);
  });

  it('空配列の場合は重複なし', () => {
    const result = detectOverlaps([]);
    expect(result.size).toBe(0);
  });

  it('時間帯が離れている場合は重複なし', () => {
    const result = detectOverlaps([
      slot('09:00', '10:00'),
      slot('13:00', '14:00'),
    ]);
    expect(result.size).toBe(0);
  });

  it('境界接触（end === 次のstart）は重複とみなさない', () => {
    const result = detectOverlaps([
      slot('09:00', '10:00'),
      slot('10:00', '11:00'),
    ]);
    expect(result.size).toBe(0);
  });

  it('3件すべて離れている場合は重複なし', () => {
    const result = detectOverlaps([
      slot('08:00', '09:00'),
      slot('10:00', '11:00'),
      slot('14:00', '15:00'),
    ]);
    expect(result.size).toBe(0);
  });

  // ---- 重複あり ----
  it('完全に同一の時間帯は重複', () => {
    const result = detectOverlaps([
      slot('09:00', '10:00'),
      slot('09:00', '10:00'),
    ]);
    expect(result).toEqual(new Set([0, 1]));
  });

  it('部分的に重なる場合は重複', () => {
    const result = detectOverlaps([
      slot('09:00', '10:30'),
      slot('10:00', '11:00'),
    ]);
    expect(result).toEqual(new Set([0, 1]));
  });

  it('一方が他方を完全に含む場合は重複', () => {
    const result = detectOverlaps([
      slot('09:00', '12:00'),
      slot('10:00', '11:00'),
    ]);
    expect(result).toEqual(new Set([0, 1]));
  });

  it('3件中2件が重複する場合、重複する2件のみが対象', () => {
    const result = detectOverlaps([
      slot('09:00', '10:00'),  // index 0: 離れている
      slot('13:00', '14:30'),  // index 1: 重複
      slot('14:00', '15:00'),  // index 2: 重複
    ]);
    expect(result).toEqual(new Set([1, 2]));
  });

  it('3件すべてが重複する場合はすべてのインデックスが対象', () => {
    const result = detectOverlaps([
      slot('09:00', '11:00'),  // index 0
      slot('09:30', '10:30'),  // index 1
      slot('10:00', '12:00'),  // index 2
    ]);
    expect(result).toEqual(new Set([0, 1, 2]));
  });

  // ---- 境界値 ----
  it('1分だけ重なる場合は重複', () => {
    const result = detectOverlaps([
      slot('09:00', '10:01'),
      slot('10:00', '11:00'),
    ]);
    expect(result).toEqual(new Set([0, 1]));
  });
});
