import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaffSummaryTable } from '../StaffSummaryTable';
import type { StaffSummaryRow } from '@/lib/report/aggregation';

function makeRow(overrides: Partial<StaffSummaryRow> & { helperId: string }): StaffSummaryRow {
  return {
    name: '佐藤 太郎',
    visitCount: 5,
    totalMinutes: 120,
    ...overrides,
  };
}

describe('StaffSummaryTable', () => {
  it('セクションタイトルが表示される', () => {
    render(<StaffSummaryTable rows={[]} />);
    expect(screen.getByText('スタッフ別稼働時間')).toBeInTheDocument();
  });

  it('空配列のとき「データなし」が表示される', () => {
    render(<StaffSummaryTable rows={[]} />);
    expect(screen.getByText('データなし')).toBeInTheDocument();
    expect(screen.getByText('0名')).toBeInTheDocument();
  });

  it('行データが正しく表示される', () => {
    const rows: StaffSummaryRow[] = [
      makeRow({ helperId: 'h1', name: '山田 太郎', visitCount: 10, totalMinutes: 300 }),
      makeRow({ helperId: 'h2', name: '田中 花子', visitCount: 4, totalMinutes: 75 }),
    ];
    render(<StaffSummaryTable rows={rows} />);

    expect(screen.getByText('2名')).toBeInTheDocument();
    expect(screen.getByText('山田 太郎')).toBeInTheDocument();
    expect(screen.getByText('10件')).toBeInTheDocument();
    expect(screen.getByText('5時間')).toBeInTheDocument();
    expect(screen.getByText('田中 花子')).toBeInTheDocument();
    expect(screen.getByText('4件')).toBeInTheDocument();
    expect(screen.getByText('1時間15分')).toBeInTheDocument();
  });

  it('テーブルヘッダーが表示される', () => {
    const rows = [makeRow({ helperId: 'h1' })];
    render(<StaffSummaryTable rows={rows} />);

    expect(screen.getByText('氏名')).toBeInTheDocument();
    expect(screen.getByText('訪問件数')).toBeInTheDocument();
    expect(screen.getByText('稼働時間')).toBeInTheDocument();
  });
});
