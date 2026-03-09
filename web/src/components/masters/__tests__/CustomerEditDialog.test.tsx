import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerEditDialog } from '../CustomerEditDialog';
import type { Customer } from '@/types';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: (props: { checked?: boolean; onCheckedChange?: () => void }) => (
    <input type="checkbox" checked={props.checked ?? false} onChange={() => props.onCheckedChange?.()} />
  ),
}));

vi.mock('@/hooks/useHelpers', () => ({
  useHelpers: () => ({ helpers: new Map(), loading: false }),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: new Map(), loading: false }),
}));

vi.mock('@/lib/firestore/customers', () => ({
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
}));

vi.mock('@/lib/geocoding', () => ({
  geocodeAddress: vi.fn(),
}));

vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../CustomerLocationPicker', () => ({
  CustomerLocationPicker: () => <div data-testid="location-picker" />,
}));

vi.mock('../WeeklyServicesEditor', () => ({
  WeeklyServicesEditor: () => <div data-testid="weekly-services-editor" />,
}));

vi.mock('../StaffMultiSelect', () => ({
  StaffMultiSelect: ({ label }: { label: string }) => <div data-testid={`staff-multi-select-${label}`} />,
}));

vi.mock('../CustomerMultiSelect', () => ({
  CustomerMultiSelect: ({ label }: { label: string }) => <div data-testid={`customer-multi-select-${label}`} />,
}));

vi.mock('../IrregularPatternEditor', () => ({
  IrregularPatternEditor: () => <div data-testid="irregular-pattern-editor" />,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── ヘルパー ──────────────────────────────────────────────────

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    name: { family: '田中', given: '花子' },
    address: '東京都新宿区1-1-1',
    location: { lat: 35.68, lng: 139.69 },
    ng_staff_ids: [],
    allowed_staff_ids: [],
    preferred_staff_ids: [],
    same_household_customer_ids: [],
    same_facility_customer_ids: [],
    weekly_services: {},
    service_manager: '山田太郎',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
};

// ── テスト ──────────────────────────────────────────────────────

describe('CustomerEditDialog', () => {
  it('open=false のとき何も表示しない', () => {
    render(<CustomerEditDialog {...defaultProps} open={false} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('新規作成時にタイトルが「利用者を追加」になる', () => {
    render(<CustomerEditDialog {...defaultProps} />);
    expect(screen.getByText('利用者を追加')).toBeInTheDocument();
  });

  it('編集時にタイトルが「利用者を編集」になる', () => {
    render(<CustomerEditDialog {...defaultProps} customer={makeCustomer()} />);
    expect(screen.getByText('利用者を編集')).toBeInTheDocument();
  });

  it('姓・名の入力フィールドが表示される', () => {
    render(<CustomerEditDialog {...defaultProps} />);
    expect(screen.getByLabelText('姓')).toBeInTheDocument();
    expect(screen.getByLabelText('名')).toBeInTheDocument();
  });

  it('住所の入力フィールドが表示される', () => {
    render(<CustomerEditDialog {...defaultProps} />);
    expect(screen.getByLabelText('住所')).toBeInTheDocument();
  });

  it('サービス提供責任者の入力フィールドが表示される', () => {
    render(<CustomerEditDialog {...defaultProps} />);
    expect(screen.getByLabelText('サービス提供責任者')).toBeInTheDocument();
  });

  it('保存ボタンとキャンセルボタンが表示される', () => {
    render(<CustomerEditDialog {...defaultProps} />);
    expect(screen.getByText('保存')).toBeInTheDocument();
    expect(screen.getByText('キャンセル')).toBeInTheDocument();
  });

  it('住所から検索ボタンが表示される', () => {
    render(<CustomerEditDialog {...defaultProps} />);
    expect(screen.getByText('住所から検索')).toBeInTheDocument();
  });

  it('あおぞらIDフィールドが表示される', () => {
    render(<CustomerEditDialog {...defaultProps} />);
    expect(screen.getByLabelText('あおぞらID（任意）')).toBeInTheDocument();
  });
});
