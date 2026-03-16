import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompanionDialog } from '../CompanionDialog';
import type { Order, Customer, Helper } from '@/types';

// Radix Dialog はポータルを使うためインラインでモック
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function makeHelper(id: string, family: string, given: string): Helper {
  return {
    id,
    name: { family, given },
    qualifications: ['介護福祉士'],
    can_physical_care: true,
    transportation: 'car',
    weekly_availability: {},
    preferred_hours: { min: 0, max: 8 },
    available_hours: { min: 0, max: 8 },
    customer_training_status: {},
    employment_type: 'full_time',
    gender: 'female',
    created_at: new Date(),
    updated_at: new Date(),
  } as Helper;
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    customer_id: 'c1',
    assigned_staff_ids: ['h1'],
    status: 'assigned',
    manually_edited: false,
    ...overrides,
  } as Order;
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'c1',
    ng_staff_ids: [],
    allowed_staff_ids: [],
    preferred_staff_ids: [],
    ...overrides,
  } as Customer;
}

describe('CompanionDialog', () => {
  const h1 = makeHelper('h1', '山田', '太郎');
  const h2 = makeHelper('h2', '鈴木', '花子');
  const h3 = makeHelper('h3', '佐藤', '次郎');

  const helpers = new Map<string, Helper>([
    ['h1', h1],
    ['h2', h2],
    ['h3', h3],
  ]);

  it('候補ヘルパーが一覧表示される', () => {
    const order = makeOrder({ assigned_staff_ids: ['h1'] });
    const customer = makeCustomer();

    render(
      <CompanionDialog
        open={true}
        onOpenChange={() => {}}
        order={order}
        customer={customer}
        helpers={helpers}
        onSetCompanion={() => {}}
        onRemoveCompanion={() => {}}
      />,
    );

    // h1は割当済みで除外、h2とh3が候補
    expect(screen.getByText('鈴木 花子')).toBeInTheDocument();
    expect(screen.getByText('佐藤 次郎')).toBeInTheDocument();
  });

  it('選択して確定 → onSetCompanionが呼ばれる', () => {
    const order = makeOrder({ assigned_staff_ids: ['h1'] });
    const customer = makeCustomer();
    const onSetCompanion = vi.fn();

    render(
      <CompanionDialog
        open={true}
        onOpenChange={() => {}}
        order={order}
        customer={customer}
        helpers={helpers}
        onSetCompanion={onSetCompanion}
        onRemoveCompanion={() => {}}
      />,
    );

    // h2のラジオボタンを選択
    const radios = screen.getAllByRole('radio');
    const h2Radio = radios.find(r => r.getAttribute('value') === 'h2');
    fireEvent.click(h2Radio!);

    // 確定ボタンを押下
    fireEvent.click(screen.getByText('確定'));

    expect(onSetCompanion).toHaveBeenCalledWith('h2');
  });

  it('解除ボタン → onRemoveCompanionが呼ばれる', () => {
    const order = makeOrder({
      assigned_staff_ids: ['h1', 'h2'],
      companion_staff_id: 'h2',
    });
    const customer = makeCustomer();
    const onRemoveCompanion = vi.fn();

    render(
      <CompanionDialog
        open={true}
        onOpenChange={() => {}}
        order={order}
        customer={customer}
        helpers={helpers}
        onSetCompanion={() => {}}
        onRemoveCompanion={onRemoveCompanion}
      />,
    );

    // 現在の同行者が表示されている
    expect(screen.getByText(/現在の同行者/)).toBeInTheDocument();
    expect(screen.getByText(/鈴木 花子/)).toBeInTheDocument();

    // 解除ボタンを押下
    fireEvent.click(screen.getByTestId('remove-companion'));

    expect(onRemoveCompanion).toHaveBeenCalled();
  });

  it('「教える方」に担当スタッフ名が表示される', () => {
    const order = makeOrder({ assigned_staff_ids: ['h1'] });
    const customer = makeCustomer();

    render(
      <CompanionDialog
        open={true}
        onOpenChange={() => {}}
        order={order}
        customer={customer}
        helpers={helpers}
        onSetCompanion={() => {}}
        onRemoveCompanion={() => {}}
      />,
    );

    const section = screen.getByTestId('teaching-staff');
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent('教える方');
    expect(section).toHaveTextContent('山田 太郎');
  });

  it('同行者は「教える方」に含まれない', () => {
    const order = makeOrder({
      assigned_staff_ids: ['h1', 'h2'],
      companion_staff_id: 'h2',
    });
    const customer = makeCustomer();

    render(
      <CompanionDialog
        open={true}
        onOpenChange={() => {}}
        order={order}
        customer={customer}
        helpers={helpers}
        onSetCompanion={() => {}}
        onRemoveCompanion={() => {}}
      />,
    );

    const section = screen.getByTestId('teaching-staff');
    // h1（山田）は教える方として表示される
    expect(section).toHaveTextContent('山田 太郎');
    // h2（鈴木）は同行者なので教える方には含まれない
    expect(section).not.toHaveTextContent('鈴木 花子');
  });

  it('openがfalseのとき描画されない', () => {
    render(
      <CompanionDialog
        open={false}
        onOpenChange={() => {}}
        order={makeOrder()}
        customer={makeCustomer()}
        helpers={helpers}
        onSetCompanion={() => {}}
        onRemoveCompanion={() => {}}
      />,
    );

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });
});
