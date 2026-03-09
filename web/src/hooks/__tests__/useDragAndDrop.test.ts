/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import type { Order, Helper, Customer, DayOfWeek } from '@/types';

// --- モック ---

const mockValidateDrop = vi.fn();
const mockUpdateOrderAssignment = vi.fn();
const mockUpdateOrderAssignmentAndTime = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastWarning = vi.fn();
const mockGetStaffCount = vi.fn();
const mockComputeNewStaffIds = vi.fn();

vi.mock('@/lib/dnd/validation', () => ({
  validateDrop: (...args: unknown[]) => mockValidateDrop(...args),
}));

vi.mock('@/lib/firestore/updateOrder', () => ({
  updateOrderAssignment: (...args: unknown[]) => mockUpdateOrderAssignment(...args),
  updateOrderAssignmentAndTime: (...args: unknown[]) => mockUpdateOrderAssignmentAndTime(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));

vi.mock('@/components/gantt/constants', () => ({
  deltaToTimeShift: vi.fn(() => 0),
  computeShiftedTimes: vi.fn(),
}));

vi.mock('@/lib/dnd/staffCount', () => ({
  getStaffCount: (...args: unknown[]) => mockGetStaffCount(...args),
}));

vi.mock('@/lib/dnd/computeStaffIds', () => ({
  computeNewStaffIds: (...args: unknown[]) => mockComputeNewStaffIds(...args),
}));

vi.mock('@/lib/undo/commands', () => ({
  createDragDropCommand: vi.fn((data: Record<string, unknown>) => ({ type: 'drag-drop', ...data })),
}));

import { useDragAndDrop } from '../useDragAndDrop';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'O001',
    customer_id: 'C001',
    assigned_staff_ids: ['H001'],
    start_time: '09:00',
    end_time: '10:00',
    ...overrides,
  } as Order;
}

function makeDefaultInput(overrides = {}) {
  const order = makeOrder();
  return {
    helperRows: [
      {
        helper: { id: 'H001', name: { family: '田中', given: '太郎' } } as Helper,
        orders: [order],
      },
    ],
    unassignedOrders: [] as Order[],
    helpers: new Map([['H001', { id: 'H001', name: { family: '田中', given: '太郎' } } as Helper]]),
    customers: new Map([['C001', { id: 'C001' } as Customer]]),
    unavailability: [],
    day: 'mon' as DayOfWeek,
    slotWidth: 60,
    ...overrides,
  };
}

