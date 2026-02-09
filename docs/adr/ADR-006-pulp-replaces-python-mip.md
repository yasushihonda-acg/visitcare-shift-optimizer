# ADR-006: PuLP + CBC に変更（Python-MIPから移行）

## ステータス
Accepted（2026-02-09）

## コンテキスト
ADR-001 で Python-MIP + CBC を選定していたが、Python-MIP は Python 3.12 で安定版リリースがない（1.16rc0のみ、クラッシュ報告あり）。GitHub Issue #376 が2025年5月時点でも未解決。

## 決定
**PuLP 3.3.0 + CBC** に変更する。

## 理由
- PuLP も同じ CBC ソルバーを使用（結果品質は同等）
- Python 3.12 で安定動作（PuLP 3.3.0）
- API が類似（Python-MIP は PuLP にインスパイアされて開発された）
- pip install で CBC が同梱される（追加セットアップ不要）
- 活発にメンテナンスされている

## ADR-001 との関係
ADR-001 の「数理最適化エンジン（MIP）」「CBC ソルバー」の選定は維持。
モデリングライブラリを Python-MIP → PuLP に変更。

## 影響
- `optimizer/pyproject.toml`: `mip>=1.16.0` → `pulp>=2.9`
- エンジンコード: `mip` API → `pulp` API
- ソルバー性能: 同一 CBC ソルバーのため同等
