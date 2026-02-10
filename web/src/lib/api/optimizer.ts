const API_URL = process.env.NEXT_PUBLIC_OPTIMIZER_API_URL ?? 'http://localhost:8081';

export interface OptimizeRequest {
  week_start_date: string; // YYYY-MM-DD
  dry_run?: boolean;
}

export interface OptimizeResponse {
  status: string;
  total_orders: number;
  assigned_count: number;
  solve_time_seconds: number;
  objective_value: number;
}

export interface OptimizeError {
  detail: string;
}

export async function runOptimize(request: OptimizeRequest): Promise<OptimizeResponse> {
  const res = await fetch(`${API_URL}/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
