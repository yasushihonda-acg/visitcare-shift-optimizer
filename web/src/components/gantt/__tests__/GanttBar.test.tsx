import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GanttBar } from '../GanttBar';
import type { Order } from '@/types';

// --- Mocks ---
const mockUseDraggable = vi.fn();

vi.mock('@dnd-kit/core', () => ({
  useDraggable: (args: unknown) => {
    mockUseDraggable(args);
    return {
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      isDragging: false,
    };
  },
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

  it('status: completed → manually_edited のアンバーリングは表示されない', () => {
    const order = makeOrder({ status: 'completed', manually_edited: true });
    render(<GanttBar order={order} sourceHelperId="h1" />);

    const bar = screen.getByTestId('gantt-bar-order-1');
    expect(bar.className).not.toContain('ring-amber-400');
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
  it('manually_edited: true → アンバーリングクラスが適用される', () => {
    const order = makeOrder({ manually_edited: true });
    render(<GanttBar order={order} sourceHelperId="h1" />);

    const bar = screen.getByTestId('gantt-bar-order-1');
    expect(bar.className).toContain('ring-amber-400');
    expect(bar.className).toContain('ring-2');
    expect(bar.className).toContain('ring-offset-1');
  });

  it('manually_edited: false → アンバーリングクラスなし', () => {
    const order = makeOrder({ manually_edited: false });
    render(<GanttBar order={order} sourceHelperId="h1" />);

    const bar = screen.getByTestId('gantt-bar-order-1');
    expect(bar.className).not.toContain('ring-amber-400');
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
    expect(bar.className).not.toContain('ring-amber-400');
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
    expect(bar.className).not.toContain('ring-amber-400');
  });
});

describe('GanttBar - 変更確認チェックボタン', () => {
  it('manually_edited: true + onConfirmManualEdit → チェックボタンが表示される', () => {
    const order = makeOrder({ manually_edited: true });
    const onConfirm = vi.fn();
    render(<GanttBar order={order} sourceHelperId="h1" onConfirmManualEdit={onConfirm} />);

    expect(screen.getByTestId('confirm-edit-order-1')).toBeTruthy();
  });

  it('manually_edited: false → チェックボタンが表示されない', () => {
    const order = makeOrder({ manually_edited: false });
    const onConfirm = vi.fn();
    render(<GanttBar order={order} sourceHelperId="h1" onConfirmManualEdit={onConfirm} />);

    expect(screen.queryByTestId('confirm-edit-order-1')).toBeNull();
  });

  it('チェックボタンクリック → onConfirmManualEdit が orderId で呼ばれる', () => {
    const order = makeOrder({ manually_edited: true });
    const onConfirm = vi.fn();
    render(<GanttBar order={order} sourceHelperId="h1" onConfirmManualEdit={onConfirm} />);

    fireEvent.click(screen.getByTestId('confirm-edit-order-1'));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith('order-1');
  });

  it('status: completed → manually_edited: true でもチェックボタンが表示されない', () => {
    const order = makeOrder({ status: 'completed', manually_edited: true });
    const onConfirm = vi.fn();
    render(<GanttBar order={order} sourceHelperId="h1" onConfirmManualEdit={onConfirm} />);

    expect(screen.queryByTestId('confirm-edit-order-1')).toBeNull();
  });
});

describe('GanttBar - 同行スタッフ（OJT）のD&D制限', () => {
  beforeEach(() => {
    mockUseDraggable.mockClear();
  });

  it('companion_staff_id が sourceHelperId と一致するとき useDraggable に disabled:true が渡される', () => {
    const order = makeOrder({ companion_staff_id: 'helper-companion' });
    render(<GanttBar order={order} sourceHelperId="helper-companion" />);

    expect(mockUseDraggable).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: true }),
    );
  });

  it('companion_staff_id が sourceHelperId と一致しないとき useDraggable に disabled:true が渡されない（メインスタッフ行）', () => {
    const order = makeOrder({ companion_staff_id: 'helper-companion' });
    render(<GanttBar order={order} sourceHelperId="helper-main" />);

    expect(mockUseDraggable).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: false }),
    );
  });

  it('companion_staff_id が未設定のとき useDraggable に disabled:false が渡される', () => {
    const order = makeOrder();
    render(<GanttBar order={order} sourceHelperId="helper-main" />);

    expect(mockUseDraggable).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: false }),
    );
  });

  it('status: completed かつ companion_staff_id 一致のとき disabled:true（finalizedによる既存条件を維持）', () => {
    const order = makeOrder({ status: 'completed', companion_staff_id: 'helper-companion' });
    render(<GanttBar order={order} sourceHelperId="helper-companion" />);

    expect(mockUseDraggable).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: true }),
    );
  });
});

describe('GanttBar - 同行スタッフアイコン表示', () => {
  it('companion_staff_id が未設定 → Users アイコンが表示されない', () => {
    const order = makeOrder({ companion_staff_id: undefined });
    render(<GanttBar order={order} sourceHelperId="h1" />);

    expect(screen.queryByLabelText('同行スタッフあり')).toBeNull();
  });

  it('companion_staff_id が空文字 → Users アイコンが表示されない', () => {
    const order = makeOrder({ companion_staff_id: '' });
    render(<GanttBar order={order} sourceHelperId="h1" />);

    expect(screen.queryByLabelText('同行スタッフあり')).toBeNull();
  });

  it('companion_staff_id が設定済み → Users アイコンが表示される', () => {
    const order = makeOrder({ companion_staff_id: 'helper-b' });
    render(<GanttBar order={order} sourceHelperId="h1" />);

    expect(screen.getByLabelText('同行スタッフあり')).toBeTruthy();
  });
});
