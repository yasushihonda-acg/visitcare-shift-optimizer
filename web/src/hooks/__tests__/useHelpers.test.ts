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

import { useHelpers } from '../useHelpers';

function makeSnapshot(docs: Array<{ id: string; data: () => Record<string, unknown> }>) {
  return { forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => docs.forEach(cb) };
}

describe('useHelpers', () => {
  beforeEach(() => {
    snapshotCallback = null;
    errorCallback = null;
    mockUnsubscribe.mockClear();
  });

  it('初期状態: loading=true, helpers=空Map', () => {
    const { result } = renderHook(() => useHelpers());
    expect(result.current.loading).toBe(true);
    expect(result.current.helpers.size).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('onSnapshot成功後: loading=false, helpersにデータが入る', () => {
    const { result } = renderHook(() => useHelpers());

    act(() => {
      snapshotCallback?.(makeSnapshot([
        { id: 'H001', data: () => ({ name: { family: '田中', given: '太郎' } }) },
      ]));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.helpers.size).toBe(1);
    expect(result.current.helpers.get('H001')).toBeDefined();
  });

  it('エラー時: error が設定され loading=false になる', () => {
    const { result } = renderHook(() => useHelpers());

    act(() => {
      errorCallback?.(new Error('Firestore error'));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error?.message).toBe('Firestore error');
  });

  it('アンマウント時: unsubscribeが呼ばれる', () => {
    const { unmount } = renderHook(() => useHelpers());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
