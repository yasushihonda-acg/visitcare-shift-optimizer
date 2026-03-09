import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeekSelector } from '../WeekSelector';

// ── モック ──────────────────────────────────────────────────────

const mockGoToNextWeek = vi.fn();
const mockGoToPrevWeek = vi.fn();
const mockGoToWeek = vi.fn();

vi.mock('@/contexts/ScheduleContext', () => ({
  useScheduleContext: () => ({
    weekStart: new Date('2026-03-09'),
    goToNextWeek: mockGoToNextWeek,
    goToPrevWeek: mockGoToPrevWeek,
    goToWeek: mockGoToWeek,
  }),
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => <div data-testid="calendar" />,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ── テスト ──────────────────────────────────────────────────────

describe('WeekSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('週の期間ラベルが表示される', () => {
    render(<WeekSelector />);
    // 2026-03-09 (月) ~ 2026-03-15 (日) → "3/9 - 3/15"
    expect(screen.getByText('3/9 - 3/15')).toBeInTheDocument();
  });

  it('前の週ボタンが表示される', () => {
    render(<WeekSelector />);
    expect(screen.getByLabelText('前の週')).toBeInTheDocument();
  });

  it('次の週ボタンが表示される', () => {
    render(<WeekSelector />);
    expect(screen.getByLabelText('次の週')).toBeInTheDocument();
  });

  it('前の週ボタンクリックでgoToPrevWeekが呼ばれる', () => {
    render(<WeekSelector />);
    fireEvent.click(screen.getByLabelText('前の週'));
    expect(mockGoToPrevWeek).toHaveBeenCalledOnce();
  });

  it('次の週ボタンクリックでgoToNextWeekが呼ばれる', () => {
    render(<WeekSelector />);
    fireEvent.click(screen.getByLabelText('次の週'));
    expect(mockGoToNextWeek).toHaveBeenCalledOnce();
  });

  it('カレンダーが表示される', () => {
    render(<WeekSelector />);
    expect(screen.getByTestId('calendar')).toBeInTheDocument();
  });
});
