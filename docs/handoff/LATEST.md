# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-02-17（E2Eテスト安定化完了）
**現在のフェーズ**: Phase 0-5 完了 → E2Eテスト安定化✅完了

## 完了済み（詳細は `docs/handoff/archive/2026-02-detailed-history.md` を参照）

- **Phase 0-1**: プロジェクト基盤 + データ設計 + Seedデータ（Firestore x 2,783ドキュメント）
- **Phase 2a**: 最適化エンジン（PuLP + CBC、156テスト全パス、最大692オーダー/50ヘルパー:38秒）
- **Phase 2b**: REST API (FastAPI) + Cloud Run デプロイ済み
- **Phase 3a-3b**: UI基盤（Next.js + ガントチャート） + 統合（認証、CORS、CI/CD）
- **Phase 4a-4d**: D&D手動編集、UIデザイン改善、マスタ管理（customers/helpers/unavailability）
- **Phase 4d-security**: RBAC (Custom Claims 3役体系) + Firestoreセキュリティルール
- **Google Maps**: Distance Matrix API実装 + Geocoding API (座標ジオコーディング完了)
- **UI/UXピーク**: 週切替(カレンダーピッカー)、制約パラメータUI、マスタ間タブナビゲーション
- **E2E**: Playwright 38テスト全パス（schedule, masters, history対応）
- **ドキュメント**: ユーザーマニュアル + トラブルシューティングガイド
- **テスト合計**: 408テスト全パス（Optimizer 156 + Web 114 + Firestore 69 + E2E 38 + Seed 12）

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
cd optimizer && .venv/bin/pytest tests/ -v  # 134件

# 最適化API（ローカル、ポート8081）
cd optimizer && ALLOW_UNAUTHENTICATED=true .venv/bin/uvicorn optimizer.api.main:app --reload --port 8081

# Next.js dev
cd web && npm run dev  # → http://localhost:3000

