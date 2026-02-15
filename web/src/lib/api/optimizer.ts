import { getFirebaseAuth } from '@/lib/firebase';

const API_URL = process.env.NEXT_PUBLIC_OPTIMIZER_API_URL ?? 'http://localhost:8081';

export interface OptimizeRequest {
  week_start_date: string; // YYYY-MM-DD
  dry_run?: boolean;
}

export interface AssignmentResult {
  order_id: string;
  staff_ids: string[];
}

export interface OptimizeResponse {
  status: string;
  total_orders: number;
  assigned_count: number;
  solve_time_seconds: number;
  objective_value: number;
  assignments: AssignmentResult[];
  orders_updated: number;
}

export interface OptimizeError {
  detail: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const user = getFirebaseAuth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function runOptimize(request: OptimizeRequest): Promise<OptimizeResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/optimize`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const error: OptimizeError = await res.json();
    throw new OptimizeApiError(res.status, error.detail);
  }

  return res.json();
}

export class OptimizeApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'OptimizeApiError';
  }
}

export interface OptimizationRunSummaryResponse {
  id: string;
  week_start_date: string;
  executed_at: string;
  executed_by: string;
  dry_run: boolean;
  status: string;
  objective_value: number;
  solve_time_seconds: number;
  total_orders: number;
  assigned_count: number;
  parameters: { time_limit_seconds: number };
}

export interface OptimizationRunDetailResponse extends OptimizationRunSummaryResponse {
  assignments: Array<{ order_id: string; staff_ids: string[] }>;
}

export async function fetchOptimizationRuns(params?: {
  week_start_date?: string;
  limit?: number;
}): Promise<OptimizationRunSummaryResponse[]> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();
  if (params?.week_start_date) searchParams.set('week_start_date', params.week_start_date);
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  const url = `${API_URL}/optimization-runs${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const error: OptimizeError = await res.json();
    throw new OptimizeApiError(res.status, error.detail);
  }

  const data = await res.json();
  return data.runs;
}

export async function fetchOptimizationRunDetail(
  runId: string
): Promise<OptimizationRunDetailResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/optimization-runs/${runId}`, { headers });

  if (!res.ok) {
    const error: OptimizeError = await res.json();
    throw new OptimizeApiError(res.status, error.detail);
  }

  return res.json();
}
