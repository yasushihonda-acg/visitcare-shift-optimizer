import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import HelpPage from '../page';

// next/navigation モック
vi.mock('next/navigation', () => ({
  usePathname: () => '/help',
}));

// next/link モック
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

// IntersectionObserver モック
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
  mockObserve.mockClear();
  mockDisconnect.mockClear();
  vi.stubGlobal('IntersectionObserver', class {
    constructor() {}
    observe = mockObserve;
    disconnect = mockDisconnect;
    unobserve = vi.fn();
  });
});

describe('HelpPage', () => {
  it('タイトルが表示される', () => {
    render(<HelpPage />);
    expect(screen.getByText('VisitCare 使い方ガイド')).toBeInTheDocument();
  });

  it('全セクションの見出しが表示される', () => {
    render(<HelpPage />);
    const expectedTitles = [
      'スケジュール画面',
      'オーダー詳細',
      '手動編集（ドラッグ&ドロップ）',
      '最適化の実行',
      '利用者マスタ',
      'ヘルパーマスタ',
      '基本予定一覧',
      '希望休管理',
      '月次レポート',
      '通知設定',
      '権限について',
    ];
    for (const title of expectedTitles) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('目次にセクションリンクが生成される', () => {
    render(<HelpPage />);
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    const links = nav.querySelectorAll('a[href^="#"]');
    expect(links.length).toBe(11);
  });

  it('権限テーブルが表示される', () => {
    render(<HelpPage />);
    expect(screen.getByText('スケジュール閲覧')).toBeInTheDocument();
    expect(screen.getByText('ヘルパーマスタ編集')).toBeInTheDocument();
    expect(screen.getByText('希望休管理（自分のみ）')).toBeInTheDocument();
  });

  it('スクリーンショット画像が正しいalt属性を持つ', () => {
    render(<HelpPage />);
    const img = screen.getByAltText('スケジュール画面のスクリーンショット');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('/help/01-schedule-main.png');
  });

  it('「スケジュールに戻る」リンクが存在する', () => {
    render(<HelpPage />);
    const links = screen.getAllByText('スケジュールに戻る');
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0].closest('a')).toHaveAttribute('href', '/');
  });

  it('IntersectionObserverがセットアップされる', () => {
    render(<HelpPage />);
    expect(mockObserve).toHaveBeenCalled();
  });
});
