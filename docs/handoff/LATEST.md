# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-02-24（利用者マスタ拡充続き: ふりがな入力・あかさたなソート/フィルター・あおぞらIDフォーム整理・基本予定一覧に行クリック詳細シート追加）
**現在のフェーズ**: Phase 0-5b 完了 → 実績確認・月次レポート・Google Sheetsエクスポート（本番動作確認済み）・マスタ拡張（不定期パターン・外部連携ID・分断勤務・徒歩距離上限・サービス種別8種・性別制約・新マスタフィールド・研修状態3段階・週全体ビュー・service_typesマスタ化 Phase 1-3・制約チェック UI 拡張・メール通知・利用者軸ビュー・基本予定一覧・Gmail API DWD送信実装・staff_count複数割当・travel_times D&D統合・ガント幅バグ修正・利用者軸フォント統一・seed複数週対応・通知設定Firestore/UI管理化・マスタ詳細シート追加・ファビコン追加・E2Eテスト拡充・利用者マスタ表示/検索拡充・ふりがなソート/あかさたなフィルター・基本予定一覧詳細シート）実装済み・マージ済み

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

## 直近の実装（2026-02-23 ～ 2026-02-24）

- **feat (2026-02-24)** ✅: 基本予定一覧に行クリック詳細シートを追加
  - `web/src/app/masters/weekly-schedule/page.tsx`: テーブル行クリックで `CustomerDetailSheet` を表示（利用者マスタと同一パターン）
  - 詳細シートの編集ボタンから `CustomerEditDialog` に遷移（`canEditCustomers` 権限制御）
  - ストライプ行 + hover ハイライトで視認性向上
  - 利用者名セルにふりがなをサブテキスト表示

- **feat (2026-02-24)** ✅: 利用者編集フォームのあおぞらIDをフォーム先頭に移動
  - `CustomerEditDialog.tsx`: あおぞらID入力欄を「基本情報」セクションの先頭に移動

- **feat (2026-02-23)** ✅: 利用者マスタに頭文字（あかさたな）フィルターボタンを追加
  - `web/src/app/masters/customers/page.tsx`: 検索バー下に「頭文字」ボタンバー（あ か さ た な は ま や ら わ）配置
  - ボタンクリックで該当かな行の利用者のみ表示（再クリックで解除、✕ボタンでもクリア）
  - 濁音・半濁音も同じ行として扱う（例: が→か行、ば/ぱ→は行）
  - 頭文字フィルターとテキスト検索・ふりがなソートは併用可能

- **feat (2026-02-23)** ✅: 外部連携IDをあおぞらIDのみに整理（フォーム・スキーマ）
  - `CustomerEditDialog.tsx`: 介ソルID・カカラID・CURA IDの入力欄を削除
  - `schemas.ts`: `kaiso_id`/`karakara_id`/`cura_id` を Zodスキーマから削除
  - あおぞらIDのみシンプルな1フィールドとして表示

- **feat (2026-02-23)** ✅: 利用者マスタにふりがな入力・あかさたなソートを追加
  - `CustomerEditDialog.tsx`: 姓/名のふりがな入力欄（`family_kana`/`given_kana`）追加
  - `customers/page.tsx`: 氏名列ヘッダークリックでふりがなあかさたなソート（昇順/降順/なしの3トグル）
  - 氏名セルにふりがなをサブテキストで表示
  - `CustomerDetailSheet.tsx`: 名前の下にふりがなを表示
  - `schemas.ts`: `personNameSchema` に `family_kana`/`given_kana` を追加（オプション）

- **feat (2026-02-23)** ✅: 利用者に電話番号②・電話備考を追加（テーブル・詳細・編集フォーム）
  - 利用者マスタテーブルに `phone_number_2` / `phone_number_2_note` カラムを追加
  - `CustomerDetailSheet.tsx`: 電話番号②・備考を表示
  - `CustomerEditDialog.tsx`: 電話番号②・備考の入力フォームを追加
  - shared/types + web/src/types + Zodスキーマ更新
  - CI: success（2026-02-23T08:54:12Z）

