import { getFirebaseAuth } from '@/lib/firebase';

const API_URL = process.env.NEXT_PUBLIC_OPTIMIZER_API_URL ?? 'http://localhost:8081';

const RETRY_DELAYS = [1000, 2000];

function isTransientError(error: unknown): boolean {
  if (error instanceof TypeError) return true; // Network error (CORS cold start, DNS, etc.)
  if (error instanceof OptimizeApiError) {
    return [429, 502, 503, 504].includes(error.statusCode);
  }
  return false;
}

async function fetchWithRetry(
  fn: () => Promise<Response>,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fn();
      if (res.ok) return res;
      if ([429, 502, 503, 504].includes(res.status) && attempt < RETRY_DELAYS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      if (isTransientError(error) && attempt < RETRY_DELAYS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export interface OptimizeRequest {
  week_start_date: string; // YYYY-MM-DD
  dry_run?: boolean;
  w_travel?: number;
  w_preferred_staff?: number;
  w_workload_balance?: number;
  w_continuity?: number;
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
  const res = await fetchWithRetry(() =>
    fetch(`${API_URL}/optimize`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    }),
  );

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
  parameters: {
    time_limit_seconds: number;
    w_travel: number;
    w_preferred_staff: number;
    w_workload_balance: number;
    w_continuity: number;
  };
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
  const res = await fetchWithRetry(() => fetch(url, { headers }));

  if (!res.ok) {
    const error: OptimizeError = await res.json();
    throw new OptimizeApiError(res.status, error.detail);
  }

  const data = await res.json();
  return data.runs;
}

export interface ResetAssignmentsResponse {
  orders_reset: number;
  week_start_date: string;
}

export async function resetAssignments(weekStartDate: string): Promise<ResetAssignmentsResponse> {
  const headers = await getAuthHeaders();
  const res = await fetchWithRetry(() =>
    fetch(`${API_URL}/reset-assignments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ week_start_date: weekStartDate }),
    }),
  );

  if (!res.ok) {
    const error: OptimizeError = await res.json();
    throw new OptimizeApiError(res.status, error.detail);
  }

  return res.json();
}

export async function fetchOptimizationRunDetail(
  runId: string
): Promise<OptimizationRunDetailResponse> {
  const headers = await getAuthHeaders();
  const res = await fetchWithRetry(() =>
    fetch(`${API_URL}/optimization-runs/${runId}`, { headers }),
  );

  if (!res.ok) {
    const error: OptimizeError = await res.json();
    throw new OptimizeApiError(res.status, error.detail);
  }

  return res.json();
}
