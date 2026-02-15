import { Timestamp } from 'firebase-admin/firestore';

/** 最適化実行ステータス */
export type OptimizationStatus = 'Optimal' | 'Feasible' | 'Infeasible' | 'Not Solved';

/** 割当結果（1オーダー） */
export interface AssignmentRecord {
  order_id: string;
  staff_ids: string[];
}

/** 最適化実行パラメータ */
export interface OptimizationParameters {
  time_limit_seconds: number;
}

/** 最適化実行記録 */
export interface OptimizationRun {
  id: string;
  week_start_date: Timestamp;
  executed_at: Timestamp;
  executed_by: string;
  dry_run: boolean;
  status: OptimizationStatus;
  objective_value: number;
  solve_time_seconds: number;
  total_orders: number;
  assigned_count: number;
  assignments: AssignmentRecord[];
  parameters: OptimizationParameters;
}
