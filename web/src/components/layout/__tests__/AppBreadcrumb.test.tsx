import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppBreadcrumb } from '../AppBreadcrumb';

// next/navigation モック
const mockUsePathname = vi.fn<() => string | null>();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

// next/link モック（children をそのまま <a> として描画）
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('AppBreadcrumb', () => {
  // --- 非表示パターン ---

  it('マップにないパス（/）では何も表示しない', () => {
    mockUsePathname.mockReturnValue('/');
    const { container } = render(<AppBreadcrumb />);
    expect(container.innerHTML).toBe('');
  });

  it('pathname が null の場合は何も表示しない', () => {
    mockUsePathname.mockReturnValue(null);
    const { container } = render(<AppBreadcrumb />);
    expect(container.innerHTML).toBe('');
  });

  // --- マスタ管理ページ（groupHref あり） ---

  it('/masters/customers でホーム・マスタ管理（リンク）・利用者を表示する', () => {
    mockUsePathname.mockReturnValue('/masters/customers');
    render(<AppBreadcrumb />);

    const homeLink = screen.getByRole('link', { name: 'ホーム' });
    expect(homeLink).toHaveAttribute('href', '/');

    const groupLink = screen.getByRole('link', { name: 'マスタ管理' });
    expect(groupLink).toHaveAttribute('href', '/masters/customers');

    expect(screen.getByText('利用者')).toBeInTheDocument();
  });

  it('/masters/helpers でヘルパーラベルを表示する', () => {
    mockUsePathname.mockReturnValue('/masters/helpers');
    render(<AppBreadcrumb />);
    expect(screen.getByText('ヘルパー')).toBeInTheDocument();
  });

  it('/masters/service-types でサービス種別ラベルを表示する', () => {
    mockUsePathname.mockReturnValue('/masters/service-types');
    render(<AppBreadcrumb />);
    expect(screen.getByText('サービス種別')).toBeInTheDocument();
  });

  it('/masters/weekly-schedule で基本予定ラベルを表示する', () => {
    mockUsePathname.mockReturnValue('/masters/weekly-schedule');
    render(<AppBreadcrumb />);
    expect(screen.getByText('基本予定')).toBeInTheDocument();
  });

  it('/masters/unavailability で希望休ラベルを表示する', () => {
    mockUsePathname.mockReturnValue('/masters/unavailability');
    render(<AppBreadcrumb />);
    expect(screen.getByText('希望休')).toBeInTheDocument();
  });

  // --- 運用ページ（groupHref なし → グループはテキストのみ） ---

  it('/history でグループ「運用」をテキスト表示し、実行履歴を表示する', () => {
    mockUsePathname.mockReturnValue('/history');
    render(<AppBreadcrumb />);

    // グループはリンクではなくテキスト
    expect(screen.getByText('運用')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '運用' })).not.toBeInTheDocument();

    expect(screen.getByText('実行履歴')).toBeInTheDocument();
  });

  it('/report で月次レポートを表示する', () => {
    mockUsePathname.mockReturnValue('/report');
    render(<AppBreadcrumb />);
    expect(screen.getByText('月次レポート')).toBeInTheDocument();
  });

  it('/settings で通知設定を表示する', () => {
    mockUsePathname.mockReturnValue('/settings');
    render(<AppBreadcrumb />);
    expect(screen.getByText('設定')).toBeInTheDocument();
    expect(screen.getByText('通知設定')).toBeInTheDocument();
  });

  // --- trailingSlash 正規化 ---

  it('/history/ （末尾スラッシュ）でも正しく表示される', () => {
    mockUsePathname.mockReturnValue('/history/');
    render(<AppBreadcrumb />);
    expect(screen.getByText('実行履歴')).toBeInTheDocument();
  });

  it('/masters/customers/ （末尾スラッシュ）でも正しく表示される', () => {
    mockUsePathname.mockReturnValue('/masters/customers/');
    render(<AppBreadcrumb />);
    expect(screen.getByText('利用者')).toBeInTheDocument();
  });
});
