import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomerDetailSheet } from '../CustomerDetailSheet';
import type { Customer, Helper } from '@/types';

// Firebase 接続が必要なフックはモック
vi.mock('@/hooks/useServiceTypes', () => ({
  useServiceTypes: () => ({
    serviceTypes: new Map([
      ['physical_care', { id: 'physical_care', code: 'physical_care', label: '身体介護', short_label: '身体', requires_physical_care_cert: true, sort_order: 1, created_at: new Date(), updated_at: new Date() }],
      ['daily_living', { id: 'daily_living', code: 'daily_living', label: '生活援助', short_label: '生活', requires_physical_care_cert: false, sort_order: 2, created_at: new Date(), updated_at: new Date() }],
    ]),
    sortedList: [],
    loading: false,
    error: null,
  }),
}));

// Radix Sheet はポータルを使うためインラインでモック
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
    <div {...props}>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    name: { family: '田中', given: '花子' },
    address: '東京都新宿区1-1-1',
    location: { lat: 35.6895, lng: 139.6917 },
    ng_staff_ids: [],
    allowed_staff_ids: [],
    preferred_staff_ids: [],
    same_household_customer_ids: [],
    same_facility_customer_ids: [],
    weekly_services: {},
    service_manager: '山田太郎',
    gender_requirement: 'any',
    created_at: new Date('2025-01-01T00:00:00'),
    updated_at: new Date('2025-06-01T00:00:00'),
    ...overrides,
  };
}

