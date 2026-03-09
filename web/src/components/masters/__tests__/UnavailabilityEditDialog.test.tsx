import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnavailabilityEditDialog } from '../UnavailabilityEditDialog';
import type { Helper, StaffUnavailability } from '@/types';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
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
  Checkbox: (props: { checked?: boolean; onCheckedChange?: (v: boolean) => void }) => (
    <input type="checkbox" checked={props.checked ?? false} onChange={(e) => props.onCheckedChange?.(e.target.checked)} />
  ),
}));

vi.mock('@/lib/firestore/staff-unavailability', () => ({
  createStaffUnavailability: vi.fn(),
  updateStaffUnavailability: vi.fn(),
  deleteStaffUnavailability: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── ヘルパー ──────────────────────────────────────────────────

function makeHelper(id: string, family: string, given: string): Helper {
  return {
    id,
    name: { family, given },
    qualifications: [],
    can_physical_care: false,
    transportation: 'bicycle',
    weekly_availability: {},
    preferred_hours: { min: 0, max: 40 },
    available_hours: { min: 0, max: 40 },
    customer_training_status: {},
    employment_type: 'part_time',
    gender: 'female',
    split_shift_allowed: false,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function makeHelperMap(...entries: Helper[]): Map<string, Helper> {
  return new Map(entries.map((h) => [h.id, h]));
}

function makeUnavailability(overrides: Partial<StaffUnavailability> = {}): StaffUnavailability {
  return {
    id: 'unav-1',
    staff_id: 'h1',
    week_start_date: new Date('2026-03-09'),
    unavailable_slots: [
      { date: new Date('2026-03-10'), all_day: true },
    ],
    submitted_at: new Date(),
    ...overrides,
  };
}

const weekStart = new Date('2026-03-09');

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  helpers: makeHelperMap(makeHelper('h1', '佐藤', '一郎'), makeHelper('h2', '田中', '花子')),
  weekStart,
};

// ── テスト ──────────────────────────────────────────────────────

describe('UnavailabilityEditDialog', () => {
  it('open=false のとき何も表示しない', () => {
    render(<UnavailabilityEditDialog {...defaultProps} open={false} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('新規作成時にタイトルが「希望休を追加」になる', () => {
    render(<UnavailabilityEditDialog {...defaultProps} />);
    expect(screen.getByText('希望休を追加')).toBeInTheDocument();
  });

  it('編集時にタイトルが「希望休を編集」になる', () => {
    render(
      <UnavailabilityEditDialog {...defaultProps} unavailability={makeUnavailability()} />
    );
    expect(screen.getByText('希望休を編集')).toBeInTheDocument();
  });

  it('スタッフ選択フィールドが表示される', () => {
    render(<UnavailabilityEditDialog {...defaultProps} />);
    expect(screen.getByText('スタッフ')).toBeInTheDocument();
  });

  it('対象週が表示される', () => {
    render(<UnavailabilityEditDialog {...defaultProps} />);
    expect(screen.getByText('対象週')).toBeInTheDocument();
  });

  it('不在スロットセクションが表示される', () => {
    render(<UnavailabilityEditDialog {...defaultProps} />);
    expect(screen.getByText('不在スロット')).toBeInTheDocument();
  });

  it('保存ボタンとキャンセルボタンが表示される', () => {
    render(<UnavailabilityEditDialog {...defaultProps} />);
    expect(screen.getByText('保存')).toBeInTheDocument();
    expect(screen.getByText('キャンセル')).toBeInTheDocument();
  });

  it('編集時に削除ボタンが表示される', () => {
    render(
      <UnavailabilityEditDialog {...defaultProps} unavailability={makeUnavailability()} />
    );
    expect(screen.getByText('削除')).toBeInTheDocument();
  });

  it('新規作成時に削除ボタンが表示されない', () => {
    render(<UnavailabilityEditDialog {...defaultProps} />);
    expect(screen.queryByText('削除')).not.toBeInTheDocument();
  });

  it('備考フィールドが表示される', () => {
    render(<UnavailabilityEditDialog {...defaultProps} />);
    expect(screen.getByLabelText('備考（任意）')).toBeInTheDocument();
  });

  it('スロットが空のとき「不在スロットを追加してください」が表示される', () => {
    render(<UnavailabilityEditDialog {...defaultProps} />);
    expect(screen.getByText('不在スロットを追加してください')).toBeInTheDocument();
  });
});
