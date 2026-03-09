import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CustomersPage from '../page';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: new Map(), loading: false }),
}));

vi.mock('@/hooks/useHelpers', () => ({
  useHelpers: () => ({ helpers: new Map(), loading: false }),
}));

vi.mock('@/hooks/useServiceTypes', () => ({
  useServiceTypes: () => ({ serviceTypes: new Map(), sortedList: [], loading: false, error: null }),
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuthRole: () => ({ canEditCustomers: false }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <table {...props}>{children}</table>,
  TableBody: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <tbody {...props}>{children}</tbody>,
  TableCell: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <th {...props}>{children}</th>,
  TableHeader: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <thead {...props}>{children}</thead>,
  TableRow: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <tr {...props}>{children}</tr>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/masters/CustomerEditDialog', () => ({
  CustomerEditDialog: () => null,
}));

vi.mock('@/components/masters/CustomerDetailSheet', () => ({
  CustomerDetailSheet: () => null,
}));

vi.mock('@/components/masters/customerDetailViewModel', () => ({
  useCustomerDetailViewModel: () => null,
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span />,
  Pencil: () => <span />,
  Search: () => <span />,
  ChevronUp: () => <span />,
  ChevronDown: () => <span />,
  ChevronsUpDown: () => <span />,
}));

// ── テスト ──────────────────────────────────────────────────────

describe('利用者マスタページ', () => {
  it('エラーなくレンダリングされる', () => {
    render(<CustomersPage />);
    expect(screen.getByText('利用者マスタ')).toBeInTheDocument();
  });

  it('ページタイトルが表示される', () => {
    render(<CustomersPage />);
    expect(screen.getByRole('heading', { name: '利用者マスタ' })).toBeInTheDocument();
  });

  it('検索入力フィールドが表示される', () => {
    render(<CustomersPage />);
    expect(screen.getByPlaceholderText('あおぞらID・名前・ふりがな・住所・ケアマネで検索...')).toBeInTheDocument();
  });

  it('利用者が0件の場合に空メッセージが表示される', () => {
    render(<CustomersPage />);
    expect(screen.getByText('利用者が登録されていません')).toBeInTheDocument();
  });

  it('テーブルヘッダーが表示される', () => {
    render(<CustomersPage />);
    expect(screen.getByText('氏名')).toBeInTheDocument();
    expect(screen.getByText('住所')).toBeInTheDocument();
    expect(screen.getByText('サ責')).toBeInTheDocument();
  });
});
