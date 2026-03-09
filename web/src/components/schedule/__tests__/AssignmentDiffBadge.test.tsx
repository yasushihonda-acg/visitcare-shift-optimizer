import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssignmentDiffBadge } from '../AssignmentDiffBadge';
import type { Helper } from '@/types';
import type { AssignmentDiff } from '@/hooks/useAssignmentDiff';

function makeHelper(id: string, family: string, given: string): Helper {
  return {
    id,
    name: { family, given },
    qualifications: [],
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

describe('AssignmentDiffBadge', () => {
  it('isChanged=false → 何も表示されない', () => {
    const diff: AssignmentDiff = { added: [], removed: [], isChanged: false };
    const { container } = render(
      <AssignmentDiffBadge diff={diff} helpers={new Map()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('isChanged=true → 「手動変更」バッジが表示される', () => {
    const diff: AssignmentDiff = { added: ['h1'], removed: [], isChanged: true };
    const helpers = makeHelperMap(makeHelper('h1', '田中', '太郎'));
    render(<AssignmentDiffBadge diff={diff} helpers={helpers} />);
    expect(screen.getByText('手動変更')).toBeInTheDocument();
  });

  it('追加のみ → title属性に「追加: スタッフ名」が含まれる', () => {
    const diff: AssignmentDiff = { added: ['h1'], removed: [], isChanged: true };
    const helpers = makeHelperMap(makeHelper('h1', '田中', '太郎'));
    render(<AssignmentDiffBadge diff={diff} helpers={helpers} />);
    const badge = screen.getByText('手動変更');
    expect(badge).toHaveAttribute('title', '追加: 田中 太郎');
  });

  it('削除のみ → title属性に「削除: スタッフ名」が含まれる', () => {
    const diff: AssignmentDiff = { added: [], removed: ['h2'], isChanged: true };
    const helpers = makeHelperMap(makeHelper('h2', '佐藤', '花子'));
    render(<AssignmentDiffBadge diff={diff} helpers={helpers} />);
    const badge = screen.getByText('手動変更');
    expect(badge).toHaveAttribute('title', '削除: 佐藤 花子');
  });

  it('追加と削除の両方 → title属性に両方のスタッフ名が含まれる', () => {
    const diff: AssignmentDiff = { added: ['h1'], removed: ['h2'], isChanged: true };
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎'),
      makeHelper('h2', '佐藤', '花子'),
    );
    render(<AssignmentDiffBadge diff={diff} helpers={helpers} />);
    const badge = screen.getByText('手動変更');
    expect(badge).toHaveAttribute('title', '追加: 田中 太郎 / 削除: 佐藤 花子');
  });

  it('不明なスタッフIDの場合はIDがフォールバック表示される', () => {
    const diff: AssignmentDiff = { added: ['unknown-id'], removed: [], isChanged: true };
    render(<AssignmentDiffBadge diff={diff} helpers={new Map()} />);
    const badge = screen.getByText('手動変更');
    expect(badge).toHaveAttribute('title', '追加: unknown-id');
  });

  it('複数スタッフの追加 → カンマ区切りで表示される', () => {
    const diff: AssignmentDiff = { added: ['h1', 'h2'], removed: [], isChanged: true };
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎'),
      makeHelper('h2', '佐藤', '花子'),
    );
    render(<AssignmentDiffBadge diff={diff} helpers={helpers} />);
    const badge = screen.getByText('手動変更');
    expect(badge).toHaveAttribute('title', '追加: 田中 太郎, 佐藤 花子');
  });
});
