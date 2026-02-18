import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GanttBar } from '../GanttBar';
import type { Order } from '@/types';

// --- Mocks ---
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
}));

vi.mock('../GanttScaleContext', () => ({
  useSlotWidth: () => 4,
}));

// --- Helper ---
function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    week_start_date: new Date('2026-02-09'),
    date: new Date('2026-02-09'),
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    assigned_staff_ids: ['helper-a'],
    status: 'assigned',
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('GanttBar - 完了/キャンセル表示', () => {
  it('status: completed → 半透明 + チェックアイコン表示', () => {
    const order = makeOrder({ status: 'completed' });
    render(<GanttBar order={order} sourceHelperId="h1" />);

    const bar = screen.getByTestId('gantt-bar-order-1');
    expect(bar.className).toContain('opacity-50');
    expect(bar.className).toContain('cursor-default');
    expect(bar.querySelector('svg')).toBeTruthy();
  });

  it('status: cancelled → 半透明 + Xアイコン表示', () => {
    const order = makeOrder({ status: 'cancelled' });
    render(<GanttBar order={order} sourceHelperId="h1" />);

    const bar = screen.getByTestId('gantt-bar-order-1');
    expect(bar.className).toContain('opacity-50');
    expect(bar.querySelector('svg')).toBeTruthy();
  });

  it('status: completed → manually_edited の青リングは表示されない', () => {
    const order = makeOrder({ status: 'completed', manually_edited: true });
    render(<GanttBar order={order} sourceHelperId="h1" />);

    const bar = screen.getByTestId('gantt-bar-order-1');
    expect(bar.className).not.toContain('ring-blue-500');
  });

  it('status: assigned → 通常表示（半透明なし）', () => {
    const order = makeOrder({ status: 'assigned' });
    render(<GanttBar order={order} sourceHelperId="h1" />);

    const bar = screen.getByTestId('gantt-bar-order-1');
    expect(bar.className).not.toContain('opacity-50');
    expect(bar.className).toContain('cursor-grab');
  });
});

describe('GanttBar - 手動編集リング表示', () => {
  it('manually_edited: true → 青リングクラスが適用される', () => {
    const order = makeOrder({ manually_edited: true });
    render(<GanttBar order={order} sourceHelperId="h1" />);

    const bar = screen.getByTestId('gantt-bar-order-1');
    expect(bar.className).toContain('ring-blue-500');
    expect(bar.className).toContain('ring-2');
    expect(bar.className).toContain('ring-offset-1');
  });

  it('manually_edited: false → 青リングクラスなし', () => {
    const order = makeOrder({ manually_edited: false });
    render(<GanttBar order={order} sourceHelperId="h1" />);

    const bar = screen.getByTestId('gantt-bar-order-1');
    expect(bar.className).not.toContain('ring-blue-500');
  });

  it('hasViolation + manually_edited → violationリング（赤）が優先される', () => {
    const order = makeOrder({ manually_edited: true });
    render(
      <GanttBar
        order={order}
        sourceHelperId="h1"
        hasViolation={true}
        violationType="error"
      />,
    );

    const bar = screen.getByTestId('gantt-bar-order-1');
    expect(bar.className).toContain('ring-red-500');
    expect(bar.className).not.toContain('ring-blue-500');
  });

  it('hasViolation(warning) + manually_edited → violationリング（黄）が優先される', () => {
    const order = makeOrder({ manually_edited: true });
    render(
      <GanttBar
        order={order}
        sourceHelperId="h1"
        hasViolation={true}
        violationType="warning"
      />,
    );

    const bar = screen.getByTestId('gantt-bar-order-1');
    expect(bar.className).toContain('ring-yellow-500');
    expect(bar.className).not.toContain('ring-blue-500');
  });
});
