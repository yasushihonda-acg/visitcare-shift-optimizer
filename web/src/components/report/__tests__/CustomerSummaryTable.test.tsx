import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerSummaryTable } from '../CustomerSummaryTable';
import type { CustomerSummaryRow } from '@/lib/report/aggregation';

function makeRow(overrides: Partial<CustomerSummaryRow> & { customerId: string }): CustomerSummaryRow {
  return {
    name: '田中 太郎',
    visitCount: 5,
    totalMinutes: 120,
    ...overrides,
  };
}

describe('CustomerSummaryTable', () => {
  it('セクションタイトルが表示される', () => {
    render(<CustomerSummaryTable rows={[]} />);
    expect(screen.getByText('利用者別サービス実績')).toBeInTheDocument();
  });

  it('空配列のとき「データなし」が表示される', () => {
    render(<CustomerSummaryTable rows={[]} />);
    expect(screen.getByText('データなし')).toBeInTheDocument();
    expect(screen.getByText('0名')).toBeInTheDocument();
  });

  it('行データが正しく表示される', () => {
    const rows: CustomerSummaryRow[] = [
      makeRow({ customerId: 'c1', name: '佐藤 花子', visitCount: 3, totalMinutes: 90 }),
      makeRow({ customerId: 'c2', name: '鈴木 一郎', visitCount: 7, totalMinutes: 180 }),
    ];
    render(<CustomerSummaryTable rows={rows} />);

    expect(screen.getByText('2名')).toBeInTheDocument();
    expect(screen.getByText('佐藤 花子')).toBeInTheDocument();
    expect(screen.getByText('3件')).toBeInTheDocument();
    expect(screen.getByText('1時間30分')).toBeInTheDocument();
    expect(screen.getByText('鈴木 一郎')).toBeInTheDocument();
    expect(screen.getByText('7件')).toBeInTheDocument();
    expect(screen.getByText('3時間')).toBeInTheDocument();
  });

  it('テーブルヘッダーが表示される', () => {
    const rows = [makeRow({ customerId: 'c1' })];
    render(<CustomerSummaryTable rows={rows} />);

    expect(screen.getByText('氏名')).toBeInTheDocument();
    expect(screen.getByText('訪問件数')).toBeInTheDocument();
    expect(screen.getByText('合計時間')).toBeInTheDocument();
  });

  it('ちょうど0分のとき「0時間」と表示される', () => {
    const rows = [makeRow({ customerId: 'c1', totalMinutes: 0 })];
    render(<CustomerSummaryTable rows={rows} />);
    expect(screen.getByText('0時間')).toBeInTheDocument();
  });
});
