/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- API モック ---

const mockFetchRuns = vi.fn();
const mockFetchDetail = vi.fn();

vi.mock('@/lib/api/optimizer', () => ({
  fetchOptimizationRuns: (...args: unknown[]) => mockFetchRuns(...args),
  fetchOptimizationRunDetail: (...args: unknown[]) => mockFetchDetail(...args),
}));

import { useOptimizationRuns, useOptimizationRunDetail } from '../useOptimizationRuns';

describe('useOptimizationRuns', () => {
  beforeEach(() => {
    mockFetchRuns.mockReset();
  });

  it('初期状態で fetchOptimizationRuns が呼ばれる', async () => {
    mockFetchRuns.mockResolvedValue([]);
    const { result } = renderHook(() => useOptimizationRuns('2025-01-06'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchRuns).toHaveBeenCalledWith({
      week_start_date: '2025-01-06',
      limit: 50,
    });
  });

  it('取得成功: runsにデータが入る', async () => {
    const mockData = [{ id: 'run-1', status: 'completed' }];
    mockFetchRuns.mockResolvedValue(mockData);

    const { result } = renderHook(() => useOptimizationRuns());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.runs).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('取得失敗: errorが設定される', async () => {
    mockFetchRuns.mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() => useOptimizationRuns());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error?.message).toBe('API error');
    expect(result.current.runs).toEqual([]);
  });

  it('非Errorオブジェクトの場合もエラーとして扱われる', async () => {
    mockFetchRuns.mockRejectedValue('string error');

    const { result } = renderHook(() => useOptimizationRuns());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('string error');
  });

  it('refresh関数で再取得できる', async () => {
    mockFetchRuns.mockResolvedValue([]);

    const { result } = renderHook(() => useOptimizationRuns());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockFetchRuns.mockResolvedValue([{ id: 'run-2' }]);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.runs).toEqual([{ id: 'run-2' }]);
  });
});

describe('useOptimizationRunDetail', () => {
  beforeEach(() => {
    mockFetchDetail.mockReset();
  });

  it('runId=null: detail=null, loading=false', () => {
    const { result } = renderHook(() => useOptimizationRunDetail(null));
    expect(result.current.detail).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('runId指定時: 詳細が取得される', async () => {
    const mockDetail = { id: 'run-1', assignments: [] };
    mockFetchDetail.mockResolvedValue(mockDetail);

    const { result } = renderHook(() => useOptimizationRunDetail('run-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.detail).toEqual(mockDetail);
    expect(mockFetchDetail).toHaveBeenCalledWith('run-1');
  });

  it('取得失敗: errorが設定される', async () => {
    mockFetchDetail.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useOptimizationRunDetail('run-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error?.message).toBe('Not found');
  });
});
