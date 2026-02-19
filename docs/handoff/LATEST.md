# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-02-20（PR #90 マージ済み）
**現在のフェーズ**: Phase 0-5a 完了 → 実績確認・月次レポート・Google Sheetsエクスポート・マスタ拡張（不定期パターン・外部連携ID・分断勤務・徒歩距離上限・サービス種別8種・性別制約）実装済み・マージ済み

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

## 直近の実装（2026-02-19 ～ 2026-02-20）

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

- **PR #89** ✅: サービス種別を8種類に拡張（Closes #80）
  - 型定義: `shared/types/common.ts` + `web/src/types/index.ts` + `optimizer/models/common.py` に6種追加（mixed/prevention/private/disability/transport_support/severe_visiting）
  - 資格制約: `constraints.py` で `_PHYSICAL_CARE_TYPES = {physical_care, mixed}` — mixedも `can_physical_care` 必須
  - UI: WeeklyServicesEditor・GanttBar・GanttRow・UnassignedSection・OrderDetailPanel・ServiceTypeSummaryCard 全対応
  - Seed CSV: 2件追加（C003/thursday/mixed, C007/friday/prevention）

- **PR #90** ✅: 性別制約をソルバーのハード制約として実装（Closes #82）
  - 型定義: `Gender`（`male`/`female`）・`GenderRequirement`（`any`/`female`/`male`）を TS・Python 両方に追加
  - Optimizer: `_add_gender_constraint()` 追加 — `gender_requirement` が `any` 以外の利用者に対し性別不一致スタッフを割当禁止
  - UI: `HelperEditDialog` に性別 Select、`CustomerEditDialog` にスタッフ性別要件 Select を追加
  - Seed CSV: `helpers.csv` に `gender` 列（20名分）、`customers.csv` に `gender_requirement` 列（女性限定18名・男性限定2名）
  - テスト: 4ケース新規（TDD: RED→GREEN確認済み）、Python 238件 / Web 247件 / E2E 全pass

- **hotfix（2026-02-20）** ✅: ドキュメント整合性監査で発見した漏れを修正
  - `optimizer/models/customer.py` に外部連携ID（`kaiso_id` / `karakara_id` / `cura_id`）を追加（PR #83 で UI/TS 追加時の Python 側反映漏れ）
  - `docs/schema/firestore-schema.md` の `ServiceSlot.service_type` / `orders.service_type` を PR #89 の8種に更新（ドキュメント未更新漏れ）

## 最新テスト結果サマリー（2026-02-20 PR #90 マージ後）
- **Optimizer**: 238件 pass
- **Web (Next.js)**: 247件 pass
- **Firestore Rules**: 70/70 pass
- **E2E Tests (Playwright)**: 全pass
- **CI/CD**: 全チェック SUCCESS

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
2. **次フェーズ方針決定**: Phase 5b（メール通知）・6（モバイル）等を検討

## GitHub Issuesサマリー
- **オープンIssue**: 0件

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