describe('useDragAndDrop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStaffCount.mockReturnValue(1);
    mockComputeNewStaffIds.mockReturnValue(['H001']);
    mockValidateDrop.mockReturnValue({ allowed: true, warnings: [] });
    mockUpdateOrderAssignment.mockResolvedValue(undefined);
    mockUpdateOrderAssignmentAndTime.mockResolvedValue(undefined);
  });

  it('初期状態: activeOrder=null, dropZoneStatuses=空Map', () => {
    const { result } = renderHook(() => useDragAndDrop(makeDefaultInput()));

    expect(result.current.activeOrder).toBeNull();
    expect(result.current.dropZoneStatuses.size).toBe(0);
    expect(result.current.previewTimes).toBeNull();
    expect(result.current.dropMessage).toBeNull();
  });

  it('handleDragStart: activeOrderがセットされる', () => {
    const { result } = renderHook(() => useDragAndDrop(makeDefaultInput()));

    act(() => {
      result.current.handleDragStart({
        active: {
          id: 'O001',
          data: { current: { orderId: 'O001', sourceHelperId: 'H001' } },
        },
      } as unknown as DragStartEvent);
    });

    expect(result.current.activeOrder?.id).toBe('O001');
  });

  it('handleDragCancel: 全状態がリセットされる', () => {
    const { result } = renderHook(() => useDragAndDrop(makeDefaultInput()));

    // まずドラッグ開始
    act(() => {
      result.current.handleDragStart({
        active: {
          id: 'O001',
          data: { current: { orderId: 'O001', sourceHelperId: 'H001' } },
        },
      } as unknown as DragStartEvent);
    });
    expect(result.current.activeOrder).not.toBeNull();

    // キャンセル
    act(() => {
      result.current.handleDragCancel();
    });

    expect(result.current.activeOrder).toBeNull();
    expect(result.current.dropZoneStatuses.size).toBe(0);
    expect(result.current.previewTimes).toBeNull();
    expect(result.current.dropMessage).toBeNull();
  });

  it('handleDragEnd: 同じ場所+時間変更なしの場合はスキップ', async () => {
    const { result } = renderHook(() => useDragAndDrop(makeDefaultInput()));

    await act(async () => {
      await result.current.handleDragEnd({
        active: {
          id: 'O001',
          data: { current: { orderId: 'O001', sourceHelperId: 'H001' } },
        },
        over: { id: 'H001' },
        delta: { x: 0, y: 0 },
      } as unknown as DragEndEvent);
    });

    expect(mockUpdateOrderAssignment).not.toHaveBeenCalled();
  });

  it('handleDragEnd: 未割当セクションへのドロップで割当解除', async () => {
    const { result } = renderHook(() => useDragAndDrop(makeDefaultInput()));

    await act(async () => {
      await result.current.handleDragEnd({
        active: {
          id: 'O001',
          data: { current: { orderId: 'O001', sourceHelperId: 'H001' } },
        },
        over: { id: 'unassigned-section' },
        delta: { x: 0, y: 0 },
      } as unknown as DragEndEvent);
    });

    expect(mockUpdateOrderAssignment).toHaveBeenCalledWith('O001', []);
    expect(mockToastSuccess).toHaveBeenCalledWith('割当を解除しました');
  });

  it('handleDragEnd: バリデーション失敗時はエラートーストが表示される', async () => {
    mockValidateDrop.mockReturnValue({ allowed: false, reason: '資格不足', warnings: [] });

    const input = makeDefaultInput({
      helperRows: [
        {
          helper: { id: 'H001' } as Helper,
          orders: [makeOrder()],
        },
        {
          helper: { id: 'H002' } as Helper,
          orders: [],
        },
      ],
      helpers: new Map([
        ['H001', { id: 'H001' } as Helper],
        ['H002', { id: 'H002' } as Helper],
      ]),
    });

    const { result } = renderHook(() => useDragAndDrop(input));

    await act(async () => {
      await result.current.handleDragEnd({
        active: {
          id: 'O001',
          data: { current: { orderId: 'O001', sourceHelperId: 'H001' } },
        },
        over: { id: 'H002' },
        delta: { x: 0, y: 0 },
      } as unknown as DragEndEvent);
    });

    expect(mockToastError).toHaveBeenCalledWith('資格不足');
    expect(mockUpdateOrderAssignment).not.toHaveBeenCalled();
  });

  it('handleDragEnd: 更新失敗時にエラートーストが表示される', async () => {
    mockUpdateOrderAssignment.mockRejectedValue(new Error('Write error'));
    mockComputeNewStaffIds.mockReturnValue(['H002']);

    const input = makeDefaultInput({
      helperRows: [
        { helper: { id: 'H001' } as Helper, orders: [makeOrder()] },
        { helper: { id: 'H002' } as Helper, orders: [] },
      ],
      helpers: new Map([
        ['H001', { id: 'H001' } as Helper],
        ['H002', { id: 'H002', name: { family: '鈴木', given: '花子' } } as Helper],
      ]),
    });

    const { result } = renderHook(() => useDragAndDrop(input));

    await act(async () => {
      await result.current.handleDragEnd({
        active: {
          id: 'O001',
          data: { current: { orderId: 'O001', sourceHelperId: 'H001' } },
        },
        over: { id: 'H002' },
        delta: { x: 0, y: 0 },
      } as unknown as DragEndEvent);
    });

    expect(mockToastError).toHaveBeenCalledWith('更新に失敗しました');
  });
});
