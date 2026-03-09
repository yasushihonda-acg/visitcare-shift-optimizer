import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeeklyAvailabilityEditor } from '../WeeklyAvailabilityEditor';

// ── テスト ──────────────────────────────────────────────────────

describe('WeeklyAvailabilityEditor', () => {
  it('ラベル「週間勤務可能時間」が表示される', () => {
    render(<WeeklyAvailabilityEditor value={{}} onChange={vi.fn()} />);
    expect(screen.getByText('週間勤務可能時間')).toBeInTheDocument();
  });

  it('全曜日が表示される', () => {
    render(<WeeklyAvailabilityEditor value={{}} onChange={vi.fn()} />);
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
      <WeeklyAvailabilityEditor
        value={{ monday: [{ start_time: '09:00', end_time: '17:00' }] }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('(1件)')).toBeInTheDocument();
  });

  it('追加ボタンクリックでonChangeがデフォルトスロットで呼ばれる', () => {
    const onChange = vi.fn();
    render(<WeeklyAvailabilityEditor value={{}} onChange={onChange} />);
    // 最初の「追加」ボタン（月曜日）をクリック
    const addButtons = screen.getAllByText('追加');
    fireEvent.click(addButtons[0]);
    expect(onChange).toHaveBeenCalledWith({
      monday: [{ start_time: '09:00', end_time: '18:00' }],
    });
  });

  it('スロットがある曜日はデフォルトで展開される', () => {
    render(
      <WeeklyAvailabilityEditor
        value={{ tuesday: [{ start_time: '10:00', end_time: '15:00' }] }}
        onChange={vi.fn()}
      />
    );
    // 展開されているとtime inputが見える
    expect(screen.getByDisplayValue('10:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('15:00')).toBeInTheDocument();
  });

  it('スロットのない曜日は折りたたまれている', () => {
    render(
      <WeeklyAvailabilityEditor
        value={{ tuesday: [{ start_time: '10:00', end_time: '15:00' }] }}
        onChange={vi.fn()}
      />
    );
    // 月曜日にはスロットなし → time inputは火曜のもののみ
    const timeInputs = screen.getAllByDisplayValue(/\d{2}:\d{2}/);
    expect(timeInputs).toHaveLength(2); // start/end for tuesday only
  });

  it('複数スロットが正しく表示される', () => {
    render(
      <WeeklyAvailabilityEditor
        value={{
          monday: [
            { start_time: '09:00', end_time: '12:00' },
            { start_time: '13:00', end_time: '17:00' },
          ],
        }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('(2件)')).toBeInTheDocument();
  });

  it('開始時間を変更するとonChangeが呼ばれる', () => {
    const onChange = vi.fn();
    render(
      <WeeklyAvailabilityEditor
        value={{ monday: [{ start_time: '09:00', end_time: '17:00' }] }}
        onChange={onChange}
      />
    );
    const startInput = screen.getByDisplayValue('09:00');
    fireEvent.change(startInput, { target: { value: '10:00' } });
    expect(onChange).toHaveBeenCalledWith({
      monday: [{ start_time: '10:00', end_time: '17:00' }],
    });
  });
});