# テスト
cd web && npm test          # Vitest (32件)
cd optimizer && .venv/bin/pytest tests/ -v  # pytest (134件)
```

## CI/CD（ADR-010）
- **GitHub Actions**: `.github/workflows/ci.yml`
- **認証**: Workload Identity Federation（JSON鍵不使用）
  - SA: `github-actions@visitcare-shift-optimizer.iam.gserviceaccount.com`
  - WIF Pool: `github-actions-pool` / OIDC Provider: `github-oidc`
- PR時: test-optimizer + test-web 並列実行
- main push時: テスト通過後にCloud Build + Firebase Hosting + Firestoreルール 並列デプロイ
- 必要なGitHub Secrets: `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`
- **全4ジョブ成功確認済み**（PR #7〜#18）

## 直近の実装（2026-02-16～2026-02-17）

- **PR #51**: D&Dゴーストバー（ドロップ先プレビュー）を追加
- **PR #52**: 時間目盛りを10分単位に変更し、ゴーストを10分ブロック表示に改善
- **PR #53**: ドラッグ中の時間帯を全行横断でハイライト表示
- **PR #54**: ガントチャートをレスポンシブ幅に対応（画面幅いっぱいに表示）
- **PR #55**: ガントチャートD&D時間軸移動機能を追加
- **PR #56** ✅ **完成**: E2Eテストのフレイキー問題を修正（Welcomeダイアログ競合対策）
  - **問題**: ローカル実行で19/40テスト失敗、CI実行で40/40通過の不一致
  - **根本原因**: `page.evaluate()` でlocalStorageを設定していたが `page.goto()` 後のため、Reactの `useEffect` が先に走りWelcomeダイアログが開く
  - **修正**: `page.addInitScript()` に変更（ページロード前にlocalStorage設定）
  - **リトライ追加**: `retries: 1-2`、timeout: 60_000 を各テストスイートに追加
  - **新スクリプト**: `npm run test:e2e:fresh` で CI同等のクリーン実行が可能に
  - **結果**: ローカル・CI共に40/40全テスト通過
  - **CI全4ジョブ**: ✅ E2E (4m4s) + Firestore Rules (37s) + Web Tests (1m8s) + Optimizer Tests (3m26s)

## 重要なドキュメント
- `docs/schema/firestore-schema.md`, `data-model.mermaid` — データモデル定義
- `docs/adr/` — 14 ADR（スキーマ設計、PuLP、FastAPI、UI、認証、DnD、ルール、マスタ編集等）
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

### ガントチャートヘルパー勤務不可時間帯グレーアウト表示（PR #47 — 2026-02-16 完了）
- **ブランチ**: `feat/gantt-unavailable-greyout`（マージ完了）
- **実装内容**:
  - `calculateUnavailableBlocks()`: 勤務時間外・希望休のブロック位置計算
  - `UnavailableBlocksOverlay`: memo化コンポーネント、薄グレー+斜線パターン背示
  - DnD対応: `pointer-events-none` + `z-[1]` でオーダーバー操作に影響なし
  - 対応: 勤務時間外（7:00-21:00範囲外）、希望休終日/時間帯
- **テスト**: ユニット12件新規+既存102件 = 114/114全パス
- **ビルド**: TypeScript成功

### スケジュール画面にオーダーなしヘルパー行も表示（PR #48 — 2026-02-16 完了）
- **ブランチ**: `fix/show-all-helpers-in-schedule`（マージ完了）
- **実装内容**:
  - スケジュール画面でオーダー割当の有無に関わらず全ヘルパーを表示
  - useScheduleData フック改修: すべてのヘルパーに対してhelperScheduleRow生成
  - オーダーなし行も D&D ドロップゾーン対応
- **CI/CD**: デプロイ前に E2E D&D テスト失敗（タイムアウト）が検出
- **デプロイ**: 後続PR #49で修正後、本番反映

### E2E D&Dテスト修正（PR #49 — 2026-02-16 完了）
- **ブランチ**: `fix/e2e-dnd-test-with-empty-rows`（マージ完了）
- **問題**: PR #48で全ヘルパー行表示後、最初の行がオーダーなしの場合にgantt-barが存在せず、テストが60秒タイムアウト
- **修正内容**:
  - `schedule-dnd.spec.ts:30` のテストをforループに変更
  - オーダーを持つ行を動的に検索 → その行のgantt-barをドラッグ対象に
  - テスト呼び出し側も柔軟にソース/ターゲット行を選択
- **テスト結果**: E2E 19/19全パス、CI全4ジョブ通過
- **デプロイ**: Cloud Run + Firebase Hosting成功

### 休みの日のヘルパー行グレーアウト表示改善（PR #50 — 2026-02-16 完了）
- **ブランチ**: `feat/improve-day-off-greyout`（マージ完了）
- **実装内容**:
  - **constants.ts**: `UnavailableBlockType` を3タイプに拡張（`off_hours` / `day_off` / `unavailable`）
  - 非勤務日（weekly_availability未設定）を `day_off` タイプの全域ブロックで表示
  - **UnavailableBlocksOverlay.tsx**: ブロックタイプ別にスタイル分離
    - `off_hours`: 薄灰色（4% opacity）+ 細い斜線
    - `day_off`: 中灰色（8% opacity）+ 太い斜線 ← 視認性向上
    - `unavailable`: 赤系（希望休用）
  - **GanttRow.tsx**:
    - `isDayOff` 判定（`day_off` 型 or 終日`unavailable`型）
    - 「休」バッジをヘルパー名横に表示（背景:灰色、テキスト:濃灰色）
    - 行背景を `bg-muted/50` に変更
    - ホバー時の背景変更を無効化（視認性統一）
  - **テスト**: 114/114 全パス（type フィールド追加対応）
- **ビジュアル確認**: 本番環境で日曜タブを表示、非勤務日行に「休」バッジと斜線グレーアウトが表示
- **デプロイ**: CI全4ジョブ通過、本番反映完了

## 次のアクション（優先度順）

1. **視覚的な手動編集表示** 🟢 — `manually_edited` フラグのオーダーに色表示（GanttBar.tsx改修）
2. **ユーザー向けUI微調整** 🟡 — 休日表示の視認性フィードバック、必要に応じてバッジ/グレーアウト濃度調整
3. **追加E2Eテスト** 🟡 — オーダー手動編集シナリオなど
4. **追加機能** 🟡 — 実績確認、利用者マスタの複合スロット管理、月単位レポート

## 最新テスト結果サマリー（2026-02-17 PR #56マージ後）
- **Optimizer**: 156/156 pass
- **Web (Next.js)**: 114/114 pass（+12 calculateUnavailableBlocks + 改善型アサーション）
- **Firestore Rules**: 69/69 pass
- **E2E Tests (Playwright)**: 40/40 pass ✅（リトライ含む、schedule, schedule-dnd, schedule-interactions, masters, masters-crud, history）
- **Seed**: 12/12 pass
- **CI/CD**: 全4ジョブ成功（test-optimizer + test-web + test-firestore-rules + test-e2e） ✅
- **合計**: 411テスト全パス ✅（+2 E2Eテスト増加）

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
