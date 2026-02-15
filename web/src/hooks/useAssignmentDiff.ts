'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  fetchOptimizationRuns,
  fetchOptimizationRunDetail,
} from '@/lib/api/optimizer';
import type { Order } from '@/types';

export interface AssignmentDiff {
  added: string[];
  removed: string[];
  isChanged: boolean;
}

export function useAssignmentDiff(
  weekStart: Date,
  orders: Order[]
) {
  const [diffMap, setDiffMap] = useState<Map<string, AssignmentDiff>>(new Map());
  const [loading, setLoading] = useState(false);

  const computeDiff = useCallback(async () => {
    const weekStartDate = format(weekStart, 'yyyy-MM-dd');
    setLoading(true);
    try {
      const runs = await fetchOptimizationRuns({
        week_start_date: weekStartDate,
        limit: 1,
      });
      if (runs.length === 0) {
        setDiffMap(new Map());
        return;
      }

      const detail = await fetchOptimizationRunDetail(runs[0].id);
      const optimizedMap = new Map<string, string[]>();
      for (const a of detail.assignments) {
        optimizedMap.set(a.order_id, a.staff_ids);
      }

      const newDiffMap = new Map<string, AssignmentDiff>();
      for (const order of orders) {
        const optimized = optimizedMap.get(order.id);
        if (!optimized) continue;

        const currentSet = new Set(order.assigned_staff_ids);
        const optimizedSet = new Set(optimized);

        const added = order.assigned_staff_ids.filter((id) => !optimizedSet.has(id));
        const removed = optimized.filter((id) => !currentSet.has(id));

        if (added.length > 0 || removed.length > 0) {
          newDiffMap.set(order.id, { added, removed, isChanged: true });
        }
      }

      setDiffMap(newDiffMap);
    } catch (e) {
      console.error('Failed to compute assignment diff:', e);
      setDiffMap(new Map());
    } finally {
      setLoading(false);
    }
  }, [weekStart, orders]);

  useEffect(() => {
    computeDiff();
  }, [computeDiff]);

  return { diffMap, loading };
}
