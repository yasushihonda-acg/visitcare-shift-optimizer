# ハンドオフアーカイブ — 詳細な完了事項（2026-03-07～2026-03-11）

このファイルは `docs/handoff/LATEST.md` から移動した詳細な実装履歴です。
再開時は LATEST.md を優先参照してください。

---

## 2026-03-11 実装

### Seedインポート既存オーダー削除

- **fix (#242, 2026-03-11)** ✅: Seedインポート時に同一週の既存オーダーを事前削除して残骸を防止
  - `seed/scripts/import-orders.ts`: 投入前に同週の既存オーダーをすべて削除
  - `seed/scripts/clear-orders.ts`（未コミット）: オーダーコレクション全削除スクリプト（開発ツール）
  - CI SUCCESS（run #22892135879、8m21s）

### gunicorn / ダイアログ / ViolationPanel

- **fix (#247, 2026-03-11)** ✅: gunicorn workersを1→2に増やしリクエストブロックを防止（Closes #246）
  - `optimizer/Dockerfile`: `--workers 1` → `--workers 2`
  - 連続リクエスト（最適化→リセット等）でサーバーがブロックされる問題を解消
  - CI SUCCESS（run #22932335512、8m2s）

- **fix (#245, 2026-03-11)** ✅: 最適化・リセットダイアログに週全体が対象であることを明記
  - 最適化実行ダイアログ・リセットダイアログの確認文言に「週全体（月〜日）」を明記
  - CI SUCCESS

- **feat (#244, 2026-03-11)** ✅: 最適化完了後に違反があればViolationPanelを自動表示
  - 最適化完了時に `violations.length > 0` であれば違反/警告パネルを自動的に開く
  - CI SUCCESS

---

## 2026-03-10 実装

### ViolationSummaryBar フィルターリセット + checker修正

- **fix (#240, 2026-03-10)** ✅: ViolationSummaryBar「詳細」クリック時にフィルタをallにリセット
  - 「詳細」ボタンクリックで違反/警告Sheetドロワーを開く際、フィルタをデフォルト（all）にリセットする動作を追加
  - CI SUCCESS

- **fix (#239, 2026-03-10)** ✅: checkerのcompleted/cancelledオーダー除外とoutside_hours整合性修正（Closes #235）
  - `checker.ts`: completed/cancelled オーダーを制約チェック対象から除外
  - `outside_hours` チェックの整合性修正
  - CI SUCCESS

### StatsBar 違反/警告サマリーバー常時表示

- **feat (#238, 2026-03-10)** ✅: 違反/警告サマリーバーを常時表示する（Closes #234）
  - StatsBar の violations/warnings カウントを最適化未実行時も常時表示
  - CI in_progress（run #22889539834、main push）

- **test (#237, 2026-03-10)** ✅: StatsBar multi-staffテストにcompleted数値の直接検証を追加
  - staff_count>=2 オーダーの完了数が正しくカウントされることを直接検証
  - CI SUCCESS（run #22889203537）

- **fix (#236, 2026-03-10)** ✅: StatsBarの割当済カウントでstaff_count>=2のオーダーが二重カウントされる問題を修正
  - 複数スタッフ体制オーダーを assignments.length ではなく orders 単位でカウントするよう修正

### 違反/警告UI強化

- **feat (#232, 2026-03-10)** ✅: 違反/警告一覧パネル（Sheetドロワー）を追加
  - StatsBarの違反/警告バッジクリックで全件一覧をSheetドロワー表示
  - 違反（error）・警告（warning）を色分けリスト表示
  - CI SUCCESS（run #22882490188、8m40s）

- **feat (#230, 2026-03-10)** ✅: StatsBarの違反/警告バッジにPopover詳細表示を追加（Closes #229）
  - StatsBarのerror/warningカウントバッジにhover/clickでPopover表示
  - 件数が多い場合は「詳細はパネルで確認」誘導

- **fix (#228, 2026-03-10)** ✅: seedデータの実行可能性を修正（世帯/施設連続訪問パターン追加）
  - 同一世帯・同一施設の連続訪問パターンをseedに追加
  - Optimizerのinfeasibleリスクを低減

- **fix (#227, 2026-03-10)** ✅: DialogContentのaria-describedby警告を解消

### 世帯/施設DRY化 + パッチスクリプト + Emulator安全性強化

- **refactor (#226, 2026-03-10)** ✅: 世帯/施設グループ構築ロジックを共通モジュールに抽出
  - `seed/scripts/utils/household-groups.ts` 新規作成: `buildHouseholdFacilityGroups()` 純粋関数
  - `import-customers.ts` / `patch-customers-household.ts` の重複ロジック（~30行）を共通モジュールに統合
  - ユニットテスト7件追加（`seed/tests/household-groups.test.ts`）
  - CI全4ジョブGREEN

- **feat (#225, 2026-03-10)** ✅: 利用者の世帯/施設フィールドを差分更新するパッチスクリプトを追加
  - `seed/scripts/patch-customers-household.ts` 新規作成
  - `batch.set(ref, {...}, { merge: true })` で既存ドキュメントの `same_household_customer_ids` / `same_facility_customer_ids` のみ更新（他フィールド保持）
  - `--dry-run` / `SEED_TARGET=production` 対応
  - 背景: 本番Firestoreの世帯/施設フィールドが空だった問題の安全な修正手段

- **fix (#224, 2026-03-10)** ✅: Emulator project IDをdemo-visitcareに統一（安全性向上）
  - seed firestore-client / CI E2E env / web .env.local すべてで `demo-visitcare` に統一
  - `demo-` プレフィックスにより Emulator 未接続時の本番書き込みを防止
  - CI in_progress（run #22863135851）

- **fix (#223, 2026-03-10)** ✅: Emulator project ID不一致でWebからseedデータが見えない
  - Web の `NEXT_PUBLIC_FIREBASE_PROJECT_ID` が `demo-visitcare` → seed の `visitcare-shift-optimizer` と不一致で Emulator 上のコレクション参照が空になっていた問題を修正
  - CI SUCCESS（run #22862576160）

- **test (#221, 2026-03-10)** ✅: 利用者テーブルの世帯/施設バッジ表示テストを追加
  - `customers` ページの世帯/施設列 Badge 表示を Vitest でカバー

---

## 2026-03-09 実装

### テストカバレッジ強化

- **fix (#206, 2026-03-09)** ✅: ヘルプページを最新機能・スクリーンショットに更新（CI SUCCESS + デプロイ完了）

- **test (#205, 2026-03-09)** ✅: カバレッジギャップを埋める14テストファイル追加（865→972テスト）（CI SUCCESS）

- **test (#204, 2026-03-09)** ✅: 包括的テストカバレッジ追加（577→865テスト）（CI SUCCESS）

### ヘルプページ + テスト品質強化

- **feat (#203, 2026-03-09)** ✅: スクリーンショット付き使い方ガイドページを追加
  - `/help` ページ新規作成（Docsify ベース）
  - 操作マニュアルのスクリーンショットを埋め込んだ UI
  - CI SUCCESS、デプロイ完了

- **test (344c739, 2026-03-09)** ✅: ヘルプページとHeaderコンポーネントのテストを追加・品質改善
  - `HelpPage.test.tsx` / `Header.test.tsx` 新規追加
  - CI SUCCESS（全ジョブ GREEN）

### クラッシュ修正

- **fix (#202, 2026-03-09)** ✅: Customer配列フィールド欠落による全クラッシュ箇所を網羅修正
  - 既存Firestoreドキュメントに `ng_staff_ids` / `preferred_staff_ids` / `allowed_staff_ids` が存在しない場合のクラッシュ修正
  - `checker.ts` / `validation.ts` / `allowed-staff-check.ts` / `customerDetailViewModel.ts` にオプショナルチェーン（`?.`）またはデフォルト値（`?? []`）を追加
  - 再現テスト3件追加（TDD RED→GREEN）
  - E2Eテストのstrict mode違反も修正（`.first()` 使用）

- **fix (#201, 2026-03-09)** ✅: 利用者一覧ページのundefinedクラッシュを修正
  - 既存Firestoreドキュメントに `same_household_customer_ids` / `same_facility_customer_ids` が存在しない場合の `undefined.length` TypeError修正
  - `useCustomers.ts` でデフォルト値補完、`customers/page.tsx` でオプショナルチェーン追加

- **test (#200, 2026-03-09)** ✅: allowed_staff_ids 事前チェックダイアログE2Eテスト追加
  - Firestore emulator REST APIでH001/H009に月曜希望休を追加し、C010の警告を発生させるE2E
  - 警告ダイアログ表示・「戻って修正する」・「警告を無視して実行」の3テスト
  - `mode: 'serial'` でworker間データ競合を防止
  - CI SUCCESS（E2Eテスト拡充完了）

### 品質強化+Phase C完了

- **fix (#199, 2026-03-09)** ✅: テストファイルのtsc型エラー6件を修正
  - OptimizeButton.test.tsx: vi.fn ジェネリクスをVitest 4.x形式に更新
  - checker.test.ts / validation.test.ts: ServiceTypeDocの必須フィールド追加
  - firestore テスト3ファイル: モック関数のスプレッド引数型修正
  - `tsc --noEmit` エラー0件達成

- **feat (#198, 2026-03-09)** ✅: 利用者マスタ一覧に世帯/施設列を追加
  - NG/推奨列の右に「世帯/施設」列追加（Badge表示: 世帯=グレー枠、施設=青枠）
  - Phase C（世帯・施設選択UI）全レイヤー完了

- **test (#197, 2026-03-09)** ✅: allowed_staff_ids のSeedデータ追加とOptimizer制約テスト拡充
  - C010にallowed制約（H001, H009）のSeedデータ追加
  - 希望休との組み合わせテスト2件追加（全員休→Infeasible、一部休→Optimal）
  - StaffConstraintType enum化、共通セットアップ関数化

- **test (#196, 2026-03-09)** ✅: E2E 同一施設メンバー表示テスト追加
  - `CustomerDetailSheet` の同一施設メンバーが Badge 表示されることを E2E で検証
  - CI SUCCESS（70 passed, 3 skipped）、全ジョブ GREEN + デプロイ完了

### コード品質改善

- **refactor (#193, 2026-03-09)** ✅: ViewModel の hasWeeklyServices 削除と useServiceTypes 外部化
  - `CustomerDetailSheet` ViewModel から `hasWeeklyServices` 導出ロジック削除（呼び出し元で直接判定）
  - `useServiceTypes` フックを ViewModel 外部から注入する設計に変更（テスタビリティ向上）
  - PR #190 からの継続リファクタリング

- **refactor (#190, 2026-03-09)** ✅: CustomerDetailSheet から ViewModel を切り出し
  - `CustomerDetailSheetViewModel.ts` を新規作成し、シートのロジックを分離
  - `CustomerDetailSheet.tsx` を純粋なビューコンポーネントに簡素化
  - Closes #184

- **refactor (#189, 2026-03-09)** ✅: detailTarget stale data を ID ベース参照に修正
  - `detailTarget` オブジェクト保持 → `detailId: string | null` + `Map.get()` 導出に変更
  - `detailOpen` を `detailId !== null` から導出し状態不整合を解消
  - 回帰テスト2件追加: Map更新追随、レコード削除時null表示
  - 横展開: customers/helpers/weekly-schedule 全3ページ対応（Closes #183）

- **refactor (#188, 2026-03-09)** ✅: weekly-schedule の SERVICE_LABELS をマスタ参照に統一
  - ハードコード `SERVICE_LABELS` 定数を廃止 → `useServiceTypes()` の `short_label` を参照
  - `SERVICE_BADGE_STYLES` はUI関心事として据え置き
  - フォールバックテスト1件追加（Closes #185）

- **fix (#151, 2026-03-09)** ✅: Firestoreルールに `allowed_staff_ids` / `same_household_customer_ids` / `same_facility_customer_ids` のバリデーション追加
  - `isValidCustomer()` に optional `is list` チェック3件追加（既存データ互換: フィールド未設定は許可）
  - Firestore Rules テスト6件追加（型不正→拒否3件 + 欠落→許可3件）→ 113件全パス

- **test (#152, 2026-03-09)** ✅: `customers.ts` 双方向同期の失敗系・エッジケーステスト追加
  - 自己参照フィルタリング（household/facility各1件）、エラー伝播（batch/transaction各1件）、世帯+施設同時変更（1件）→ 16件全パス

- **fix (#150, 2026-03-09)** ✅: findSingleBarInRow フォールバックの bar/row 不整合を修正

- **fix (#149, 2026-03-09)** ✅: E2E D&D flakiness改善 — ドラッグ操作の座標安定性を強化
  - `dragOrderToTarget()`: ドラッグ開始後にターゲット位置を再スクロール → freshDropBoxで座標再取得
  - `findSingleBarInRow()`: N回の非同期DOM問い合わせ → 単一`page.evaluate()`呼び出しに最適化
  - CI: 3回連続GREEN 63 passed, 1 flaky, 0 failed

---

## 2026-03-08 実装

### CustomerDetailSheet改善

- **fix (#186, 2026-03-08)** ✅: HelperDetailSheetの編集ボタンを権限に応じて非表示にする（PR #180と同パターン）
- **fix (#182, 2026-03-08)** ✅: canEdit propを必須化してfail-closed設計に変更（Codexレビュー High指摘対応）
- **fix (#180, 2026-03-08)** ✅: CustomerDetailSheetの編集ボタンを権限に応じて非表示にする（Closes #178）
  - 閲覧専用ユーザーに編集ボタンが表示されていたセキュリティバグ修正
- **fix (#179, 2026-03-08)** ✅: 自己参照フィルタをフィルタ後配列で条件判定 + テスト補完
- **feat (#177, 2026-03-08)** ✅: CustomerDetailSheetの同一世帯・同一施設をBadge+名前表示に改善

### ナビゲーション改善 + E2E修正

- **fix (#168, 2026-03-08)** ✅: E2Eテストセレクタ修正
- **fix (#167, 2026-03-08)** ✅: PR #166 UI変更に伴うE2Eテスト同期修正
- **feat (#166, 2026-03-08)** ✅: メニュー・ナビゲーション改善（#163 #164 #165）
  - マスタタブ 3→5 統一（基本予定・希望休を追加）
  - AppBreadcrumb コンポーネント新規追加（history/report/settings/masters）
  - ヘッダーメニュー: 現在地ハイライト、アイコン→Menu、ホームリンク追加
- **test (#162, 2026-03-08)** ✅: `findSingleBarInRow` 正常パス・フォールバックパスのテスト追加
- **test (#161, 2026-03-08)** ✅: useOrders / useStaffUnavailability 週切替リセットテスト追加
- **chore (#160, 2026-03-08)** ✅: checker.ts の `getStaffCount` 重複解消
- **test (#159, 2026-03-08)** ✅: useScheduleData の loading 状態テスト追加（7件）

### Codex Medium対応

- **fix (#158, 2026-03-08)** ✅: Codex Medium指摘3件修正
  - `checker.ts`: not_visited + 複数人体制 → error から warning に降格
  - `useScheduleData.ts`: `travelTimesLoading` を combined `loading` に追加

- **fix (#157, 2026-03-08)** ✅: 希望休日付フィルタ・権限境界・週切替リセットの3件修正（Codex High指摘対応）
  - `validation.ts` / `checker.ts`: 希望休 `slot.date` と `order.date` の日付比較 `isSameDate()` を追加
  - `auth.py`: `require_manager_or_above()` で role claim 未設定ユーザーを403拒否に変更（セキュリティ修正）
  - `useOrders.ts` / `useStaffUnavailability.ts`: 週切替時に state を初期化（前週データ残留防止）

- **fix (#156, 2026-03-08)** ✅: 住所正規化をNFKC統一 + テストギャップ解消

### テスト追加 (#147〜#144)

- **test (#147, 2026-03-08)** ✅: 基本予定一覧ページ（WeeklySchedulePage）コンポーネントテスト追加（9件）
- **test (#146, 2026-03-08)** ✅: OptimizeButton allowed_staff_ids事前チェックダイアログのコンポーネントテスト追加（7件）
- **test (#145, 2026-03-08)** ✅: Undo/Redo E2Eテスト + スケジュールインタラクションE2Eテスト追加
- **test (#144, 2026-03-08)** ✅: HelperNotSubmitted バリデーション拒否テスト追加（3ケース）
- **fix (#143, 2026-03-08)** ✅: UnavailabilityReminderRequest.helpers_not_submitted を型付きモデルに変更
- **fix (#141, 2026-03-08)** ✅: PR #137 品質ゲート補完 — コードレビュー指摘修正
- **fix (#139, 2026-03-08)** ✅: Helper.emailフィールドのスキーマドキュメント・Seedインポート対応

---

## 2026-03-07 実装

- **feat (#137, 2026-03-07)** ✅: Google Chat DM催促機能を追加（Closes #132）
  - Helper型に`email`フィールド追加（shared/web/validation）
  - Python: `chat_sender.py` — Google Chat API経由DM送信（graceful degradation）
  - Python: `POST /notify/chat-reminder` エンドポイント追加
  - Web: `ChatReminderDialog` — チェックボックスで複数スタッフ選択・一括送信
  - テスト: Python 12件 + Vitest 5件追加、CI全4ジョブGREEN
  - **後続作業**: GCP設定（Chat API有効化・Bot登録・SA権限付与）

- **feat (#134, 2026-03-07)** ✅: household_id廃止 → same_household/facility_customer_ids移行（Closes #133）
  - Phase A: データモデル移行（32ファイル）、Firestore双方向同期、住所正規化ユーティリティ
  - Phase B: solver.py 同一世帯・施設ペアの移動時間0オーバーライド、Union-Find連結成分構築
  - テスト: Optimizer 294件 / Web 461件 / CI全4ジョブGREEN

- **feat (#136, 2026-03-07)** ✅: 利用者編集UIに同一世帯・同一施設メンバー選択MultiSelectを追加

---

## 2026-02-24〜02-25 実装

- 詳細: `docs/handoff/archive/2026-02-detailed-history.md` を参照
- PR #85〜#131: 不定期パターン・外部連携ID・分断勤務・徒歩距離上限・サービス種別8種→105種・性別制約・新マスタフィールド・研修状態3段階・週全体ビュー・service_typesマスタ化・allowed_staff_ids・Phase 5b メール通知・Gmail API DWD・利用者軸ビュー・Undo/Redo・iPad横向き対応
