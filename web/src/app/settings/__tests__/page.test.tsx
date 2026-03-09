import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SettingsPage from '../page';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuthRole: () => ({ isAdmin: false }),
}));

vi.mock('@/hooks/useNotificationSettings', () => ({
  useNotificationSettings: () => ({ senderEmail: null, loading: false }),
}));

vi.mock('@/lib/firestore/settings', () => ({
  updateNotificationSettings: vi.fn(),
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

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('lucide-react', () => ({
  Mail: () => <span data-testid="mail-icon" />,
}));

// ── テスト ──────────────────────────────────────────────────────

describe('設定ページ', () => {
  it('エラーなくレンダリングされる', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('ページタイトルが表示される', () => {
    render(<SettingsPage />);
    expect(screen.getByText('設定')).toBeInTheDocument();
  });

  it('通知設定カードが表示される', () => {
    render(<SettingsPage />);
    expect(screen.getByText('通知設定')).toBeInTheDocument();
  });

  it('送信元メールアドレスラベルが表示される', () => {
    render(<SettingsPage />);
    expect(screen.getByText('送信元メールアドレス')).toBeInTheDocument();
  });

  it('管理者でない場合は読み取り専用で表示される', () => {
    render(<SettingsPage />);
    expect(screen.getByDisplayValue('未設定')).toBeInTheDocument();
  });
});
