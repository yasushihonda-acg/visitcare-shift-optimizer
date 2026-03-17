import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StaffMultiSelect } from './StaffMultiSelect';
import type { Helper, Customer } from '@/types';

function makeHelper(overrides: Partial<Helper> & { id: string }): Helper {
  return {
    name: { family: 'テスト', given: '太郎' },
    qualifications: [],
    can_physical_care: false,
    transportation: 'car',
    weekly_availability: {},
    preferred_hours: { min: 0, max: 8 },
    available_hours: { min: 0, max: 8 },
    customer_training_status: {},
    employment_type: 'full_time',
    gender: 'male',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    name: { family: '利用', given: '花子' },
    address: '東京都',
    location: { lat: 35.68, lng: 139.76 },
    ng_staff_ids: [],
    allowed_staff_ids: [],
    preferred_staff_ids: [],
    weekly_services: {},
    same_household_customer_ids: [],
    same_facility_customer_ids: [],
    service_manager: 'sm-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildHelpers(...list: (Partial<Helper> & { id: string })[]): Map<string, Helper> {
  const map = new Map<string, Helper>();
  for (const h of list) {
    map.set(h.id, makeHelper(h));
  }
  return map;
}

describe('StaffMultiSelect', () => {
  const defaultProps = {
    label: '割当スタッフ',
    selected: [] as string[],
    onChange: vi.fn(),
  };

  describe('customer未指定時は従来通りの動作', () => {
    it('全スタッフがフラットに表示される', async () => {
      const helpers = buildHelpers(
        { id: 'h1', name: { family: '田中', given: '一郎' } },
        { id: 'h2', name: { family: '鈴木', given: '二郎' } },
      );
      render(<StaffMultiSelect {...defaultProps} helpers={helpers} />);
      fireEvent.click(screen.getByRole('button', { name: /選択/ }));

      expect(screen.getByText('田中 一郎')).toBeInTheDocument();
      expect(screen.getByText('鈴木 二郎')).toBeInTheDocument();
      // グループヘッダーが表示されない
      expect(screen.queryByText('推奨')).not.toBeInTheDocument();
      expect(screen.queryByText('対応可能')).not.toBeInTheDocument();
    });
  });

  describe('customer指定時のグループ分け', () => {
    it('推奨スタッフが上に表示される', async () => {
      const helpers = buildHelpers(
        { id: 'h1', name: { family: '田中', given: '一郎' } },
        { id: 'h2', name: { family: '鈴木', given: '二郎' } },
      );
      const customer = makeCustomer({
        preferred_staff_ids: ['h2'],
      });
      render(
        <StaffMultiSelect {...defaultProps} helpers={helpers} customer={customer} />
      );
      fireEvent.click(screen.getByRole('button', { name: /選択/ }));

      expect(screen.getByText('推奨')).toBeInTheDocument();
      // 推奨スタッフが先に表示される
      const labels = screen.getAllByRole('checkbox');
      const firstLabelText = labels[0].closest('label')!.textContent!;
      expect(firstLabelText).toContain('鈴木 二郎');
    });

    it('allowed設定時、allowed以外が「その他」グループになる', async () => {
      const helpers = buildHelpers(
        { id: 'h1', name: { family: '田中', given: '一郎' } },
        { id: 'h2', name: { family: '鈴木', given: '二郎' } },
        { id: 'h3', name: { family: '佐藤', given: '三郎' } },
      );
      const customer = makeCustomer({
        preferred_staff_ids: ['h1'],
        allowed_staff_ids: ['h1', 'h2'],
      });
      render(
        <StaffMultiSelect {...defaultProps} helpers={helpers} customer={customer} />
      );
      fireEvent.click(screen.getByRole('button', { name: /選択/ }));

      expect(screen.getByText('推奨')).toBeInTheDocument();
      expect(screen.getByText('対応可能')).toBeInTheDocument();
      expect(screen.getByText('その他')).toBeInTheDocument();
    });
  });

  describe('NGスタッフの非表示', () => {
    it('customer.ng_staff_idsに含まれるスタッフが非表示', async () => {
      const helpers = buildHelpers(
        { id: 'h1', name: { family: '田中', given: '一郎' } },
        { id: 'h2', name: { family: '鈴木', given: '二郎' } },
      );
      const customer = makeCustomer({
        ng_staff_ids: ['h2'],
      });
      render(
        <StaffMultiSelect {...defaultProps} helpers={helpers} customer={customer} />
      );
      fireEvent.click(screen.getByRole('button', { name: /選択/ }));

      expect(screen.getByText('田中 一郎')).toBeInTheDocument();
      expect(screen.queryByText('鈴木 二郎')).not.toBeInTheDocument();
    });
  });

  describe('性別制限フィルタ', () => {
    it('女性専用の場合、男性スタッフが除外される', async () => {
      const helpers = buildHelpers(
        { id: 'h1', name: { family: '田中', given: '花子' }, gender: 'female' },
        { id: 'h2', name: { family: '鈴木', given: '太郎' }, gender: 'male' },
      );
      const customer = makeCustomer({
        gender_requirement: 'female',
      });
      render(
        <StaffMultiSelect {...defaultProps} helpers={helpers} customer={customer} />
      );
      fireEvent.click(screen.getByRole('button', { name: /選択/ }));

      expect(screen.getByText('田中 花子')).toBeInTheDocument();
      expect(screen.queryByText('鈴木 太郎')).not.toBeInTheDocument();
    });

    it('性別制限がある場合、注記が表示される', async () => {
      const helpers = buildHelpers(
        { id: 'h1', name: { family: '田中', given: '花子' }, gender: 'female' },
      );
      const customer = makeCustomer({
        gender_requirement: 'female',
      });
      render(
        <StaffMultiSelect {...defaultProps} helpers={helpers} customer={customer} />
      );
      fireEvent.click(screen.getByRole('button', { name: /選択/ }));

      expect(screen.getByText(/女性専用/)).toBeInTheDocument();
    });

    it('gender_requirement=anyの場合、注記が表示されない', async () => {
      const helpers = buildHelpers(
        { id: 'h1', name: { family: '田中', given: '花子' }, gender: 'female' },
      );
      const customer = makeCustomer({
        gender_requirement: 'any',
      });
      render(
        <StaffMultiSelect {...defaultProps} helpers={helpers} customer={customer} />
      );
      fireEvent.click(screen.getByRole('button', { name: /選択/ }));

      expect(screen.queryByText(/女性専用/)).not.toBeInTheDocument();
      expect(screen.queryByText(/男性専用/)).not.toBeInTheDocument();
    });
  });

  describe('訪問実績バッジ', () => {
    it('customer_training_statusに応じたバッジが表示される', async () => {
      const helpers = buildHelpers(
        { id: 'h1', name: { family: '田中', given: '一郎' }, customer_training_status: { 'cust-1': 'training' } },
        { id: 'h2', name: { family: '鈴木', given: '二郎' }, customer_training_status: { 'cust-1': 'independent' } },
        { id: 'h3', name: { family: '佐藤', given: '三郎' }, customer_training_status: {} },
      );
      const customer = makeCustomer();
      render(
        <StaffMultiSelect {...defaultProps} helpers={helpers} customer={customer} />
      );
      fireEvent.click(screen.getByRole('button', { name: /選択/ }));

      expect(screen.getByText('同行研修中')).toBeInTheDocument();
      expect(screen.getByText('自立')).toBeInTheDocument();
    });
  });
});
