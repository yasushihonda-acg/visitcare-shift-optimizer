"""住所正規化 — 同一住所判定に使用

正規化ルール:
1. 全角英数字・記号 → 半角
2. 連続する空白を1つに統合し、前後の空白を除去
3. ハイフン系文字の統一（‐ ― ー ‒ – — ﹣ － → -)
"""

import re
import unicodedata


def normalize_address(address: str) -> str:
    # NFKC正規化 (全角英数字→半角、半角カナ→全角カナ etc.)
    s = unicodedata.normalize("NFKC", address)

    # ハイフン系文字の統一
    s = re.sub(r"[‐―ー‒–—﹣－]", "-", s)

    # 連続空白を1つに統合 + トリム
    s = re.sub(r"\s+", " ", s).strip()

    return s
