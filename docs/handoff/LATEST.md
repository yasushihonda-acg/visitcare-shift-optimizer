# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-02-19（月次レポート画面 PR #75 マージ済み）
**現在のフェーズ**: Phase 0-5 完了 → 実績確認機能 + 利用者マスタ重複チェック + 月次レポート実装済み・マージ済み

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
- **テスト合計**: 418テスト全パス（Optimizer 156 + Web 118 + Firestore 69 + E2E 43 + Seed 12）

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

- **PR #54**: ガントチャートをレスポンシブ幅に対応（画面幅いっぱいに表示）
- **PR #55**: ガントチャートD&D時間軸移動機能を追加
- **PR #56** ✅: E2Eテストのフレイキー問題を修正（Welcomeダイアログ競合対策）
- **PR #57** ✅: 手動編集済みオーダーに青リング枠を表示
- **PR #65** ✅ **NEW**: デモ環境バナーをヘッダー上部に常時表示
  - **実装**: layout.tsx に `NEXT_PUBLIC_AUTH_MODE !== 'required'` 判定で amber バー追加
  - **表示**: 「デモ環境 — 本番データではありません」（デモ環境のみ表示）
  - **テスト**: Next.js build確認済み

- **PR #66** ✅ **NEW**: ガントバーのテキスト視認性を大幅改善
  - **実装**: globals.css に `.text-shadow-bar` ユーティリティ追加（3層黒枠線: `0 0 4px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.35), 0 0 1px rgba(0,0,0,0.3)`）
  - **GanttBar.tsx 修正**:
    - `truncate` 廃止 → `overflow-visible whitespace-nowrap` で長い名前をバー外に拡張表示
    - `text-shadow-bar` クラス追加（黒枠線効果）
    - `text-[11px]` → `text-xs font-medium` で視認性向上
    - `hover:z-20` でホバー時に最前面表示
    - テキスト長閾値を廃止（常に顧客名を表示）
  - **テスト**: 全テスト 157/157 pass

- **PR #68** ✅ **NEW**: 手動編集フラグ（青リング）のE2Eテスト追加
  - **実装**: `web/e2e/schedule-manual-edit.spec.ts` 新規作成（3テスト）
  - **テスト内容**: D&D前の初期状態（青リングなし）、ヘルパー行間D&D後の青リング表示、水平D&D（時間変更）後の青リング表示
  - **テスト**: E2E 40 → 43件 ✅ CI全ジョブ成功

- **PR #67** ✅: デモバナー文字サイズ拡大 + ゴースト同一行内ドラッグ追随修正
  - **デモバナー**: `text-xs`(12px) → `text-sm`(14px)（視認性大幅向上）
  - **ゴースト追随根本修正**:
    - **根本原因**: `@dnd-kit/core` の `onDragOver` は droppable ターゲット変更時のみ発火。同一行内の水平ドラッグでゴースト更新されず
    - **修正**: `onDragMove` ハンドラ追加（毎ピクセル発火）。共通の `processPreview` 関数で両者を処理
    - **最適化**: `useRef` で前回スナップ値（ターゲットID + シフト分数）を保持し重複計算をスキップ → パフォーマンス向上
    - **ファイル変更**: `useDragAndDrop.ts` (ロジック抽出), `page.tsx` (`onDragMove` 接続)
  - **テスト**: 全テスト 157/157 pass ✅

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

- **PR #69** ✅: OrderDetailPanelに手動編集済みバッジを追加
  - **実装**: 手動編集済みオーダーの詳細パネルに「手動編集済み」バッジを表示
  - **CI**: 全ジョブ成功

- **PR #70** ✅: 休日表示の視認性改善（斜線強調・バッジ強化）
  - **実装**: 休日行の斜線パターン強調 + 「休」バッジのスタイル強化
  - **CI**: 全ジョブ成功（7m43s）

- **PR #73** ✅ **NEW**: 利用者マスタの週間サービス時間帯重複チェック
  - **timeOverlap.ts**: `detectOverlaps(slots)` ユーティリティ追加（O(n²)判定、境界接触は重複なし）
  - **schemas.ts**: `weeklyServicesSchema` に `.superRefine()` 追加（同一曜日内の重複スロットで保存ブロック）
  - **WeeklyServicesEditor.tsx**: リアルタイム赤枠表示・曜日ヘッダーに「時間帯重複」バッジ・スロット行に警告文
  - **テスト**: timeOverlap 11件 + スキーマ統合 3件追加 → Web 194/194 pass、合計475テスト全パス
  - **CI**: PR時4ジョブ成功（main push時は支払い問題により失敗中）

- **PR #71** ✅ **NEW**: オーダー実績確認機能
  - **Firestoreルール**: `isValidStatusTransition()` — status遷移バリデーション（同一ステータス遷移ガード含む）
  - **updateOrder.ts**: `updateOrderStatus()`, `bulkUpdateOrderStatus()`, `isValidTransition()`, `isOrderStatus()` 追加
  - **GanttBar**: completed/cancelled で半透明+アイコン表示、D&D無効化
  - **OrderDetailPanel**: ステータス変更Select UI追加、finalized時スタッフ編集無効
  - **BulkCompleteButton**: 一括実績確認ダイアログ（日本語曜日表示）
  - **StatsBar**: 実績確認カード（完了率プログレスバー、キャンセル分母除外）
  - **コードレビュー修正済み**: HIGH-1(同一遷移ガード), MEDIUM-1〜4(型ガード/DRY/エラーログ/完了率計算), LOW-1(曜日表示)
  - **テスト**: Vitest 180/180 pass (+8), Firestore Rules +1テスト

- **PR #75** ✅ **NEW**: 月次レポート画面を追加（/report）
  - **画面**: `web/src/app/report/page.tsx` — 月セレクタ + 4カード構成
  - **コンポーネント**: `MonthSelector`, `StatusSummaryCard`, `ServiceTypeSummaryCard`, `StaffSummaryTable`, `CustomerSummaryTable`（`web/src/components/report/`）
  - **フック**: `useMonthlyOrders`（月単位Firestoreクエリ）, `useMonthlyReport`（集計ロジック）
  - **リファクタ**: `formatMinutesToHours` を `aggregation.ts` に集約しDRY解消
  - **テスト**: Web 219/219 pass（+25）
  - **CI**: PR時全ジョブ成功 ✅（main push時 in_progress — 支払い問題の影響なし）
  - **ブランチ**: `feat/monthly-report` → **main マージ済み（PR #75 → c7dc088）**

## 次のアクション（優先度順）

1. **次フェーズ方針決定**: Phase 5a（Google Sheets連携）・5b（メール通知）・6（モバイル）等を検討
2. **UI改善継続** 🟡 — ユーザーフィードバックに応じた微調整

## 最新テスト結果サマリー（2026-02-19 PR #75 月次レポート後）
- **Optimizer**: 156/156 pass
- **Web (Next.js)**: 219/219 pass（+25: 月次レポート関連）
- **Firestore Rules**: 70/70 pass
- **E2E Tests (Playwright)**: 43/43 pass ✅
- **Seed**: 12/12 pass
- **CI/CD**: PR時テストジョブ成功 ✅（mainブランチ push時 in_progress — 2026-02-18T17:39:57Z）
- **合計**: 500テスト全パス ✅

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
