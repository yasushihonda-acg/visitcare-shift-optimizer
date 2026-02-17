import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConstraintWeightsForm, DEFAULT_WEIGHTS } from '../ConstraintWeightsForm';

describe('ConstraintWeightsForm - 制約解説', () => {
  it('「制約の解説」トリガーを表示', () => {
    render(<ConstraintWeightsForm weights={{ ...DEFAULT_WEIGHTS }} onChange={vi.fn()} />);
    expect(screen.getByText('制約の解説')).toBeInTheDocument();
  });

  it('展開でハード制約が表示される', () => {
    render(<ConstraintWeightsForm weights={{ ...DEFAULT_WEIGHTS }} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('制約の解説'));
    expect(screen.getByText('ハード制約（必ず守る）')).toBeInTheDocument();
    expect(screen.getByText('資格要件')).toBeInTheDocument();
    expect(screen.getByText('同時刻重複禁止')).toBeInTheDocument();
    expect(screen.getByText('NGスタッフ')).toBeInTheDocument();
  });

  it('展開でソフト制約が表示される', () => {
    render(<ConstraintWeightsForm weights={{ ...DEFAULT_WEIGHTS }} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('制約の解説'));
    expect(screen.getByText('ソフト制約（重みで調整可）')).toBeInTheDocument();
    expect(screen.getByText('移動時間最小化')).toBeInTheDocument();
    expect(screen.getByText('稼働バランス')).toBeInTheDocument();
  });
});
