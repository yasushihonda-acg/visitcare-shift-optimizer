import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomerDetailSheet } from '../CustomerDetailSheet';
import type { CustomerDetailViewModel } from '../customerDetailViewModel';

// Radix Sheet はポータルを使うためインラインでモック
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
    <div {...props}>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

function makeVm(overrides: Partial<CustomerDetailViewModel> = {}): CustomerDetailViewModel {
  return {
    id: 'cust-1',
    fullName: '田中 花子',
    fullKana: null,
    address: '東京都新宿区1-1-1',
    serviceManager: '山田太郎',
    genderRequirementLabel: '指定なし',
    ngStaff: [],
    allowedStaff: [],
    householdMembers: [],
    facilityMembers: [],
    weeklyServices: [],
    hasWeeklyServices: false,
    irregularPatterns: [],
    hasContact: false,
    hasExternalIds: false,
    createdAt: new Date('2025-01-01T00:00:00'),
    updatedAt: new Date('2025-06-01T00:00:00'),
    ...overrides,
  };
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onEdit: vi.fn(),
  canEdit: true,
};

describe('CustomerDetailSheet', () => {
  it('open=false のとき何も表示しない', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm()} open={false} />);
    expect(screen.queryByTestId('customer-detail-sheet')).not.toBeInTheDocument();
  });

  it('vm=null のとき何も表示しない', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={null} />);
    expect(screen.queryByTestId('customer-detail-sheet')).not.toBeInTheDocument();
  });

  it('利用者名が表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm()} />);
    expect(screen.getByText('田中 花子')).toBeInTheDocument();
  });

  it('住所・サ責・性別要件が表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm()} />);
    expect(screen.getByText('東京都新宿区1-1-1')).toBeInTheDocument();
    expect(screen.getByText('山田太郎')).toBeInTheDocument();
    expect(screen.getByText('指定なし')).toBeInTheDocument();
  });

  it('電話番号は値があるときのみ表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm({ phoneNumber: '03-1234-5678' })} />);
    expect(screen.getByText('03-1234-5678')).toBeInTheDocument();
  });

  it('連絡先セクションは hasContact=false のとき表示されない', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm()} />);
    expect(screen.queryByText('連絡先・関連機関')).not.toBeInTheDocument();
  });

  it('連絡先セクションは hasContact=true のとき表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm({
      hasContact: true,
      homeCareOffice: 'ケアセンター新宿',
      careManagerName: '佐藤ケアマネ',
    })} />);
    expect(screen.getByText('ケアセンター新宿')).toBeInTheDocument();
    expect(screen.getByText('佐藤ケアマネ')).toBeInTheDocument();
  });

  it('NGスタッフのバッジが表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm({
      ngStaff: [{ id: 'h-1', name: '鈴木 一郎', isPreferred: false }],
    })} />);
    expect(screen.getByTestId('ng-staff-badges')).toBeInTheDocument();
    expect(screen.getByText('鈴木 一郎')).toBeInTheDocument();
  });

  it('allowed_staff に値があるとき「入れるスタッフ」セクションが表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm({
      allowedStaff: [{ id: 'h-2', name: '高橋 二郎', isPreferred: false }],
    })} />);
    expect(screen.getByTestId('allowed-staff-badges')).toBeInTheDocument();
    expect(screen.getByText('高橋 二郎')).toBeInTheDocument();
  });

  it('preferred フラグのあるスタッフに推奨マークが表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm({
      allowedStaff: [{ id: 'h-3', name: '伊藤 三郎', isPreferred: true }],
    })} />);
    expect(screen.getByTestId('allowed-staff-preferred-h-3')).toBeInTheDocument();
  });

  it('同一世帯メンバーがBadgeで表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm({
      householdMembers: [{ id: 'C002', name: '佐藤 次郎' }],
    })} />);
    expect(screen.getByText('同一世帯')).toBeInTheDocument();
    expect(screen.getByText('佐藤 次郎')).toBeInTheDocument();
  });

  it('同一施設メンバーがBadgeで表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm({
      facilityMembers: [{ id: 'C010', name: '中村 五郎' }],
    })} />);
    expect(screen.getByText('同一施設')).toBeInTheDocument();
    expect(screen.getByText('中村 五郎')).toBeInTheDocument();
  });

  it('同一世帯・同一施設が空のとき表示されない', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm()} />);
    expect(screen.queryByText('同一世帯')).not.toBeInTheDocument();
    expect(screen.queryByText('同一施設')).not.toBeInTheDocument();
  });

  it('allowed_staff が空のとき「入れるスタッフ」セクションが表示されない', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm()} />);
    expect(screen.queryByTestId('allowed-staff-badges')).not.toBeInTheDocument();
  });

  it('週間サービスが設定されている場合にテーブルが表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm({
      hasWeeklyServices: true,
      weeklyServices: [{
        day: 'monday',
        dayLabel: '月',
        slots: [{ time: '09:00 - 10:00', serviceLabel: '身体介護', staffCount: 1 }],
      }],
    })} />);
    expect(screen.getByText('月')).toBeInTheDocument();
    expect(screen.getByText('09:00 - 10:00')).toBeInTheDocument();
    expect(screen.getByText('身体介護')).toBeInTheDocument();
    expect(screen.getByText('1名')).toBeInTheDocument();
  });

  it('週間サービスが空のとき週間サービスセクションが表示されない', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm()} />);
    expect(screen.queryByText('週間サービス')).not.toBeInTheDocument();
  });

  it('備考が設定されている場合に表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm({ notes: '特記事項あり' })} />);
    expect(screen.getByText('特記事項あり')).toBeInTheDocument();
  });

  it('備考が未設定のとき備考セクションが表示されない', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm()} />);
    expect(screen.queryByText('備考')).not.toBeInTheDocument();
  });

  it('あおぞらIDがある場合に外部連携IDセクションが表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm({ hasExternalIds: true, aozoraId: 'AO-001' })} />);
    expect(screen.getByText('AO-001')).toBeInTheDocument();
  });

  it('外部IDが全て空のとき外部連携IDセクションが表示されない', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm()} />);
    expect(screen.queryByText('外部連携ID')).not.toBeInTheDocument();
  });

  it('編集ボタンクリックで onEdit が呼ばれる', () => {
    const onEdit = vi.fn();
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm()} onEdit={onEdit} />);
    fireEvent.click(screen.getByTestId('customer-detail-edit-button'));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('canEdit=false のとき編集ボタンが表示されない', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm()} canEdit={false} />);
    expect(screen.queryByTestId('customer-detail-edit-button')).not.toBeInTheDocument();
  });

  it('canEdit=true のとき編集ボタンが表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm()} canEdit={true} />);
    expect(screen.getByTestId('customer-detail-edit-button')).toBeInTheDocument();
  });

  it('不定期パターンが設定されている場合に表示される', () => {
    render(<CustomerDetailSheet {...defaultProps} vm={makeVm({
      irregularPatterns: [{ typeLabel: '隔週', description: '第1・3週のみ' }],
    })} />);
    expect(screen.getByText('隔週')).toBeInTheDocument();
    expect(screen.getByText('第1・3週のみ')).toBeInTheDocument();
  });
});
