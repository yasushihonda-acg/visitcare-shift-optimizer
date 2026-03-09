import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from '../Header';

// next/navigation モック
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// next/link モック
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

// AuthProvider モック
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    role: null,
    authMode: 'anonymous',
    signOut: vi.fn(),
  }),
}));

// WeekSelector モック
vi.mock('@/components/schedule/WeekSelector', () => ({
  WeekSelector: () => <div data-testid="week-selector" />,
}));

// Radix DropdownMenu モック — jsdom でポータルが動作しないため常時展開
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div role="menuitem" onClick={onClick}>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

describe('Header', () => {
  it('VisitCare ロゴが表示される', () => {
    render(<Header />);
    expect(screen.getByText('VisitCare')).toBeInTheDocument();
  });

  it('ヘッダーが bg-gradient-brand クラスを持つ', () => {
    render(<Header />);
    const header = screen.getByRole('banner');
    expect(header.className).toContain('bg-gradient-brand');
  });

  it('「使い方ガイド」リンクが表示される', () => {
    render(<Header />);
    const helpLink = screen.getByText('使い方ガイド');
    expect(helpLink).toBeInTheDocument();
    expect(helpLink.closest('a')).toHaveAttribute('href', '/help');
  });

  it('onShowWelcome が渡されると「クイックツアー」が表示される', () => {
    const onShowWelcome = vi.fn();
    render(<Header onShowWelcome={onShowWelcome} />);
    expect(screen.getByText('クイックツアー')).toBeInTheDocument();
  });

  it('onShowWelcome が未指定だと「クイックツアー」は表示されない', () => {
    render(<Header />);
    expect(screen.queryByText('クイックツアー')).not.toBeInTheDocument();
  });
});
