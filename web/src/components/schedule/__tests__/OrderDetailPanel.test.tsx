import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderDetailPanel } from '../OrderDetailPanel';
import type { Order, Customer, Helper } from '@/types';
import type { Violation } from '@/lib/constraints/checker';

// useServiceTypes は Firebase 接続が必要なためモック
vi.mock('@/hooks/useServiceTypes', () => ({
  useServiceTypes: () => ({
    serviceTypes: new Map([
      ['physical_care', { id: 'physical_care', label: '身体介護' }],
      ['daily_living', { id: 'daily_living', label: '生活援助' }],
    ]),
    sortedList: [],
    loading: false,
    error: null,
  }),
}));

// updateOrderStatus をモック
vi.mock('@/lib/firestore/updateOrder', () => ({
  updateOrderStatus: vi.fn(),
  isOrderStatus: (v: string) => ['pending', 'assigned', 'completed', 'cancelled'].includes(v),
}));

// Radix Sheet uses portal — mock to render inline
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
    <div {...props}>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

// Select をモック（Radix ポータル対策）
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
    <button {...props}>{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) =>
    <option value={value}>{children}</option>,
}));

// StaffMultiSelect をモック
vi.mock('@/components/masters/StaffMultiSelect', () => ({
  StaffMultiSelect: () => <div data-testid="staff-multi-select">StaffMultiSelect</div>,
}));

// AssignmentDiffBadge をモック
vi.mock('@/components/schedule/AssignmentDiffBadge', () => ({
  AssignmentDiffBadge: () => <span data-testid="assignment-diff-badge">手動変更</span>,
}));

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    week_start_date: new Date('2026-02-09'),
    date: new Date('2026-02-09'),
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    assigned_staff_ids: [],
    status: 'pending',
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeHelper(id: string, family: string, given: string, canPhysical = false): Helper {
  return {
    id,
    name: { family, given },
    qualifications: [],
    can_physical_care: canPhysical,
    transportation: 'bicycle',
    weekly_availability: {},
    preferred_hours: { min: 0, max: 8 },
    available_hours: { min: 0, max: 8 },
    customer_training_status: {},
    employment_type: 'part_time',
    gender: 'female',
    created_at: new Date(),
    updated_at: new Date(),
  } as Helper;
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    name: { family: '山田', given: '太郎' },
    address: '東京都新宿区1-1-1',
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
  } as Customer;
}

const defaultProps = {
  assignedHelpers: [] as Helper[],
  violations: [] as Violation[],
  open: true,
  onClose: vi.fn(),
};

describe('OrderDetailPanel - 手動編集バッジ', () => {
  it('manually_edited: true → 「手動編集済み」バッジが表示される', () => {
    const order = makeOrder({ manually_edited: true });
    render(<OrderDetailPanel order={order} {...defaultProps} />);
    expect(screen.getByText('手動編集済み')).toBeInTheDocument();
  });

  it('manually_edited: false → 「手動編集済み」バッジが表示されない', () => {
    const order = makeOrder({ manually_edited: false });
    render(<OrderDetailPanel order={order} {...defaultProps} />);
    expect(screen.queryByText('手動編集済み')).not.toBeInTheDocument();
  });
});

