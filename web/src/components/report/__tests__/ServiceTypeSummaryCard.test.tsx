import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceTypeSummaryCard } from '../ServiceTypeSummaryCard';
import type { ServiceTypeSummaryItem } from '@/lib/report/aggregation';

function makeItem(overrides: Partial<ServiceTypeSummaryItem> = {}): ServiceTypeSummaryItem {
  return {
    serviceType: 'physical_care',
    label: '身体介護',
    visitCount: 10,
    totalMinutes: 300,
    ...overrides,
  };
}

describe('ServiceTypeSummaryCard', () => {
  it('セクションタイトルが表示される', () => {
    render(<ServiceTypeSummaryCard items={[]} totalMinutes={0} />);
    expect(screen.getByText('サービス種別内訳')).toBeInTheDocument();
  });

  it('空配列のとき「データなし」が表示される', () => {
    render(<ServiceTypeSummaryCard items={[]} totalMinutes={0} />);
    expect(screen.getByText('データなし')).toBeInTheDocument();
  });

  it('各サービス種別のラベル・件数・時間・パーセントが表示される', () => {
    const items: ServiceTypeSummaryItem[] = [
      makeItem({ serviceType: 'physical_care', label: '身体介護', visitCount: 6, totalMinutes: 180 }),
      makeItem({ serviceType: 'daily_living', label: '生活援助', visitCount: 4, totalMinutes: 120 }),
    ];
    render(<ServiceTypeSummaryCard items={items} totalMinutes={300} />);

    expect(screen.getByText('身体介護')).toBeInTheDocument();
    expect(screen.getByText('6件')).toBeInTheDocument();
    expect(screen.getByText('3時間')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();

    expect(screen.getByText('生活援助')).toBeInTheDocument();
    expect(screen.getByText('4件')).toBeInTheDocument();
    expect(screen.getByText('2時間')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('totalMinutesが0のときパーセントが0%になる', () => {
    const items = [makeItem({ totalMinutes: 60 })];
    render(<ServiceTypeSummaryCard items={items} totalMinutes={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
