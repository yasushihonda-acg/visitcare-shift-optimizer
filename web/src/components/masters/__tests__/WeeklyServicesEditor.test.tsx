import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeeklyServicesEditor } from '../WeeklyServicesEditor';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value }: { children: React.ReactNode; value?: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
}));

vi.mock('@/hooks/useServiceTypes', () => ({
  useServiceTypes: () => ({
    sortedList: [
      { code: 'physical_care', label: '身体介護', sort_order: 1 },
      { code: 'daily_living', label: '生活援助', sort_order: 2 },
    ],
    loading: false,
  }),
}));

vi.mock('@/lib/validation/timeOverlap', () => ({
  detectOverlaps: () => new Set<number>(),
}));

// ── テスト ──────────────────────────────────────────────────────

describe('WeeklyServicesEditor', () => {
  it('ラベル「週間サービス」が表示される', () => {
    render(<WeeklyServicesEditor value={{}} onChange={vi.fn()} />);
    expect(screen.getByText('週間サービス')).toBeInTheDocument();
  });

  it('全曜日が表示される', () => {
    render(<WeeklyServicesEditor value={{}} onChange={vi.fn()} />);
    expect(screen.getByText('月')).toBeInTheDocument();
    expect(screen.getByText('火')).toBeInTheDocument();
    expect(screen.getByText('水')).toBeInTheDocument();
    expect(screen.getByText('木')).toBeInTheDocument();
    expect(screen.getByText('金')).toBeInTheDocument();
    expect(screen.getByText('土')).toBeInTheDocument();
    expect(screen.getByText('日')).toBeInTheDocument();
  });

  it('スロットがある曜日に件数が表示される', () => {
    render(
      <WeeklyServicesEditor
        value={{
          monday: [{ start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 1 }],
        }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('(1件)')).toBeInTheDocument();
  });

  it('追加ボタンクリックでonChangeが呼ばれる', () => {
    const onChange = vi.fn();
    render(<WeeklyServicesEditor value={{}} onChange={onChange} />);
    const addButtons = screen.getAllByText('追加');
    fireEvent.click(addButtons[0]); // 月曜の追加ボタン
    expect(onChange).toHaveBeenCalled();
    const calledWith = onChange.mock.calls[0][0];
    expect(calledWith.monday).toHaveLength(1);
    expect(calledWith.monday[0].service_type).toBe('physical_care');
  });

  it('スロットがある曜日はデフォルトで展開される', () => {
    render(
      <WeeklyServicesEditor
        value={{
          wednesday: [{ start_time: '14:00', end_time: '15:00', service_type: 'daily_living', staff_count: 1 }],
        }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('14:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('15:00')).toBeInTheDocument();
  });

  it('開始時間を変更するとonChangeが呼ばれる', () => {
    const onChange = vi.fn();
    render(
      <WeeklyServicesEditor
        value={{
          monday: [{ start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 1 }],
        }}
        onChange={onChange}
      />
    );
    const startInput = screen.getByDisplayValue('09:00');
    fireEvent.change(startInput, { target: { value: '10:30' } });
    expect(onChange).toHaveBeenCalledWith({
      monday: [{ start_time: '10:30', end_time: '10:00', service_type: 'physical_care', staff_count: 1 }],
    });
  });

  it('複数スロットの件数が正しく表示される', () => {
    render(
      <WeeklyServicesEditor
        value={{
          friday: [
            { start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 1 },
            { start_time: '14:00', end_time: '15:00', service_type: 'daily_living', staff_count: 2 },
          ],
        }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('(2件)')).toBeInTheDocument();
  });
});
