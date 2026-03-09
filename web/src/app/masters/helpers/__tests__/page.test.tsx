import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HelpersPage from '../page';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/hooks/useHelpers', () => ({
  useHelpers: () => ({ helpers: new Map(), loading: false }),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: new Map(), loading: false }),
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuthRole: () => ({ canEditHelpers: false }),
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

vi.mock('@/components/masters/HelperEditDialog', () => ({
  HelperEditDialog: () => null,
}));

vi.mock('@/components/masters/HelperDetailSheet', () => ({
  HelperDetailSheet: () => null,
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span />,
  Pencil: () => <span />,
  Search: () => <span />,
}));

// ── テスト ──────────────────────────────────────────────────────

describe('ヘルパーマスタページ', () => {
  it('エラーなくレンダリングされる', () => {
    render(<HelpersPage />);
    expect(screen.getByText('ヘルパーマスタ')).toBeInTheDocument();
  });

  it('ページタイトルが表示される', () => {
    render(<HelpersPage />);
    expect(screen.getByRole('heading', { name: 'ヘルパーマスタ' })).toBeInTheDocument();
  });

  it('検索入力フィールドが表示される', () => {
    render(<HelpersPage />);
    expect(screen.getByPlaceholderText('名前・資格で検索...')).toBeInTheDocument();
  });

  it('ヘルパーが0件の場合に空メッセージが表示される', () => {
    render(<HelpersPage />);
    expect(screen.getByText('ヘルパーが登録されていません')).toBeInTheDocument();
  });

  it('テーブルヘッダーが表示される', () => {
    render(<HelpersPage />);
    expect(screen.getByText('氏名')).toBeInTheDocument();
    expect(screen.getByText('資格')).toBeInTheDocument();
    expect(screen.getByText('雇用形態')).toBeInTheDocument();
  });
});
