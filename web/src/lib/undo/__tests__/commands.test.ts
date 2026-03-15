import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firestore/updateOrder', () => ({
  patchOrder: vi.fn().mockResolvedValue(undefined),
}));

import { createDragDropCommand, createStaffChangeCommand, createCompanionChangeCommand, createConfirmEditCommand } from '../commands';
import { patchOrder } from '@/lib/firestore/updateOrder';

describe('createDragDropCommand', () => {
  beforeEach(() => {
    vi.mocked(patchOrder).mockResolvedValue(undefined);
  });

  it('undo() でbefore状態をパッチする', async () => {
    const before = { assigned_staff_ids: ['h1'], start_time: '09:00', end_time: '10:00', manually_edited: false };
    const after = { assigned_staff_ids: ['h2'], start_time: '10:00', end_time: '11:00', manually_edited: true };
    const cmd = createDragDropCommand({ orderId: 'o1', label: 'テスト移動', before, after });

    await cmd.undo();

    expect(patchOrder).toHaveBeenCalledWith('o1', before);
  });

  it('redo() でafter状態をパッチする', async () => {
    const before = { assigned_staff_ids: ['h1'], manually_edited: false };
    const after = { assigned_staff_ids: ['h2'], manually_edited: true };
    const cmd = createDragDropCommand({ orderId: 'o1', label: 'テスト', before, after });

    await cmd.redo();

    expect(patchOrder).toHaveBeenCalledWith('o1', after);
  });

  it('idが一意なUUIDである', () => {
    const cmd1 = createDragDropCommand({ orderId: 'o1', label: 'a', before: {}, after: {} });
    const cmd2 = createDragDropCommand({ orderId: 'o1', label: 'a', before: {}, after: {} });
    expect(cmd1.id).not.toBe(cmd2.id);
  });

  it('labelが設定される', () => {
    const cmd = createDragDropCommand({ orderId: 'o1', label: '田中さんを移動', before: {}, after: {} });
    expect(cmd.label).toBe('田中さんを移動');
  });
});

describe('createStaffChangeCommand', () => {
  beforeEach(() => {
    vi.mocked(patchOrder).mockResolvedValue(undefined);
  });

  it('undo() でbefore状態のスタッフを復元する', async () => {
    const before = { assigned_staff_ids: ['h1'], manually_edited: false };
    const after = { assigned_staff_ids: ['h2'], manually_edited: true };
    const cmd = createStaffChangeCommand({ orderId: 'o2', label: 'スタッフ変更', before, after });

    await cmd.undo();

    expect(patchOrder).toHaveBeenCalledWith('o2', before);
  });

  it('redo() でafter状態のスタッフを設定する', async () => {
    const before = { assigned_staff_ids: ['h1'], manually_edited: false };
    const after = { assigned_staff_ids: ['h2'], manually_edited: true };
    const cmd = createStaffChangeCommand({ orderId: 'o2', label: 'スタッフ変更', before, after });

    await cmd.redo();

    expect(patchOrder).toHaveBeenCalledWith('o2', after);
  });
});

describe('createCompanionChangeCommand', () => {
  beforeEach(() => {
    vi.mocked(patchOrder).mockResolvedValue(undefined);
  });

  it('undo() で同行設定前の状態を復元する', async () => {
    const before = { companion_staff_id: null, assigned_staff_ids: ['h1'], staff_count: 1, manually_edited: false };
    const after = { companion_staff_id: 'h2', assigned_staff_ids: ['h1', 'h2'], staff_count: 2, manually_edited: true };
    const cmd = createCompanionChangeCommand({ orderId: 'o1', label: '同行設定', before, after });

    await cmd.undo();

    expect(patchOrder).toHaveBeenCalledWith('o1', before);
  });

  it('redo() で同行設定後の状態を適用する', async () => {
    const before = { companion_staff_id: null, assigned_staff_ids: ['h1'], staff_count: 1, manually_edited: false };
    const after = { companion_staff_id: 'h2', assigned_staff_ids: ['h1', 'h2'], staff_count: 2, manually_edited: true };
    const cmd = createCompanionChangeCommand({ orderId: 'o1', label: '同行設定', before, after });

    await cmd.redo();

    expect(patchOrder).toHaveBeenCalledWith('o1', after);
  });
});

describe('createConfirmEditCommand', () => {
  beforeEach(() => {
    vi.mocked(patchOrder).mockResolvedValue(undefined);
  });

  it('undo() でmanually_edited: trueに戻す', async () => {
    const cmd = createConfirmEditCommand('o3');

    await cmd.undo();

    expect(patchOrder).toHaveBeenCalledWith('o3', { manually_edited: true });
  });

  it('redo() でmanually_edited: falseにする', async () => {
    const cmd = createConfirmEditCommand('o3');

    await cmd.redo();

    expect(patchOrder).toHaveBeenCalledWith('o3', { manually_edited: false });
  });

  it('labelは「変更確認」', () => {
    const cmd = createConfirmEditCommand('o3');
    expect(cmd.label).toBe('変更確認');
  });
});
