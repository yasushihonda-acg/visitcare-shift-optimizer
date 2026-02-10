import { describe, it, expect } from 'vitest';
import { timeToColumn, timeToMinutes, isOverlapping, TOTAL_SLOTS } from '../constants';

describe('timeToColumn', () => {
  it('7:00（開始時刻）は列1', () => {
    expect(timeToColumn('07:00')).toBe(1);
  });

  it('7:05は列2', () => {
    expect(timeToColumn('07:05')).toBe(2);
  });

  it('8:00は列13（7:00から12スロット+1）', () => {
    expect(timeToColumn('08:00')).toBe(13);
  });

  it('21:00（終了時刻）は最大列+1', () => {
    expect(timeToColumn('21:00')).toBe(TOTAL_SLOTS + 1);
  });

  it('7:00より前はクランプされて列1', () => {
    expect(timeToColumn('06:00')).toBe(1);
  });

  it('12:30は正しい列番号', () => {
    // 12:30 = 5.5時間 * 12スロット/時間 = 66スロット → 列67
    expect(timeToColumn('12:30')).toBe(67);
  });
});

describe('timeToMinutes', () => {
  it('07:00は420分', () => {
    expect(timeToMinutes('07:00')).toBe(420);
  });

  it('09:30は570分', () => {
    expect(timeToMinutes('09:30')).toBe(570);
  });

  it('21:00は1260分', () => {
    expect(timeToMinutes('21:00')).toBe(1260);
  });
});

describe('isOverlapping', () => {
  it('重複する時間帯', () => {
    expect(isOverlapping('09:00', '10:00', '09:30', '10:30')).toBe(true);
  });

  it('隣接する時間帯は重複しない', () => {
    expect(isOverlapping('09:00', '10:00', '10:00', '11:00')).toBe(false);
  });

  it('完全に分離した時間帯は重複しない', () => {
    expect(isOverlapping('09:00', '10:00', '11:00', '12:00')).toBe(false);
  });

  it('包含関係', () => {
    expect(isOverlapping('09:00', '12:00', '10:00', '11:00')).toBe(true);
  });

  it('同一時間帯', () => {
    expect(isOverlapping('09:00', '10:00', '09:00', '10:00')).toBe(true);
  });
});
