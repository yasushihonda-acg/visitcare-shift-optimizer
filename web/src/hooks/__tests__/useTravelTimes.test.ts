/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Firestore モック ---

const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

vi.mock('@/lib/firebase', () => ({
  getDb: vi.fn(),
}));

const mockBuildTravelTimeLookup = vi.fn();
vi.mock('@/lib/travelTime', () => ({
  buildTravelTimeLookup: (...args: unknown[]) => mockBuildTravelTimeLookup(...args),
}));

import { useTravelTimes } from '../useTravelTimes';

describe('useTravelTimes', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockBuildTravelTimeLookup.mockReset();
  });

  it('初期状態: loading=true, travelTimeLookup=空Map', () => {
    mockGetDocs.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useTravelTimes());
    expect(result.current.loading).toBe(true);
    expect(result.current.travelTimeLookup.size).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('getDocs成功後: buildTravelTimeLookupの結果が設定される', async () => {
    const expectedMap = new Map([['A_B', 10]]);
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'A_B', data: () => ({ travel_time_minutes: 10 }) },
      ],
    });
    mockBuildTravelTimeLookup.mockReturnValue(expectedMap);

    const { result } = renderHook(() => useTravelTimes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.travelTimeLookup).toBe(expectedMap);
    expect(mockBuildTravelTimeLookup).toHaveBeenCalledWith([
      { id: 'A_B', travel_time_minutes: 10 },
    ]);
  });

  it('travel_time_minutesが未定義の場合: 0にフォールバックされる', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'A_B', data: () => ({}) },
      ],
    });
    mockBuildTravelTimeLookup.mockReturnValue(new Map());

    const { result } = renderHook(() => useTravelTimes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockBuildTravelTimeLookup).toHaveBeenCalledWith([
      { id: 'A_B', travel_time_minutes: 0 },
    ]);
  });

  it('エラー時: error が設定され loading=false になる', async () => {
    mockGetDocs.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTravelTimes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error?.message).toBe('Network error');
  });
});
