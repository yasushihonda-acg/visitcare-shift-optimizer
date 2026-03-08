/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Firestore モック ---

let snapshotCallback: ((snapshot: unknown) => void) | null = null;
const mockUnsubscribe = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  Timestamp: { fromDate: vi.fn((d: Date) => d) },
  onSnapshot: vi.fn((_q: unknown, onNext: (snapshot: unknown) => void) => {
    snapshotCallback = onNext;
    return mockUnsubscribe;
  }),
}));

vi.mock('@/lib/firebase', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/firestore-converter', () => ({
  convertTimestamps: vi.fn(<T>(data: T): T => data),
}));

import { useOrders } from '../useOrders';

const week1 = new Date('2025-01-06');
const week2 = new Date('2025-01-13');

function makeSnapshot(docs: Array<{ id: string; data: () => Record<string, unknown> }>) {
  return { forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => docs.forEach(cb) };
}

describe('useOrders', () => {
  beforeEach(() => {
    snapshotCallback = null;
    mockUnsubscribe.mockClear();
  });

  it('初期状態: loading=true, orders=[]', () => {
    const { result } = renderHook(() => useOrders(week1));
    expect(result.current.loading).toBe(true);
    expect(result.current.orders).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('onSnapshot成功後: loading=false, ordersにデータが入る', () => {
    const { result } = renderHook(() => useOrders(week1));

    act(() => {
      snapshotCallback?.(makeSnapshot([
        { id: 'O001', data: () => ({ customer_id: 'C001' }) },
      ]));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.orders).toHaveLength(1);
  });

  it('weekStart変更時: orders=[]にリセットされ loading=true に戻る', () => {
    const { result, rerender } = renderHook(
      ({ weekStart }) => useOrders(weekStart),
      { initialProps: { weekStart: week1 } }
    );

    // 最初のデータ到着
    act(() => {
      snapshotCallback?.(makeSnapshot([
        { id: 'O001', data: () => ({ customer_id: 'C001' }) },
      ]));
    });
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.loading).toBe(false);

    // 週切替
    rerender({ weekStart: week2 });

    // リセット確認: 前週データが残っていない + loading=true
    expect(result.current.orders).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('weekStart変更時: 前のリスナーが解除される', () => {
    const { rerender } = renderHook(
      ({ weekStart }) => useOrders(weekStart),
      { initialProps: { weekStart: week1 } }
    );

    rerender({ weekStart: week2 });
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
