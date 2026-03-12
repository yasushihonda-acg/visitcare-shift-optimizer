import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/lib/firebase', () => ({
  getDb: vi.fn(() => ({})),
}));

import { updateOrderStatus, bulkUpdateOrderStatus, isValidTransition, isOrderStatus, patchOrder } from '../updateOrder';
import { doc, updateDoc } from 'firebase/firestore';

describe('updateOrderStatus - 状態遷移バリデーション', () => {
  it('assigned → completed は許可される', async () => {
    await expect(updateOrderStatus('o1', 'assigned', 'completed')).resolves.not.toThrow();
  });

  it('assigned → cancelled は許可される', async () => {
    await expect(updateOrderStatus('o1', 'assigned', 'cancelled')).resolves.not.toThrow();
  });

  it('pending → cancelled は許可される', async () => {
    await expect(updateOrderStatus('o1', 'pending', 'cancelled')).resolves.not.toThrow();
  });

  it('pending → completed はエラーになる', async () => {
    await expect(updateOrderStatus('o1', 'pending', 'completed')).rejects.toThrow(
      'Invalid status transition: pending → completed'
    );
  });

  it('completed → assigned はエラーになる（最終状態）', async () => {
    await expect(updateOrderStatus('o1', 'completed', 'assigned')).rejects.toThrow(
      'Invalid status transition'
    );
  });

  it('cancelled → pending は許可される（キャンセル取消）', async () => {
    await expect(updateOrderStatus('o1', 'cancelled', 'pending')).resolves.not.toThrow();
  });

  it('cancelled → assigned はエラーになる', async () => {
    await expect(updateOrderStatus('o1', 'cancelled', 'assigned')).rejects.toThrow(
      'Invalid status transition'
    );
  });

  it('completed → completed はエラーになる', async () => {
    await expect(updateOrderStatus('o1', 'completed', 'completed')).rejects.toThrow(
      'Invalid status transition'
    );
  });

  it('assigned → assigned はエラーになる（同一ステータス）', async () => {
    await expect(updateOrderStatus('o1', 'assigned', 'assigned')).rejects.toThrow(
      'Invalid status transition'
    );
  });
});

describe('isValidTransition - 純粋関数テスト', () => {
  it('assigned → completed は true', () => {
    expect(isValidTransition('assigned', 'completed')).toBe(true);
  });

  it('assigned → assigned は false（同一ステータス）', () => {
    expect(isValidTransition('assigned', 'assigned')).toBe(false);
  });

  it('completed → completed は false', () => {
    expect(isValidTransition('completed', 'completed')).toBe(false);
  });

  it('pending → cancelled は true', () => {
    expect(isValidTransition('pending', 'cancelled')).toBe(true);
  });

  it('pending → completed は false', () => {
    expect(isValidTransition('pending', 'completed')).toBe(false);
  });

  it('cancelled → pending は true（キャンセル取消）', () => {
    expect(isValidTransition('cancelled', 'pending')).toBe(true);
  });

  it('cancelled → assigned は false', () => {
    expect(isValidTransition('cancelled', 'assigned')).toBe(false);
  });
});

describe('isOrderStatus - 型ガードテスト', () => {
  it('有効な status 値は true', () => {
    expect(isOrderStatus('pending')).toBe(true);
    expect(isOrderStatus('assigned')).toBe(true);
    expect(isOrderStatus('completed')).toBe(true);
    expect(isOrderStatus('cancelled')).toBe(true);
  });

  it('無効な値は false', () => {
    expect(isOrderStatus('invalid')).toBe(false);
    expect(isOrderStatus('')).toBe(false);
  });
});

describe('patchOrder', () => {
  beforeEach(() => {
    vi.mocked(doc).mockReturnValue({} as ReturnType<typeof doc>);
    vi.mocked(updateDoc).mockResolvedValue(undefined);
  });

  it('指定フィールドとupdated_atを書き込む', async () => {
    const mockRef = { id: 'orders/o1' };
    vi.mocked(doc).mockReturnValue(mockRef as ReturnType<typeof doc>);

    await patchOrder('o1', { assigned_staff_ids: ['h1', 'h2'], manually_edited: true });

    expect(updateDoc).toHaveBeenCalledWith(mockRef, {
      assigned_staff_ids: ['h1', 'h2'],
      manually_edited: true,
      updated_at: 'SERVER_TIMESTAMP',
    });
  });

  it('時刻フィールドのみ更新できる', async () => {
    const mockRef = {};
    vi.mocked(doc).mockReturnValue(mockRef as ReturnType<typeof doc>);

    await patchOrder('o2', { start_time: '09:00', end_time: '10:00' });

    expect(updateDoc).toHaveBeenCalledWith(mockRef, {
      start_time: '09:00',
      end_time: '10:00',
      updated_at: 'SERVER_TIMESTAMP',
    });
  });

  it('manually_edited: false を書き込める（確認ボタンのundo用）', async () => {
    const mockRef = {};
    vi.mocked(doc).mockReturnValue(mockRef as ReturnType<typeof doc>);

    await patchOrder('o3', { manually_edited: false });

    expect(updateDoc).toHaveBeenCalledWith(mockRef, {
      manually_edited: false,
      updated_at: 'SERVER_TIMESTAMP',
    });
  });
});

describe('bulkUpdateOrderStatus', () => {
  it('有効な遷移のみ処理し件数を返す', async () => {
    const orders = [
      { id: 'o1', currentStatus: 'assigned' as const },
      { id: 'o2', currentStatus: 'pending' as const },    // pending → completed は無効
      { id: 'o3', currentStatus: 'assigned' as const },
      { id: 'o4', currentStatus: 'completed' as const },  // completed → completed は無効
    ];
    const count = await bulkUpdateOrderStatus(orders, 'completed');
    expect(count).toBe(2);  // o1 と o3 のみ
  });

  it('全て無効な遷移の場合は0を返す', async () => {
    const orders = [
      { id: 'o1', currentStatus: 'completed' as const },
      { id: 'o2', currentStatus: 'cancelled' as const },
    ];
    const count = await bulkUpdateOrderStatus(orders, 'completed');
    expect(count).toBe(0);
  });
});
