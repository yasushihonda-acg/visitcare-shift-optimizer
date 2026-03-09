import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ServiceTypesPage from '../page';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/hooks/useServiceTypes', () => ({
  useServiceTypes: () => ({ serviceTypes: new Map(), sortedList: [], loading: false, error: null }),
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuthRole: () => ({ canEditHelpers: false }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
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

vi.mock('@/components/masters/ServiceTypeEditDialog', () => ({
  ServiceTypeEditDialog: () => null,
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span />,
  Pencil: () => <span />,
}));

// ── テスト ──────────────────────────────────────────────────────

describe('サービス種別マスタページ', () => {
  it('エラーなくレンダリングされる', () => {
    render(<ServiceTypesPage />);
    expect(screen.getByText('サービス種別マスタ')).toBeInTheDocument();
  });

  it('ページタイトルが表示される', () => {
    render(<ServiceTypesPage />);
    expect(screen.getByRole('heading', { name: 'サービス種別マスタ' })).toBeInTheDocument();
  });

  it('テーブルヘッダーが表示される', () => {
    render(<ServiceTypesPage />);
    expect(screen.getByText('コード')).toBeInTheDocument();
    expect(screen.getByText('表示名')).toBeInTheDocument();
    expect(screen.getByText('短縮名')).toBeInTheDocument();
  });

  it('サービス種別が0件の場合に空メッセージが表示される', () => {
    render(<ServiceTypesPage />);
    expect(screen.getByText('サービス種別が登録されていません')).toBeInTheDocument();
  });
});
