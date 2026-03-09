/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWelcomeDialog } from '../useWelcomeDialog';

const STORAGE_KEY = 'visitcare-welcome-shown';

describe('useWelcomeDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('初回訪問: welcomeOpen=trueになる', () => {
    const { result } = renderHook(() => useWelcomeDialog());
    expect(result.current.welcomeOpen).toBe(true);
  });

  it('既にshown済み: welcomeOpen=falseになる', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() => useWelcomeDialog());
    expect(result.current.welcomeOpen).toBe(false);
  });

  it('closeWelcome: welcomeOpenがfalseになりlocalStorageに保存される', () => {
    const { result } = renderHook(() => useWelcomeDialog());
    expect(result.current.welcomeOpen).toBe(true);

    act(() => {
      result.current.closeWelcome();
    });

    expect(result.current.welcomeOpen).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('reopenWelcome: welcomeOpenがtrueに戻る', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() => useWelcomeDialog());
    expect(result.current.welcomeOpen).toBe(false);

    act(() => {
      result.current.reopenWelcome();
    });

    expect(result.current.welcomeOpen).toBe(true);
  });

  it('closeWelcome後にreopenWelcome: 再度trueになる', () => {
    const { result } = renderHook(() => useWelcomeDialog());

    act(() => {
      result.current.closeWelcome();
    });
    expect(result.current.welcomeOpen).toBe(false);

    act(() => {
      result.current.reopenWelcome();
    });
    expect(result.current.welcomeOpen).toBe(true);
  });

  it('closeWelcomeとreopenWelcomeは安定した参照を返す', () => {
    const { result, rerender } = renderHook(() => useWelcomeDialog());
    const firstClose = result.current.closeWelcome;
    const firstReopen = result.current.reopenWelcome;

    rerender();

    expect(result.current.closeWelcome).toBe(firstClose);
    expect(result.current.reopenWelcome).toBe(firstReopen);
  });
});
