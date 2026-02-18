import { describe, it, expect, vi } from 'vitest';

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

import { updateOrderStatus, bulkUpdateOrderStatus } from '../updateOrder';

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

  it('cancelled → assigned はエラーになる（最終状態）', async () => {
    await expect(updateOrderStatus('o1', 'cancelled', 'assigned')).rejects.toThrow(
      'Invalid status transition'
    );
  });

  it('completed → completed はエラーになる', async () => {
    await expect(updateOrderStatus('o1', 'completed', 'completed')).rejects.toThrow(
      'Invalid status transition'
    );
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
