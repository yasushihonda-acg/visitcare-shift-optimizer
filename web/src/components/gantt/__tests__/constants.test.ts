import { describe, it, expect } from 'vitest';
import { timeToColumn, timeToMinutes, isOverlapping, TOTAL_SLOTS, SLOT_WIDTH_PX, calculateUnavailableBlocks } from '../constants';
import type { AvailabilitySlot, UnavailableSlot, DayOfWeek } from '@/types';

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

describe('calculateUnavailableBlocks', () => {
  const monday: DayOfWeek = 'monday';
  const mondayDate = new Date('2025-01-06'); // Monday

  // px計算ヘルパー: 時間をpx位置に変換（7:00起点）
  function timeToPx(time: string): number {
    const [h, m] = time.split(':').map(Number);
    const minutes = h * 60 + m;
    const startMinutes = 7 * 60; // GANTT_START_HOUR
    return ((minutes - startMinutes) / 5) * SLOT_WIDTH_PX;
  }

  describe('勤務時間外のグレーアウト', () => {
    it('勤務9:00-17:00 → 7:00-9:00と17:00-21:00がブロック', () => {
      const availability: Partial<Record<DayOfWeek, AvailabilitySlot[]>> = {
        monday: [{ start_time: '09:00', end_time: '17:00' }],
      };
      const blocks = calculateUnavailableBlocks(availability, [], monday, mondayDate);

      expect(blocks).toHaveLength(2);
      // 7:00-9:00ブロック
      expect(blocks[0]).toEqual({
        left: timeToPx('07:00'),
        width: timeToPx('09:00') - timeToPx('07:00'),
        label: '勤務時間外',
        type: 'off_hours',
      });
      // 17:00-21:00ブロック
      expect(blocks[1]).toEqual({
        left: timeToPx('17:00'),
        width: timeToPx('21:00') - timeToPx('17:00'),
        label: '勤務時間外',
        type: 'off_hours',
      });
    });

    it('勤務7:00-17:00 → 前方ブロックなし、17:00-21:00のみ', () => {
      const availability: Partial<Record<DayOfWeek, AvailabilitySlot[]>> = {
        monday: [{ start_time: '07:00', end_time: '17:00' }],
      };
      const blocks = calculateUnavailableBlocks(availability, [], monday, mondayDate);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        left: timeToPx('17:00'),
        width: timeToPx('21:00') - timeToPx('17:00'),
        label: '勤務時間外',
        type: 'off_hours',
      });
    });

    it('勤務9:00-21:00 → 7:00-9:00のみ', () => {
      const availability: Partial<Record<DayOfWeek, AvailabilitySlot[]>> = {
        monday: [{ start_time: '09:00', end_time: '21:00' }],
      };
      const blocks = calculateUnavailableBlocks(availability, [], monday, mondayDate);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        left: timeToPx('07:00'),
        width: timeToPx('09:00') - timeToPx('07:00'),
        label: '勤務時間外',
        type: 'off_hours',
      });
    });

    it('複数スロット（午前+午後）→ 間の空きもブロック化', () => {
      const availability: Partial<Record<DayOfWeek, AvailabilitySlot[]>> = {
        monday: [
          { start_time: '09:00', end_time: '12:00' },
          { start_time: '14:00', end_time: '17:00' },
        ],
      };
      const blocks = calculateUnavailableBlocks(availability, [], monday, mondayDate);

      expect(blocks).toHaveLength(3);
      // 7:00-9:00
      expect(blocks[0].label).toBe('勤務時間外');
      expect(blocks[0].type).toBe('off_hours');
      expect(blocks[0].left).toBe(timeToPx('07:00'));
      expect(blocks[0].width).toBe(timeToPx('09:00') - timeToPx('07:00'));
      // 12:00-14:00
      expect(blocks[1].left).toBe(timeToPx('12:00'));
      expect(blocks[1].width).toBe(timeToPx('14:00') - timeToPx('12:00'));
      // 17:00-21:00
      expect(blocks[2].left).toBe(timeToPx('17:00'));
      expect(blocks[2].width).toBe(timeToPx('21:00') - timeToPx('17:00'));
    });

    it('勤務7:00-21:00（全域）→ ブロックなし', () => {
      const availability: Partial<Record<DayOfWeek, AvailabilitySlot[]>> = {
        monday: [{ start_time: '07:00', end_time: '21:00' }],
      };
      const blocks = calculateUnavailableBlocks(availability, [], monday, mondayDate);
      expect(blocks).toHaveLength(0);
    });
  });

  describe('勤務時間未設定（非勤務日）', () => {
    it('該当曜日に勤務スロットなし → 非勤務日ブロック（全域）', () => {
      const availability: Partial<Record<DayOfWeek, AvailabilitySlot[]>> = {
        tuesday: [{ start_time: '09:00', end_time: '17:00' }],
      };
      const blocks = calculateUnavailableBlocks(availability, [], monday, mondayDate);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        left: timeToPx('07:00'),
        width: timeToPx('21:00') - timeToPx('07:00'),
        label: '非勤務日',
        type: 'day_off',
      });
    });

    it('weekly_availability自体が空 → 非勤務日ブロック（全域）', () => {
      const blocks = calculateUnavailableBlocks({}, [], monday, mondayDate);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        left: timeToPx('07:00'),
        width: timeToPx('21:00') - timeToPx('07:00'),
        label: '非勤務日',
        type: 'day_off',
      });
    });
  });

  describe('希望休（終日）', () => {
    it('終日休み → 希望休ブロックが全域をカバー', () => {
      const availability: Partial<Record<DayOfWeek, AvailabilitySlot[]>> = {
        monday: [{ start_time: '09:00', end_time: '17:00' }],
      };
      const slots: UnavailableSlot[] = [
        { date: new Date('2025-01-06'), all_day: true },
      ];
      const blocks = calculateUnavailableBlocks(availability, slots, monday, mondayDate);

      // 勤務時間外ブロック（7:00-9:00, 17:00-21:00）+ 希望休ブロック（7:00-21:00）
      const fullWidth = timeToPx('21:00') - timeToPx('07:00');
      const holidayBlock = blocks.find((b) => b.label === '希望休');
      expect(holidayBlock).toBeDefined();
      expect(holidayBlock!.left).toBe(timeToPx('07:00'));
      expect(holidayBlock!.width).toBe(fullWidth);
    });
  });

  describe('希望休（時間帯指定）', () => {
    it('9:00-12:00の希望休 → 該当範囲がブロック', () => {
      const availability: Partial<Record<DayOfWeek, AvailabilitySlot[]>> = {
        monday: [{ start_time: '07:00', end_time: '21:00' }],
      };
      const slots: UnavailableSlot[] = [
        { date: new Date('2025-01-06'), all_day: false, start_time: '09:00', end_time: '12:00' },
      ];
      const blocks = calculateUnavailableBlocks(availability, slots, monday, mondayDate);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        left: timeToPx('09:00'),
        width: timeToPx('12:00') - timeToPx('09:00'),
        label: '希望休',
        type: 'unavailable',
      });
    });

    it('日付不一致の希望休 → スキップ', () => {
      const availability: Partial<Record<DayOfWeek, AvailabilitySlot[]>> = {
        monday: [{ start_time: '07:00', end_time: '21:00' }],
      };
      const slots: UnavailableSlot[] = [
        { date: new Date('2025-01-07'), all_day: false, start_time: '09:00', end_time: '12:00' },
      ];
      const blocks = calculateUnavailableBlocks(availability, slots, monday, mondayDate);
      expect(blocks).toHaveLength(0);
    });
  });

  describe('ガント範囲外クリップ', () => {
    it('勤務6:00-17:00 → 7:00より前はクリップ、17:00-21:00がブロック', () => {
      const availability: Partial<Record<DayOfWeek, AvailabilitySlot[]>> = {
        monday: [{ start_time: '06:00', end_time: '17:00' }],
      };
      const blocks = calculateUnavailableBlocks(availability, [], monday, mondayDate);

      // 6:00-7:00はガント範囲外なのでクリップ → 17:00-21:00のみ
      expect(blocks).toHaveLength(1);
      expect(blocks[0].left).toBe(timeToPx('17:00'));
    });

    it('勤務9:00-22:00 → 7:00-9:00のみ（22:00はクリップ）', () => {
      const availability: Partial<Record<DayOfWeek, AvailabilitySlot[]>> = {
        monday: [{ start_time: '09:00', end_time: '22:00' }],
      };
      const blocks = calculateUnavailableBlocks(availability, [], monday, mondayDate);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        left: timeToPx('07:00'),
        width: timeToPx('09:00') - timeToPx('07:00'),
        label: '勤務時間外',
        type: 'off_hours',
      });
    });
  });
});
