/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- モック ---

const mockUpdateOrderAssignment = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/lib/firestore/updateOrder', () => ({
  updateOrderAssignment: (...args: unknown[]) => mockUpdateOrderAssignment(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('@/lib/undo/commands', () => ({
  createStaffChangeCommand: vi.fn((data: Record<string, unknown>) => ({ type: 'staff-change', ...data })),
}));

import { useOrderEdit } from '../useOrderEdit';

describe('useOrderEdit', () => {
  beforeEach(() => {
    mockUpdateOrderAssignment.mockReset();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it('初期状態: saving=false', () => {
    const { result } = renderHook(() => useOrderEdit());
    expect(result.current.saving).toBe(false);
  });

  it('handleStaffChange成功時: 成功トーストが表示される', async () => {
    mockUpdateOrderAssignment.mockResolvedValue(undefined);

    const { result } = renderHook(() => useOrderEdit());

    await act(async () => {
      await result.current.handleStaffChange('O001', ['H001', 'H002']);
    });

    expect(mockUpdateOrderAssignment).toHaveBeenCalledWith('O001', ['H001', 'H002']);
    expect(mockToastSuccess).toHaveBeenCalledWith('割当スタッフを更新しました');
    expect(result.current.saving).toBe(false);
  });

  it('handleStaffChange失敗時: エラートーストが表示される', async () => {
    mockUpdateOrderAssignment.mockRejectedValue(new Error('Write error'));

    const { result } = renderHook(() => useOrderEdit());

    await act(async () => {
      await result.current.handleStaffChange('O001', ['H001']);
    });

    expect(mockToastError).toHaveBeenCalledWith('割当スタッフの更新に失敗しました');
    expect(result.current.saving).toBe(false);
  });

  it('beforeState指定時: onCommandが呼ばれる', async () => {
    mockUpdateOrderAssignment.mockResolvedValue(undefined);
    const onCommand = vi.fn();

    const { result } = renderHook(() => useOrderEdit({ onCommand }));

    await act(async () => {
      await result.current.handleStaffChange(
        'O001',
        ['H002'],
        { assigned_staff_ids: ['H001'], manually_edited: false }
      );
    });

    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('beforeState未指定時: onCommandは呼ばれない', async () => {
    mockUpdateOrderAssignment.mockResolvedValue(undefined);
    const onCommand = vi.fn();

    const { result } = renderHook(() => useOrderEdit({ onCommand }));

    await act(async () => {
      await result.current.handleStaffChange('O001', ['H002']);
    });

    expect(onCommand).not.toHaveBeenCalled();
  });
});
