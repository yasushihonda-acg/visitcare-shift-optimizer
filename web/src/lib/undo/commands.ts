import { patchOrder } from '@/lib/firestore/updateOrder';
import type { Order } from '@/types';
import type { UndoCommand } from './types';

type OrderPatch = Partial<Pick<Order, 'assigned_staff_ids' | 'companion_staff_id' | 'staff_count' | 'start_time' | 'end_time' | 'manually_edited'>>;

/** patchOrder ベースの汎用 undo/redo コマンドファクトリ */
function createPatchCommand<T extends OrderPatch>(params: {
  orderId: string;
  label: string;
  before: T;
  after: T;
}): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label: params.label,
    undo: () => patchOrder(params.orderId, params.before),
    redo: () => patchOrder(params.orderId, params.after),
  };
}

/** D&D移動コマンド */
export const createDragDropCommand = createPatchCommand;

/** 詳細パネルからのスタッフ変更コマンド */
export const createStaffChangeCommand = createPatchCommand<
  Pick<OrderPatch, 'assigned_staff_ids' | 'manually_edited'>
>;

/** 同行スタッフ変更コマンド */
export const createCompanionChangeCommand = createPatchCommand<
  Pick<OrderPatch, 'companion_staff_id' | 'assigned_staff_ids' | 'staff_count' | 'manually_edited'>
>;

/**
 * 「確認」ボタン押下コマンドを生成する。
 * redo() = manually_edited: false（確認実行）
 * undo() = manually_edited: true（アンバーリング復元）
 */
export function createConfirmEditCommand(orderId: string): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label: '変更確認',
    undo: () => patchOrder(orderId, { manually_edited: true }),
    redo: () => patchOrder(orderId, { manually_edited: false }),
  };
}
