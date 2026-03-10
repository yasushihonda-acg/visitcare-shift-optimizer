import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViolationPopover } from '../ViolationPopover';
import type { ViolationMap } from '@/lib/constraints/checker';

describe('ViolationPopover', () => {
  it('count=0のとき何も表示しない', () => {
    const violations: ViolationMap = new Map();
    const { container } = render(
      <ViolationPopover violations={violations} severity="error" count={0} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('error severity で「違反N」バッジが表示される', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        { orderId: 'o1', staffId: 'h1', type: 'overlap', severity: 'error', message: '時間重複テスト' },
        { orderId: 'o1', staffId: 'h1', type: 'ng_staff', severity: 'error', message: 'NGスタッフテスト' },
      ]],
    ]);
    render(<ViolationPopover violations={violations} severity="error" count={2} />);
    expect(screen.getByText('違反2')).toBeInTheDocument();
  });

  it('warning severity で「警告N」バッジが表示される', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        { orderId: 'o1', type: 'outside_hours', severity: 'warning', message: '勤務時間外テスト' },
      ]],
    ]);
    render(<ViolationPopover violations={violations} severity="warning" count={1} />);
    expect(screen.getByText('警告1')).toBeInTheDocument();
  });

  it('バッジクリックでPopoverが開き、種別ごとにグループ表示される', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        { orderId: 'o1', staffId: 'h1', type: 'overlap', severity: 'error', message: '佐藤 の時間重複: 10:00-11:00' },
        { orderId: 'o1', staffId: 'h2', type: 'overlap', severity: 'error', message: '鈴木 の時間重複: 09:00-10:00' },
        { orderId: 'o1', staffId: 'h1', type: 'ng_staff', severity: 'error', message: 'NGスタッフ 佐藤 が割当済み' },
      ]],
    ]);
    render(<ViolationPopover violations={violations} severity="error" count={3} />);

    fireEvent.click(screen.getByText('違反3'));

    // ヘッダー
    expect(screen.getByText('違反一覧（3件）')).toBeInTheDocument();

    // 種別グループラベル
    expect(screen.getByText('時間重複')).toBeInTheDocument();
    expect(screen.getByText('NGスタッフ')).toBeInTheDocument();

    // 個別メッセージ
    expect(screen.getByText('佐藤 の時間重複: 10:00-11:00')).toBeInTheDocument();
    expect(screen.getByText('鈴木 の時間重複: 09:00-10:00')).toBeInTheDocument();
    expect(screen.getByText('NGスタッフ 佐藤 が割当済み')).toBeInTheDocument();
  });

  it('warning Popover内に件数が表示される', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        { orderId: 'o1', type: 'travel_time', severity: 'warning', message: '移動時間不足（必要: 15分、余裕: 5分）' },
        { orderId: 'o2', type: 'outside_hours', severity: 'warning', message: '佐藤 の勤務時間外' },
      ]],
    ]);
    render(<ViolationPopover violations={violations} severity="warning" count={2} />);

    fireEvent.click(screen.getByText('警告2'));

    expect(screen.getByText('警告一覧（2件）')).toBeInTheDocument();
    expect(screen.getByText('移動時間不足')).toBeInTheDocument();
    expect(screen.getByText('勤務時間外')).toBeInTheDocument();
  });

  it('他のseverityの項目はフィルタされる', () => {
    const violations: ViolationMap = new Map([
      ['o1', [
        { orderId: 'o1', type: 'overlap', severity: 'error', message: 'エラーメッセージ' },
        { orderId: 'o1', type: 'outside_hours', severity: 'warning', message: '警告メッセージ' },
      ]],
    ]);
    render(<ViolationPopover violations={violations} severity="error" count={1} />);

    fireEvent.click(screen.getByText('違反1'));

    expect(screen.getByText('エラーメッセージ')).toBeInTheDocument();
    expect(screen.queryByText('警告メッセージ')).not.toBeInTheDocument();
  });

  it('aria-labelがバッジに設定されている', () => {
    const violations: ViolationMap = new Map([
      ['o1', [{ orderId: 'o1', type: 'overlap', severity: 'error', message: 'test' }]],
    ]);
    render(<ViolationPopover violations={violations} severity="error" count={1} />);
    expect(screen.getByLabelText('違反1件の詳細を表示')).toBeInTheDocument();
  });
});
