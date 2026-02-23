import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelperDetailSheet } from '../HelperDetailSheet';
import type { Helper, Customer } from '@/types';

// Radix Sheet はポータルを使うためインラインでモック
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
    <div {...props}>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

function makeHelper(overrides: Partial<Helper> = {}): Helper {
  return {
    id: 'helper-1',
    name: { family: '佐藤', given: '次郎' },
    qualifications: [],
    can_physical_care: false,
    transportation: 'bicycle',
    weekly_availability: {},
    preferred_hours: { min: 20, max: 40 },
    available_hours: { min: 20, max: 40 },
    customer_training_status: {},
    employment_type: 'part_time',
    gender: 'male',
    split_shift_allowed: false,
    created_at: new Date('2025-01-01T00:00:00'),
    updated_at: new Date('2025-06-01T00:00:00'),
    ...overrides,
  };
}

function makeCustomer(id: string, family: string, given: string): Customer {
  return {
    id,
    name: { family, given },
    address: '東京都渋谷区1-1',
    location: { lat: 35.0, lng: 139.0 },
    ng_staff_ids: [],
    preferred_staff_ids: [],
    weekly_services: {},
    service_manager: '担当者',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onEdit: vi.fn(),
  customers: new Map<string, Customer>(),
};

describe('HelperDetailSheet', () => {
  it('open=false のとき何も表示しない', () => {
    render(<HelperDetailSheet {...defaultProps} helper={makeHelper()} open={false} />);
    expect(screen.queryByTestId('helper-detail-sheet')).not.toBeInTheDocument();
  });

  it('helper=null のとき何も表示しない', () => {
    render(<HelperDetailSheet {...defaultProps} helper={null} />);
    expect(screen.queryByTestId('helper-detail-sheet')).not.toBeInTheDocument();
  });

  it('ヘルパー名が表示される', () => {
    render(<HelperDetailSheet {...defaultProps} helper={makeHelper()} />);
    expect(screen.getByText('佐藤 次郎')).toBeInTheDocument();
  });

  it('性別・雇用形態・移動手段が表示される', () => {
    render(<HelperDetailSheet {...defaultProps} helper={makeHelper()} />);
    expect(screen.getByText('男性')).toBeInTheDocument();
    expect(screen.getByText('非常勤')).toBeInTheDocument();
    expect(screen.getByText('自転車')).toBeInTheDocument();
  });

  it('希望時間と対応可能時間が表示される', () => {
    const helper = makeHelper({ preferred_hours: { min: 20, max: 40 }, available_hours: { min: 30, max: 48 } });
    render(<HelperDetailSheet {...defaultProps} helper={helper} />);
    expect(screen.getByText('20 〜 40 時間/週')).toBeInTheDocument();
    expect(screen.getByText('30 〜 48 時間/週')).toBeInTheDocument();
  });

  it('資格がある場合に表示される', () => {
    const helper = makeHelper({ qualifications: ['介護福祉士', '実務者研修'] });
    render(<HelperDetailSheet {...defaultProps} helper={helper} />);
    expect(screen.getByText('介護福祉士')).toBeInTheDocument();
    expect(screen.getByText('実務者研修')).toBeInTheDocument();
  });

  it('身体介護可の場合に「対応可」が表示される', () => {
    const helper = makeHelper({ can_physical_care: true });
    render(<HelperDetailSheet {...defaultProps} helper={helper} />);
    expect(screen.getByText('対応可')).toBeInTheDocument();
  });

  it('電話番号は値があるときのみ表示される', () => {
    const helper = makeHelper({ phone_number: '090-1234-5678' });
    render(<HelperDetailSheet {...defaultProps} helper={helper} />);
    expect(screen.getByText('090-1234-5678')).toBeInTheDocument();
  });

  it('週間勤務可能時間が設定されている場合にテーブルが表示される', () => {
    const helper = makeHelper({
      weekly_availability: {
        tuesday: [{ start_time: '10:00', end_time: '15:00' }],
      },
    });
    render(<HelperDetailSheet {...defaultProps} helper={helper} />);
    expect(screen.getByText('火')).toBeInTheDocument();
    expect(screen.getByText('10:00 - 15:00')).toBeInTheDocument();
  });

  it('週間勤務可能時間が空のとき週間テーブルが表示されない', () => {
    render(<HelperDetailSheet {...defaultProps} helper={makeHelper()} />);
    expect(screen.queryByText('週間勤務可能時間')).not.toBeInTheDocument();
  });

  it('研修中の利用者が研修状態リストに表示される', () => {
    const customer = makeCustomer('cust-1', '田中', '花子');
    const customers = new Map([['cust-1', customer]]);
    const helper = makeHelper({
      customer_training_status: { 'cust-1': 'training' },
    });
    render(<HelperDetailSheet {...defaultProps} helper={helper} customers={customers} />);
    expect(screen.getByTestId('training-status-list')).toBeInTheDocument();
    expect(screen.getByText('田中 花子')).toBeInTheDocument();
    expect(screen.getByText('同行研修中')).toBeInTheDocument();
  });

  it('independent な利用者は自立済みセクションに表示される', () => {
    const customer = makeCustomer('cust-2', '高橋', '三郎');
    const customers = new Map([['cust-2', customer]]);
    const helper = makeHelper({
      customer_training_status: { 'cust-2': 'independent' },
    });
    render(<HelperDetailSheet {...defaultProps} helper={helper} customers={customers} />);
    expect(screen.getByTestId('training-status-list')).toBeInTheDocument();
    expect(screen.getByText('自立済み（1名）')).toBeInTheDocument();
    expect(screen.getByText('高橋 三郎')).toBeInTheDocument();
  });

  it('編集ボタンクリックで onEdit が呼ばれる', () => {
    const onEdit = vi.fn();
    render(<HelperDetailSheet {...defaultProps} helper={makeHelper()} onEdit={onEdit} />);
    fireEvent.click(screen.getByTestId('helper-detail-edit-button'));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('短縮名がある場合に表示される', () => {
    const helper = makeHelper({ name: { family: '佐藤', given: '次郎', short: '佐次' } });
    render(<HelperDetailSheet {...defaultProps} helper={helper} />);
    expect(screen.getByText('佐次')).toBeInTheDocument();
  });
});
