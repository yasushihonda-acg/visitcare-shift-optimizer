import { describe, it, expect } from 'vitest';
import { computeNewStaffIds } from '../computeStaffIds';

describe('computeNewStaffIds', () => {
  describe('同一ヘルパー', () => {
    it('sourceHelperId == targetId → 既存の割当を維持（時間変更のみ）', () => {
      const result = computeNewStaffIds(['A', 'B'], 'A', 'A', 2);
      expect(result).toEqual(['A', 'B']);
    });
  });

  describe('staff_count=1（単一スタッフ）', () => {
    it('置換', () => {
      const result = computeNewStaffIds(['A'], 'B', 'A', 1);
      expect(result).toEqual(['B']);
    });

    it('未割当 → 新規割当', () => {
      const result = computeNewStaffIds([], 'B', null, 1);
      expect(result).toEqual(['B']);
    });
  });

  describe('staff_count=2（複数スタッフ）', () => {
    it('空きあり（0人割当）→ 追加', () => {
      const result = computeNewStaffIds([], 'B', null, 2);
      expect(result).toEqual(['B']);
    });

    it('空きあり（1人割当済み）→ 追加', () => {
      const result = computeNewStaffIds(['A'], 'B', 'A', 2);
      // sourceHelperId != targetId かつ staff_count > 1 かつ空きあり → 追加
      // ただしsourceHelperIdがassignedにあるので除去して追加
      // → A は維持、B を追加
      expect(result).toEqual(['A', 'B']);
    });

    it('空きあり（別のヘルパーが1人割当）→ 追加', () => {
      const result = computeNewStaffIds(['C'], 'B', null, 2);
      expect(result).toEqual(['C', 'B']);
    });

    it('満員（2人割当）→ sourceHelperIdをtargetIdに置換', () => {
      const result = computeNewStaffIds(['A', 'C'], 'B', 'A', 2);
      expect(result).toEqual(['C', 'B']);
    });

    it('満員 + sourceHelperId が割当に含まれない → targetIdを末尾に追加', () => {
      // sourceHelperIdがassignedにないケース（手動でおかしい状態）
      // → 後方互換でtargetIdを追加
      const result = computeNewStaffIds(['C', 'D'], 'B', null, 2);
      // 満員だが sourceHelperId=null → targetIdを末尾追加（最善の選択）
      expect(result).toEqual(['C', 'D', 'B']);
    });
  });

  describe('staff_count=3（3人体制）', () => {
    it('2人割当済み → 追加', () => {
      const result = computeNewStaffIds(['A', 'C'], 'B', null, 3);
      expect(result).toEqual(['A', 'C', 'B']);
    });

    it('3人割当済み（満員）→ sourceHelperIdをtargetIdに置換', () => {
      const result = computeNewStaffIds(['A', 'C', 'D'], 'B', 'A', 3);
      expect(result).toEqual(['C', 'D', 'B']);
    });
  });

  describe('重複防止', () => {
    it('targetId がすでに割当済み → 重複しない', () => {
      const result = computeNewStaffIds(['A', 'B'], 'B', 'A', 2);
      // targetIdがすでに割当済みの場合は変更なし
      expect(result).toEqual(['A', 'B']);
    });
  });
});
