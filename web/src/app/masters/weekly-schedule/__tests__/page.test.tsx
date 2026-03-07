import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WeeklySchedulePage from '../page';
import type { Customer } from '@/types';

// ── モック ──────────────────────────────────────────────────────

const mockCustomers = new Map<string, Customer>();

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({
    customers: mockCustomers,
    loading: false,
  }),
}));

vi.mock('@/hooks/useHelpers', () => ({
  useHelpers: () => ({
    helpers: new Map(),
    loading: false,
  }),
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuthRole: () => ({ canEditCustomers: false }),
}));

vi.mock('@/hooks/useServiceTypes', () => ({
  useServiceTypes: () => ({
    serviceTypes: new Map([
      ['physical_care', { id: 'physical_care', code: 'physical_care', label: '身体介護', short_label: '身体', requires_physical_care_cert: true, sort_order: 1, created_at: new Date(), updated_at: new Date() }],
      ['daily_living', { id: 'daily_living', code: 'daily_living', label: '生活援助', short_label: '生活', requires_physical_care_cert: false, sort_order: 2, created_at: new Date(), updated_at: new Date() }],
    ]),
    sortedList: [],
    loading: false,
    error: null,
  }),
}));

// shadcn/ui コンポーネントのモック
vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <table {...props}>{children}</table>,
  TableBody: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <tbody {...props}>{children}</tbody>,
  TableCell: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <th {...props}>{children}</th>,
  TableHeader: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <thead {...props}>{children}</thead>,
  TableRow: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <tr {...props}>{children}</tr>,
}));

// Radix Sheet / Dialog はポータルを使うためモック
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="detail-sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

// CustomerDetailSheet / CustomerEditDialog は今回テスト対象外
vi.mock('@/components/masters/CustomerDetailSheet', () => ({
  CustomerDetailSheet: ({ open, customer }: { open: boolean; customer: unknown }) =>
    open ? <div data-testid="detail-sheet">{customer ? 'detail' : ''}</div> : null,
}));

vi.mock('@/components/masters/CustomerEditDialog', () => ({
  CustomerEditDialog: () => null,
}));

// lucide-react アイコン
vi.mock('lucide-react', () => ({
  Search: () => <span data-testid="search-icon" />,
}));

// ── ファクトリ ──────────────────────────────────────────────────

function makeCustomer(id: string, family: string, given: string, overrides: Partial<Customer> = {}): Customer {
  return {
    id,
    name: { family, given },
    address: '東京都千代田区1-1-1',
    location: { lat: 35.68, lng: 139.69 },
    ng_staff_ids: [],
    allowed_staff_ids: [],
    preferred_staff_ids: [],
    same_household_customer_ids: [],
    same_facility_customer_ids: [],
    weekly_services: {},
    service_manager: 'テスト',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ── テスト ──────────────────────────────────────────────────────

describe('基本予定一覧ページ', () => {
  beforeEach(() => {
    mockCustomers.clear();
  });

  it('ページタイトルが表示される', () => {
    render(<WeeklySchedulePage />);
    expect(screen.getByText('基本予定一覧')).toBeInTheDocument();
  });

  it('利用者がない場合「該当する利用者がいません」と表示される', () => {
    render(<WeeklySchedulePage />);
    expect(screen.getByText('該当する利用者がいません')).toBeInTheDocument();
  });

  it('利用者名がテーブルに表示される', () => {
    mockCustomers.set('c1', makeCustomer('c1', '山田', '太郎'));
    mockCustomers.set('c2', makeCustomer('c2', '佐藤', '花子'));

    render(<WeeklySchedulePage />);

    expect(screen.getByText('山田 太郎')).toBeInTheDocument();
    expect(screen.getByText('佐藤 花子')).toBeInTheDocument();
  });

  it('週間サービスのスロットが表示される', () => {
    mockCustomers.set('c1', makeCustomer('c1', '山田', '太郎', {
      weekly_services: {
        monday: [
          { start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 1 },
        ],
        wednesday: [
          { start_time: '14:00', end_time: '15:00', service_type: 'daily_living', staff_count: 1 },
        ],
      },
    }));

    render(<WeeklySchedulePage />);

    expect(screen.getByText('09:00–10:00')).toBeInTheDocument();
    expect(screen.getByText('14:00–15:00')).toBeInTheDocument();
    expect(screen.getByText('身体')).toBeInTheDocument();
    expect(screen.getByText('生活')).toBeInTheDocument();
  });

  it('合計スロット数が表示される', () => {
    mockCustomers.set('c1', makeCustomer('c1', '山田', '太郎', {
      weekly_services: {
        monday: [
          { start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 1 },
        ],
        tuesday: [
          { start_time: '10:00', end_time: '11:00', service_type: 'daily_living', staff_count: 1 },
        ],
        friday: [
          { start_time: '14:00', end_time: '15:00', service_type: 'physical_care', staff_count: 1 },
        ],
      },
    }));

    render(<WeeklySchedulePage />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('検索フィルタで名前の絞り込みができる', () => {
    mockCustomers.set('c1', makeCustomer('c1', '山田', '太郎'));
    mockCustomers.set('c2', makeCustomer('c2', '佐藤', '花子'));

    render(<WeeklySchedulePage />);

    const searchInput = screen.getByPlaceholderText('利用者名で検索...');
    fireEvent.change(searchInput, { target: { value: '山田' } });

    expect(screen.getByText('山田 太郎')).toBeInTheDocument();
    expect(screen.queryByText('佐藤 花子')).not.toBeInTheDocument();
  });

  it('検索結果が0件のとき「該当する利用者がいません」と表示される', () => {
    mockCustomers.set('c1', makeCustomer('c1', '山田', '太郎'));

    render(<WeeklySchedulePage />);

    const searchInput = screen.getByPlaceholderText('利用者名で検索...');
    fireEvent.change(searchInput, { target: { value: '存在しない' } });

    expect(screen.getByText('該当する利用者がいません')).toBeInTheDocument();
  });

  it('行クリックで詳細シートが開く', () => {
    mockCustomers.set('c1', makeCustomer('c1', '山田', '太郎'));

    render(<WeeklySchedulePage />);

    // 詳細シートは初期非表示
    expect(screen.queryByTestId('detail-sheet')).not.toBeInTheDocument();

    // 行をクリック
    fireEvent.click(screen.getByText('山田 太郎'));

    // 詳細シートが表示される
    expect(screen.getByTestId('detail-sheet')).toBeInTheDocument();
  });

  it('staff_count > 1 のとき人数バッジが表示される', () => {
    mockCustomers.set('c1', makeCustomer('c1', '山田', '太郎', {
      weekly_services: {
        monday: [
          { start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 2 },
        ],
      },
    }));

    render(<WeeklySchedulePage />);

    expect(screen.getByText('×2')).toBeInTheDocument();
  });
});
