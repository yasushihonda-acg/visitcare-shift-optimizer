/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- API モック ---

const mockFetchRuns = vi.fn();
const mockFetchDetail = vi.fn();

vi.mock('@/lib/api/optimizer', () => ({
  fetchOptimizationRuns: (...args: unknown[]) => mockFetchRuns(...args),
  fetchOptimizationRunDetail: (...args: unknown[]) => mockFetchDetail(...args),
}));

import { useAssignmentDiff } from '../useAssignmentDiff';
import type { Order } from '@/types';

function makeOrder(id: string, staffIds: string[]): Order {
  return { id, assigned_staff_ids: staffIds } as Order;
}

describe('useAssignmentDiff', () => {
  const weekStart = new Date('2025-01-06');

  beforeEach(() => {
    mockFetchRuns.mockReset();
    mockFetchDetail.mockReset();
  });

  it('最適化ランが無い場合: diffMap=空Map', async () => {
    mockFetchRuns.mockResolvedValue([]);

    const { result } = renderHook(() => useAssignmentDiff(weekStart, []));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.diffMap.size).toBe(0);
  });

  it('割当に差分がある場合: addedとremovedが計算される', async () => {
    mockFetchRuns.mockResolvedValue([{ id: 'run-1' }]);
    mockFetchDetail.mockResolvedValue({
      assignments: [
        { order_id: 'O001', staff_ids: ['H001', 'H002'] },
      ],
    });

    const orders = [makeOrder('O001', ['H001', 'H003'])];

    const { result } = renderHook(() => useAssignmentDiff(weekStart, orders));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const diff = result.current.diffMap.get('O001');
    expect(diff).toBeDefined();
    // H003 は最適化結果に無い → added (現在にのみ存在)
    expect(diff?.added).toEqual(['H003']);
    // H002 は最適化結果にのみ存在 → removed (現在から消えている)
    expect(diff?.removed).toEqual(['H002']);
    expect(diff?.isChanged).toBe(true);
  });

  it('割当に差分が無い場合: diffMapに含まれない', async () => {
    mockFetchRuns.mockResolvedValue([{ id: 'run-1' }]);
    mockFetchDetail.mockResolvedValue({
      assignments: [
        { order_id: 'O001', staff_ids: ['H001'] },
      ],
    });

    const orders = [makeOrder('O001', ['H001'])];

    const { result } = renderHook(() => useAssignmentDiff(weekStart, orders));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.diffMap.has('O001')).toBe(false);
  });

  it('API失敗時: diffMap=空Map（エラーは握りつぶされる）', async () => {
    mockFetchRuns.mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() => useAssignmentDiff(weekStart, []));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.diffMap.size).toBe(0);
  });
});
