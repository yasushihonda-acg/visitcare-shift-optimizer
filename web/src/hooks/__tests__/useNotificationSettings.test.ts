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
  doc: vi.fn(),
  onSnapshot: vi.fn((_ref: unknown, onNext: (snapshot: unknown) => void, onError: (err: Error) => void) => {
    snapshotCallback = onNext;
    errorCallback = onError;
    return mockUnsubscribe;
  }),
}));

vi.mock('@/lib/firebase', () => ({
  getDb: vi.fn(),
}));

import { useNotificationSettings } from '../useNotificationSettings';

describe('useNotificationSettings', () => {
  beforeEach(() => {
    snapshotCallback = null;
    errorCallback = null;
    mockUnsubscribe.mockClear();
  });

  it('初期状態: loading=true, senderEmail=null', () => {
    const { result } = renderHook(() => useNotificationSettings());
    expect(result.current.loading).toBe(true);
    expect(result.current.senderEmail).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('ドキュメントが存在する場合: sender_emailが設定される', () => {
    const { result } = renderHook(() => useNotificationSettings());

    act(() => {
      snapshotCallback?.({
        exists: () => true,
        data: () => ({ sender_email: 'test@example.com' }),
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.senderEmail).toBe('test@example.com');
  });

  it('ドキュメントが存在しない場合: senderEmail=null', () => {
    const { result } = renderHook(() => useNotificationSettings());

    act(() => {
      snapshotCallback?.({
        exists: () => false,
        data: () => undefined,
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.senderEmail).toBeNull();
  });

  it('sender_emailフィールドが無い場合: senderEmail=null', () => {
    const { result } = renderHook(() => useNotificationSettings());

    act(() => {
      snapshotCallback?.({
        exists: () => true,
        data: () => ({}),
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.senderEmail).toBeNull();
  });

  it('エラー時: error が設定される', () => {
    const { result } = renderHook(() => useNotificationSettings());

    act(() => {
      errorCallback?.(new Error('Permission denied'));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error?.message).toBe('Permission denied');
  });

  it('アンマウント時: unsubscribeが呼ばれる', () => {
    const { unmount } = renderHook(() => useNotificationSettings());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
