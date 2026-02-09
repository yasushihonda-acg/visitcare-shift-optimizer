# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-02-09
**現在のフェーズ**: Phase 0 完了 → Phase 1 開始前

## 完了済み

### Phase 0: プロジェクト基盤構築
- Git初期化（main ブランチ、1コミット）
- 環境分離設定（.envrc, .gitconfig.local, ~/.gitconfig includeIf）
- GitHub: `yasushihonda-acg` / GCP: `yasushi.honda@aozora-cg.com`
- GCP config `visitcare-shift-optimizer` 作成済み（APIは未有効化）
- 要件ドキュメント保存:
  - `docs/requirements/SOW.md` - 作業範囲
  - `docs/requirements/PRD.md` - 製品要件
  - `docs/requirements/current-workflow-analysis.md` - 現行業務分析（Excel実データ解析結果）
- ADR 3件作成: 最適化エンジン選定、アーキテクチャ、移動時間計算
- CLAUDE.md 作成（技術スタック、ドメイン用語、開発規約）
- MEMORY.md 作成（セッション引継ぎ用）

## 未着手

### Phase 1: データ設計 + Seedデータ（次のアクション）
- Firestoreスキーマ設計（ER図）
- Seedデータ作成（正常系 + 異常系CSV）
- CSVインポートスクリプト

### Phase 2a: 最適化エンジン
### Phase 2b: API層 + Cloud Run
### Phase 3a: UI基盤 + ガントチャート
### Phase 3b: 統合 + バリデーション

## 次のアクション候補
1. `/impl-plan` で Phase 1 の詳細計画を策定
2. Firestoreスキーマ設計（Customer/Helper/Location/Order モデル）
3. 実データ（Excel）からのSeedデータ変換

## 重要な設計判断（未決定）
- **デモ規模**: PRDの20名/50名 vs 実データ147名/2,394名 → どちらを先に対応？
- **Locationマトリクス「5」の意味**: ダミー値 or 実測値？ユーザーに確認必要
- **サービス種別の範囲**: Phase 1で身体/生活のみか、全種別カバーか

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）

## 外部参考URL
- SMS社技術ブログ（Python-MIP+CBC実績）: tech.bm-sms.co.jp
- 統数研 池上敦子 介護スケジューリング研究: ism.ac.jp
- 介護給付費サービスコード表: wam.go.jp（適宜最新検索）
