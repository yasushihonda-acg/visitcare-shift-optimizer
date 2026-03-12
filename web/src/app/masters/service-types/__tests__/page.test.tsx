import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ServiceTypesPage from '../page';
import type { ServiceTypeDoc } from '@/types';

// ── テストデータ ──────────────────────────────────────────────────

function makeServiceType(overrides: Partial<ServiceTypeDoc> & { code: string; category: string }): ServiceTypeDoc {
  return {
    id: overrides.code,
    label: overrides.code,
    short_label: overrides.code,
    duration: '',
    care_level: '',
    units: 0,
    requires_physical_care_cert: false,
    sort_order: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const MULTI_CATEGORY_LIST: ServiceTypeDoc[] = [
  makeServiceType({ code: '身体介護1・Ⅱ', category: '訪問介護', sort_order: 1, requires_physical_care_cert: true }),
  makeServiceType({ code: '生活援助２・Ⅱ', category: '訪問介護', sort_order: 2 }),
  makeServiceType({ code: '通所介護Ⅰ11', category: '通所介護Ⅰ', sort_order: 3 }),
  makeServiceType({ code: '地域密着型11', category: '地域密着型', sort_order: 4 }),
];

// ── モック ──────────────────────────────────────────────────────

let mockSortedList: ServiceTypeDoc[] = [];

vi.mock('@/hooks/useServiceTypes', () => ({
  useServiceTypes: () => ({ serviceTypes: new Map(), sortedList: mockSortedList, loading: false, error: null }),
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuthRole: () => ({ canEditHelpers: false }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
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
  beforeEach(() => {
    mockSortedList = [];
  });

  it('エラーなくレンダリングされる', () => {
    render(<ServiceTypesPage />);
    expect(screen.getByText('サービス種別マスタ')).toBeInTheDocument();
  });

  it('ページタイトルが表示される', () => {
    render(<ServiceTypesPage />);
    expect(screen.getByRole('heading', { name: 'サービス種別マスタ' })).toBeInTheDocument();
  });

  it('テーブルヘッダーにカテゴリ列が表示される', () => {
    render(<ServiceTypesPage />);
    expect(screen.getByText('カテゴリ')).toBeInTheDocument();
    expect(screen.getByText('コード')).toBeInTheDocument();
    expect(screen.getByText('表示名')).toBeInTheDocument();
    expect(screen.getByText('短縮名')).toBeInTheDocument();
  });

  it('サービス種別が0件の場合に空メッセージが表示される', () => {
    render(<ServiceTypesPage />);
    expect(screen.getByText('サービス種別が登録されていません')).toBeInTheDocument();
  });
});

describe('カテゴリフィルタ', () => {
  beforeEach(() => {
    mockSortedList = MULTI_CATEGORY_LIST;
  });

  it('複数カテゴリがある場合にフィルタボタンが表示される', () => {
    render(<ServiceTypesPage />);
    expect(screen.getByRole('group', { name: 'カテゴリフィルタ' })).toBeInTheDocument();
    // フィルタボタンとテーブルBadge両方にカテゴリ名が出るのでgetAllByTextで確認
    expect(screen.getAllByText('訪問介護').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('通所介護Ⅰ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('地域密着型').length).toBeGreaterThanOrEqual(1);
  });

  it('カテゴリが1種類のみの場合はフィルタが表示されない', () => {
    mockSortedList = [
      makeServiceType({ code: '身体介護1・Ⅱ', category: '訪問介護', sort_order: 1 }),
    ];
    render(<ServiceTypesPage />);
    expect(screen.queryByRole('group', { name: 'カテゴリフィルタ' })).not.toBeInTheDocument();
  });

  it('初期状態では全件表示される', () => {
    render(<ServiceTypesPage />);
    expect(screen.getByText('全4件')).toBeInTheDocument();
  });

  it('カテゴリクリックでフィルタリングされる', () => {
    render(<ServiceTypesPage />);

    const filterGroup = screen.getByRole('group', { name: 'カテゴリフィルタ' });
    fireEvent.click(within(filterGroup).getByRole('button', { name: /訪問介護/ }));

    expect(screen.getByText('全4件（表示: 2件）')).toBeInTheDocument();
    expect(screen.getAllByText('身体介護1・Ⅱ').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('通所介護Ⅰ11')).not.toBeInTheDocument();
  });

  it('複数カテゴリを同時選択できる', () => {
    render(<ServiceTypesPage />);

    const filterGroup = screen.getByRole('group', { name: 'カテゴリフィルタ' });
    fireEvent.click(within(filterGroup).getByRole('button', { name: /訪問介護/ }));
    fireEvent.click(within(filterGroup).getByRole('button', { name: /地域密着型/ }));

    expect(screen.getByText('全4件（表示: 3件）')).toBeInTheDocument();
  });

  it('選択済みカテゴリの再クリックで解除される', () => {
    render(<ServiceTypesPage />);

    const filterGroup = screen.getByRole('group', { name: 'カテゴリフィルタ' });
    const btn = within(filterGroup).getByRole('button', { name: /訪問介護/ });

    fireEvent.click(btn); // 選択
    expect(screen.getByText('全4件（表示: 2件）')).toBeInTheDocument();

    fireEvent.click(btn); // 解除
    expect(screen.getByText('全4件')).toBeInTheDocument();
  });

  it('クリアボタンで全選択解除される', () => {
    render(<ServiceTypesPage />);

    const filterGroup = screen.getByRole('group', { name: 'カテゴリフィルタ' });
    fireEvent.click(within(filterGroup).getByRole('button', { name: /訪問介護/ }));

    const clearButton = screen.getByText('クリア');
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(screen.getByText('全4件')).toBeInTheDocument();
    expect(screen.queryByText('クリア')).not.toBeInTheDocument();
  });
});
