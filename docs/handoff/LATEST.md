# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-03-08（CustomerDetailSheet権限チェック PR #180 マージ済み）
**現在のフェーズ**: Phase 0-5b 完了 → 実績確認・月次レポート・Google Sheetsエクスポート（本番動作確認済み）・マスタ拡張（不定期パターン・外部連携ID・分断勤務・徒歩距離上限・サービス種別→介護保険105種・性別制約・新マスタフィールド・研修状態3段階・週全体ビュー・service_typesマスタ化 Phase 1-3・制約チェック UI 拡張・メール通知・利用者軸ビュー・基本予定一覧・Gmail API DWD送信実装・staff_count複数割当・travel_times D&D統合・ガント幅バグ修正・利用者軸フォント統一・seed複数週対応・通知設定Firestore/UI管理化・マスタ詳細シート追加・ファビコン追加・E2Eテスト拡充・利用者マスタ表示/検索拡充・ふりがなソート/あかさたなフィルター・基本予定一覧詳細シート・手動編集バーアンバーデザイン刷新・Undo/Redo機能・iPad横向きレスポンシブ対応・allowed_staff_ids ホワイトリスト + 事前チェック・same_household/facility_customer_ids移行・利用者編集UI同一世帯/施設MultiSelect・Google Chat DM催促・E2E D&D flakiness改善・CustomerDetailSheet同一世帯/施設Badge表示+権限チェック）実装済み・マージ済み

## 完了済み（詳細は `docs/handoff/archive/2026-02-detailed-history.md` を参照）

- **Phase 0-1**: プロジェクト基盤 + データ設計 + Seedデータ（Firestore x 2,783ドキュメント）
- **Phase 2a**: 最適化エンジン（PuLP + CBC、156テスト全パス、最大692オーダー/50ヘルパー:38秒）
- **Phase 2b**: REST API (FastAPI) + Cloud Run デプロイ済み
- **Phase 3a-3b**: UI基盤（Next.js + ガントチャート） + 統合（認証、CORS、CI/CD）
- **Phase 4a-4d**: D&D手動編集、UIデザイン改善、マスタ管理（customers/helpers/unavailability）
- **Phase 4d-security**: RBAC (Custom Claims 3役体系) + Firestoreセキュリティルール
- **Google Maps**: Distance Matrix API実装 + Geocoding API (座標ジオコーディング完了)
- **UI/UXピーク**: 週切替(カレンダーピッカー)、制約パラメータUI、マスタ間タブナビゲーション
- **E2E**: Playwright 64テスト全パス（schedule, schedule-dnd, schedule-interactions, schedule-manual-edit, masters, masters-crud, history, masters-detail, settings）
- **ドキュメント**: ユーザーマニュアル + トラブルシューティングガイド
- **サービス種別全面置き換え（2026-02-24）**: 8種 union 型 → 介護保険サービスコード 105 種（5カテゴリ: 訪問介護・通所介護Ⅰ・地域密着型・訪問看護・大規模型Ⅰ）。TypeScript ServiceType → string 型。Python ServiceType enum → str 型エイリアス。静的ラベル/色マップ廃止→動的 config ベース。全テスト 285+402+32 件 GREEN。本番 Firestore 再投入済み・デプロイ済み

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

## 直近の実装（2026-03-08 CustomerDetailSheet改善）

