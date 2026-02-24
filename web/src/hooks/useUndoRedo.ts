'use client';

import { useState, useCallback, useRef } from 'react';
import type { UndoCommand } from '@/lib/undo/types';

export function useUndoRedo(maxHistory = 50) {
  const [past, setPast] = useState<UndoCommand[]>([]);
  const [future, setFuture] = useState<UndoCommand[]>([]);
  const lockRef = useRef(false);

  const pushCommand = useCallback(
    (cmd: UndoCommand) => {
      setPast((prev) => {
        const next = [...prev, cmd];
        return next.length > maxHistory ? next.slice(next.length - maxHistory) : next;
      });
      setFuture([]);
    },
    [maxHistory]
  );

  const undo = useCallback(async () => {
    if (lockRef.current || past.length === 0) return;
    lockRef.current = true;
    const last = past[past.length - 1];
    try {
      await last.undo();
      setPast((prev) => prev.slice(0, -1));
      setFuture((prev) => [last, ...prev]);
    } catch (err) {
      console.error('Undo failed:', err);
      // 失敗時は状態を変更しない
    } finally {
      lockRef.current = false;
    }
  }, [past]);

  const redo = useCallback(async () => {
    if (lockRef.current || future.length === 0) return;
    lockRef.current = true;
    const first = future[0];
    try {
      await first.redo();
      setFuture((prev) => prev.slice(1));
      setPast((prev) => [...prev, first]);
    } catch (err) {
      console.error('Redo failed:', err);
      // 失敗時は状態を変更しない
    } finally {
      lockRef.current = false;
    }
  }, [future]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    pushCommand,
    clearHistory,
    undoLabel: past.length > 0 ? past[past.length - 1].label : undefined,
    redoLabel: future.length > 0 ? future[0].label : undefined,
  };
}
