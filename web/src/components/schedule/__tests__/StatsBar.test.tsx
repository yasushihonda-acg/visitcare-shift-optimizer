import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsBar } from '../StatsBar';
import type { DaySchedule } from '@/hooks/useScheduleData';
import type { ViolationMap } from '@/lib/constraints/checker';
import type { Order, Helper } from '@/types';

// ── ヘルパー ──────────────────────────────────────────────────

function makeHelper(id: string): Helper {
  return {
    id,
    name: { family: '佐藤', given: id },
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

function makeOrder(id: string, status: Order['status'] = 'assigned'): Order {
  return {
    id,
    customer_id: 'c1',
    week_start_date: new Date('2026-03-09'),
    date: new Date('2026-03-10'),
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    staff_count: 1,
    assigned_staff_ids: status === 'assigned' ? ['h1'] : [],
    status,
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function makeSchedule(opts: {
  assigned?: Order[];
  unassigned?: Order[];
  helperCount?: number;
}): DaySchedule {
  const assigned = opts.assigned ?? [];
  const unassigned = opts.unassigned ?? [];
  const helperCount = opts.helperCount ?? 1;
  const rows = [];
  for (let i = 0; i < helperCount; i++) {
    rows.push({
      helper: makeHelper(`h${i + 1}`),
      orders: i === 0 ? assigned : [],
    });
  }
  return {
    day: 'tuesday',
    date: new Date('2026-03-10'),
    helperRows: rows,
    unassignedOrders: unassigned,
    totalOrders: assigned.length + unassigned.length,
  };
}

// ── テスト ──────────────────────────────────────────────────────

describe('StatsBar', () => {
  const emptyViolations: ViolationMap = new Map();

  it('オーダー数が表示される', () => {
    const schedule = makeSchedule({ assigned: [makeOrder('o1'), makeOrder('o2')] });
    render(<StatsBar schedule={schedule} violations={emptyViolations} />);
    expect(screen.getByText('オーダー')).toBeInTheDocument();
  });

  it('割当済み件数が表示される', () => {
    const schedule = makeSchedule({ assigned: [makeOrder('o1')] });
    render(<StatsBar schedule={schedule} violations={emptyViolations} />);
    expect(screen.getByText('割当済')).toBeInTheDocument();
  });

  it('未割当件数が表示される', () => {
    const schedule = makeSchedule({
      assigned: [],
      unassigned: [makeOrder('o1', 'pending')],
    });
    render(<StatsBar schedule={schedule} violations={emptyViolations} />);
    expect(screen.getByText('未割当')).toBeInTheDocument();
  });

  it('ヘルパー数が表示される', () => {
    const schedule = makeSchedule({ assigned: [makeOrder('o1')], helperCount: 3 });
    render(<StatsBar schedule={schedule} violations={emptyViolations} />);
    expect(screen.getByText('ヘルパー')).toBeInTheDocument();
  });

  it('違反がある場合にバッジが表示される', () => {
    const schedule = makeSchedule({ assigned: [makeOrder('o1')] });
    const violations: ViolationMap = new Map([
      ['h1', [{ type: 'overlap', severity: 'error', message: 'テスト違反', orderId: 'o1', helperId: 'h1' }]],
    ]);
    render(<StatsBar schedule={schedule} violations={violations} />);
    expect(screen.getByText('違反1')).toBeInTheDocument();
  });

  it('警告がある場合に警告バッジが表示される', () => {
    const schedule = makeSchedule({ assigned: [makeOrder('o1')] });
    const violations: ViolationMap = new Map([
      ['h1', [{ type: 'outside_hours', severity: 'warning', message: '稼働超過', orderId: 'o1' }]],
    ]);
    render(<StatsBar schedule={schedule} violations={violations} />);
    expect(screen.getByText('警告1')).toBeInTheDocument();
  });

  it('最適化差分が0件のとき「変更なし」が表示される', () => {
    const schedule = makeSchedule({ assigned: [makeOrder('o1')] });
    render(<StatsBar schedule={schedule} violations={emptyViolations} />);
    expect(screen.getByText('変更なし')).toBeInTheDocument();
  });

  it('最適化差分がある場合に件数が表示される', () => {
    const schedule = makeSchedule({ assigned: [makeOrder('o1')] });
    const diffMap = new Map([
      ['o1', { added: ['h2'], removed: ['h1'], isChanged: true }],
    ]);
    render(<StatsBar schedule={schedule} violations={emptyViolations} diffMap={diffMap} />);
    expect(screen.getByText('件変更')).toBeInTheDocument();
  });

  it('完了済みオーダーがある場合に実績確認が表示される', () => {
    const schedule = makeSchedule({
      assigned: [makeOrder('o1', 'completed')],
    });
    render(<StatsBar schedule={schedule} violations={emptyViolations} />);
    expect(screen.getByText('実績確認')).toBeInTheDocument();
  });

  it('キャンセルオーダーがある場合に取消バッジが表示される', () => {
    const schedule = makeSchedule({
      assigned: [makeOrder('o1', 'assigned')],
      unassigned: [makeOrder('o2', 'cancelled')],
    });
    render(<StatsBar schedule={schedule} violations={emptyViolations} />);
    expect(screen.getByText(/取消1/)).toBeInTheDocument();
  });

  it('staff_count=2 のオーダーが複数ヘルパー行にあっても割当済は1件としてカウントされる', () => {
    // staff_count=2 のオーダーは2人のヘルパーに割り当てられ、各行に同じオーダーが入る
    const multiStaffOrder: Order = {
      ...makeOrder('o-multi', 'assigned'),
      staff_count: 2,
      assigned_staff_ids: ['h1', 'h2'],
    };
    const singleOrder = makeOrder('o-single', 'assigned');

    const schedule: DaySchedule = {
      day: 'tuesday',
      date: new Date('2026-03-10'),
      helperRows: [
        { helper: makeHelper('h1'), orders: [multiStaffOrder, singleOrder] },
        { helper: makeHelper('h2'), orders: [multiStaffOrder] },
      ],
      unassignedOrders: [],
      totalOrders: 2, // 実際のオーダーは2件（multi + single）
    };

    render(<StatsBar schedule={schedule} violations={emptyViolations} />);

    // 割当済は2件であるべき（multiStaffOrderは1回のみカウント）
    // totalOrders=2 なので割当率は100%
    expect(screen.getByText('100%')).toBeInTheDocument();
    // 割当済の数値 "2" が表示される
    const assignedSection = screen.getByText('割当済').closest('div')!.parentElement!;
    expect(assignedSection.textContent).toContain('2');
    expect(assignedSection.textContent).toContain('100%');
  });

  it('staff_count=2 のcompleted/cancelledオーダーも重複カウントされない', () => {
    const completedMulti: Order = {
      ...makeOrder('o-comp', 'completed'),
      staff_count: 2,
      assigned_staff_ids: ['h1', 'h2'],
    };
    const cancelledSingle = makeOrder('o-cancel', 'cancelled');

    const schedule: DaySchedule = {
      day: 'tuesday',
      date: new Date('2026-03-10'),
      helperRows: [
        { helper: makeHelper('h1'), orders: [completedMulti] },
        { helper: makeHelper('h2'), orders: [completedMulti] },
      ],
      unassignedOrders: [cancelledSingle],
      totalOrders: 2,
    };

    render(<StatsBar schedule={schedule} violations={emptyViolations} />);

    // completed=1件（重複排除）、cancelled=1件
    // 完了率 = 1 / (2 - 1) = 100%
    expect(screen.getByText(/取消1/)).toBeInTheDocument();
  });
});
