/**
 * 住所正規化 — 同一住所判定に使用
 *
 * 正規化ルール:
 * 1. 全角英数字・記号 → 半角
 * 2. 半角カナ → 全角カナ
 * 3. 連続する空白を1つに統合し、前後の空白を除去
 * 4. ハイフン系文字の統一（‐ ― ー ‒ – — ﹣ － → -)
 */
export function normalizeAddress(address: string): string {
  let s = address;

  // 全角英数字・記号 → 半角 (U+FF01-FF5E → U+0021-007E)
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  );

  // 全角スペース → 半角スペース
  s = s.replace(/\u3000/g, ' ');

  // ハイフン系文字の統一
  s = s.replace(/[‐―ー‒–—﹣－]/g, '-');

  // 連続空白を1つに統合 + トリム
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}
