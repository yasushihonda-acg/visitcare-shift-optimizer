/** DnD 型定義 */

/** ドラッグ元の情報 */
export interface DragData {
  orderId: string;
  sourceHelperId: string | null; // null = 未割当
}

/** ドロップ先の情報 */
export interface DropData {
  helperId: string | null; // null = 未割当セクション
}

/** バリデーション結果 */
export type DropValidationResult =
  | { allowed: true; warnings: string[] }
  | { allowed: false; reason: string };

/** ドロップゾーンの状態 */
export type DropZoneStatus = 'idle' | 'valid' | 'warning' | 'invalid';