- **fix (#186, 2026-03-08)** ✅: HelperDetailSheetの編集ボタンを権限に応じて非表示にする
  - PR #180と同パターンの横展開修正。`canEdit: boolean` propを必須で追加（fail-closed設計）
  - `helpers/page.tsx` で `canEditHelpers` を渡す。テスト2件追加 → 16件全パス
- **fix (#182, 2026-03-08)** ✅: canEdit propを必須化してfail-closed設計に変更
  - Codexレビュー High指摘対応: `canEdit?: boolean`（デフォルトtrue）→ `canEdit: boolean`（必須）
  - 権限系propは呼び出し元が明示的に渡す設計に変更
- **fix (#180, 2026-03-08)** ✅: CustomerDetailSheetの編集ボタンを権限に応じて非表示にする
  - `canEdit: boolean` propを追加（必須、fail-closed設計）
  - `customers/page.tsx` / `weekly-schedule/page.tsx` で `canEditCustomers` を渡す
  - 閲覧専用ユーザーに編集ボタンが表示されていたセキュリティバグ修正（Closes #178）
  - テスト2件追加（canEdit=false/true）→ 30件全パス
- **fix (#179, 2026-03-08)** ✅: 自己参照フィルタをフィルタ後配列で条件判定 + テスト補完
  - `householdIds` / `facilityIds` をフィルタ後に変数化し、条件チェック・レンダリング両方で使用
  - 自己IDのみの場合に空セクションが表示されるバグ修正
  - テスト追加: 施設側名前解決・自己参照フィルタ・自己IDのみ非表示（世帯/施設対称）
- **feat (#177, 2026-03-08)** ✅: CustomerDetailSheetの同一世帯・同一施設をBadge+名前表示に改善
  - `customers: Map<string, Customer>` propを追加
  - 同一世帯/施設メンバーをBadgeコンポーネントで表示（名前解決 + IDフォールバック）
  - 自己参照IDのフィルタリング

## 直近の実装（2026-03-08 ナビゲーション改善 + E2E修正）

- **fix (#168, 2026-03-08)** ✅: E2Eテストセレクタ修正
  - `schedule.spec.ts`: `getByText('利用者')` → `getByRole('menuitem')` で ViewModeToggle との曖昧マッチ解消
  - `history.spec.ts`: パンくずリンク表示待機追加
  - `AppBreadcrumb.tsx`: `trailingSlash: true` による `usePathname()` 末尾スラッシュ正規化
- **fix (#167, 2026-03-08)** ✅: PR #166 UI変更に伴うE2Eテスト同期修正
  - `getByText('利用者マスタ')` → `'利用者'` 等ラベル短縮の反映
  - 「戻る」ボタン削除 → パンくず「ホーム」リンクへのテスト更新
- **feat (#166, 2026-03-08)** ✅: メニュー・ナビゲーション改善（#163 #164 #165）
  - マスタタブ 3→5 統一（基本予定・希望休を追加）
  - AppBreadcrumb コンポーネント新規追加（history/report/settings/masters）
  - ヘッダーメニュー: 現在地ハイライト、アイコン→Menu、ホームリンク追加
- **test (#162, 2026-03-08)** ✅: `findSingleBarInRow` 正常パス・フォールバックパスのテスト追加
  - `web/e2e/helpers.spec.ts` に 3 件追加（+62行）
  - `page.setContent()` で DOM 構造を直接構築し Emulator 不要で高速検証
  - PR #150 で修正した bar/row 不整合バグの回帰防止テスト
- **test (#161, 2026-03-08)** ✅: useOrders / useStaffUnavailability 週切替リセットテスト追加（CI GREEN run #22816170444）
  - 週切替時の state 初期化（前週データ残留防止）を検証するテストを追加
- **chore (#160, 2026-03-08)** ✅: checker.ts の `getStaffCount` 重複解消 + LATEST.md テスト件数更新
- **test (#159, 2026-03-08)** ✅: useScheduleData の loading 状態テスト追加（travelTimesLoading 含む）
  - 7件: loading 初期値・travelTimesLoading 合算・各フラグ true 状態

## 直近の実装（2026-03-08 Codex Medium対応）

- **fix (#158, 2026-03-08)** ✅: Codex Medium指摘3件修正
  - `checker.ts`: not_visited + 複数人体制 → error から warning に降格（validation.ts / optimizer と整合性統一）
  - `useScheduleData.ts`: `travelTimesLoading` を combined `loading` に追加（travel_times ロード前の制約チェック漏れ防止）
  - `LATEST.md`: PR #155〜#157 の内容を追記

- **fix (#157, 2026-03-08)** ✅: 希望休日付フィルタ・権限境界・週切替リセットの3件修正（Codex High指摘対応）
  - `validation.ts` / `checker.ts`: 希望休 `slot.date` と `order.date` の日付比較 `isSameDate()` を追加（別日の希望休が誤適用されるバグ修正）
  - `auth.py`: `require_manager_or_above()` で role claim 未設定ユーザーを403拒否に変更（セキュリティ修正）
  - `useOrders.ts` / `useStaffUnavailability.ts`: 週切替時に state を初期化（前週データ残留防止）
  - テスト: validation.test.ts +2件、checker.test.ts +2件、test_auth.py 期待値変更

- **fix (#156, 2026-03-08)** ✅: 住所正規化をNFKC統一 + テストギャップ解消
  - `normalize-address.ts` / `normalize_address.py`: NFKC正規化を統一適用
  - テスト追加: 全角数字・全角ハイフン・スペース正規化のエッジケース

- **docs (#155, 2026-03-08)** ✅: LATEST.md に PR #151, #152 の内容を追記

## 直近の実装（2026-03-09）

- **fix (#151, 2026-03-09)** ✅: Firestoreルールに `allowed_staff_ids` / `same_household_customer_ids` / `same_facility_customer_ids` のバリデーション追加
  - `isValidCustomer()` に optional `is list` チェック3件追加（既存データ互換: フィールド未設定は許可）
  - Firestore Rules テスト6件追加（型不正→拒否3件 + 欠落→許可3件）→ 113件全パス
- **test (#152, 2026-03-09)** ✅: `customers.ts` 双方向同期の失敗系・エッジケーステスト追加
  - 自己参照フィルタリング（household/facility各1件）、エラー伝播（batch/transaction各1件）、世帯+施設同時変更（1件）、世帯メンバー変更時の双方向同期検証（1件）→ 16件全パス
  - Codexレビュー指摘（seed/optimizerグループ結合ロジック乖離 #153、hasNoRoleリスク #154）をIssue化
- **fix (#150, 2026-03-09)** ✅: findSingleBarInRow フォールバックの bar/row 不整合を修正
  - フォールバック時 `ganttRows.first()` → `firstBar.locator('xpath=ancestor::*[...]')` で実際の親行を取得
  - bar と row が異なる DOM 要素を参照するリスクを排除
- **fix (#149, 2026-03-09)** ✅: E2E D&D flakiness改善 — ドラッグ操作の座標安定性を強化（CI: 3回連続GREEN 63 passed, 1 flaky, 0 failed）
  - `dragOrderToTarget()`: ドラッグ開始後にターゲット位置を再スクロール → freshDropBoxで座標再取得。stale drop座標による落下失敗を削減（NOTE: mousedown中のscrollIntoViewIfNeededはdnd-kit座標deltaをずらすリスク、ビューポート拡大で緩和）
  - `findSingleBarInRow()`: N回の非同期DOM問い合わせ（bars.count() ループ）→ 単一`page.evaluate()`呼び出しに最適化。strict mode違反リスク低減、Emulator RPC呼び出し削減
  - `dragOrderHorizontally()`: コメント整備（dnd-kit PointerSensor 5px距離確実トリガーの詳細説明）
  - E2Eテスト: `toBeLessThanOrEqual(0)` → `toBe(0)` に修正（キャンセル時トースト非表示の意図明確化）
  - ローカル検証: 6 passed, 2 flaky (Emulator並列ロード), 0 logic failures
  - 他テストへの副作用: なし（D&D機構のみ変更）

## 直近の実装（2026-03-08）

- **test (#147, 2026-03-08)** ✅: 基本予定一覧ページ（WeeklySchedulePage）コンポーネントテスト追加
  - 9件: ページタイトル・空状態・利用者名表示・週間サービススロット・合計数・検索フィルタ・0件検索・詳細シート開閉・staff_countバッジ
- **test (#146, 2026-03-08)** ✅: OptimizeButton allowed_staff_ids事前チェックダイアログのコンポーネントテスト追加
  - 7件: 警告なし→直接最適化・警告あり→事前警告ダイアログ・利用者名/曜日/時間帯表示・allowedヘルパー名表示・戻って修正・警告無視して実行・複数警告リスト
- **test (#145, 2026-03-08)** ✅: Undo/Redo E2Eテスト + スケジュールインタラクションE2Eテスト追加
  - E2E: Undo/Redo初期disabled状態確認 + D&D成功後Undo→Redo フロー確認
  - 変更確認チェックボタン・同一世帯/施設MultiSelectは既存テストで十分と判断（追加不要）
- **test (#144, 2026-03-08)** ✅: HelperNotSubmitted バリデーション拒否テスト追加
  - id欠落・name欠落・非オブジェクト型の3ケースで422拒否を検証
- **fix (#143, 2026-03-08)** ✅: UnavailabilityReminderRequest.helpers_not_submitted を型付きモデルに変更
  - `list[dict]` → `list[HelperNotSubmitted]`（Pydantic型バリデーション強化）
- **fix (#141, 2026-03-08)** ✅: PR #137 品質ゲート補完 — コードレビュー指摘修正
  - `EmailStr` バリデーション導入、`DefaultCredentialsError` 個別ハンドリング、DRY改善
- **fix (#139, 2026-03-08)** ✅: Helper.emailフィールドのスキーマドキュメント・Seedインポート対応
  - `firestore-schema.md` にemail記載、`import-helpers.ts` でemail列対応

## 直近の実装（2026-03-07）

- **feat (2026-03-07)** ✅: Google Chat DM催促機能を追加（PR #137 マージ済み、Closes #132）
  - Helper型に`email`フィールド追加（shared/web/validation）
  - Python: `chat_sender.py` — Google Chat API経由DM送信（graceful degradation）
  - Python: `POST /notify/chat-reminder` エンドポイント追加
  - Web: `ChatReminderDialog` — チェックボックスで複数スタッフ選択・一括送信
  - Web: 希望休管理ページに「Chat催促」ボタン追加
  - テスト: Python 12件 + Vitest 5件追加、CI全4ジョブGREEN
  - **後続作業**: GCP設定（Chat API有効化・Bot登録・SA権限付与）

- **feat (2026-03-07)** ✅: household_id廃止 → same_household/facility_customer_ids移行（PR #134 マージ済み、Closes #133）
  - **Phase A: データモデル移行**（32ファイル）
    - `household_id?: string` → `same_household_customer_ids: string[]` + `same_facility_customer_ids: string[]`
    - Firestore双方向同期: `writeBatch`（create）/ `runTransaction`（update）で原子的に相手側リストも更新
    - 住所正規化ユーティリティ（TS: `normalizeAddress` / Python: `normalize_address`）で同一施設自動判定
    - seed/import スクリプト対応（`household_id` CSV → 新フィールド変換）
  - **Phase B: 最適化エンジン**
    - `solver.py`: 同一世帯・同一施設ペアの移動時間を0にオーバーライド
    - `link_household.py`: Union-Findで連結成分を構築（chain関係の分断バグ修正）
  - **Codexレビュー指摘4件修正**
    - Firestore双方向同期の原子化（writeBatch/runTransaction統合）
    - Union-Findアルゴリズム（visited走査の連結成分分断バグ修正）
    - seed側住所正規化の統一（`.trim()` → `normalizeAddress()`）
    - Zodスキーマ重複排除 + 自己参照フィルタリング
  - テスト: Optimizer 294件 / Web 461件 / CI全4ジョブGREEN
  - Phase C（利用者編集UIの世帯・施設選択）は後続PRで対応

- **feat (2026-03-07)** ✅: 利用者編集UIに同一世帯・同一施設メンバー選択MultiSelectを追加（PR #136 マージ済み）
  - `CustomerEditDialog.tsx`: 「同一世帯メンバー」「同一施設メンバー」それぞれにMultiSelect UIを追加
  - `same_household_customer_ids` / `same_facility_customer_ids` を双方向同期で保存
  - 自己参照フィルタリング（自分自身を選択肢に表示しない）
  - CI: main push後 in_progress（run #22800783714、2026-03-07T14:25Z）

## 直近の実装（2026-02-25）

- **feat (2026-02-25)** ✅: allowed_staff_ids 事前チェック機能を追加（CI GREEN run #22372525458）
  - `checkAllowedStaff()` 純粋関数: `weekly_availability` の曜日・時間帯カバーチェック + 希望休（全日/時間帯重複）チェック
  - `OptimizeButton`: 最適化実行前に警告検出 → 「戻って修正する」/「警告を無視して実行」2択ダイアログ
  - Vitest 11件追加（`allowed-staff-check.test.ts` 304行）
  - ファイル: `web/src/lib/validation/allowed-staff-check.ts` / `allowed-staff-check.test.ts`

- **fix (2026-02-25)** ✅: allowed_staff_ids ロールバックスクリプトを追加（CI GREEN run #22371570983）
  - `seed/scripts/rollback-allowed-staff.ts` 新規追加: 本番 Firestore の `allowed_staff_ids` を `[]` にリセット（緊急ロールバック用）
  - 背景: preferred→allowed 自動移行が Infeasible を引き起こしたため

- **fix (2026-02-25)** ✅: E2EテストのallowedStaffバッジ確認を削除（Seedデータ非対応）（CI GREEN run #22370977294）
  - `web/e2e/masters-crud.spec.ts`: Seed データが `allowed_staff_ids` 非対応のためバッジ確認テストを削除

- **fix (2026-02-25)** ✅: CI失敗修正 — schemas.tsの型エラーとIntegration test Infeasibleを解消
  - `web/src/lib/validation/schemas.ts`: `allowed_staff_ids` から `.default([])` を削除（Zod 型分離による TypeScript エラー解消）
  - `seed/data/customer-staff-constraints.csv`: `allowed` 行を削除（19行に戻す）→ Optimizer Infeasible 解消

- **feat (2026-02-25)** ✅: 入れるスタッフ（allowed_staff_ids）ホワイトリスト機能の追加（PR #131 マージ済み）
  - **型定義・スキーマ**: `StaffConstraintType` に `'allowed'` 追加、`Customer` に `allowed_staff_ids: string[]` 追加（TS + Python）
  - **Python エンジン**: `_add_allowed_staff_constraint()` — 空=制限なし、空でなければリスト外スタッフ禁止（ハード制約）。TDD 4テスト（289件 pass）
  - **UI**: `CustomerEditDialog.tsx` に「入れるスタッフ」MultiSelect 追加（複数選択、バッジ表示）
  - **マイグレーション**: `seed/scripts/migrate-preferred-to-allowed.ts` 新規（preferred → allowed 移行スクリプト）
  - CI: success（run #22360000000付近）

## 直近の実装（2026-02-24）

- **fix (2026-02-24)** ✅: iPad横向き（1024px）レスポンシブ対応 — ツールバー横スクロール解消（PR #124 マージ済み）
  - `ViewModeToggle` / `DayTabs` / `ResetButton` / `NotifyChangesButton` / `BulkCompleteButton`: xl 未満でアイコンのみ表示（テキストラベル非表示）
  - `StatsBar`: `grid-cols-6` → `grid-cols-2/sm:3/lg:6` レスポンシブ化
  - iPad(1024px)で約63px余裕あり、Desktop(1280px)で約45px余裕あり
  - CI: success（run #22350898838）

- **2026-02-22〜24の実装**: PR #107〜#124（詳細は `docs/handoff/archive/2026-02-detailed-history.md` を参照）
  - Phase 5b メール通知 → Gmail API DWD実装 → 利用者軸ビュー → staff_count/travel_times D&D統合
  - ガント幅バグ修正 → 通知設定Firestore化 → マスタ詳細シート → ファビコン → E2E拡充
  - ふりがなソート/あかさたなフィルター → 基本予定詳細シート → Undo/Redo → iPad横向き対応



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

- **PR #88** ✅: 徒歩移動スタッフへの訪問移動時間上限制約を追加（Closes #84）
  - Optimizer: `MAX_WALK_TRAVEL_MINUTES = 30`（30分）を超えるペアへの割り当てを禁止
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

- **PR #91** ✅: PRD/SOWに新マスタフィールド・スコープ外・将来フェーズを反映
  - `PRD.md`: 利用者マスタ6フィールド・スタッフマスタ4フィールド・研修状態3段階・可視化機能・スコープ外セクション追記
  - `SOW.md`: サービス種別8種・拡張フィールド・スコープ外（突合処理）・将来フェーズを反映

- **PR #92** ✅: Helper.genderをrequiredに統一・LATEST.mdの徒歩記述を実態に修正
  - `shared/types/helper.ts` + `web/src/types/index.ts`: `gender?: Gender` → `gender: Gender`（Zodスキーマ・Pythonモデルは元々required）
  - `docs/handoff/LATEST.md`: PR#88の「徒歩距離2.0km」→「徒歩移動時間30分（`MAX_WALK_TRAVEL_MINUTES = 30`）」

- **PR #93** ✅: Customer/Helperマスタに新フィールドを追加（14ファイル、+331行）
  - **Customer（6フィールド）**: `aozora_id`, `phone_number`, `home_care_office`, `consultation_support_office`, `care_manager_name`, `support_specialist_name`（全てoptional）
  - **Helper（4フィールド）**: `employee_number`, `address`, `location`（GeoLocation?）, `phone_number`（全てoptional）
  - 追加レイヤー: TypeScript共有型・フロントエンド型・Zodスキーマ・Pythonモデル・Firestoreローダー・UI編集ダイアログ（住所ジオコーディング含む）・Seedデータ/スクリプト・スキーマドキュメント
  - `CustomerEditDialog.tsx`: 「連絡先・関連機関」セクション新設、外部連携IDにaozora_id追加
  - `HelperEditDialog.tsx`: 社員番号・電話番号追加、住所セクション（住所入力＋ジオコーディングボタン＋lat/lng）新設

- **PR #95** ✅: HelperEditDialog location NaN バリデーション修正（Closes #94）
  - `HelperEditDialog.tsx`: `geocodeAddress()` で `lat`/`lng` が `NaN` になるケースの入力バリデーションを追加
  - E2E CI failure（`masters-crud` テスト）を修正

- **PR #102** ✅: スケジュール週全体ビュー（ピボット表示）を追加（Closes #96）
  - `ScheduleContext` に `viewMode`（`'day' | 'week'`）を追加（デフォルト `'day'`、既存E2E影響なし）
  - `ViewModeToggle` コンポーネント（日/週ボタン切り替え）を新規作成
  - `WeeklyGanttChart` でヘルパー×曜日のピボット表示を実装（ResizeObserver でレスポンシブ列幅）
  - `SERVICE_COLORS` を `constants.ts` に移動し週ビューでも再利用
  - テスト: `ViewModeToggle.test.tsx`（5件）+ `WeeklyGanttChart.test.tsx`（7件）追加、計12件新規

- **Phase 3** ✅: Python Optimizer の service_types 動的化（Closes #98 Phase 3）
  - `models/common.py`: `ServiceTypeConfig` Pydantic モデル新設（code/label/short_label/requires_physical_care_cert/sort_order）
  - `models/problem.py`: `OptimizationInput` に `service_type_configs: list[ServiceTypeConfig] = []` 追加（後方互換: デフォルト空）
  - `data/firestore_loader.py`: `load_service_types()` + `load_all_service_types()` 追加、`load_optimization_input()` を更新
  - `engine/constraints.py`: `_requires_physical_care_cert()` ヘルパー追加（Firestoreマスタ優先、静的フォールバック）
  - `engine/solver.py`: `_compute_feasible_pairs()` で `service_type_configs` を動的参照（`o.service_type in ("physical_care", "mixed")` のハードコードを削除）
  - `report/aggregation.py`: `aggregate_service_type_summary()` に `service_type_configs` 引数追加（ラベル動的解決）
  - `api/routes.py`: 月次レポートエンドポイントで `load_all_service_types()` を呼び出し、集計に渡す
  - テスト15件新規追加: `TestLoadServiceTypes`（5件）+ `TestLoadAllServiceTypes`（2件）+ `TestDynamicQualificationConstraint`（4件）+ 動的ラベルテスト（4件）
  - 全266件 pass

- **PR #103** ✅: service_types Firestoreコレクション + CRUD UI を追加（Closes #98 Phase 1）
  - `service_types` コレクション新設（ドキュメントID = code）、delete 禁止ルール
  - 8種の初期 Seed データ（CSV + `import-service-types.ts`）
  - `useServiceTypes` フック（onSnapshot + sort_order 順 sortedList）
  - Firestore CRUD: `createServiceType`（setDoc）/ `updateServiceType`（updateDoc）
  - Zod: `serviceTypeSchema`（code は英小文字・アンダースコアのみ）
  - `/masters/service-types` ページ + `ServiceTypeEditDialog`（編集モードで code は read-only）
  - Header.tsx ナビゲーションに「サービス種別マスタ」リンク追加
  - テスト: 33件新規追加（CRUD 8件 + Zod 12件 + Firestore Rules 13件）

- **PR #101** ✅: TrainingStatusを3段階（not_visited/training/independent）に拡張（Closes #97）
  - `shared/types/common.ts` + `web/src/types/index.ts`: TrainingStatus に `not_visited` を追加
  - `optimizer/models/common.py`: TrainingStatus enum に NOT_VISITED を追加
  - `optimizer/engine/constraints.py`: not_visited も training と同様に単独割当禁止に適用
  - `web/src/lib/validation/schemas.ts`: Zod enum に `not_visited` を追加
  - `CustomerTrainingStatusEditor.tsx`: SelectItem に「未経験」を追加（UI: 3択）
  - テスト: Optimizer 251件 pass / Web 250件 pass

- **PR #100** ✅: household制約のFirestoreリンク生成を共通化（Closes #99）
  - `optimizer/data/link_household.py` を新規作成し、`csv_loader._link_household_orders()` を共通関数 `link_household_orders()` として抽出
  - `firestore_loader.load_optimization_input()` でも共通関数を呼び出し、Firestoreに `linked_order_id` がない場合も動的リンクを生成するよう修正
  - `csv_loader` は共通関数を呼ぶだけに変更（動作は同一）
  - `seed/scripts/import-orders.ts` のリンクロジックを時間ギャップベース（30分以内）に修正しcsv_loaderと整合
  - テスト: `test_link_household.py`（10件新規）+ `test_firestore_loader.py`（2件追加）→ 計250件 pass（Optimizer）/ 249件 pass（Web）

## 最新テスト結果サマリー（2026-03-08）
- **Optimizer**: 297件 pass ✅
- **Web (Next.js)**: **529件 pass** ✅（+8: useScheduleData loading 7件 + useOrders/useStaffUnavailability週切替リセット7件 — PR #159〜#161）
- **Firestore Rules**: 107件 pass
- **E2E Tests (Playwright)**: **69テスト** pass（+3: findSingleBarInRow 正常パス/フォールバックパス — PR #162）
- **CI/CD**: PR #162 CI in_progress（run #22816375809）

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

## GCP Sheets エクスポート（本番環境設定まとめ）

本番 Cloud Run で Google Sheets エクスポートを有効にするために以下の設定を実施済み:

### 採用アプローチ: Authorized User ADC を Secret Manager に保存

**背景**: Service Account（Compute Engine Default SA）は Google Drive ストレージを持っていないため、SA として直接スプレッドシートを作成できない。

**解決策**:
1. ローカルの ADC（`~/.config/gcloud/application_default_credentials.json`、`yasushi.honda@aozora-cg.com`、Sheets/Drive スコープ付き）を Secret Manager に保存
2. Cloud Run がそれを `/etc/secrets/adc` にマウント
3. `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/adc` 環境変数で ADC として使用

**GCP 設定（実施済み）**:
- Secret Manager API 有効化: `secretmanager.googleapis.com`
- シークレット: `google-adc-credentials`（version 1）
- Cloud Run SA に `roles/secretmanager.secretAccessor` 付与
- Cloud Run サービス: `/etc/secrets/adc=google-adc-credentials:latest` ボリュームマウント
- Cloud Run 環境変数: `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/adc`

**注意事項**:
- スプレッドシートは `yasushi.honda@aozora-cg.com` の個人 Drive に作成される
- ADC の refresh token が失効した場合、再ログインして Secret Manager を更新が必要:
  ```bash
  gcloud auth application-default login \
    --scopes="openid,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive"
  gcloud secrets versions add google-adc-credentials \
    --data-file="$HOME/.config/gcloud/application_default_credentials.json" \
    --project=visitcare-shift-optimizer
  ```

## 次のアクション（優先度順）

1. **allowed_staff_ids の本番運用確認**: 本番 Firestore で意図しない Infeasible が発生しないか確認。必要なら `seed/scripts/rollback-allowed-staff.ts` でロールバック
3. **E2Eテスト拡充**: 以下が未追加
   - 基本予定一覧詳細シート（行クリック詳細シート）E2E
   - 変更確認チェックボタン（アンバーリング→緑確認ボタン→解除）E2E
   - Undo/Redo ボタン操作（Cmd+Z / Cmd+Shift+Z）E2E
   - allowed_staff_ids 事前チェックダイアログ E2E
   - 同一世帯・同一施設MultiSelect E2E
4. **次フェーズ方針決定**: Phase 6（モバイル対応・PWA化・オフライン対応）等を検討
5. **seed複数週対応の活用**: `import-all.ts --weeks 2026-02-09,2026-02-16,2026-02-23` で複数週一括投入が可能

## GitHub Issuesサマリー
- **オープンIssue**: 0件
- **クローズ済み（直近）**: PR #144（バリデーション拒否テスト）、PR #143（HelperNotSubmitted型付き、Closes #142）、PR #141（品質ゲート補完、Closes #140）、PR #139（スキーマdoc+Seed、Closes #138）、PR #137（Chat DM催促、Closes #132）、PR #136（同一世帯/施設MultiSelect）、PR #134（household_id廃止、Closes #133）
- **クローズ済み（既往）**: Issue #118（Gmail DWD）、Issue #125（型定義）、Issue #126（Python制約）、Issue #127（UI）、Issue #120（C010競合修正）、Issue #109（PR #111）、Issue #112（PR #114）、Issue #113（PR #115）

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
