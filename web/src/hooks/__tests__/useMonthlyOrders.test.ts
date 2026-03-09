/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Firestore モック ---

let snapshotCallback: ((snapshot: unknown) => void) | null = null;
let errorCallback: ((err: Error) => void) | null = null;
const mockUnsubscribe = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  Timestamp: { fromDate: vi.fn((d: Date) => d) },
  onSnapshot: vi.fn((_q: unknown, onNext: (snapshot: unknown) => void, onError: (err: Error) => void) => {
    snapshotCallback = onNext;
    errorCallback = onError;
    return mockUnsubscribe;
  }),
}));

vi.mock('@/lib/firebase', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/firestore-converter', () => ({
  convertTimestamps: vi.fn(<T>(data: T): T => data),
}));

import { useMonthlyOrders } from '../useMonthlyOrders';

function makeSnapshot(docs: Array<{ id: string; data: () => Record<string, unknown> }>) {
  return { forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => docs.forEach(cb) };
}

describe('useMonthlyOrders', () => {
  beforeEach(() => {
    snapshotCallback = null;
    errorCallback = null;
    mockUnsubscribe.mockClear();
  });

  it('初期状態: loading=true, orders=[]', () => {
    const { result } = renderHook(() => useMonthlyOrders(new Date('2025-01-15')));
    expect(result.current.loading).toBe(true);
    expect(result.current.orders).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('onSnapshot成功後: loading=false, ordersにデータが入る', () => {
    const { result } = renderHook(() => useMonthlyOrders(new Date('2025-01-15')));

    act(() => {
      snapshotCallback?.(makeSnapshot([
        { id: 'O001', data: () => ({ customer_id: 'C001' }) },
        { id: 'O002', data: () => ({ customer_id: 'C002' }) },
      ]));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.orders).toHaveLength(2);
  });

  it('エラー時: error が設定される', () => {
    const { result } = renderHook(() => useMonthlyOrders(new Date('2025-01-15')));

    act(() => {
      errorCallback?.(new Error('Query error'));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error?.message).toBe('Query error');
  });

  it('month変更時: 前のリスナーが解除される', () => {
    const { rerender } = renderHook(
      ({ month }) => useMonthlyOrders(month),
      { initialProps: { month: new Date('2025-01-15') } }
    );

    rerender({ month: new Date('2025-02-15') });
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('アンマウント時: unsubscribeが呼ばれる', () => {
    const { unmount } = renderHook(() => useMonthlyOrders(new Date('2025-01-15')));
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
