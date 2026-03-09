import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonthSelector } from '../MonthSelector';

describe('MonthSelector', () => {
  const month = new Date('2026-03-01');

  it('現在の年月が表示される', () => {
    render(<MonthSelector month={month} onChange={vi.fn()} />);
    expect(screen.getByText('2026年3月')).toBeInTheDocument();
  });

  it('前月ボタンをクリックすると1ヶ月前の日付でonChangeが呼ばれる', () => {
    const onChange = vi.fn();
    render(<MonthSelector month={month} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('前月'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const called = onChange.mock.calls[0][0] as Date;
    expect(called.getFullYear()).toBe(2026);
    expect(called.getMonth()).toBe(1); // February = 1
  });

  it('次月ボタンをクリックすると1ヶ月後の日付でonChangeが呼ばれる', () => {
    const onChange = vi.fn();
    render(<MonthSelector month={month} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('次月'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const called = onChange.mock.calls[0][0] as Date;
    expect(called.getFullYear()).toBe(2026);
    expect(called.getMonth()).toBe(3); // April = 3
  });

  it('年末の場合に正しく年をまたぐ', () => {
    const december = new Date('2026-12-01');
    const onChange = vi.fn();
    render(<MonthSelector month={december} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('次月'));

    const called = onChange.mock.calls[0][0] as Date;
    expect(called.getFullYear()).toBe(2027);
    expect(called.getMonth()).toBe(0); // January = 0
  });
});
