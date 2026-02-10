import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayTabs } from '../DayTabs';

const mockSetSelectedDay = vi.fn();

vi.mock('@/contexts/ScheduleContext', () => ({
  useScheduleContext: () => ({
    selectedDay: 'monday',
    setSelectedDay: mockSetSelectedDay,
  }),
}));

describe('DayTabs', () => {
  it('7日分のタブを表示', () => {
    render(<DayTabs />);
    expect(screen.getByText('月')).toBeInTheDocument();
    expect(screen.getByText('火')).toBeInTheDocument();
    expect(screen.getByText('水')).toBeInTheDocument();
    expect(screen.getByText('木')).toBeInTheDocument();
    expect(screen.getByText('金')).toBeInTheDocument();
    expect(screen.getByText('土')).toBeInTheDocument();
    expect(screen.getByText('日')).toBeInTheDocument();
  });

  it('タブクリックでsetSelectedDayが呼ばれる', () => {
    render(<DayTabs />);
    fireEvent.click(screen.getByText('火'));
    expect(mockSetSelectedDay).toHaveBeenCalledWith('tuesday');
  });

  it('オーダー数バッジを表示', () => {
    render(<DayTabs orderCounts={{ monday: 25, tuesday: 18 }} />);
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('選択中のタブにaria-selected=true', () => {
    render(<DayTabs />);
    const monTab = screen.getByRole('tab', { name: /月/ });
    expect(monTab).toHaveAttribute('aria-selected', 'true');
  });
});
