import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReportPage from '../page';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/hooks/useMonthlyOrders', () => ({
  useMonthlyOrders: () => ({ orders: [], loading: false }),
}));

vi.mock('@/hooks/useHelpers', () => ({
  useHelpers: () => ({ helpers: new Map(), loading: false }),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: new Map(), loading: false }),
}));

vi.mock('@/hooks/useServiceTypes', () => ({
  useServiceTypes: () => ({ serviceTypes: new Map(), sortedList: [], loading: false, error: null }),
}));

vi.mock('@/hooks/useMonthlyReport', () => ({
  useMonthlyReport: () => ({
    staffSummary: [],
    customerSummary: [],
    statusSummary: { total: 0, assigned: 0, unassigned: 0, completed: 0 },
    serviceTypeSummary: [],
  }),
}));

vi.mock('@/components/layout/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

vi.mock('@/components/layout/AppBreadcrumb', () => ({
  AppBreadcrumb: () => <nav data-testid="breadcrumb">Breadcrumb</nav>,
}));

vi.mock('@/components/report/ExportButton', () => ({
  ExportButton: () => <button>エクスポート</button>,
}));

vi.mock('@/components/report/MonthSelector', () => ({
  MonthSelector: () => <div data-testid="month-selector">MonthSelector</div>,
}));

vi.mock('@/components/report/StaffSummaryTable', () => ({
  StaffSummaryTable: () => <div data-testid="staff-summary">StaffSummary</div>,
}));

vi.mock('@/components/report/CustomerSummaryTable', () => ({
  CustomerSummaryTable: () => <div data-testid="customer-summary">CustomerSummary</div>,
}));

vi.mock('@/components/report/StatusSummaryCard', () => ({
  StatusSummaryCard: () => <div data-testid="status-summary">StatusSummary</div>,
}));

vi.mock('@/components/report/ServiceTypeSummaryCard', () => ({
  ServiceTypeSummaryCard: () => <div data-testid="service-type-summary">ServiceTypeSummary</div>,
}));

// 時刻固定
beforeEach(() => {
  vi.setSystemTime(new Date('2025-01-15T10:00:00'));
});

// ── テスト ──────────────────────────────────────────────────────

describe('月次レポートページ', () => {
  it('エラーなくレンダリングされる', () => {
    render(<ReportPage />);
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('ページタイトルが表示される', () => {
    render(<ReportPage />);
    expect(screen.getByText('月次レポート')).toBeInTheDocument();
  });

  it('サマリーカードが表示される', () => {
    render(<ReportPage />);
    expect(screen.getByTestId('status-summary')).toBeInTheDocument();
    expect(screen.getByTestId('service-type-summary')).toBeInTheDocument();
  });

  it('スタッフ・利用者サマリーテーブルが表示される', () => {
    render(<ReportPage />);
    expect(screen.getByTestId('staff-summary')).toBeInTheDocument();
    expect(screen.getByTestId('customer-summary')).toBeInTheDocument();
  });
});