- **fix (2026-02-23)** ✅: web側PersonName型にfamily_kana/given_kanaを追加（ビルドエラー修正）
  - `web/src/types/index.ts` の `PersonName` に `family_kana?`・`given_kana?` を追加
  - CI: success（2026-02-23T08:51:34Z）

- **feat (2026-02-23)** ✅: 利用者検索にあおぞらID・ふりがな（ひらがな/カタカナ統一）を追加・外部連携IDテスト修正
  - 検索バーでふりがな（`name.family_kana`/`name.given_kana`）・あおぞらIDによる絞り込みを追加
  - カタカナ入力をひらがなに正規化して一致判定（`toHiragana` ユーティリティ）
  - CI: success（2026-02-23T08:45:59Z の実行は1ジョブ失敗だが後続で解消）

- **feat (2026-02-23)** ✅: 利用者マスタにあおぞらIDカラム追加・外部連携IDをあおぞらIDのみに整理
  - 利用者一覧テーブルに `aozora_id` カラムを追加
  - 不要な外部連携IDカラム（介ソルID/カカラID/CURA ID）をテーブルから削除し画面をすっきり

- **feat (2026-02-23)** ✅: 利用者マスタテーブルに担当居宅カラムを追加
  - `home_care_office` フィールドを一覧テーブルに表示

- **test (2026-02-23)** ✅: HelperDetailSheetテストを新仕様（自立済み表示）に更新

- **feat (2026-02-23)** ✅: 詳細シートの表示内容を拡充
  - `CustomerDetailSheet.tsx`: 連絡先・関連機関（担当居宅・相談支援事務所・ケアマネ・支援専門員）表示を追加
  - `HelperDetailSheet.tsx`: 研修状態を「未経験/研修中/自立済み」のバッジで分類表示

- **feat (2026-02-23)** ✅: 利用者マスタテーブルに連絡先4列を追加
  - 担当居宅・ケアマネ・相談支援事務所・支援専門員カラムを一覧に追加（横スクロール対応）

- **feat (2026-02-23)** ✅: 詳細シートを幅拡張・ヘッダー固定に改善
  - Sheet 幅を `max-w-md` → `max-w-2xl` に拡大、タイトルヘッダーをスクロール固定

- **fix (2026-02-23)** ✅: E2EテストのgetByText strict mode violation修正（サ責ラベル）
  - `masters-detail.spec.ts`: 複数マッチするテキストを `first()` で限定

- **test (2026-02-23)** ✅: E2Eテスト拡充（詳細シート・通知ダイアログ）— 48 → **58テスト**
  - `web/e2e/masters-detail.spec.ts` 新規（7テスト）: 利用者/ヘルパー行クリック→DetailSheet表示・Escape閉じ・編集ボタン→EditDialog遷移・Pencilボタン直接遷移
  - `web/e2e/schedule-interactions.spec.ts` 追加（3テスト）: 「変更通知」disabled確認・最適化後NotifyConfirmDialog表示・スキップ動作
  - CI: in_progress（2026-02-23T07:36:16Z）

- **feat (2026-02-23)** ✅: 訪問介護アプリ用ファビコンを追加（家＋ハート）
  - `web/src/app/icon.svg` 新規追加: ティール背景に白い家＋ピンクのハートデザイン
  - Next.js App Router の自動検出により `<link rel="icon">` として配信（追加設定不要）
  - CI: success（2026-02-23T06:55:39Z）

- **PR #119 (2026-02-23)** ✅: 利用者・ヘルパーマスタに詳細シート（読み取り専用）を追加
  - `web/src/components/masters/CustomerDetailSheet.tsx` 新規: 行クリック → 右サイドパネルで詳細表示（Radix UI Sheet）
  - `web/src/components/masters/HelperDetailSheet.tsx` 新規: ヘルパー詳細右パネル（資格バッジ・研修状態含む）
  - 表示内容: Customer（基本情報・連絡先関連機関・NG/推奨スタッフ名前解決・週間サービス・不定期パターン・外部連携ID）/ Helper（基本情報・雇用条件・週間勤務可能時間・利用者別研修状態）
  - UIパターン: 読み取り専用=Sheet（右パネル）/ 編集=Dialog への「編集」ボタンでシームレス遷移
  - `CustomerEditDialog` / `HelperEditDialog` に `DialogDescription` 追加（aria-describedby 警告解消）
  - ユニットテスト 31件追加（CustomerDetailSheet 17件・HelperDetailSheet 14件）
  - CI: success（2026-02-23T06:27:14Z）、E2E 48テスト

