import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CustomersPage from '../page';

// ── モック ──────────────────────────────────────────────────────

const mockCustomers = new Map();

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: mockCustomers, loading: false }),
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
  beforeEach(() => {
    mockCustomers.clear();
  });

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
    expect(screen.getByText('NG/推奨/入れる')).toBeInTheDocument();
  });

  it('allowed_staff_idsを持つ利用者に「入れる」バッジが表示される', () => {
    mockCustomers.set('C010', {
      id: 'C010',
      name: { family: '吉田', given: '勝', family_kana: 'よしだ', given_kana: 'かつ' },
      address: '鹿児島市天文館町15-7',
      service_manager: '鈴木裕子',
      weekly_services: {},
      ng_staff_ids: [],
      preferred_staff_ids: ['H001', 'H009'],
      allowed_staff_ids: ['H001', 'H009'],
      same_household_customer_ids: [],
      same_facility_customer_ids: [],
    });
    render(<CustomersPage />);
    // preferred が全て allowed に含まれるため「推奨」バッジは表示されない
    expect(screen.queryByText('推奨 2')).not.toBeInTheDocument();
    expect(screen.getByText('入れる 2')).toBeInTheDocument();
  });

  it('preferred が allowed と重複しない場合のみ「推奨」バッジが表示される', () => {
    mockCustomers.set('C020', {
      id: 'C020',
      name: { family: '山田', given: '太郎', family_kana: 'やまだ', given_kana: 'たろう' },
      address: '鹿児島市中央町1-1',
      service_manager: '鈴木裕子',
      weekly_services: {},
      ng_staff_ids: ['H003'],
      preferred_staff_ids: ['H001', 'H002', 'H009'],
      allowed_staff_ids: ['H009'],
      same_household_customer_ids: [],
      same_facility_customer_ids: [],
    });
    render(<CustomersPage />);
    expect(screen.getByText('NG 1')).toBeInTheDocument();
    // H001, H002 は allowed に含まれないので推奨バッジに表示
    expect(screen.getByText('推奨 2')).toBeInTheDocument();
    expect(screen.getByText('入れる 1')).toBeInTheDocument();
  });
});
