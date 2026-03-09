import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelperEditDialog } from '../HelperEditDialog';
import type { Helper, Customer } from '@/types';

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

vi.mock('@/lib/firestore/helpers', () => ({
  createHelper: vi.fn(),
  updateHelper: vi.fn(),
}));

vi.mock('@/lib/geocoding', () => ({
  geocodeAddress: vi.fn(),
}));

vi.mock('../WeeklyAvailabilityEditor', () => ({
  WeeklyAvailabilityEditor: () => <div data-testid="weekly-availability-editor" />,
}));

vi.mock('../CustomerTrainingStatusEditor', () => ({
  CustomerTrainingStatusEditor: () => <div data-testid="training-status-editor" />,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── ヘルパー ──────────────────────────────────────────────────

function makeHelper(overrides: Partial<Helper> = {}): Helper {
  return {
    id: 'helper-1',
    name: { family: '佐藤', given: '次郎' },
    qualifications: [],
    can_physical_care: false,
    transportation: 'bicycle',
    weekly_availability: {},
    preferred_hours: { min: 20, max: 40 },
    available_hours: { min: 20, max: 40 },
    customer_training_status: {},
    employment_type: 'part_time',
    gender: 'male',
    split_shift_allowed: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  customers: new Map<string, Customer>(),
};

// ── テスト ──────────────────────────────────────────────────────

describe('HelperEditDialog', () => {
  it('open=false のとき何も表示しない', () => {
    render(<HelperEditDialog {...defaultProps} open={false} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('新規作成時にタイトルが「ヘルパーを追加」になる', () => {
    render(<HelperEditDialog {...defaultProps} />);
    expect(screen.getByText('ヘルパーを追加')).toBeInTheDocument();
  });

  it('編集時にタイトルが「ヘルパーを編集」になる', () => {
    render(<HelperEditDialog {...defaultProps} helper={makeHelper()} />);
    expect(screen.getByText('ヘルパーを編集')).toBeInTheDocument();
  });

  it('姓・名の入力フィールドが表示される', () => {
    render(<HelperEditDialog {...defaultProps} />);
    expect(screen.getByLabelText('姓')).toBeInTheDocument();
    expect(screen.getByLabelText('名')).toBeInTheDocument();
  });

  it('短縮名の入力フィールドが表示される', () => {
    render(<HelperEditDialog {...defaultProps} />);
    expect(screen.getByLabelText('短縮名')).toBeInTheDocument();
  });

  it('基本情報セクションが表示される', () => {
    render(<HelperEditDialog {...defaultProps} />);
    expect(screen.getByText('基本情報')).toBeInTheDocument();
  });

  it('雇用条件セクションが表示される', () => {
    render(<HelperEditDialog {...defaultProps} />);
    expect(screen.getByText('雇用条件')).toBeInTheDocument();
  });

  it('勤務スケジュールセクションが表示される', () => {
    render(<HelperEditDialog {...defaultProps} />);
    expect(screen.getByText('勤務スケジュール')).toBeInTheDocument();
  });

  it('保存ボタンとキャンセルボタンが表示される', () => {
    render(<HelperEditDialog {...defaultProps} />);
    expect(screen.getByText('保存')).toBeInTheDocument();
    expect(screen.getByText('キャンセル')).toBeInTheDocument();
  });

  it('資格チェックボックスが表示される', () => {
    render(<HelperEditDialog {...defaultProps} />);
    expect(screen.getByText('介護福祉士')).toBeInTheDocument();
    expect(screen.getByText('実務者研修')).toBeInTheDocument();
    expect(screen.getByText('初任者研修')).toBeInTheDocument();
  });

  it('身体介護対応可チェックボックスが表示される', () => {
    render(<HelperEditDialog {...defaultProps} />);
    expect(screen.getByText('身体介護対応可')).toBeInTheDocument();
  });

  it('分断勤務可チェックボックスが表示される', () => {
    render(<HelperEditDialog {...defaultProps} />);
    expect(screen.getByText(/分断勤務可/)).toBeInTheDocument();
  });
});