- **PR #117 (2026-02-23)** ✅: 通知設定をFirestore/UIで管理 + E2E D&Dフレーキー修正
  - `firebase/firestore.rules`: `settings/{docId}` ルール追加（admin書き込み、認証済み読み取り）
  - `firebase/__tests__/firestore.rules.test.ts`: settings 13件ルールテスト追加 → 合計106件 pass
  - `web/src/lib/firestore/settings.ts` 新規: `updateNotificationSettings()` 実装
  - `web/src/hooks/useNotificationSettings.ts` 新規: `onSnapshot` リアルタイム購読フック
  - `web/src/app/settings/page.tsx` 新規: 設定ページUI（admin編集可、他ロールは読み取り専用）
  - `web/src/components/layout/Header.tsx`: ナビに「通知設定」リンク追加
  - `optimizer/src/optimizer/notification/sender.py`: `send_email()` に `sender_email` 引数追加
  - `optimizer/src/optimizer/api/routes.py`: `_get_sender_email()` ヘルパー追加（Firestore優先、env varフォールバック）
  - `optimizer/tests/test_notification.py`: `TestGetSenderEmail` 4件 + sender/endpointテスト追加 → 合計285件 pass
  - `docs/schema/firestore-schema.md`: `settings` コレクション記載追加
  - E2E D&Dフレーキー修正: `dragOrderToTarget` スクロール順を `source→target` から `target→source` に変更
  - CI: テスト全 job 成功（E2E in_progress as of 2026-02-23T04:24:29Z）

- **fix (2026-02-23)** ✅: ハードリフレッシュ後にガント幅が初期値のまま崩れるバグを修正
  - `GanttChart.tsx`: `useRef+useLayoutEffect([])` をコールバックref（useState）パターンに変更。`totalOrders` が 0→>0 になりDOMが出現したタイミングで再実行され `slotWidth` が 4px のまま固まる問題を解消
  - `page.tsx`: `dayDate` を `useMemo` でメモ化し、毎レンダーで新 Date を生成して schedule メモが不必要に再計算される問題を修正
  - `ScheduleContext.tsx`: `ganttAxis` を localStorage に永続化し、ハードリフレッシュ後もスタッフ軸 / 利用者軸の選択を維持

- **feat (2026-02-23)** ✅: 利用者軸ブロックのフォント改善 + seedデータ複数週対応
  - `CustomerGanttChart.tsx`: `CustomerOrderBar` / `UnassignedOrderBar` のテキストスタイルをスタッフ軸（GanttBar）と統一（text-xs font-medium flex items-center rounded-lg px-2）
  - `import-all.ts`: `--weeks` パラメータ追加（カンマ区切り複数週を一括生成）
  - `import-orders.ts`: `staff_count` フィールドを order doc に追加

- **fix (2026-02-22)** ✅: useDragAndDrop の useCallback 依存配列に serviceTypes/travelTimeLookup を追加
  - `useDragAndDrop.ts`: `processPreview` / `handleDragEnd` の依存配列漏れによる stale closure を修正

- **PR #115** ✅: travel_times移動時間D&Dバリデーション統合（Issue #113）
  - `web/src/lib/travelTime.ts` 新規: `parseTravelTimeDocId` / `buildTravelTimeLookup` / `getTravelMinutes`（双方向検索）
  - `web/src/hooks/useTravelTimes.ts` 新規: Firestore `travel_times` 一括取得フック
  - `validateDrop()` に移動時間不足 warning チェックを追加（直前/直後オーダーとのギャップ < travel_time_minutes）
  - `checkConstraints()` に `travel_time` 違反タイプ（warning）を追加
  - テスト: 16件 + 4件 + 3件 = 23件追加、合計372件 GREEN
  - CI: テスト全 job success、Deploy進行中（2026-02-22T03:29:19Z）

