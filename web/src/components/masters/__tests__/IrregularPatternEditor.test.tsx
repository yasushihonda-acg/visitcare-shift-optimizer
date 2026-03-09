import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IrregularPatternEditor } from '../IrregularPatternEditor';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value }: { children: React.ReactNode; value?: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: (props: { checked?: boolean; onCheckedChange?: () => void }) => (
    <input type="checkbox" checked={props.checked ?? false} onChange={() => props.onCheckedChange?.()} />
  ),
}));

// ── テスト ──────────────────────────────────────────────────────

describe('IrregularPatternEditor', () => {
  it('パターンが空のとき「毎週定期（不定期パターンなし）」が表示される', () => {
    render(<IrregularPatternEditor value={[]} onChange={vi.fn()} />);
    expect(screen.getByText('毎週定期（不定期パターンなし）')).toBeInTheDocument();
  });

  it('ラベル「不定期パターン」が表示される', () => {
    render(<IrregularPatternEditor value={[]} onChange={vi.fn()} />);
    expect(screen.getByText('不定期パターン')).toBeInTheDocument();
  });

  it('追加ボタンが表示される', () => {
    render(<IrregularPatternEditor value={[]} onChange={vi.fn()} />);
    expect(screen.getByText('追加')).toBeInTheDocument();
  });

  it('追加ボタンクリックでonChangeがデフォルトパターンで呼ばれる', () => {
    const onChange = vi.fn();
    render(<IrregularPatternEditor value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('追加'));
    expect(onChange).toHaveBeenCalledWith([
      { type: 'biweekly', description: '', active_weeks: [0, 2] },
    ]);
  });

  it('パターンがある場合に説明入力フィールドが表示される', () => {
    render(
      <IrregularPatternEditor
        value={[{ type: 'biweekly', description: '第1・3週', active_weeks: [0, 2] }]}
        onChange={vi.fn()}
      />
    );
    const input = screen.getByDisplayValue('第1・3週');
    expect(input).toBeInTheDocument();
  });

  it('パターンの説明を変更するとonChangeが呼ばれる', () => {
    const onChange = vi.fn();
    render(
      <IrregularPatternEditor
        value={[{ type: 'biweekly', description: '', active_weeks: [0, 2] }]}
        onChange={onChange}
      />
    );
    const input = screen.getByPlaceholderText('説明（例: 隔週 第1・3週）');
    fireEvent.change(input, { target: { value: 'テスト説明' } });
    expect(onChange).toHaveBeenCalledWith([
      { type: 'biweekly', description: 'テスト説明', active_weeks: [0, 2] },
    ]);
  });

  it('biweeklyタイプのとき対象週チェックボックスが表示される', () => {
    render(
      <IrregularPatternEditor
        value={[{ type: 'biweekly', description: '', active_weeks: [0, 2] }]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('第1週')).toBeInTheDocument();
    expect(screen.getByText('第2週')).toBeInTheDocument();
    expect(screen.getByText('第3週')).toBeInTheDocument();
    expect(screen.getByText('第4週')).toBeInTheDocument();
  });

  it('temporary_stopタイプのとき対象週チェックボックスが表示されない', () => {
    render(
      <IrregularPatternEditor
        value={[{ type: 'temporary_stop', description: '一時中止' }]}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByText('対象週:')).not.toBeInTheDocument();
  });

  it('削除ボタンクリックでパターンが除去される', () => {
    const onChange = vi.fn();
    render(
      <IrregularPatternEditor
        value={[
          { type: 'biweekly', description: 'パターン1', active_weeks: [0, 2] },
          { type: 'monthly', description: 'パターン2', active_weeks: [0] },
        ]}
        onChange={onChange}
      />
    );
    // 最初のパターンの削除ボタンをクリック
    const removeButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg'));
    // 追加ボタン以外の削除ボタン（Xアイコン付き）
    const deleteButton = removeButtons.find((b) => b.closest('.rounded-md.border'));
    fireEvent.click(deleteButton!);
    expect(onChange).toHaveBeenCalled();
  });
});
