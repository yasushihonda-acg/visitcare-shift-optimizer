import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusSummaryCard } from '../StatusSummaryCard';
import type { StatusSummary } from '@/lib/report/aggregation';

function makeSummary(overrides: Partial<StatusSummary> = {}): StatusSummary {
  return {
    pending: 0,
    assigned: 0,
    completed: 0,
    cancelled: 0,
    total: 0,
    completionRate: 0,
    ...overrides,
  };
}

describe('StatusSummaryCard', () => {
  it('セクションタイトルが表示される', () => {
    render(<StatusSummaryCard summary={makeSummary()} />);
    expect(screen.getByText('実績確認ステータス')).toBeInTheDocument();
  });

  it('合計件数が表示される', () => {
    render(<StatusSummaryCard summary={makeSummary({ total: 42 })} />);
    expect(screen.getByText('合計 42件')).toBeInTheDocument();
  });

  it('完了率が表示される', () => {
    render(<StatusSummaryCard summary={makeSummary({ completionRate: 75 })} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('各ステータスの件数が表示される', () => {
    const summary = makeSummary({
      completed: 10,
      assigned: 5,
      pending: 3,
      cancelled: 2,
      total: 20,
      completionRate: 56,
    });
    render(<StatusSummaryCard summary={summary} />);

    expect(screen.getByText('実績確認済')).toBeInTheDocument();
    expect(screen.getByText('10件')).toBeInTheDocument();
    expect(screen.getByText('割当済')).toBeInTheDocument();
    expect(screen.getByText('5件')).toBeInTheDocument();
    expect(screen.getByText('未割当')).toBeInTheDocument();
    expect(screen.getByText('3件')).toBeInTheDocument();
    expect(screen.getByText('キャンセル')).toBeInTheDocument();
    expect(screen.getByText('2件')).toBeInTheDocument();
  });

  it('完了率ラベルが表示される', () => {
    render(<StatusSummaryCard summary={makeSummary()} />);
    expect(screen.getByText('実績確認率（キャンセル除く）')).toBeInTheDocument();
  });

  it('全て0件の場合でも正しく表示される', () => {
    const summary = makeSummary({ total: 0, completionRate: 0 });
    render(<StatusSummaryCard summary={summary} />);
    expect(screen.getByText('合計 0件')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
