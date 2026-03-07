import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomerMultiSelect } from '../CustomerMultiSelect';
import type { Customer } from '@/types';

// Radix Dialog はポータルを使うためインラインでモック
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function makeCustomer(id: string, family: string, given: string, address = '東京都'): Customer {
  return {
    id,
    name: { family, given },
    address,
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
  };
}

function makeCustomerMap(...entries: Customer[]): Map<string, Customer> {
  return new Map(entries.map((c) => [c.id, c]));
}

describe('CustomerMultiSelect', () => {
  it('should show "未設定" when no customers are selected', () => {
    render(
      <CustomerMultiSelect
        label="同一世帯"
        selected={[]}
        onChange={() => {}}
        customers={new Map()}
      />
    );
    expect(screen.getByText('未設定')).toBeInTheDocument();
  });

  it('should display selected customer names as badges', () => {
    const customers = makeCustomerMap(
      makeCustomer('c1', '田中', '太郎'),
      makeCustomer('c2', '佐藤', '花子'),
    );
    render(
      <CustomerMultiSelect
        label="同一世帯"
        selected={['c1', 'c2']}
        onChange={() => {}}
        customers={customers}
      />
    );
    expect(screen.getByText('田中 太郎')).toBeInTheDocument();
    expect(screen.getByText('佐藤 花子')).toBeInTheDocument();
  });

  it('should remove a customer when badge X is clicked', () => {
    const onChange = vi.fn();
    const customers = makeCustomerMap(
      makeCustomer('c1', '田中', '太郎'),
      makeCustomer('c2', '佐藤', '花子'),
    );
    render(
      <CustomerMultiSelect
        label="同一世帯"
        selected={['c1', 'c2']}
        onChange={onChange}
        customers={customers}
      />
    );
    // Badge内のXボタン（aria-labelなし）をクエリ
    const badges = screen.getAllByText(/田中|佐藤/).map((el) => el.closest('[data-slot="badge"]')!);
    const removeButton = badges[0].querySelector('button')!;
    fireEvent.click(removeButton);
    expect(onChange).toHaveBeenCalledWith(['c2']);
  });

  it('should exclude customers specified in excludeIds', () => {
    const customers = makeCustomerMap(
      makeCustomer('c1', '田中', '太郎'),
      makeCustomer('c2', '佐藤', '花子'),
      makeCustomer('c3', '鈴木', '一郎'),
    );
    render(
      <CustomerMultiSelect
        label="同一世帯"
        selected={[]}
        onChange={() => {}}
        customers={customers}
        excludeIds={['c1']}
      />
    );
    // ダイアログを開く
    fireEvent.click(screen.getByText('選択'));
    // c1は除外される
    expect(screen.queryByText('田中 太郎')).not.toBeInTheDocument();
    expect(screen.getByText('佐藤 花子')).toBeInTheDocument();
    expect(screen.getByText('鈴木 一郎')).toBeInTheDocument();
  });

  it('should filter customers by search query (name)', () => {
    const customers = makeCustomerMap(
      makeCustomer('c1', '田中', '太郎'),
      makeCustomer('c2', '佐藤', '花子'),
    );
    render(
      <CustomerMultiSelect
        label="同一世帯"
        selected={[]}
        onChange={() => {}}
        customers={customers}
      />
    );
    fireEvent.click(screen.getByText('選択'));
    const searchInput = screen.getByPlaceholderText('名前・住所で検索...');
    fireEvent.change(searchInput, { target: { value: '田中' } });
    expect(screen.getByText('田中 太郎')).toBeInTheDocument();
    expect(screen.queryByText('佐藤 花子')).not.toBeInTheDocument();
  });

  it('should filter customers by search query (address)', () => {
    const customers = makeCustomerMap(
      makeCustomer('c1', '田中', '太郎', '鹿児島市'),
      makeCustomer('c2', '佐藤', '花子', '東京都'),
    );
    render(
      <CustomerMultiSelect
        label="同一施設"
        selected={[]}
        onChange={() => {}}
        customers={customers}
      />
    );
    fireEvent.click(screen.getByText('選択'));
    const searchInput = screen.getByPlaceholderText('名前・住所で検索...');
    fireEvent.change(searchInput, { target: { value: '鹿児島' } });
    expect(screen.getByText('田中 太郎')).toBeInTheDocument();
    expect(screen.queryByText('佐藤 花子')).not.toBeInTheDocument();
  });

  it('should call onChange with selected ids on confirm', () => {
    const onChange = vi.fn();
    const customers = makeCustomerMap(
      makeCustomer('c1', '田中', '太郎'),
      makeCustomer('c2', '佐藤', '花子'),
    );
    render(
      <CustomerMultiSelect
        label="同一世帯"
        selected={[]}
        onChange={onChange}
        customers={customers}
      />
    );
    fireEvent.click(screen.getByText('選択'));
    // c1をチェック
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    // 確定ボタン
    fireEvent.click(screen.getByText('確定（1名）'));
    expect(onChange).toHaveBeenCalledWith(['c1']);
  });

  it('should show fallback id for unknown customer', () => {
    render(
      <CustomerMultiSelect
        label="同一世帯"
        selected={['unknown-id']}
        onChange={() => {}}
        customers={new Map()}
      />
    );
    expect(screen.getByText('unknown-id')).toBeInTheDocument();
  });
});
