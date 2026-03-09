import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ConstraintWeightsForm,
  DEFAULT_WEIGHTS,
  type ConstraintWeights,
} from '../ConstraintWeightsForm';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/components/ui/slider', () => ({
  Slider: ({
    value,
    onValueChange,
  }: {
    value: number[];
    onValueChange?: (v: number[]) => void;
  }) => (
    <input
      type="range"
      value={value[0]}
      onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
      data-testid="slider"
    />
  ),
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <button {...props}>{children}</button>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ── テスト ──────────────────────────────────────────────────────

describe('ConstraintWeightsForm', () => {
  it('「制約の解説」セクションが表示される', () => {
    render(
      <ConstraintWeightsForm weights={DEFAULT_WEIGHTS} onChange={vi.fn()} />
    );
    expect(screen.getByText('制約の解説')).toBeInTheDocument();
  });

  it('「詳細設定」セクションが表示される', () => {
    render(
      <ConstraintWeightsForm weights={DEFAULT_WEIGHTS} onChange={vi.fn()} />
    );
    expect(screen.getByText('詳細設定')).toBeInTheDocument();
  });

  it('ハード制約の一覧が表示される', () => {
    render(
      <ConstraintWeightsForm weights={DEFAULT_WEIGHTS} onChange={vi.fn()} />
    );
    expect(screen.getByText('資格要件')).toBeInTheDocument();
    expect(screen.getByText('勤務時間枠')).toBeInTheDocument();
    expect(screen.getByText('希望休')).toBeInTheDocument();
    expect(screen.getByText('同時刻重複禁止')).toBeInTheDocument();
    expect(screen.getByText('移動時間確保')).toBeInTheDocument();
    expect(screen.getByText('性別制限')).toBeInTheDocument();
    expect(screen.getByText('必要人数')).toBeInTheDocument();
    expect(screen.getByText('NGスタッフ')).toBeInTheDocument();
  });

  it('ソフト制約のラベルが表示される', () => {
    render(
      <ConstraintWeightsForm weights={DEFAULT_WEIGHTS} onChange={vi.fn()} />
    );
    // ラベルは解説セクションとスライダーセクションの両方に表示される
    expect(screen.getAllByText('移動時間最小化').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('推奨スタッフ優先').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('稼働バランス').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('担当継続性').length).toBeGreaterThanOrEqual(1);
  });

  it('デフォルト値のときリセットボタンが表示されない', () => {
    render(
      <ConstraintWeightsForm weights={DEFAULT_WEIGHTS} onChange={vi.fn()} />
    );
    expect(screen.queryByText('リセット')).not.toBeInTheDocument();
  });

  it('デフォルト値から変更されたときリセットボタンが表示される', () => {
    const customWeights: ConstraintWeights = {
      ...DEFAULT_WEIGHTS,
      w_travel: 5.0,
    };
    render(
      <ConstraintWeightsForm weights={customWeights} onChange={vi.fn()} />
    );
    expect(screen.getByText('リセット')).toBeInTheDocument();
  });

  it('各重みの現在値が表示される', () => {
    render(
      <ConstraintWeightsForm weights={DEFAULT_WEIGHTS} onChange={vi.fn()} />
    );
    expect(screen.getByText('1.0')).toBeInTheDocument();  // w_travel
    expect(screen.getByText('5.0')).toBeInTheDocument();  // w_preferred_staff
    expect(screen.getByText('10.0')).toBeInTheDocument(); // w_workload_balance
    expect(screen.getByText('3.0')).toBeInTheDocument();  // w_continuity
  });

  it('スライダーが4つ表示される', () => {
    render(
      <ConstraintWeightsForm weights={DEFAULT_WEIGHTS} onChange={vi.fn()} />
    );
    const sliders = screen.getAllByTestId('slider');
    expect(sliders).toHaveLength(4);
  });
});
