import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewModeToggle } from '../ViewModeToggle';

const mockSetViewMode = vi.fn();

vi.mock('@/contexts/ScheduleContext', () => ({
  useScheduleContext: () => ({
    viewMode: 'day',
    setViewMode: mockSetViewMode,
  }),
}));

describe('ViewModeToggle', () => {
  it('日と週のボタンが表示される', () => {
    render(<ViewModeToggle />);
    expect(screen.getByTestId('view-mode-day')).toBeInTheDocument();
    expect(screen.getByTestId('view-mode-week')).toBeInTheDocument();
  });

  it('viewMode=dayのとき日ボタンがアクティブ（aria-pressed=true）', () => {
    render(<ViewModeToggle />);
    expect(screen.getByTestId('view-mode-day')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('view-mode-week')).toHaveAttribute('aria-pressed', 'false');
  });

  it('週ボタンクリックでsetViewMode("week")が呼ばれる', () => {
    render(<ViewModeToggle />);
    fireEvent.click(screen.getByTestId('view-mode-week'));
    expect(mockSetViewMode).toHaveBeenCalledWith('week');
  });

  it('日ボタンクリックでsetViewMode("day")が呼ばれる', () => {
    render(<ViewModeToggle />);
    fireEvent.click(screen.getByTestId('view-mode-day'));
    expect(mockSetViewMode).toHaveBeenCalledWith('day');
  });

  it('data-testid="view-mode-toggle"が存在する', () => {
    render(<ViewModeToggle />);
    expect(screen.getByTestId('view-mode-toggle')).toBeInTheDocument();
  });
});
