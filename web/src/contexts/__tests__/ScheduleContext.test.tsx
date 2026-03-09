/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';

// date-fnsのstartOfWeek/addWeeks/subWeeksは実物を使う（純粋関数）
// localStorageモックはjsdom標準で利用可能

import { ScheduleProvider, useScheduleContext } from '../ScheduleContext';

function wrapper({ children }: { children: ReactNode }) {
  return <ScheduleProvider>{children}</ScheduleProvider>;
}

describe('ScheduleContext', () => {
  beforeEach(() => {
    localStorage.clear();
    // 2025-01-06 (Monday) に固定
    vi.setSystemTime(new Date(2025, 0, 6, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Provider ---

  it('Provider なしで useScheduleContext を呼ぶとエラーになる', () => {
    expect(() => {
      renderHook(() => useScheduleContext());
    }).toThrow('useScheduleContext must be used within ScheduleProvider');
  });

  it('Provider 内で useScheduleContext がコンテキスト値を返す', () => {
    const { result } = renderHook(() => useScheduleContext(), { wrapper });

    expect(result.current.weekStart).toBeInstanceOf(Date);
    expect(result.current.selectedDay).toBeDefined();
    expect(result.current.viewMode).toBe('day');
    expect(result.current.ganttAxis).toBe('staff');
  });

  // --- weekStart 初期値 ---

  it('weekStart が現在の週の月曜日に初期化される', () => {
    const { result } = renderHook(() => useScheduleContext(), { wrapper });

    // 2025-01-06 は月曜日
    expect(result.current.weekStart.getFullYear()).toBe(2025);
    expect(result.current.weekStart.getMonth()).toBe(0);
    expect(result.current.weekStart.getDate()).toBe(6);
    expect(result.current.weekStart.getDay()).toBe(1); // Monday
  });

  // --- selectedDay 初期値 ---

  it('selectedDay が現在の曜日に初期化される（月曜日の場合 monday）', () => {
    const { result } = renderHook(() => useScheduleContext(), { wrapper });
    expect(result.current.selectedDay).toBe('monday');
  });

  // --- goToNextWeek / goToPrevWeek ---

  it('goToNextWeek で weekStart が1週間進む', () => {
    const { result } = renderHook(() => useScheduleContext(), { wrapper });

    act(() => {
      result.current.goToNextWeek();
    });

    expect(result.current.weekStart.getDate()).toBe(13);
  });

  it('goToPrevWeek で weekStart が1週間戻る', () => {
    const { result } = renderHook(() => useScheduleContext(), { wrapper });

    act(() => {
      result.current.goToPrevWeek();
    });

    // 2024-12-30 (前週の月曜日)
    expect(result.current.weekStart.getFullYear()).toBe(2024);
    expect(result.current.weekStart.getMonth()).toBe(11);
    expect(result.current.weekStart.getDate()).toBe(30);
  });

  // --- goToWeek ---

  it('goToWeek で指定日の週の月曜日に移動する', () => {
    const { result } = renderHook(() => useScheduleContext(), { wrapper });

    act(() => {
      // 2025-02-19 (水曜日) → 2025-02-17 (月曜日)
      result.current.goToWeek(new Date(2025, 1, 19));
    });

    expect(result.current.weekStart.getMonth()).toBe(1);
    expect(result.current.weekStart.getDate()).toBe(17);
    expect(result.current.weekStart.getDay()).toBe(1);
  });

  // --- setSelectedDay ---

  it('setSelectedDay で曜日を変更できる', () => {
    const { result } = renderHook(() => useScheduleContext(), { wrapper });

    act(() => {
      result.current.setSelectedDay('friday');
    });

    expect(result.current.selectedDay).toBe('friday');
  });

  // --- viewMode ---

  it('setViewMode で day/week を切り替えられる', () => {
    const { result } = renderHook(() => useScheduleContext(), { wrapper });
    expect(result.current.viewMode).toBe('day');

    act(() => {
      result.current.setViewMode('week');
    });

    expect(result.current.viewMode).toBe('week');
  });

  // --- ganttAxis + localStorage ---

  it('ganttAxis のデフォルトは staff', () => {
    const { result } = renderHook(() => useScheduleContext(), { wrapper });
    expect(result.current.ganttAxis).toBe('staff');
  });

  it('setGanttAxis で customer に変更すると localStorage にも保存される', () => {
    const { result } = renderHook(() => useScheduleContext(), { wrapper });

    act(() => {
      result.current.setGanttAxis('customer');
    });

    expect(result.current.ganttAxis).toBe('customer');
    expect(localStorage.getItem('ganttAxis')).toBe('customer');
  });

  it('localStorage に保存済みの ganttAxis が初期値として読み込まれる', () => {
    localStorage.setItem('ganttAxis', 'customer');

    const { result } = renderHook(() => useScheduleContext(), { wrapper });
    expect(result.current.ganttAxis).toBe('customer');
  });

  it('localStorage に無効な値がある場合はデフォルト staff になる', () => {
    localStorage.setItem('ganttAxis', 'invalid');

    const { result } = renderHook(() => useScheduleContext(), { wrapper });
    expect(result.current.ganttAxis).toBe('staff');
  });
});
