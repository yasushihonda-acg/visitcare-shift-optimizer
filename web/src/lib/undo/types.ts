export interface UndoCommand {
  id: string;           // crypto.randomUUID()
  label: string;        // 表示用: "田中太郎を月曜9:00→10:00に移動"
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}
