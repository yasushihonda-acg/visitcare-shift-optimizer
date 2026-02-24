import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useUndoRedoKeyboard } from '../useUndoRedoKeyboard';

afterEach(() => {
  // クリーンアップ: フォーカスをbodyに戻す
  document.body.focus();
});

describe('useUndoRedoKeyboard', () => {
  it('Cmd+Z でundoが呼ばれる', () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const redo = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useUndoRedoKeyboard({ undo, redo, canUndo: true, canRedo: true }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));

    expect(undo).toHaveBeenCalledOnce();
    expect(redo).not.toHaveBeenCalled();
  });

  it('Ctrl+Z でもundoが呼ばれる（Windows互換）', () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const redo = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useUndoRedoKeyboard({ undo, redo, canUndo: true, canRedo: true }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));

    expect(undo).toHaveBeenCalledOnce();
  });

  it('Cmd+Shift+Z でredoが呼ばれる', () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const redo = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useUndoRedoKeyboard({ undo, redo, canUndo: true, canRedo: true }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', shiftKey: true, metaKey: true, bubbles: true }));

    expect(redo).toHaveBeenCalledOnce();
    expect(undo).not.toHaveBeenCalled();
  });

  it('canUndo=falseのとき Cmd+Z でundoが呼ばれない', () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useUndoRedoKeyboard({ undo, redo: vi.fn(), canUndo: false, canRedo: true })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));

    expect(undo).not.toHaveBeenCalled();
  });

  it('canRedo=falseのとき Cmd+Shift+Z でredoが呼ばれない', () => {
    const redo = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useUndoRedoKeyboard({ undo: vi.fn(), redo, canUndo: true, canRedo: false })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', shiftKey: true, metaKey: true, bubbles: true }));

    expect(redo).not.toHaveBeenCalled();
  });

  it('input要素にフォーカス中はショートカットが無視される', () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useUndoRedoKeyboard({ undo, redo: vi.fn(), canUndo: true, canRedo: true })
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));

    expect(undo).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('textarea要素にフォーカス中はショートカットが無視される', () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useUndoRedoKeyboard({ undo, redo: vi.fn(), canUndo: true, canRedo: true })
    );

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));

    expect(undo).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('アンマウント後はリスナーが削除される', () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useUndoRedoKeyboard({ undo, redo: vi.fn(), canUndo: true, canRedo: true })
    );

    unmount();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));

    expect(undo).not.toHaveBeenCalled();
  });
});
