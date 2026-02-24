import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UndoRedoButtons } from '../UndoRedoButtons';

describe('UndoRedoButtons', () => {
  it('canUndo=falseのときundoボタンは無効', () => {
    render(
      <UndoRedoButtons canUndo={false} canRedo={true} onUndo={vi.fn()} onRedo={vi.fn()} />
    );
    const undoBtn = screen.getByTestId('undo-button');
    expect(undoBtn).toBeDisabled();
  });

  it('canRedo=falseのときredoボタンは無効', () => {
    render(
      <UndoRedoButtons canUndo={true} canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()} />
    );
    const redoBtn = screen.getByTestId('redo-button');
    expect(redoBtn).toBeDisabled();
  });

  it('undoボタンクリックでonUndoが呼ばれる', () => {
    const onUndo = vi.fn();
    render(
      <UndoRedoButtons canUndo={true} canRedo={false} onUndo={onUndo} onRedo={vi.fn()} />
    );
    fireEvent.click(screen.getByTestId('undo-button'));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('redoボタンクリックでonRedoが呼ばれる', () => {
    const onRedo = vi.fn();
    render(
      <UndoRedoButtons canUndo={false} canRedo={true} onUndo={vi.fn()} onRedo={onRedo} />
    );
    fireEvent.click(screen.getByTestId('redo-button'));
    expect(onRedo).toHaveBeenCalledOnce();
  });

  it('undoLabelがtitleに表示される', () => {
    render(
      <UndoRedoButtons
        canUndo={true}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        undoLabel="田中さんを移動"
      />
    );
    const undoBtn = screen.getByTestId('undo-button');
    expect(undoBtn.title).toContain('田中さんを移動');
  });

  it('redoLabelがtitleに表示される', () => {
    render(
      <UndoRedoButtons
        canUndo={false}
        canRedo={true}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        redoLabel="田中さんを移動"
      />
    );
    const redoBtn = screen.getByTestId('redo-button');
    expect(redoBtn.title).toContain('田中さんを移動');
  });

  it('canUndo/canRedoが両方trueのとき両ボタンが有効', () => {
    render(
      <UndoRedoButtons canUndo={true} canRedo={true} onUndo={vi.fn()} onRedo={vi.fn()} />
    );
    expect(screen.getByTestId('undo-button')).not.toBeDisabled();
    expect(screen.getByTestId('redo-button')).not.toBeDisabled();
  });
});