- **PR #114** ✅: staff_count複数割当D&Dバリデーション対応（Issue #112）
  - `Order` 型に `staff_count?: number` 追加（shared/types・web/src/types）
  - `getStaffCount()` / `computeNewStaffIds()` 純粋関数実装
  - `validateDrop()` に同一ヘルパー二重割当防止（error）・満員警告（warning）追加
  - `checkConstraints()` に `staff_count_under`（warning）/ `staff_count_over`（error）違反タイプ追加
  - `GanttBar` に `staffCount > 1` 時の「M/N」バッジ追加
  - テスト: 31件追加、合計349件 GREEN（Web）

- **PR #111** ✅: Gmail API（DWD）でメール送信を実装する（Issue #109）
  - `sender.py` のスタブを Gmail API + Domain-Wide Delegation（SA self-impersonation）で実装
  - `_get_sheets_credentials()` と同じ認証パターンを流用（ADR-015準拠）
  - `NOTIFICATION_SENDER_EMAIL` 未設定・Cloud Run 以外の環境では `emails_sent: 0`（graceful degradation）
  - 部分成功対応（個別送信失敗が他宛先に影響しない）
  - ADR-016 作成（Gmail API + DWD 採用理由・認証フロー・インフラ設定手順）
  - テスト: 5件更新（TestSender: no_sender/empty/service_unavailable/success/partial_failure）、合計279件 GREEN（Optimizer）
  - 注意: Cloud Run 本番動作には Google Workspace 管理コンソールでの DWD 設定が必要（手動・未完）

- **PR #110** ✅: スケジュール UI 改善（利用者軸ビュー・StatsBar差分カード・基本予定一覧・通知テスト）
  - `StatsBar`: `diffMap` を受け取り、最適化後の変更件数を violet で表示
  - 利用者軸ビュー: 日表示で「スタッフ軸 / 利用者軸」切替ボタンを追加。`CustomerGanttChart` を表示（利用者行 × 時刻軸）
  - `/masters/weekly-schedule` ページ新規作成: 利用者の `weekly_services` を曜日別テーブルで一覧表示
  - Header ナビ: 設定ドロップダウンに「基本予定一覧」リンク追加
  - `NotifyConfirmDialog` / `NotifyChangesButton` のコンポーネントテスト追加（各5件）
  - テスト: 318件グリーン確認

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

## 最新テスト結果サマリー（2026-02-24 基本予定一覧詳細シート・ふりがなフィルター追加後）
- **Optimizer**: 285件 pass（PR #117 TestGetSenderEmail 4件追加）
- **Web (Next.js)**: 403件 pass（確認済み 2026-02-24）
- **Firestore Rules**: 106件 pass（PR #117 settings 13件追加）
- **E2E Tests (Playwright)**: **58テスト**（直近追加: 詳細シート7件・通知ダイアログ3件）
- **CI/CD**: 最新コミット（基本予定一覧詳細シート追加）CI success（2026-02-23T15:01:46Z）

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

1. **Gmail API DWD 本番設定**: Google Workspace 管理コンソール → DWD でSAに `gmail.send` スコープ追加 + `/settings` ページまたは直接Firestoreで `settings/notification.sender_email` を設定（手動作業、コード外）。Issue #118 参照
2. **利用者マスタ 本番Firestore再投入**: `phone_number_2`/`phone_number_2_note`・`family_kana`/`given_kana` 等の新フィールドをseedに反映してから再投入を検討（本番データに新フィールドがなくてもUIは正常動作）
3. **E2Eテスト拡充**: 電話番号②・ふりがな検索・あかさたなフィルター・基本予定一覧詳細シートのE2Eテスト追加（現在58テスト）
4. **次フェーズ方針決定**: Phase 6（モバイル対応）等を検討
5. **seed複数週対応の活用**: `import-all.ts --weeks 2026-02-09,2026-02-16,2026-02-23` で複数週一括投入が可能に

## GitHub Issuesサマリー
- **オープンIssue**: 0件（全クローズ）
- **クローズ済み（直近）**: Issue #109（PR #111）、Issue #112（PR #114）、Issue #113（PR #115）、PR #117（通知設定管理・フレーキー修正）
- **クローズ済み（既往）**: Issue #96（PR #102）、Issue #98 Phase 1（PR #103）、Phase 2（PR #104）、Phase 3（PR #105）

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