function makeHelper(id: string, family: string, given: string): Helper {
  return {
    id,
    name: { family, given },
    qualifications: [],
    can_physical_care: false,
    transportation: 'bicycle',
    weekly_availability: {},
    preferred_hours: { min: 20, max: 40 },
    available_hours: { min: 20, max: 40 },
    customer_training_status: {},
    employment_type: 'part_time',
    gender: 'female',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onEdit: vi.fn(),
  helpers: new Map<string, Helper>(),
  customers: new Map<string, Customer>(),
};

describe('CustomerDetailSheet', () => {
  it('open=false のとき何も表示しない', () => {
    render(<CustomerDetailSheet {...defaultProps} customer={makeCustomer()} open={false} />);
    expect(screen.queryByTestId('customer-detail-sheet')).not.toBeInTheDocument();
  });

  it('customer=null のとき何も表示しない', () => {
    render(<CustomerDetailSheet {...defaultProps} customer={null} />);
    expect(screen.queryByTestId('customer-detail-sheet')).not.toBeInTheDocument();
  });

  it('利用者名が表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} customer={makeCustomer()} />);
    expect(screen.getByText('田中 花子')).toBeInTheDocument();
  });

  it('住所・サ責・性別要件が表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} customer={makeCustomer()} />);
    expect(screen.getByText('東京都新宿区1-1-1')).toBeInTheDocument();
    expect(screen.getByText('山田太郎')).toBeInTheDocument();
    expect(screen.getByText('指定なし')).toBeInTheDocument();
  });

  it('電話番号は値があるときのみ表示される', () => {
    const customer = makeCustomer({ phone_number: '03-1234-5678' });
    render(<CustomerDetailSheet {...defaultProps} customer={customer} />);
    expect(screen.getByText('03-1234-5678')).toBeInTheDocument();
  });

  it('連絡先セクションは全て空のとき表示されない', () => {
    render(<CustomerDetailSheet {...defaultProps} customer={makeCustomer()} />);
    expect(screen.queryByText('連絡先・関連機関')).not.toBeInTheDocument();
  });

  it('担当居宅が設定されている場合に連絡先セクションが表示される', () => {
    const customer = makeCustomer({
      home_care_office: 'ケアセンター新宿',
      care_manager_name: '佐藤ケアマネ',
    });
    render(<CustomerDetailSheet {...defaultProps} customer={customer} />);
    expect(screen.getByText('ケアセンター新宿')).toBeInTheDocument();
    expect(screen.getByText('佐藤ケアマネ')).toBeInTheDocument();
  });

  it('NGスタッフのバッジが表示される', () => {
    const helper = makeHelper('h-1', '鈴木', '一郎');
    const helpers = new Map([['h-1', helper]]);
    const customer = makeCustomer({ ng_staff_ids: ['h-1'] });
    render(<CustomerDetailSheet {...defaultProps} customer={customer} helpers={helpers} />);
    expect(screen.getByTestId('ng-staff-badges')).toBeInTheDocument();
    expect(screen.getByText('鈴木 一郎')).toBeInTheDocument();
  });

  it('allowed_staff_ids に値があるとき「入れるスタッフ」セクションが表示される', () => {
    const helper = makeHelper('h-2', '高橋', '二郎');
    const helpers = new Map([['h-2', helper]]);
    const customer = makeCustomer({ allowed_staff_ids: ['h-2'] });
    render(<CustomerDetailSheet {...defaultProps} customer={customer} helpers={helpers} />);
    expect(screen.getByTestId('allowed-staff-badges')).toBeInTheDocument();
    expect(screen.getByText('高橋 二郎')).toBeInTheDocument();
  });

  it('preferred_staff_ids に含まれるスタッフに推奨マークが表示される', () => {
    const helper = makeHelper('h-3', '伊藤', '三郎');
    const helpers = new Map([['h-3', helper]]);
    const customer = makeCustomer({
      allowed_staff_ids: ['h-3'],
      preferred_staff_ids: ['h-3'],
    });
    render(<CustomerDetailSheet {...defaultProps} customer={customer} helpers={helpers} />);
    expect(screen.getByTestId('allowed-staff-preferred-h-3')).toBeInTheDocument();
  });

  it('同一世帯メンバーが設定されている場合にBadgeで表示される（IDフォールバック）', () => {
    const customer = makeCustomer({ same_household_customer_ids: ['C002', 'C003'] });
    render(<CustomerDetailSheet {...defaultProps} customer={customer} />);
    expect(screen.getByText('同一世帯')).toBeInTheDocument();
    // customers Map に該当がないのでIDがそのまま表示される
    expect(screen.getByText('C002')).toBeInTheDocument();
    expect(screen.getByText('C003')).toBeInTheDocument();
  });

  it('同一世帯メンバーのcustomers Map該当時に名前で表示される', () => {
    const c2 = makeCustomer({ id: 'C002', name: { family: '佐藤', given: '次郎' } });
    const customersMap = new Map([['C002', c2]]);
    const customer = makeCustomer({ same_household_customer_ids: ['C002'] });
    render(<CustomerDetailSheet {...defaultProps} customer={customer} customers={customersMap} />);
    expect(screen.getByText('佐藤 次郎')).toBeInTheDocument();
  });

  it('同一施設メンバーが設定されている場合にBadgeで表示される', () => {
    const customer = makeCustomer({ same_facility_customer_ids: ['C010'] });
    render(<CustomerDetailSheet {...defaultProps} customer={customer} />);
    expect(screen.getByText('同一施設')).toBeInTheDocument();
    expect(screen.getByText('C010')).toBeInTheDocument();
  });

  it('同一施設メンバーのcustomers Map該当時に名前で表示される', () => {
    const c10 = makeCustomer({ id: 'C010', name: { family: '中村', given: '五郎' } });
    const customersMap = new Map([['C010', c10]]);
    const customer = makeCustomer({ same_facility_customer_ids: ['C010'] });
    render(<CustomerDetailSheet {...defaultProps} customer={customer} customers={customersMap} />);
    expect(screen.getByText('中村 五郎')).toBeInTheDocument();
  });

  it('同一世帯に自己IDが含まれる場合はフィルタされる', () => {
    const self = makeCustomer({ id: 'cust-1', same_household_customer_ids: ['cust-1', 'C002'] });
    render(<CustomerDetailSheet {...defaultProps} customer={self} />);
    expect(screen.getByText('同一世帯')).toBeInTheDocument();
    expect(screen.getByText('C002')).toBeInTheDocument();
    const badges = screen.getByText('C002').parentElement;
    expect(badges?.textContent).not.toContain('cust-1');
  });

  it('同一施設に自己IDが含まれる場合はフィルタされる', () => {
    const self = makeCustomer({ id: 'cust-1', same_facility_customer_ids: ['cust-1', 'C010'] });
    render(<CustomerDetailSheet {...defaultProps} customer={self} />);
    expect(screen.getByText('同一施設')).toBeInTheDocument();
    expect(screen.getByText('C010')).toBeInTheDocument();
    const badges = screen.getByText('C010').parentElement;
    expect(badges?.textContent).not.toContain('cust-1');
  });

  it('同一世帯が自己IDのみの場合はセクション非表示', () => {
    const self = makeCustomer({ id: 'cust-1', same_household_customer_ids: ['cust-1'] });
    render(<CustomerDetailSheet {...defaultProps} customer={self} />);
    expect(screen.queryByText('同一世帯')).not.toBeInTheDocument();
  });

  it('同一施設が自己IDのみの場合はセクション非表示', () => {
    const self = makeCustomer({ id: 'cust-1', same_facility_customer_ids: ['cust-1'] });
    render(<CustomerDetailSheet {...defaultProps} customer={self} />);
    expect(screen.queryByText('同一施設')).not.toBeInTheDocument();
  });

  it('同一世帯・同一施設が空のとき表示されない', () => {
    render(<CustomerDetailSheet {...defaultProps} customer={makeCustomer()} />);
    expect(screen.queryByText('同一世帯')).not.toBeInTheDocument();
    expect(screen.queryByText('同一施設')).not.toBeInTheDocument();
  });

  it('allowed_staff_ids が空のとき「入れるスタッフ」セクションが表示されない', () => {
    render(<CustomerDetailSheet {...defaultProps} customer={makeCustomer()} />);
    expect(screen.queryByTestId('allowed-staff-badges')).not.toBeInTheDocument();
  });

  it('週間サービスが設定されている場合にテーブルが表示される', () => {
    const customer = makeCustomer({
      weekly_services: {
        monday: [
          { start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 1 },
        ],
      },
    });
    render(<CustomerDetailSheet {...defaultProps} customer={customer} />);
    expect(screen.getByText('月')).toBeInTheDocument();
    expect(screen.getByText('09:00 - 10:00')).toBeInTheDocument();
    expect(screen.getByText('身体介護')).toBeInTheDocument();
    expect(screen.getByText('1名')).toBeInTheDocument();
  });

  it('週間サービスが空のとき週間サービスセクションが表示されない', () => {
    render(<CustomerDetailSheet {...defaultProps} customer={makeCustomer()} />);
    expect(screen.queryByText('週間サービス')).not.toBeInTheDocument();
  });

  it('備考が設定されている場合に表示される', () => {
    const customer = makeCustomer({ notes: '特記事項あり' });
    render(<CustomerDetailSheet {...defaultProps} customer={customer} />);
    expect(screen.getByText('特記事項あり')).toBeInTheDocument();
  });

  it('備考が未設定のとき備考セクションが表示されない', () => {
    render(<CustomerDetailSheet {...defaultProps} customer={makeCustomer()} />);
    expect(screen.queryByText('備考')).not.toBeInTheDocument();
  });

  it('あおぞらIDがある場合に外部連携IDセクションが表示される', () => {
    const customer = makeCustomer({ aozora_id: 'AO-001' });
    render(<CustomerDetailSheet {...defaultProps} customer={customer} />);
    expect(screen.getByText('AO-001')).toBeInTheDocument();
  });

  it('外部IDが全て空のとき外部連携IDセクションが表示されない', () => {
    render(<CustomerDetailSheet {...defaultProps} customer={makeCustomer()} />);
    expect(screen.queryByText('外部連携ID')).not.toBeInTheDocument();
  });

  it('編集ボタンクリックで onEdit が呼ばれる', () => {
    const onEdit = vi.fn();
    render(<CustomerDetailSheet {...defaultProps} customer={makeCustomer()} onEdit={onEdit} />);
    fireEvent.click(screen.getByTestId('customer-detail-edit-button'));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('不定期パターンが設定されている場合に表示される', () => {
    const customer = makeCustomer({
      irregular_patterns: [{ type: 'biweekly', description: '第1・3週のみ' }],
    });
    render(<CustomerDetailSheet {...defaultProps} customer={customer} />);
    expect(screen.getByText('隔週')).toBeInTheDocument();
    expect(screen.getByText('第1・3週のみ')).toBeInTheDocument();
  });
});
