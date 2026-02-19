import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firebase authモック（optimizer.tsがimportするため先にモック）
vi.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: { getIdToken: () => Promise.resolve('mock-token') } }),
  getDb: () => ({}),
}));

import { runOptimize, fetchOptimizationRuns, exportReport, OptimizeApiError } from '../optimizer';

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

  it('ネットワークエラー時にリトライして成功', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
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

    const result = await runOptimize({ week_start_date: '2025-01-06' });
    expect(result.status).toBe('Optimal');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('503エラー時にリトライして成功', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'Optimal',
          total_orders: 10,
          assigned_count: 10,
          solve_time_seconds: 0.3,
          objective_value: 50,
          assignments: [],
          orders_updated: 0,
        }),
      });

    const result = await runOptimize({ week_start_date: '2025-01-06' });
    expect(result.status).toBe('Optimal');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('永続エラー(422)はリトライしない', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ detail: '日付が不正です' }),
    });

    await expect(runOptimize({ week_start_date: 'invalid' }))
      .rejects.toThrow(OptimizeApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('exportReport', () => {
  const mockExportResponse = {
    spreadsheet_id: 'ss-123',
    spreadsheet_url: 'https://docs.google.com/spreadsheets/d/ss-123',
    title: '月次レポート 2026年2月',
    year_month: '2026-02',
    sheets_created: 4,
    shared_with: null,
  };

  it('正常系: スプレッドシートURLが返る', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockExportResponse),
    });

    const result = await exportReport({ year_month: '2026-02' });
    expect(result.spreadsheet_id).toBe('ss-123');
    expect(result.sheets_created).toBe(4);
    expect(result.shared_with).toBeNull();
  });

  it('user_email付きリクエストが正しく送信される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ ...mockExportResponse, shared_with: 'manager@example.com' }),
    });

    const result = await exportReport({
      year_month: '2026-02',
      user_email: 'manager@example.com',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.user_email).toBe('manager@example.com');
    expect(result.shared_with).toBe('manager@example.com');
  });

  it('404: データなしエラー', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ detail: 'オーダーが見つかりません' }),
    });

    await expect(exportReport({ year_month: '2025-01' })).rejects.toThrow(OptimizeApiError);
  });

  it('500: スプレッドシート作成エラー', async () => {
    // 500はリトライ対象外なので即座にエラーになる
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: 'スプレッドシートの作成に失敗しました' }),
    });

    await expect(exportReport({ year_month: '2026-02' })).rejects.toThrow(OptimizeApiError);
  });

  it('POSTメソッドで /export-report へ送信', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockExportResponse),
    });

    await exportReport({ year_month: '2026-02' });
    expect(mockFetch.mock.calls[0][0]).toMatch('/export-report');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
  });
});

describe('fetchOptimizationRuns', () => {
  it('ネットワークエラー時にリトライして成功', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runs: [{ id: 'run-1', status: 'Optimal' }] }),
      });

    const result = await fetchOptimizationRuns({ week_start_date: '2025-01-06', limit: 1 });
    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
