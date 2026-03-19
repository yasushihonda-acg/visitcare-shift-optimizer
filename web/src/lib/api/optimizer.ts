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

export interface ExportReportRequest {
  year_month: string; // YYYY-MM
  user_email?: string;
}

export interface ExportReportResponse {
  spreadsheet_id: string;
  spreadsheet_url: string;
  title: string;
  year_month: string;
  sheets_created: number;
  shared_with: string | null;
}

export async function exportReport(request: ExportReportRequest): Promise<ExportReportResponse> {
  const headers = await getAuthHeaders();
  const res = await fetchWithRetry(() =>
    fetch(`${API_URL}/export-report`, {
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

// ---------------------------------------------------------------------------
// Google Chat DM 催促
// ---------------------------------------------------------------------------

export interface ChatReminderTarget {
  staff_id: string;
  name: string;
  email: string;
}

export interface ChatReminderResultItem {
  staff_id: string;
  email: string;
  success: boolean;
}

export interface ChatReminderResponse {
  messages_sent: number;
  total_targets: number;
  results: ChatReminderResultItem[];
}

export async function sendChatReminder(params: {
  target_week_start: string;
  targets: ChatReminderTarget[];
  message?: string;
}): Promise<ChatReminderResponse> {
  const headers = await getAuthHeaders();
  const res = await fetchWithRetry(() =>
    fetch(`${API_URL}/notify/chat-reminder`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    }),
  );
  if (!res.ok) {
    const error: OptimizeError = await res.json();
    throw new OptimizeApiError(res.status, error.detail);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// CURAノート インポート
// ---------------------------------------------------------------------------

export interface NoteImportTimeRange {
  start: string;
  end: string | null;
}

export interface NoteImportMatchedOrder {
  order_id: string;
  customer_id: string;
  customer_name: string;
  date: string;
  start_time: string;
  end_time: string;
  service_type: string;
  status: string;
}

export type NoteActionType = 'cancel' | 'update_time' | 'add_visit' | 'add_meeting' | 'add' | 'staff_unavailability' | 'unknown';
export type ImportActionStatus = 'ready' | 'needs_review' | 'unmatched' | 'skipped';

export interface NoteImportAction {
  post_id: string;
  action_type: NoteActionType;
  status: ImportActionStatus;
  customer_name: string | null;
  matched_customer_id: string | null;
  matched_order: NoteImportMatchedOrder | null;
  description: string;
  raw_content: string;
  date_from: string;
  date_to: string;
  time_range: NoteImportTimeRange | null;
  new_time_range: NoteImportTimeRange | null;
  confidence: number;
}

export interface NoteImportPreviewResponse {
  spreadsheet_id: string;
  total_notes: number;
  actions: NoteImportAction[];
  ready_count: number;
  review_count: number;
  unmatched_count: number;
  skipped_count: number;
}

export interface NoteImportApplyResponse {
  applied_count: number;
  marked_count: number;
  total_requested: number;
}

export async function importNotesPreview(
  spreadsheetId: string,
): Promise<NoteImportPreviewResponse> {
  const headers = await getAuthHeaders();
  const res = await fetchWithRetry(() =>
    fetch(`${API_URL}/import/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ spreadsheet_id: spreadsheetId }),
    }),
  );
  if (!res.ok) {
    const error: OptimizeError = await res.json();
    throw new OptimizeApiError(res.status, error.detail);
  }
  return res.json();
}

export async function importNotesApply(params: {
  spreadsheet_id: string;
  post_ids: string[];
  mark_as_handled?: boolean;
}): Promise<NoteImportApplyResponse> {
  const headers = await getAuthHeaders();
  const res = await fetchWithRetry(() =>
    fetch(`${API_URL}/import/notes/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    }),
  );
  if (!res.ok) {
    const error: OptimizeError = await res.json();
    throw new OptimizeApiError(res.status, error.detail);
  }
  return res.json();
}
