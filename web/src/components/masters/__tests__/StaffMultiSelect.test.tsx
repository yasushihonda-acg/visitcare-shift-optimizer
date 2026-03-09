import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StaffMultiSelect } from '../StaffMultiSelect';
import type { Helper } from '@/types';

// Radix Dialog はポータルを使うためインラインでモック
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function makeHelper(id: string, family: string, given: string, qualifications: string[] = []): Helper {
  return {
    id,
    name: { family, given },
    qualifications,
    can_physical_care: false,
    transportation: 'bicycle',
    weekly_availability: {},
    preferred_hours: { min: 0, max: 8 },
    available_hours: { min: 0, max: 8 },
    customer_training_status: {},
    employment_type: 'part_time',
    gender: 'female',
    created_at: new Date(),
    updated_at: new Date(),
  } as Helper;
}

function makeHelperMap(...entries: Helper[]): Map<string, Helper> {
  return new Map(entries.map((h) => [h.id, h]));
}

describe('StaffMultiSelect', () => {
  it('選択なし → 「未設定」が表示される', () => {
    render(
      <StaffMultiSelect
        label="担当スタッフ"
        selected={[]}
        onChange={() => {}}
        helpers={new Map()}
      />
    );
    expect(screen.getByText('未設定')).toBeInTheDocument();
  });

  it('選択済みスタッフ名がバッジで表示される', () => {
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎'),
      makeHelper('h2', '佐藤', '花子'),
    );
    render(
      <StaffMultiSelect
        label="担当スタッフ"
        selected={['h1', 'h2']}
        onChange={() => {}}
        helpers={helpers}
      />
    );
    expect(screen.getByText('田中 太郎')).toBeInTheDocument();
    expect(screen.getByText('佐藤 花子')).toBeInTheDocument();
  });

  it('不明なIDの場合はIDがフォールバック表示される', () => {
    render(
      <StaffMultiSelect
        label="担当スタッフ"
        selected={['unknown-id']}
        onChange={() => {}}
        helpers={new Map()}
      />
    );
    expect(screen.getByText('unknown-id')).toBeInTheDocument();
  });

  it('バッジのXボタンクリックで該当スタッフが除外される', () => {
    const onChange = vi.fn();
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎'),
      makeHelper('h2', '佐藤', '花子'),
    );
    render(
      <StaffMultiSelect
        label="担当スタッフ"
        selected={['h1', 'h2']}
        onChange={onChange}
        helpers={helpers}
      />
    );
    const badges = screen.getAllByText(/田中|佐藤/).map((el) => el.closest('[data-slot="badge"]')!);
    const removeButton = badges[0].querySelector('button')!;
    fireEvent.click(removeButton);
    expect(onChange).toHaveBeenCalledWith(['h2']);
  });

  it('ダイアログを開いてスタッフを選択し確定する', () => {
    const onChange = vi.fn();
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎'),
      makeHelper('h2', '佐藤', '花子'),
    );
    render(
      <StaffMultiSelect
        label="担当スタッフ"
        selected={[]}
        onChange={onChange}
        helpers={helpers}
      />
    );
    fireEvent.click(screen.getByText('選択'));
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByText('確定（1名）'));
    expect(onChange).toHaveBeenCalledWith(['h1']);
  });

  it('excludeIdsで指定したスタッフがダイアログに表示されない', () => {
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎'),
      makeHelper('h2', '佐藤', '花子'),
      makeHelper('h3', '鈴木', '一郎'),
    );
    render(
      <StaffMultiSelect
        label="担当スタッフ"
        selected={[]}
        onChange={() => {}}
        helpers={helpers}
        excludeIds={['h1']}
      />
    );
    fireEvent.click(screen.getByText('選択'));
    expect(screen.queryByText('田中 太郎')).not.toBeInTheDocument();
    expect(screen.getByText('佐藤 花子')).toBeInTheDocument();
    expect(screen.getByText('鈴木 一郎')).toBeInTheDocument();
  });

  it('名前で検索フィルタリングされる', () => {
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎'),
      makeHelper('h2', '佐藤', '花子'),
    );
    render(
      <StaffMultiSelect
        label="担当スタッフ"
        selected={[]}
        onChange={() => {}}
        helpers={helpers}
      />
    );
    fireEvent.click(screen.getByText('選択'));
    const searchInput = screen.getByPlaceholderText('名前で検索...');
    fireEvent.change(searchInput, { target: { value: '田中' } });
    expect(screen.getByText('田中 太郎')).toBeInTheDocument();
    expect(screen.queryByText('佐藤 花子')).not.toBeInTheDocument();
  });

  it('検索結果0件 → 「該当なし」が表示される', () => {
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎'),
    );
    render(
      <StaffMultiSelect
        label="担当スタッフ"
        selected={[]}
        onChange={() => {}}
        helpers={helpers}
      />
    );
    fireEvent.click(screen.getByText('選択'));
    const searchInput = screen.getByPlaceholderText('名前で検索...');
    fireEvent.change(searchInput, { target: { value: 'zzz' } });
    expect(screen.getByText('該当なし')).toBeInTheDocument();
  });

  it('資格情報がダイアログに表示される', () => {
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎', ['介護福祉士', 'ヘルパー2級']),
    );
    render(
      <StaffMultiSelect
        label="担当スタッフ"
        selected={[]}
        onChange={() => {}}
        helpers={helpers}
      />
    );
    fireEvent.click(screen.getByText('選択'));
    expect(screen.getByText('介護福祉士, ヘルパー2級')).toBeInTheDocument();
  });

  it('資格なし → ダイアログでハイフンが表示される', () => {
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎', []),
    );
    render(
      <StaffMultiSelect
        label="担当スタッフ"
        selected={[]}
        onChange={() => {}}
        helpers={helpers}
      />
    );
    fireEvent.click(screen.getByText('選択'));
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  describe('triggerOnlyモード', () => {
    it('バッジ一覧が非表示で「スタッフを選択」ボタンが表示される', () => {
      const helpers = makeHelperMap(
        makeHelper('h1', '田中', '太郎'),
      );
      render(
        <StaffMultiSelect
          label="担当スタッフ"
          selected={['h1']}
          onChange={() => {}}
          helpers={helpers}
          triggerOnly
        />
      );
      expect(screen.queryByText('田中 太郎')).not.toBeInTheDocument();
      expect(screen.getByText('スタッフを選択')).toBeInTheDocument();
    });

    it('ダイアログで選択して確定できる', () => {
      const onChange = vi.fn();
      const helpers = makeHelperMap(
        makeHelper('h1', '田中', '太郎'),
        makeHelper('h2', '佐藤', '花子'),
      );
      render(
        <StaffMultiSelect
          label="担当スタッフ"
          selected={[]}
          onChange={onChange}
          helpers={helpers}
          triggerOnly
        />
      );
      fireEvent.click(screen.getByText('スタッフを選択'));
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(screen.getByText('確定（1名）'));
      expect(onChange).toHaveBeenCalledWith(['h1']);
    });
  });

  it('チェック済みスタッフをもう一度クリックで解除できる', () => {
    const onChange = vi.fn();
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎'),
    );
    render(
      <StaffMultiSelect
        label="担当スタッフ"
        selected={['h1']}
        onChange={onChange}
        helpers={helpers}
      />
    );
    fireEvent.click(screen.getByText('選択'));
    // h1 はドラフトに入っている → チェックボックスをクリックで解除
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByText('確定（0名）'));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
