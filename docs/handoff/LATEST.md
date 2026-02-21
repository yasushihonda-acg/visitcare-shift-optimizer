# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-02-21（PR #108: Phase 5b メール通知（サ責向け）— SendGrid Free Tier）
**現在のフェーズ**: Phase 0-5b 完了 → 実績確認・月次レポート・Google Sheetsエクスポート（本番動作確認済み）・マスタ拡張（不定期パターン・外部連携ID・分断勤務・徒歩距離上限・サービス種別8種・性別制約・新マスタフィールド・研修状態3段階・週全体ビュー・service_typesマスタ化 Phase 1-3・制約チェック UI 拡張・メール通知）実装済み・マージ済み

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

## 直近の実装（2026-02-19 ～ 2026-02-21）

- **PR #108** ✅: Phase 5b メール通知（サ責向け）— エンドポイント実装済み・送信未実装
  - シフト確定・シフト変更・希望休催促の3種のメール通知をサ責向けに実装
  - `optimizer/notification/`: `recipients.py`（サ責メール収集）/ `sender.py`（**スタブ・常に0返却**）/ `templates.py`（HTMLテンプレート）
  - `sender.py` は Gmail API（DWD）実装予定。現在は `emails_sent: 0` を返す（graceful degradation）
  - `routes.py`: `POST /notify/shift-confirmed|shift-changed|unavailability-reminder`
  - `NotifyConfirmDialog.tsx`: 最適化成功後に表示する確定通知ダイアログ
  - `NotifyChangesButton.tsx`: 差分ありオーダーの変更通知ボタン
  - 希望休ページ: 未提出ヘルパーへの催促メールボタン追加

- **PR #107** ✅: 性別・研修状態・推奨スタッフ制約チェックをD&Dバリデーションとガントバーに追加（#107）
  - `checker.ts`: `Violation.type` に `gender` / `training` / `preferred_staff` を追加
  - `checkConstraints`: 性別要件(error)・研修状態(error/warning)・推奨スタッフ外(warning) を検出
  - `validateDrop`: 同3制約をD&Dドロップ時にリアルタイムチェック
  - `GanttBar`: `violationMessages` prop を追加し tooltip に違反メッセージを表示
  - `GanttRow`: `orderViolations` のメッセージを GanttBar に渡す
  - テスト18件追加（`checker.test.ts` 9件、`validation.test.ts` 9件）



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

## 最新テスト結果サマリー（2026-02-21 PR #108 実装後）
- **Optimizer**: 277件 pass（+11件: test_notification.py）
- **Web (Next.js)**: 299件 pass
- **Firestore Rules**: 94件 pass
- **E2E Tests (Playwright)**: 41 passed, 2 skipped
- **CI/CD**: PR #108 CI success（2026-02-21 10:42 JST、7m22s）

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

1. **次フェーズ方針決定**: Phase 6（モバイル対応）等を検討
2. **メール送信実装**: Gmail API（DWD）で `sender.py` を実装（ADR-016作成→実装→Cloud Run SA に DWD 設定）
3. **E2Eテスト拡充**: メール通知ボタンのE2Eテスト追加

## GitHub Issuesサマリー
- **オープンIssue**: 1件
  - #109 `feat: Gmail API（DWD）でメール送信を実装する` [enhancement, P2]
- **クローズ済み**: Issue #96（PR #102）、Issue #98 Phase 1（PR #103）、Phase 2（PR #104）、Phase 3（PR #105）

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
