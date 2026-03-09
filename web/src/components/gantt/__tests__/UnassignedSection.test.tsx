import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnassignedSection } from '../UnassignedSection';
import type { Customer, Order } from '@/types';

// --- Mocks ---
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}));

vi.mock('@/hooks/useServiceTypes', () => ({
  useServiceTypes: () => ({
    serviceTypes: new Map([
      ['physical_care', { id: 'physical_care', short_label: '身体' }],
      ['daily_living', { id: 'daily_living', short_label: '生活' }],
    ]),
  }),
}));

// --- フィクスチャ ---
function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    week_start_date: new Date('2026-02-16'),
    date: new Date('2026-02-16'),
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

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    name: { family: '佐藤', given: '一郎', short: '佐藤' },
    address: '東京都渋谷区',
    location: { lat: 35.6, lng: 139.7 },
    ng_staff_ids: [],
    allowed_staff_ids: [],
    preferred_staff_ids: [],
    same_household_customer_ids: [],
    same_facility_customer_ids: [],
    weekly_services: {},
    service_manager: 'sm-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('UnassignedSection', () => {
  const customers = new Map([['cust-1', makeCustomer()]]);

  it('「未割当」見出しが表示される', () => {
    render(
      <UnassignedSection orders={[]} customers={customers} />,
    );

    expect(screen.getByText('未割当')).toBeInTheDocument();
  });

  it('data-testidが設定される', () => {
    render(
      <UnassignedSection orders={[]} customers={customers} />,
    );

    expect(screen.getByTestId('unassigned-section')).toBeInTheDocument();
  });

  it('オーダーが0件の場合は案内テキストが表示される', () => {
    render(
      <UnassignedSection orders={[]} customers={customers} />,
    );

    expect(screen.getByText('オーダーをここにドロップして割当を解除')).toBeInTheDocument();
  });

  it('オーダー件数バッジが表示される', () => {
    const orders = [makeOrder({ id: 'o-1' }), makeOrder({ id: 'o-2' })];

    render(
      <UnassignedSection orders={orders} customers={customers} />,
    );

    expect(screen.getByText('2件')).toBeInTheDocument();
  });

  it('顧客名が表示される', () => {
    const orders = [makeOrder()];

    render(
      <UnassignedSection orders={orders} customers={customers} />,
    );

    expect(screen.getByText('佐藤')).toBeInTheDocument();
  });

  it('時間帯が表示される', () => {
    const orders = [makeOrder({ start_time: '10:00', end_time: '11:00' })];

    render(
      <UnassignedSection orders={orders} customers={customers} />,
    );

    expect(screen.getByText('10:00-11:00')).toBeInTheDocument();
  });

  it('サービス種別ラベルが表示される', () => {
    const orders = [makeOrder({ service_type: 'physical_care' })];

    render(
      <UnassignedSection orders={orders} customers={customers} />,
    );

    expect(screen.getByText('身体')).toBeInTheDocument();
  });

  it('オーダークリックでonOrderClickが呼ばれる', () => {
    const onOrderClick = vi.fn();
    const order = makeOrder();

    render(
      <UnassignedSection
        orders={[order]}
        customers={customers}
        onOrderClick={onOrderClick}
      />,
    );

    fireEvent.click(screen.getByTestId('unassigned-order-order-1'));
    expect(onOrderClick).toHaveBeenCalledWith(order);
  });

  it('顧客がマップに存在しない場合はcustomer_idが表示される', () => {
    const order = makeOrder({ customer_id: 'unknown-cust' });

    render(
      <UnassignedSection
        orders={[order]}
        customers={customers}
      />,
    );

    expect(screen.getByText('unknown-cust')).toBeInTheDocument();
  });
});
