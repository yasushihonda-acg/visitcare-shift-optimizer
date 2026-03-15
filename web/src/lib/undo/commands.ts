import { patchOrder } from '@/lib/firestore/updateOrder';
import type { Order } from '@/types';
import type { UndoCommand } from './types';

type OrderPatch = Partial<Pick<Order, 'assigned_staff_ids' | 'companion_staff_id' | 'staff_count' | 'start_time' | 'end_time' | 'manually_edited'>>;

/**
 * D&D移動コマンドを生成する。
 * before/afterに assigned_staff_ids, start_time, end_time, manually_edited を含める。
 */
export function createDragDropCommand(params: {
  orderId: string;
  label: string;
  before: OrderPatch;
  after: OrderPatch;
}): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label: params.label,
    undo: () => patchOrder(params.orderId, params.before),
    redo: () => patchOrder(params.orderId, params.after),
  };
}

/**
 * 詳細パネルからのスタッフ変更コマンドを生成する。
 */
export function createStaffChangeCommand(params: {
  orderId: string;
  label: string;
  before: { assigned_staff_ids: string[]; manually_edited: boolean };
  after: { assigned_staff_ids: string[]; manually_edited: boolean };
}): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label: params.label,
    undo: () => patchOrder(params.orderId, params.before),
    redo: () => patchOrder(params.orderId, params.after),
  };
}

type CompanionPatch = Pick<OrderPatch, 'companion_staff_id' | 'assigned_staff_ids' | 'staff_count' | 'manually_edited'>;

/**
 * 同行スタッフ変更コマンドを生成する。
 */
export function createCompanionChangeCommand(params: {
  orderId: string;
  label: string;
  before: CompanionPatch;
  after: CompanionPatch;
}): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label: params.label,
    undo: () => patchOrder(params.orderId, params.before),
    redo: () => patchOrder(params.orderId, params.after),
  };
}

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
