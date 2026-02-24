'use client';

import { Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UndoRedoButtonsProps {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string;
  redoLabel?: string;
  onUndo: () => void;
  onRedo: () => void;
}

export function UndoRedoButtons({
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  onUndo,
  onRedo,
}: UndoRedoButtonsProps) {
  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        disabled={!canUndo}
        onClick={onUndo}
        title={undoLabel ? `元に戻す: ${undoLabel}` : '元に戻す (Cmd+Z)'}
        className="h-8 w-8 p-0"
        data-testid="undo-button"
      >
        <Undo2 className="h-4 w-4" />
        <span className="sr-only">元に戻す</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={!canRedo}
        onClick={onRedo}
        title={redoLabel ? `やり直し: ${redoLabel}` : 'やり直し (Cmd+Shift+Z)'}
        className="h-8 w-8 p-0"
        data-testid="redo-button"
      >
        <Redo2 className="h-4 w-4" />
        <span className="sr-only">やり直し</span>
      </Button>
    </div>
  );
}
