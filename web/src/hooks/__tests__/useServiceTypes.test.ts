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

import { useServiceTypes } from '../useServiceTypes';

function makeSnapshot(docs: Array<{ id: string; data: () => Record<string, unknown> }>) {
  return { forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => docs.forEach(cb) };
}

describe('useServiceTypes', () => {
  beforeEach(() => {
    snapshotCallback = null;
    errorCallback = null;
    mockUnsubscribe.mockClear();
  });

  it('初期状態: loading=true, serviceTypes=空Map, sortedList=空配列', () => {
    const { result } = renderHook(() => useServiceTypes());

    expect(result.current.loading).toBe(true);
    expect(result.current.serviceTypes.size).toBe(0);
    expect(result.current.sortedList).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('onSnapshot成功後: loading=false, serviceTypesにデータが入る', () => {
    const { result } = renderHook(() => useServiceTypes());

    act(() => {
      snapshotCallback?.(makeSnapshot([
        { id: 'ST001', data: () => ({ code: 'ST001', label: 'Physical Care', sort_order: 2 }) },
        { id: 'ST002', data: () => ({ code: 'ST002', label: 'Daily Living', sort_order: 1 }) },
      ]));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.serviceTypes.size).toBe(2);
    expect(result.current.serviceTypes.get('ST001')).toBeDefined();
    expect(result.current.serviceTypes.get('ST002')).toBeDefined();
  });

  it('sortedList が sort_order 昇順でソートされる', () => {
    const { result } = renderHook(() => useServiceTypes());

    act(() => {
      snapshotCallback?.(makeSnapshot([
        { id: 'ST001', data: () => ({ code: 'ST001', label: 'Physical Care', sort_order: 3 }) },
        { id: 'ST002', data: () => ({ code: 'ST002', label: 'Daily Living', sort_order: 1 }) },
        { id: 'ST003', data: () => ({ code: 'ST003', label: 'Prevention', sort_order: 2 }) },
      ]));
    });

    expect(result.current.sortedList).toHaveLength(3);
    expect(result.current.sortedList[0].id).toBe('ST002');
    expect(result.current.sortedList[1].id).toBe('ST003');
    expect(result.current.sortedList[2].id).toBe('ST001');
  });

  it('エラー時: error が設定され loading=false になる', () => {
    const { result } = renderHook(() => useServiceTypes());

    act(() => {
      errorCallback?.(new Error('Firestore error'));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Firestore error');
  });

  it('アンマウント時: unsubscribeが呼ばれる', () => {
    const { unmount } = renderHook(() => useServiceTypes());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('スナップショット更新時: データが置き換わる', () => {
    const { result } = renderHook(() => useServiceTypes());

    act(() => {
      snapshotCallback?.(makeSnapshot([
        { id: 'ST001', data: () => ({ code: 'ST001', label: 'Type A', sort_order: 1 }) },
      ]));
    });

    expect(result.current.serviceTypes.size).toBe(1);

    act(() => {
      snapshotCallback?.(makeSnapshot([
        { id: 'ST001', data: () => ({ code: 'ST001', label: 'Type A', sort_order: 1 }) },
        { id: 'ST002', data: () => ({ code: 'ST002', label: 'Type B', sort_order: 2 }) },
      ]));
    });

    expect(result.current.serviceTypes.size).toBe(2);
    expect(result.current.sortedList).toHaveLength(2);
  });
});
