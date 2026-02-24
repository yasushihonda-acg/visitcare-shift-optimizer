import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useUndoRedo } from '../useUndoRedo';
import type { UndoCommand } from '@/lib/undo/types';

function makeCmd(
  label: string,
  undoFn = vi.fn().mockResolvedValue(undefined),
  redoFn = vi.fn().mockResolvedValue(undefined)
): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label,
    undo: undoFn,
    redo: redoFn,
  };
}

describe('useUndoRedo', () => {
  it('初期状態: canUndo/canRedoはfalse', () => {
    const { result } = renderHook(() => useUndoRedo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undoLabel).toBeUndefined();
    expect(result.current.redoLabel).toBeUndefined();
  });

  it('pushCommand後: canUndoがtrueになり、undoLabelが設定される', () => {
    const { result } = renderHook(() => useUndoRedo());
    const cmd = makeCmd('アクション1');
    act(() => { result.current.pushCommand(cmd); });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undoLabel).toBe('アクション1');
  });

  it('undo実行: cmd.undo()が呼ばれ、canRedoがtrueになる', async () => {
    const undoFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useUndoRedo());
    const cmd = makeCmd('テスト', undoFn);

    act(() => { result.current.pushCommand(cmd); });
    await act(async () => { await result.current.undo(); });

    expect(undoFn).toHaveBeenCalledOnce();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    expect(result.current.redoLabel).toBe('テスト');
  });

  it('redo実行: cmd.redo()が呼ばれ、canUndoがtrueになる', async () => {
    const redoFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useUndoRedo());
    const cmd = makeCmd('テスト', vi.fn().mockResolvedValue(undefined), redoFn);

    act(() => { result.current.pushCommand(cmd); });
    await act(async () => { await result.current.undo(); });
    await act(async () => { await result.current.redo(); });

    expect(redoFn).toHaveBeenCalledOnce();
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('canUndo=falseのときundoは何もしない', async () => {
    const undoFn = vi.fn();
    const { result } = renderHook(() => useUndoRedo());

    await act(async () => { await result.current.undo(); });

    expect(undoFn).not.toHaveBeenCalled();
  });

  it('新操作でredoスタックがクリアされる', async () => {
    const { result } = renderHook(() => useUndoRedo());
    const cmd1 = makeCmd('cmd1');
    const cmd2 = makeCmd('cmd2');
    const cmd3 = makeCmd('cmd3');

    act(() => { result.current.pushCommand(cmd1); });
    act(() => { result.current.pushCommand(cmd2); });
    await act(async () => { await result.current.undo(); }); // cmd2をfutureへ
    act(() => { result.current.pushCommand(cmd3); }); // futureをクリア

    expect(result.current.canRedo).toBe(false);
  });

  it('clearHistory: pastとfutureが両方クリアされる', async () => {
    const { result } = renderHook(() => useUndoRedo());
    act(() => { result.current.pushCommand(makeCmd('cmd1')); });
    await act(async () => { await result.current.undo(); }); // futureに1件

    act(() => { result.current.clearHistory(); });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('maxHistory: 上限を超えると古い履歴が削除される', async () => {
    const { result } = renderHook(() => useUndoRedo(2));
    const cmd1 = makeCmd('cmd1');
    const cmd2 = makeCmd('cmd2');
    const cmd3 = makeCmd('cmd3');

    act(() => {
      result.current.pushCommand(cmd1);
      result.current.pushCommand(cmd2);
      result.current.pushCommand(cmd3);
    });

    // maxHistory=2 なので past=[cmd2, cmd3]
    expect(result.current.undoLabel).toBe('cmd3');
    await act(async () => { await result.current.undo(); });
    expect(result.current.undoLabel).toBe('cmd2');
    await act(async () => { await result.current.undo(); });
    // cmd1 は削除されているので canUndo=false
    expect(result.current.canUndo).toBe(false);
  });

  it('undo失敗時: 状態を変更しない', async () => {
    const failingUndo = vi.fn().mockRejectedValue(new Error('Firebase error'));
    const { result } = renderHook(() => useUndoRedo());
    const cmd = makeCmd('失敗するコマンド', failingUndo);

    act(() => { result.current.pushCommand(cmd); });
    await act(async () => { await result.current.undo(); });

    // 失敗しても状態は変わらない（pastにcmdが残る）
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });
});
