'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchOptimizationRuns,
  fetchOptimizationRunDetail,
  type OptimizationRunSummaryResponse,
  type OptimizationRunDetailResponse,
} from '@/lib/api/optimizer';

export function useOptimizationRuns(weekStartDate?: string) {
  const [runs, setRuns] = useState<OptimizationRunSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOptimizationRuns({
        week_start_date: weekStartDate,
        limit: 50,
      });
      setRuns(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [weekStartDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { runs, loading, error, refresh };
}

export function useOptimizationRunDetail(runId: string | null) {
  const [detail, setDetail] = useState<OptimizationRunDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!runId) {
      setDetail(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetchOptimizationRunDetail(runId)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err : new Error(String(err))))
      .finally(() => setLoading(false));
  }, [runId]);

  return { detail, loading, error };
}
