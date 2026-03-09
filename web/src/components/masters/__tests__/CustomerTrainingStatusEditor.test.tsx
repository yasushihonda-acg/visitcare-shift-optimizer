import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomerTrainingStatusEditor } from '../CustomerTrainingStatusEditor';
import type { Customer, TrainingStatus } from '@/types';

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
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) => (
    <div data-testid="select" data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
}));

// ── ヘルパー ──────────────────────────────────────────────────

function makeCustomer(id: string, family: string, given: string): Customer {
  return {
    id,
    name: { family, given },
    address: '東京都',
    location: { lat: 35.0, lng: 139.0 },
    ng_staff_ids: [],
    allowed_staff_ids: [],
    preferred_staff_ids: [],
    same_household_customer_ids: [],
    same_facility_customer_ids: [],
    weekly_services: {},
    service_manager: 'テスト',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function makeCustomerMap(...entries: Customer[]): Map<string, Customer> {
  return new Map(entries.map((c) => [c.id, c]));
}

// ── テスト ──────────────────────────────────────────────────────

describe('CustomerTrainingStatusEditor', () => {
  it('エントリが空のとき「未設定」と表示される', () => {
    render(
      <CustomerTrainingStatusEditor
        value={{}}
        onChange={vi.fn()}
        customers={new Map()}
      />
    );
    expect(screen.getByText('未設定')).toBeInTheDocument();
  });

  it('ラベル「利用者別研修状態」が表示される', () => {
    render(
      <CustomerTrainingStatusEditor
        value={{}}
        onChange={vi.fn()}
        customers={new Map()}
      />
    );
    expect(screen.getByText('利用者別研修状態')).toBeInTheDocument();
  });

  it('追加ボタンが表示される', () => {
    render(
      <CustomerTrainingStatusEditor
        value={{}}
        onChange={vi.fn()}
        customers={new Map()}
      />
    );
    expect(screen.getByText('追加')).toBeInTheDocument();
  });

  it('登録済みエントリの利用者名が表示される', () => {
    const customers = makeCustomerMap(makeCustomer('c1', '田中', '太郎'));
    const value: Record<string, TrainingStatus> = { c1: 'training' };

    render(
      <CustomerTrainingStatusEditor
        value={value}
        onChange={vi.fn()}
        customers={customers}
      />
    );
    expect(screen.getByText('田中 太郎')).toBeInTheDocument();
  });

  it('不明な利用者IDの場合はIDがそのまま表示される', () => {
    const value: Record<string, TrainingStatus> = { 'unknown-id': 'training' };

    render(
      <CustomerTrainingStatusEditor
        value={value}
        onChange={vi.fn()}
        customers={new Map()}
      />
    );
    expect(screen.getByText('unknown-id')).toBeInTheDocument();
  });

  it('削除ボタンクリックでonChangeが呼ばれエントリが除去される', () => {
    const onChange = vi.fn();
    const customers = makeCustomerMap(makeCustomer('c1', '田中', '太郎'));
    const value: Record<string, TrainingStatus> = { c1: 'training' };

    render(
      <CustomerTrainingStatusEditor
        value={value}
        onChange={onChange}
        customers={customers}
      />
    );

    const removeButton = screen.getByText('田中 太郎').closest('div')!.querySelector('button')!;
    fireEvent.click(removeButton);
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('追加ボタンクリックでダイアログが開く', () => {
    render(
      <CustomerTrainingStatusEditor
        value={{}}
        onChange={vi.fn()}
        customers={makeCustomerMap(makeCustomer('c1', '田中', '太郎'))}
      />
    );

    fireEvent.click(screen.getByText('追加'));
    expect(screen.getByText('研修状態を追加')).toBeInTheDocument();
  });
});
