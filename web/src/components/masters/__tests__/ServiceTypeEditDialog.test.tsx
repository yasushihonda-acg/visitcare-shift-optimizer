import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceTypeEditDialog } from '../ServiceTypeEditDialog';
import type { ServiceTypeDoc } from '@/types';

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

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: (props: { checked?: boolean; onCheckedChange?: () => void }) => (
    <input type="checkbox" checked={props.checked ?? false} onChange={() => props.onCheckedChange?.()} />
  ),
}));

vi.mock('@/lib/firestore/service-types', () => ({
  createServiceType: vi.fn(),
  updateServiceType: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── ヘルパー ──────────────────────────────────────────────────

function makeServiceType(overrides: Partial<ServiceTypeDoc> = {}): ServiceTypeDoc {
  return {
    id: 'physical_care_2',
    code: 'physical_care_2',
    category: '訪問介護',
    label: '身体介護2',
    duration: '30分以上60分未満',
    care_level: '要介護1〜5',
    units: 394,
    short_label: '身体',
    requires_physical_care_cert: true,
    sort_order: 1,
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

describe('ServiceTypeEditDialog', () => {
  it('open=false のとき何も表示しない', () => {
    render(<ServiceTypeEditDialog {...defaultProps} open={false} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('新規作成時にタイトルが「サービス種別を追加」になる', () => {
    render(<ServiceTypeEditDialog {...defaultProps} />);
    expect(screen.getByText('サービス種別を追加')).toBeInTheDocument();
  });

  it('編集時にタイトルが「サービス種別を編集」になる', () => {
    render(<ServiceTypeEditDialog {...defaultProps} serviceType={makeServiceType()} />);
    expect(screen.getByText('サービス種別を編集')).toBeInTheDocument();
  });

  it('コード入力フィールドが表示される', () => {
    render(<ServiceTypeEditDialog {...defaultProps} />);
    expect(screen.getByLabelText('コード')).toBeInTheDocument();
  });

  it('カテゴリ入力フィールドが表示される', () => {
    render(<ServiceTypeEditDialog {...defaultProps} />);
    expect(screen.getByLabelText('カテゴリ')).toBeInTheDocument();
  });

  it('表示名入力フィールドが表示される', () => {
    render(<ServiceTypeEditDialog {...defaultProps} />);
    expect(screen.getByLabelText('表示名')).toBeInTheDocument();
  });

  it('単位数入力フィールドが表示される', () => {
    render(<ServiceTypeEditDialog {...defaultProps} />);
    expect(screen.getByLabelText('単位数')).toBeInTheDocument();
  });

  it('短縮名入力フィールドが表示される', () => {
    render(<ServiceTypeEditDialog {...defaultProps} />);
    expect(screen.getByLabelText('短縮名')).toBeInTheDocument();
  });

  it('身体介護資格チェックボックスが表示される', () => {
    render(<ServiceTypeEditDialog {...defaultProps} />);
    expect(screen.getByText(/身体介護資格/)).toBeInTheDocument();
  });

  it('編集時にコードフィールドがreadonlyになる', () => {
    render(<ServiceTypeEditDialog {...defaultProps} serviceType={makeServiceType()} />);
    const codeInputs = screen.getAllByDisplayValue('physical_care_2');
    const readonlyInput = codeInputs.find((el) => el.hasAttribute('readOnly'));
    expect(readonlyInput).toBeDefined();
  });

  it('保存ボタンとキャンセルボタンが表示される', () => {
    render(<ServiceTypeEditDialog {...defaultProps} />);
    expect(screen.getByText('保存')).toBeInTheDocument();
    expect(screen.getByText('キャンセル')).toBeInTheDocument();
  });
});
