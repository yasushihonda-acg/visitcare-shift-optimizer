import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HistoryPage from '../page';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/hooks/useOptimizationRuns', () => ({
  useOptimizationRuns: () => ({ runs: [], loading: false, error: null }),
  useOptimizationRunDetail: () => ({ detail: null, loading: false }),
}));

vi.mock('@/hooks/useHelpers', () => ({
  useHelpers: () => ({ helpers: new Map(), loading: false }),
}));

vi.mock('@/components/layout/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

vi.mock('@/components/layout/AppBreadcrumb', () => ({
  AppBreadcrumb: () => <nav data-testid="breadcrumb">Breadcrumb</nav>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <table {...props}>{children}</table>,
  TableBody: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <tbody {...props}>{children}</tbody>,
  TableCell: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <th {...props}>{children}</th>,
  TableHeader: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <thead {...props}>{children}</thead>,
  TableRow: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <tr {...props}>{children}</tr>,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('lucide-react', () => ({
  Clock: () => <span data-testid="clock-icon" />,
  CheckCircle2: () => <span />,
  XCircle: () => <span />,
  AlertTriangle: () => <span />,
  FlaskConical: () => <span />,
  Loader2: () => <span />,
}));

// ── テスト ──────────────────────────────────────────────────────

describe('最適化実行履歴ページ', () => {
  it('エラーなくレンダリングされる', () => {
    render(<HistoryPage />);
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('ページタイトルが表示される', () => {
    render(<HistoryPage />);
    expect(screen.getByText('最適化実行履歴')).toBeInTheDocument();
  });

  it('履歴が空の場合に空メッセージが表示される', () => {
    render(<HistoryPage />);
    expect(screen.getByText('最適化の実行履歴はまだありません')).toBeInTheDocument();
  });
});
