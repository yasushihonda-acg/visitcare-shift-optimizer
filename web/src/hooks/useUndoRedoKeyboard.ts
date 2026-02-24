'use client';

import { useEffect } from 'react';

interface UseUndoRedoKeyboardProps {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Cmd+Z / Ctrl+Z → undo
 * Cmd+Shift+Z / Ctrl+Shift+Z → redo
 * input / textarea / contenteditable にフォーカス中は無効
 */
export function useUndoRedoKeyboard({ undo, redo, canUndo, canRedo }: UseUndoRedoKeyboardProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const modKey = e.metaKey || e.ctrlKey;
      if (!modKey) return;

      if (e.key.toLowerCase() === 'z') {
        if (!e.shiftKey && canUndo) {
          e.preventDefault();
          undo();
        } else if (e.shiftKey && canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, canUndo, canRedo]);
}
