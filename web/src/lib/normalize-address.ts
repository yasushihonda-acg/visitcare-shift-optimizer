/**
 * 住所正規化 — 同一住所判定に使用
 *
 * 正規化ルール:
 * 1. NFKC正規化（全角英数字→半角、半角カナ→全角カナ etc.）
 * 2. ハイフン系文字の統一（‐ ― ー ‒ – — ﹣ － → -)
 * 3. 連続する空白を1つに統合し、前後の空白を除去
 *
 * ※ Python版 (optimizer/data/normalize_address.py) と同一ロジック
 */
export function normalizeAddress(address: string): string {
  // NFKC正規化 (全角英数字→半角、半角カナ→全角カナ etc.)
  let s = address.normalize('NFKC');

  // ハイフン系文字の統一
  s = s.replace(/[‐―ー‒–—﹣－−]/g, '-');

  // 連続空白を1つに統合 + トリム
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}
