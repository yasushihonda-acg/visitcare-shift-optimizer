import { describe, it, expect } from 'vitest';
import { timeToColumn, timeToMinutes, isOverlapping, TOTAL_SLOTS, SLOT_WIDTH_PX, calculateUnavailableBlocks, minutesToTime, addMinutesToTime, snapTo10Min, deltaToTimeShift, computeShiftedTimes } from '../constants';
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

describe('minutesToTime', () => {
  it('420分は07:00', () => {
    expect(minutesToTime(420)).toBe('07:00');
  });

  it('570分は09:30', () => {
    expect(minutesToTime(570)).toBe('09:30');
  });

  it('1260分は21:00', () => {
    expect(minutesToTime(1260)).toBe('21:00');
  });

  it('0分は00:00', () => {
    expect(minutesToTime(0)).toBe('00:00');
  });
});

describe('addMinutesToTime', () => {
  it('09:00 + 30分 = 09:30', () => {
    expect(addMinutesToTime('09:00', 30)).toBe('09:30');
  });

  it('09:00 - 30分 = 08:30', () => {
    expect(addMinutesToTime('09:00', -30)).toBe('08:30');
  });

  it('09:00 + 60分 = 10:00', () => {
    expect(addMinutesToTime('09:00', 60)).toBe('10:00');
  });

  it('ガント終了時刻を超えない（20:30 + 60分 → 21:00）', () => {
    expect(addMinutesToTime('20:30', 60)).toBe('21:00');
  });

  it('ガント開始時刻を下回らない（07:30 - 60分 → 07:00）', () => {
    expect(addMinutesToTime('07:30', -60)).toBe('07:00');
  });
});

describe('snapTo10Min', () => {
  it('0はそのまま', () => {
    expect(snapTo10Min(0)).toBe(0);
  });

  it('10はそのまま', () => {
    expect(snapTo10Min(10)).toBe(10);
  });

  it('7は10にスナップ', () => {
    expect(snapTo10Min(7)).toBe(10);
  });

  it('4は0にスナップ', () => {
    expect(snapTo10Min(4)).toBe(0);
  });

  it('-7は-10にスナップ', () => {
    expect(snapTo10Min(-7)).toBe(-10);
  });

  it('15は20にスナップ', () => {
    expect(snapTo10Min(15)).toBe(20);
  });
});

describe('deltaToTimeShift', () => {
  it('slotWidth=4, delta=8px → 10分', () => {
    // 8px / 4px = 2スロット = 10分、snapTo10Min(10) = 10
    expect(deltaToTimeShift(8, 4)).toBe(10);
  });

  it('slotWidth=4, delta=0px → 0分', () => {
    expect(deltaToTimeShift(0, 4)).toBe(0);
  });

  it('slotWidth=4, delta=-8px → -10分', () => {
    expect(deltaToTimeShift(-8, 4)).toBe(-10);
  });

  it('slotWidth=10, delta=20px → 10分', () => {
    // 20px / 10px = 2スロット = 10分
    expect(deltaToTimeShift(20, 10)).toBe(10);
  });

  it('小さなdelta（スナップ閾値未満）→ 0分', () => {
    // 3px / 4px = 0.75スロット = 3.75分 → snapTo10Min = 0
    expect(deltaToTimeShift(3, 4)).toBe(0);
  });
});

describe('computeShiftedTimes', () => {
  it('+30分シフト', () => {
    const result = computeShiftedTimes('09:00', '10:00', 30);
    expect(result).toEqual({ newStartTime: '09:30', newEndTime: '10:30' });
  });

  it('-30分シフト', () => {
    const result = computeShiftedTimes('09:00', '10:00', -30);
    expect(result).toEqual({ newStartTime: '08:30', newEndTime: '09:30' });
  });

  it('0分シフト（変更なし）', () => {
    const result = computeShiftedTimes('09:00', '10:00', 0);
    expect(result).toEqual({ newStartTime: '09:00', newEndTime: '10:00' });
  });

  it('ガント終了時刻クランプ（duration保持）', () => {
    // 20:30 + 60分 → end=22:00 超過 → start=20:00, end=21:00にクランプ
    const result = computeShiftedTimes('20:00', '21:00', 60);
    expect(result).toEqual({ newStartTime: '20:00', newEndTime: '21:00' });
  });

  it('ガント開始時刻クランプ（duration保持）', () => {
    // 07:30 - 60分 → start=06:30 < 07:00 → start=07:00, end=08:00
    const result = computeShiftedTimes('07:30', '08:30', -60);
    expect(result).toEqual({ newStartTime: '07:00', newEndTime: '08:00' });
  });

  it('duration保持: 2時間のオーダー', () => {
    const result = computeShiftedTimes('09:00', '11:00', 60);
    expect(result).toEqual({ newStartTime: '10:00', newEndTime: '12:00' });
  });
});
