# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-02-19（PR #88 マージ済み・main push CI in_progress）
**現在のフェーズ**: Phase 0-5a 完了 → 実績確認・月次レポート・Google Sheetsエクスポート・マスタ拡張（不定期パターン・外部連携ID・分断勤務・徒歩距離上限）実装済み・マージ済み

## 完了済み（詳細は `docs/handoff/archive/2026-02-detailed-history.md` を参照）

- **Phase 0-1**: プロジェクト基盤 + データ設計 + Seedデータ（Firestore x 2,783ドキュメント）
- **Phase 2a**: 最適化エンジン（PuLP + CBC、156テスト全パス、最大692オーダー/50ヘルパー:38秒）
- **Phase 2b**: REST API (FastAPI) + Cloud Run デプロイ済み
- **Phase 3a-3b**: UI基盤（Next.js + ガントチャート） + 統合（認証、CORS、CI/CD）
- **Phase 4a-4d**: D&D手動編集、UIデザイン改善、マスタ管理（customers/helpers/unavailability）
- **Phase 4d-security**: RBAC (Custom Claims 3役体系) + Firestoreセキュリティルール
- **Google Maps**: Distance Matrix API実装 + Geocoding API (座標ジオコーディング完了)
- **UI/UXピーク**: 週切替(カレンダーピッカー)、制約パラメータUI、マスタ間タブナビゲーション
- **E2E**: Playwright 43テスト全パス（schedule, schedule-dnd, schedule-interactions, schedule-manual-edit, masters, masters-crud, history）
- **ドキュメント**: ユーザーマニュアル + トラブルシューティングガイド

## デプロイURL
- **Web App**: https://visitcare-shift-optimizer.web.app
- **Optimizer API**: https://shift-optimizer-1045989697649.asia-northeast1.run.app

## データアクセス方法
```bash
# 一括起動（推奨、ローカル Emulator）
./scripts/dev-start.sh

# 本番 Firestore へのseed投入（今週の日付）
cd seed && SEED_TARGET=production npx tsx scripts/import-all.ts

# 個別起動（ローカル）:
# Emulator起動
firebase emulators:start --project demo-test

# Seed データ投入（ローカル）
cd seed && FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/import-all.ts

# 最適化エンジン テスト
cd optimizer && .venv/bin/pytest tests/ -v

# 最適化API（ローカル、ポート8081）
cd optimizer && ALLOW_UNAUTHENTICATED=true .venv/bin/uvicorn optimizer.api.main:app --reload --port 8081

# Next.js dev
cd web && npm run dev  # → http://localhost:3000

# テスト
cd web && npm test          # Vitest
cd optimizer && .venv/bin/pytest tests/ -v  # pytest
```

## CI/CD（ADR-010）
- **GitHub Actions**: `.github/workflows/ci.yml`
- **認証**: Workload Identity Federation（JSON鍵不使用）
  - SA: `github-actions@visitcare-shift-optimizer.iam.gserviceaccount.com`
  - WIF Pool: `github-actions-pool` / OIDC Provider: `github-oidc`
- PR時: test-optimizer + test-web 並列実行
- main push時: テスト通過後にCloud Build + Firebase Hosting + Firestoreルール 並列デプロイ
- 必要なGitHub Secrets: `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`

## 直近の実装（2026-02-19）

- **PR #85** ✅: ヘルパー編集UIに `customer_training_status` と `name.short` を追加
  - `shared/types/helper.ts` + Python モデルにフィールド追加
  - `HelperEditDialog.tsx` に入力フォーム追加

- **PR #86** ✅: 利用者の不定期パターン（`irregular_patterns`）を実装（Closes #77）
  - TypeScript型: `IrregularPattern` interface + `IrregularPatternType` type
  - Zodバリデーション: `irregularPatternSchema` 追加（10件テスト追加）
  - UI: `IrregularPatternEditor.tsx` 新規コンポーネント
  - Python: Pydanticモデル + Firestoreローダー対応
  - Seed: オーダー生成スクリプトで非アクティブ週スキップ

- **PR #87** ✅: 外部連携ID入力UI (#83) + 分断勤務フラグ (#81)（Closes #83, Closes #81）
  - 利用者編集ダイアログに外部連携ID（介ソルID / カカラID / CURA ID）入力フィールド追加
  - ヘルパーに `split_shift_allowed` フラグ追加（UI + バックエンドモデル）

- **PR #88** ✅: 徒歩移動スタッフへの訪問距離上限制約を追加（Closes #84）
  - Optimizer: `walking_distance_km` パラメータ追加（デフォルト2.0km）
  - API/Schema: `WalkingDistanceConstraint` モデル、routes.py に制約適用
  - Firestore loader: ヘルパーの `transport_mode` 読み込み対応
  - テスト: 各種テスト追加・更新
  - CI: main push in_progress（テストジョブ PR時は全 success）

## 最新テスト結果サマリー（2026-02-19 PR #88 マージ後）
- **Optimizer**: 223+件 pass（#88 追加分含む）
- **Web (Next.js)**: 219+件 pass
- **Firestore Rules**: 70/70 pass
- **E2E Tests (Playwright)**: 43/43 pass
- **Seed**: 12/12 pass
- **CI/CD**: main push #88 デプロイ in_progress（テストジョブ4件全 success確認済み）

## 重要なドキュメント
- `docs/schema/firestore-schema.md`, `data-model.mermaid` — データモデル定義
- `docs/adr/` — ADR-001〜ADR-015（スキーマ設計、PuLP、FastAPI、UI、認証、DnD、ルール、マスタ編集、Google Sheetsエクスポート等）
- `shared/types/` — TypeScript型定義（Python Pydantic参照元）
- `optimizer/src/optimizer/` — 最適化エンジン + API
- `web/src/` — Next.js フロントエンド

## Seedコマンド（本番Firestore）
```bash
# 全データ再投入（今週）
cd seed && SEED_TARGET=production npx tsx scripts/import-all.ts --week 2026-02-09

# オーダーのみ週切替
cd seed && SEED_TARGET=production npx tsx scripts/import-all.ts --orders-only --week 2026-02-16
```

## 次のアクション（優先度順）

1. **【GCPインフラ】Cloud Run SA 権限付与**: `sheets.googleapis.com`, `drive.googleapis.com` API有効化 + SA に Sheets/Drive 編集権限付与（本番Sheetsエクスポート前に必須）
2. **オープンIssue対応**: #80（サービス種別8種拡張）、#82（利用者制約条件 女性限定・アレルギー等）
3. **次フェーズ方針決定**: Phase 5b（メール通知）・6（モバイル）等を検討

## GitHub Issuesサマリー
- **オープンIssue**: 2件
  - #82: feat: 利用者の制約条件（女性限定・アレルギー等）を構造化フィールドで管理する [enhancement]
  - #80: feat: サービス種別を現行Excel仕様の8種類に拡張する [enhancement]

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
