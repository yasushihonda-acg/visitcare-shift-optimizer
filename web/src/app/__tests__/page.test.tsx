import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '../page';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/contexts/ScheduleContext', () => ({
  ScheduleProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useScheduleContext: () => ({
    weekStart: new Date('2025-01-06'),
    selectedDay: 'monday' as const,
    setSelectedDay: vi.fn(),
    viewMode: 'day' as const,
    setViewMode: vi.fn(),
    ganttAxis: 'helper' as const,
  }),
}));

vi.mock('@/hooks/useScheduleData', () => ({
  useScheduleData: () => ({
    customers: new Map(),
    helpers: new Map(),
    orderCounts: new Map(),
    getDaySchedule: () => ({ helperRows: [], unassignedOrders: [], totalOrders: 0 }),
    unavailability: [],
    loading: false,
    travelTimeLookup: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock('@/hooks/useDragAndDrop', () => ({
  useDragAndDrop: () => ({
    dropZoneStatuses: new Map(),
    activeOrder: null,
    previewTimes: null,
    dropMessage: null,
    handleDragStart: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragMove: vi.fn(),
    handleDragEnd: vi.fn(),
    handleDragCancel: vi.fn(),
  }),
}));

vi.mock('@/hooks/useOrderEdit', () => ({
  useOrderEdit: () => ({ saving: false, handleStaffChange: vi.fn() }),
}));

vi.mock('@/hooks/useUndoRedo', () => ({
  useUndoRedo: () => ({
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    pushCommand: vi.fn(),
    clearHistory: vi.fn(),
    undoLabel: '',
    redoLabel: '',
  }),
}));

vi.mock('@/hooks/useUndoRedoKeyboard', () => ({
  useUndoRedoKeyboard: vi.fn(),
}));

vi.mock('@/hooks/useAssignmentDiff', () => ({
  useAssignmentDiff: () => ({ diffMap: new Map() }),
}));

vi.mock('@/hooks/useServiceTypes', () => ({
  useServiceTypes: () => ({ serviceTypes: new Map(), sortedList: [], loading: false, error: null }),
}));

vi.mock('@/components/onboarding/useWelcomeDialog', () => ({
  useWelcomeDialog: () => ({ welcomeOpen: false, closeWelcome: vi.fn(), reopenWelcome: vi.fn() }),
}));

vi.mock('@/components/layout/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

vi.mock('@/components/onboarding/WelcomeDialog', () => ({
  WelcomeDialog: () => null,
}));

vi.mock('@/components/schedule/DayTabs', () => ({
  DayTabs: () => <div>DayTabs</div>,
}));

vi.mock('@/components/schedule/ViewModeToggle', () => ({
  ViewModeToggle: () => <div>ViewModeToggle</div>,
}));

vi.mock('@/components/schedule/StatsBar', () => ({
  StatsBar: () => <div data-testid="stats-bar">StatsBar</div>,
}));

vi.mock('@/components/schedule/OptimizeButton', () => ({
  OptimizeButton: () => <button>最適化</button>,
}));

vi.mock('@/components/schedule/NotifyChangesButton', () => ({
  NotifyChangesButton: () => null,
}));

vi.mock('@/components/schedule/ResetButton', () => ({
  ResetButton: () => null,
}));

vi.mock('@/components/schedule/BulkCompleteButton', () => ({
  BulkCompleteButton: () => null,
}));

vi.mock('@/components/schedule/UndoRedoButtons', () => ({
  UndoRedoButtons: () => null,
}));

vi.mock('@/components/gantt/GanttChart', () => ({
  GanttChart: () => <div data-testid="gantt-chart">GanttChart</div>,
}));

vi.mock('@/components/gantt/WeeklyGanttChart', () => ({
  WeeklyGanttChart: () => <div>WeeklyGanttChart</div>,
}));

vi.mock('@/components/gantt/CustomerGanttChart', () => ({
  CustomerGanttChart: () => <div>CustomerGanttChart</div>,
}));

vi.mock('@/components/schedule/OrderDetailPanel', () => ({
  OrderDetailPanel: () => null,
}));

vi.mock('@/lib/constraints/checker', () => ({
  checkConstraints: () => new Map(),
}));

vi.mock('@/lib/undo/commands', () => ({
  createConfirmEditCommand: vi.fn(),
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
}));

// ── テスト ──────────────────────────────────────────────────────

describe('メインスケジュールページ', () => {
  it('エラーなくレンダリングされる', () => {
    render(<Home />);
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('ガントチャートが表示される', () => {
    render(<Home />);
    expect(screen.getByTestId('gantt-chart')).toBeInTheDocument();
  });

  it('統計バーが表示される', () => {
    render(<Home />);
    expect(screen.getByTestId('stats-bar')).toBeInTheDocument();
  });
});