describe('OrderDetailPanel - null order', () => {
  it('order=null → 何も表示されない', () => {
    const { container } = render(
      <OrderDetailPanel order={null} {...defaultProps} />
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('OrderDetailPanel - 顧客名表示', () => {
  it('customerが渡された場合 → 顧客名が表示される', () => {
    const order = makeOrder();
    const customer = makeCustomer();
    render(<OrderDetailPanel order={order} customer={customer} {...defaultProps} />);
    expect(screen.getByText('山田 太郎')).toBeInTheDocument();
  });

  it('customerが未指定の場合 → customer_idがフォールバック表示される', () => {
    const order = makeOrder({ customer_id: 'cust-999' });
    render(<OrderDetailPanel order={order} {...defaultProps} />);
    expect(screen.getByText('cust-999')).toBeInTheDocument();
  });
});

describe('OrderDetailPanel - 基本情報', () => {
  it('時間帯が表示される', () => {
    const order = makeOrder({ start_time: '14:00', end_time: '15:30' });
    render(<OrderDetailPanel order={order} {...defaultProps} />);
    expect(screen.getByText('14:00 - 15:30')).toBeInTheDocument();
  });

  it('サービス種別がserviceTypesマップから表示される', () => {
    const order = makeOrder({ service_type: 'physical_care' });
    render(<OrderDetailPanel order={order} {...defaultProps} />);
    expect(screen.getByText('身体介護')).toBeInTheDocument();
  });

  it('ステータスラベルが表示される（pending → 未割当）', () => {
    const order = makeOrder({ status: 'pending' });
    render(<OrderDetailPanel order={order} {...defaultProps} />);
    // ステータスバッジと割当スタッフの両方に「未割当」が表示される
    const elements = screen.getAllByText('未割当');
    expect(elements.length).toBeGreaterThanOrEqual(1);
    // ステータスバッジのほう（Badge内）
    const badge = elements.find((el) => el.getAttribute('data-slot') === 'badge');
    expect(badge).toBeDefined();
  });

  it('ステータスラベルが表示される（assigned → 割当済）', () => {
    const order = makeOrder({ status: 'assigned' });
    render(<OrderDetailPanel order={order} {...defaultProps} />);
    expect(screen.getByText('割当済')).toBeInTheDocument();
  });
});

describe('OrderDetailPanel - ステータス変更セレクト', () => {
  it('pendingのとき → ステータス変更セレクトが表示される', () => {
    const order = makeOrder({ status: 'pending' });
    render(<OrderDetailPanel order={order} {...defaultProps} />);
    expect(screen.getByTestId('status-change-select')).toBeInTheDocument();
  });

  it('completedのとき → ステータス変更セレクトが表示されない', () => {
    const order = makeOrder({ status: 'completed' });
    render(<OrderDetailPanel order={order} {...defaultProps} />);
    expect(screen.queryByTestId('status-change-select')).not.toBeInTheDocument();
  });

  it('cancelledのとき → 復元ボタンが表示される', () => {
    const order = makeOrder({ status: 'cancelled' });
    render(<OrderDetailPanel order={order} {...defaultProps} />);
    expect(screen.getByTestId('status-restore-button')).toBeInTheDocument();
    expect(screen.getByText('復元')).toBeInTheDocument();
  });
});

describe('OrderDetailPanel - 割当スタッフ表示', () => {
  it('assignedHelpersが空 → 「未割当」テキストが表示される', () => {
    const order = makeOrder();
    render(<OrderDetailPanel order={order} {...defaultProps} assignedHelpers={[]} />);
    // 「未割当」はステータスバッジ + スタッフ欄の2箇所に表示されうる
    const elements = screen.getAllByText('未割当');
    // スタッフ欄の「未割当」（p要素）が含まれていること
    const pElement = elements.find((el) => el.tagName === 'P');
    expect(pElement).toBeDefined();
  });

  it('assignedHelpersがある → スタッフ名が表示される', () => {
    const order = makeOrder();
    const helpers = [makeHelper('h1', '田中', '太郎')];
    render(<OrderDetailPanel order={order} {...defaultProps} assignedHelpers={helpers} />);
    expect(screen.getByText('田中 太郎')).toBeInTheDocument();
  });

  it('身体介護可能なスタッフ → 「身体可」バッジが表示される', () => {
    const order = makeOrder();
    const helpers = [makeHelper('h1', '田中', '太郎', true)];
    render(<OrderDetailPanel order={order} {...defaultProps} assignedHelpers={helpers} />);
    expect(screen.getByText('身体可')).toBeInTheDocument();
  });

  it('onStaffChange+helpersが渡された場合 → StaffMultiSelectが表示される', () => {
    const order = makeOrder({ status: 'pending' });
    const helperMap = new Map<string, Helper>([['h1', makeHelper('h1', '田中', '太郎')]]);
    render(
      <OrderDetailPanel
        order={order}
        {...defaultProps}
        helpers={helperMap}
        onStaffChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('staff-multi-select')).toBeInTheDocument();
  });

  it('completedステータス → StaffMultiSelectではなくスタッフリストが表示される', () => {
    const order = makeOrder({ status: 'completed' });
    const helperMap = new Map<string, Helper>([['h1', makeHelper('h1', '田中', '太郎')]]);
    render(
      <OrderDetailPanel
        order={order}
        {...defaultProps}
        helpers={helperMap}
        onStaffChange={vi.fn()}
        assignedHelpers={[makeHelper('h1', '田中', '太郎')]}
      />
    );
    expect(screen.queryByTestId('staff-multi-select')).not.toBeInTheDocument();
    expect(screen.getByText('田中 太郎')).toBeInTheDocument();
  });
});

describe('OrderDetailPanel - 制約違反', () => {
  it('違反なし → 制約違反セクションが表示されない', () => {
    const order = makeOrder();
    render(<OrderDetailPanel order={order} {...defaultProps} violations={[]} />);
    expect(screen.queryByText('制約違反')).not.toBeInTheDocument();
  });

  it('違反あり → 違反メッセージが表示される', () => {
    const order = makeOrder();
    const violations: Violation[] = [
      { orderId: 'order-1', type: 'qualification', severity: 'error', message: '資格不足です' },
    ];
    render(<OrderDetailPanel order={order} {...defaultProps} violations={violations} />);
    expect(screen.getByText('制約違反')).toBeInTheDocument();
    expect(screen.getByText('資格不足です')).toBeInTheDocument();
  });

  it('複数の違反 → すべてのメッセージが表示される', () => {
    const order = makeOrder();
    const violations: Violation[] = [
      { orderId: 'order-1', type: 'qualification', severity: 'error', message: '資格不足です' },
      { orderId: 'order-1', type: 'overlap', severity: 'warning', message: '時間が重複しています' },
    ];
    render(<OrderDetailPanel order={order} {...defaultProps} violations={violations} />);
    expect(screen.getByText('資格不足です')).toBeInTheDocument();
    expect(screen.getByText('時間が重複しています')).toBeInTheDocument();
  });
});

describe('OrderDetailPanel - 住所', () => {
  it('customerに住所がある → 住所が表示される', () => {
    const order = makeOrder();
    const customer = makeCustomer({ address: '大阪府大阪市北区1-2-3' });
    render(<OrderDetailPanel order={order} customer={customer} {...defaultProps} />);
    expect(screen.getByText('大阪府大阪市北区1-2-3')).toBeInTheDocument();
  });

  it('customerが未指定 → 住所セクションが表示されない', () => {
    const order = makeOrder();
    render(<OrderDetailPanel order={order} {...defaultProps} />);
    expect(screen.queryByText('住所')).not.toBeInTheDocument();
  });
});

describe('OrderDetailPanel - AssignmentDiffBadge', () => {
  it('diff+helpersが渡された場合 → AssignmentDiffBadgeが表示される', () => {
    const order = makeOrder();
    const helperMap = new Map<string, Helper>([['h1', makeHelper('h1', '田中', '太郎')]]);
    const diff = { added: ['h1'], removed: [], isChanged: true };
    render(
      <OrderDetailPanel
        order={order}
        {...defaultProps}
        helpers={helperMap}
        diff={diff}
      />
    );
    expect(screen.getByTestId('assignment-diff-badge')).toBeInTheDocument();
  });
});

describe('OrderDetailPanel - open=false', () => {
  it('open=false → パネルが表示されない', () => {
    const order = makeOrder();
    const { container } = render(
      <OrderDetailPanel order={order} {...defaultProps} open={false} />
    );
    expect(container.innerHTML).toBe('');
  });
});
