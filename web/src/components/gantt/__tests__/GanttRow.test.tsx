import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GanttRow } from '../GanttRow';
import { GanttScaleProvider } from '../GanttScaleContext';
import type { Helper, Customer, Order, DayOfWeek } from '@/types';
import type { HelperScheduleRow } from '@/hooks/useScheduleData';
import type { ViolationMap } from '@/lib/constraints/checker';

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

// --- フィクスチャ ---
function makeHelper(overrides: Partial<Helper> = {}): Helper {
  return {
    id: 'helper-1',
    name: { family: '田中', given: '花子', short: '田中' },
    qualifications: [],
    can_physical_care: true,
    transportation: 'bicycle',
    weekly_availability: {
      monday: [{ start_time: '09:00', end_time: '18:00' }],
    },
    preferred_hours: { min: 20, max: 40 },
    available_hours: { min: 0, max: 40 },
    customer_training_status: {},
    employment_type: 'part_time',
    gender: 'female',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    week_start_date: new Date('2026-02-16'),
    date: new Date('2026-02-16'),
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    assigned_staff_ids: ['helper-1'],
    status: 'assigned',
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

function renderRow(
  rowOverrides: Partial<HelperScheduleRow> = {},
  props: Record<string, unknown> = {},
) {
  const helper = makeHelper();
  const row: HelperScheduleRow = {
    helper,
    orders: [],
    ...rowOverrides,
  };
  const customers = new Map([['cust-1', makeCustomer()]]);
  const violations: ViolationMap = new Map();

  return render(
    <GanttScaleProvider value={4}>
      <GanttRow
        row={row}
        customers={customers}
        violations={violations}
        index={0}
        unavailability={[]}
        day={'monday' as DayOfWeek}
        dayDate={new Date('2026-02-16')}
        {...props}
      />
    </GanttScaleProvider>,
  );
}

describe('GanttRow', () => {
  it('ヘルパー名が表示される', () => {
    renderRow();

    expect(screen.getByText('田中')).toBeInTheDocument();
  });

  it('ヘルパー名がtitle属性に設定される', () => {
    renderRow();

    expect(screen.getByTitle('田中')).toBeInTheDocument();
  });

  it('data-testidにヘルパーIDが含まれる', () => {
    renderRow();

    expect(screen.getByTestId('gantt-row-helper-1')).toBeInTheDocument();
  });

  it('オーダーがある場合にGanttBarがレンダリングされる', () => {
    const order = makeOrder();
    renderRow({ orders: [order] });

    expect(screen.getByTestId('gantt-bar-order-1')).toBeInTheDocument();
  });

  it('非勤務日の場合は「休」バッジが表示される', () => {
    const helper = makeHelper({
      weekly_availability: {}, // monday未設定 → 非勤務日
    });
    renderRow({ helper, orders: [] });

    expect(screen.getByText('休')).toBeInTheDocument();
  });

  it('勤務日の場合は「休」バッジが表示されない', () => {
    renderRow();

    expect(screen.queryByText('休')).not.toBeInTheDocument();
  });
});
