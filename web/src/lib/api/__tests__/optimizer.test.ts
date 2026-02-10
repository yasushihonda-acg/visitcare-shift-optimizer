import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firebase authモック（optimizer.tsがimportするため先にモック）
vi.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: { getIdToken: () => Promise.resolve('mock-token') } }),
  getDb: () => ({}),
}));

import { runOptimize, OptimizeApiError } from '../optimizer';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('runOptimize', () => {
  it('正常系: 最適化成功', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        status: 'Optimal',
        total_orders: 30,
        assigned_count: 30,
        solve_time_seconds: 0.5,
        objective_value: 100,
        assignments: [{ order_id: 'ORD0001', staff_ids: ['H001'] }],
        orders_updated: 30,
      }),
    });

    const result = await runOptimize({ week_start_date: '2025-01-06' });
    expect(result.status).toBe('Optimal');
    expect(result.assigned_count).toBe(30);
    expect(result.assignments).toHaveLength(1);
    expect(result.orders_updated).toBe(30);
  });

  it('409: Infeasible', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ detail: 'Infeasible: 解が見つかりません' }),
    });

    await expect(runOptimize({ week_start_date: '2025-01-06' }))
      .rejects.toThrow(OptimizeApiError);
  });

  it('422: バリデーションエラー', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ detail: '日付が不正です' }),
    });

    await expect(runOptimize({ week_start_date: 'invalid' }))
      .rejects.toThrow(OptimizeApiError);
  });

  it('dry_runフラグを送信', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        status: 'Optimal',
        total_orders: 30,
        assigned_count: 30,
        solve_time_seconds: 0.5,
        objective_value: 100,
        assignments: [],
        orders_updated: 0,
      }),
    });

    await runOptimize({ week_start_date: '2025-01-06', dry_run: true });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.dry_run).toBe(true);
  });
});
