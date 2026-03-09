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

import { useCustomers } from '../useCustomers';

function makeSnapshot(docs: Array<{ id: string; data: () => Record<string, unknown> }>) {
  return { forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => docs.forEach(cb) };
}

describe('useCustomers', () => {
  beforeEach(() => {
    snapshotCallback = null;
    errorCallback = null;
    mockUnsubscribe.mockClear();
  });

  it('初期状態: loading=true, customers=空Map', () => {
    const { result } = renderHook(() => useCustomers());
    expect(result.current.loading).toBe(true);
    expect(result.current.customers.size).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('onSnapshot成功後: loading=false, customersにデータが入る', () => {
    const { result } = renderHook(() => useCustomers());

    act(() => {
      snapshotCallback?.(makeSnapshot([
        { id: 'C001', data: () => ({ name: 'Customer 1' }) },
        { id: 'C002', data: () => ({ name: 'Customer 2' }) },
      ]));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.customers.size).toBe(2);
    expect(result.current.customers.get('C001')).toBeDefined();
  });

  it('欠落している配列フィールドがデフォルト値で補完される', () => {
    const { result } = renderHook(() => useCustomers());

    act(() => {
      snapshotCallback?.(makeSnapshot([
        { id: 'C001', data: () => ({ name: 'Customer 1' }) },
      ]));
    });

    const customer = result.current.customers.get('C001');
    expect(customer?.ng_staff_ids).toEqual([]);
    expect(customer?.preferred_staff_ids).toEqual([]);
    expect(customer?.allowed_staff_ids).toEqual([]);
    expect(customer?.same_household_customer_ids).toEqual([]);
    expect(customer?.same_facility_customer_ids).toEqual([]);
  });

  it('既存の配列フィールドは上書きされない', () => {
    const { result } = renderHook(() => useCustomers());

    act(() => {
      snapshotCallback?.(makeSnapshot([
        { id: 'C001', data: () => ({ name: 'Customer 1', ng_staff_ids: ['H001'] }) },
      ]));
    });

    const customer = result.current.customers.get('C001');
    expect(customer?.ng_staff_ids).toEqual(['H001']);
  });

  it('エラー時: error が設定され loading=false になる', () => {
    const { result } = renderHook(() => useCustomers());

    act(() => {
      errorCallback?.(new Error('Firestore error'));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Firestore error');
  });

  it('アンマウント時: unsubscribeが呼ばれる', () => {
    const { unmount } = renderHook(() => useCustomers());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
