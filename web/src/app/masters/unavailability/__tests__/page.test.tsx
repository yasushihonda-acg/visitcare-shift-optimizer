import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import UnavailabilityPage from '../page';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/hooks/useHelpers', () => ({
  useHelpers: () => ({ helpers: new Map(), loading: false }),
}));

vi.mock('@/hooks/useStaffUnavailability', () => ({
  useStaffUnavailability: () => ({ unavailability: [], loading: false }),
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuthRole: () => ({
    canEditUnavailability: false,
    isHelper: false,
    helperId: null,
  }),
}));

vi.mock('@/lib/api/optimizer', () => ({
  notifyUnavailabilityReminder: vi.fn(),
  OptimizeApiError: class extends Error {},
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

vi.mock('@/components/masters/UnavailabilityEditDialog', () => ({
  UnavailabilityEditDialog: () => null,
}));

vi.mock('@/components/unavailability/ChatReminderDialog', () => ({
  ChatReminderDialog: () => null,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span />,
  Pencil: () => <span />,
  Search: () => <span />,
  ChevronLeft: () => <span />,
  ChevronRight: () => <span />,
  Mail: () => <span />,
  MessageSquare: () => <span />,
  Loader2: () => <span />,
}));

// 時刻固定
beforeEach(() => {
  vi.setSystemTime(new Date('2025-01-08T10:00:00'));
});

// ── テスト ──────────────────────────────────────────────────────

describe('希望休管理ページ', () => {
  it('エラーなくレンダリングされる', () => {
    render(<UnavailabilityPage />);
    expect(screen.getByText('希望休管理')).toBeInTheDocument();
  });

  it('ページタイトルが表示される', () => {
    render(<UnavailabilityPage />);
    expect(screen.getByRole('heading', { name: '希望休管理' })).toBeInTheDocument();
  });

  it('検索入力フィールドが表示される', () => {
    render(<UnavailabilityPage />);
    expect(screen.getByPlaceholderText('スタッフ名で検索...')).toBeInTheDocument();
  });

  it('希望休が0件の場合に空メッセージが表示される', () => {
    render(<UnavailabilityPage />);
    expect(screen.getByText('この週の希望休はありません')).toBeInTheDocument();
  });

  it('テーブルヘッダーが表示される', () => {
    render(<UnavailabilityPage />);
    expect(screen.getByText('スタッフ')).toBeInTheDocument();
    expect(screen.getByText('不在内容')).toBeInTheDocument();
    expect(screen.getByText('備考')).toBeInTheDocument();
  });
});
