# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-02-15（パフォーマンス最適化 完了）
**現在のフェーズ**: Phase 0-5 完了 → 本番改善・ドキュメント整備

## 完了済み

### Phase 0: プロジェクト基盤構築
- Git初期化、環境分離設定
- 要件ドキュメント保存（SOW, PRD, 現行業務分析）
- ADR 4件作成

### Phase 1: データ設計 + Seedデータ
- **Firebase初期化**: Emulator設定（Firestore:8080, Auth:9099, UI:4000）
- **TypeScript型定義**: `shared/types/` — 全5コレクションの型（strict mode）
- **Firestoreルール**: 開発用allow all + 複合インデックス3件
- **CSVデータ**: 鹿児島市中心部のデモデータ6ファイル
  - customers: 50名（3世帯ペア、NG/推奨スタッフ設定含む）
  - helpers: 20名（有資格16名/無資格4名）
  - customer-services: 160件/週（身体58%/生活42%）
  - helper-availability: 94エントリ
  - staff-unavailability: 3名分サンプル
  - customer-staff-constraints: NG7件/推奨12件
- **インポートスクリプト**: バリデーション→クリア→順次投入
- **移動時間**: Haversine距離×市街地係数1.3÷車速40km/h（`source: 'dummy'`）
- **ドキュメント**: スキーマ定義書、ER図（Mermaid）、ADR-005
- **テスト**: バリデーションunit + Emulator統合テスト
- **Emulatorテスト確認済み**: 2,783ドキュメント正常投入

### Phase 2a: 最適化エンジン
- **技術変更**: Python-MIP → **PuLP 3.3.0 + CBC**（ADR-006）
- **Python環境**: Python 3.12 + venv + pyproject.toml（editable install）
- **Pydanticモデル**: `optimizer/src/optimizer/models/` — TS型定義と完全対応
- **CSVデータローダー**: `optimizer/src/optimizer/data/csv_loader.py`
- **MIPエンジン**: `optimizer/src/optimizer/engine/`
  - ハード制約×8 + ソフト制約×4（推奨スタッフ優先、移動時間最小化、稼働バランス、担当継続性）
  - **PR #13 品質改善**: 稼働バランス（preferred_hours乖離ペナルティ）、担当継続性（4件以上の利用者対象）、世帯リンク自動生成
  - 改善効果: 希望時間外 14/20→6/20、複数担当 44/50→37/50、平均担当者数 3.0→2.3
- **テスト**: 156件全パス
- **パフォーマンス**: 160オーダー/20ヘルパーで **0.3秒**、692オーダー/50ヘルパーで **38秒**

### Phase 2b: API層 + Cloud Run
- **REST API**: FastAPI（ADR-007）
  - `GET /health` — ヘルスチェック
  - `POST /optimize` — シフト最適化実行
- **Cloud Run デプロイ済み**: `https://shift-optimizer-1045989697649.asia-northeast1.run.app`
  - asia-northeast1 / 1Gi / max 3インスタンス / 認証必須
- **CORSミドルウェア追加**: `CORS_ORIGINS`環境変数で制御
- **Artifact Registry**: 最新2イメージ保持（Keep policy）
- **テスト**: 116件全パス

### Phase 3a: UI基盤 + ガントチャート（ADR-008）
- **Next.js 15 App Router** + Tailwind CSS v4 + shadcn/ui
- **Firebase Client SDK**: `web/src/lib/firebase.ts`（関数ベース遅延初期化、エミュレータ対応）
- **クライアント型定義**: `web/src/types/`（Timestamp→Date変換版）
- **Firestoreリアルタイムフック**: useHelpers, useCustomers, useOrders, useStaffUnavailability
- **スケジュールデータ統合**: useScheduleData（日別・ヘルパー別整形）
- **ガントチャート**: CSS Grid カスタム（7:00-21:00, 5分粒度, 168スロット）
  - GanttChart / GanttTimeHeader / GanttRow / GanttBar
  - 身体介護=青、生活援助=緑、違反=赤/黄ボーダー
- **最適化ボタン**: 確認ダイアログ（実行/テスト実行/キャンセル）→ sonner通知
- **制約違反チェッカー**: NGスタッフ/資格不適合/時間重複/希望休/勤務時間外
- **オーダー詳細パネル**: Sheet（スライドイン）
- **未割当セクション**: ガント下部に表示

### Phase 3b: 統合 + バリデーション（ADR-009）
- **FE-BE型統一**: `total_orders`, `assigned_count` をBEに追加、FEに`assignments`, `orders_updated`追加
- **認証基盤**: Firebase Auth 2モード対応（required/demo）
  - FE: AuthProvider（匿名認証/ログイン必須）、APIクライアントにAuthorizationヘッダー
  - BE: firebase-admin認証ミドルウェア（ALLOW_UNAUTHENTICATED環境変数でスキップ可）
- **ローカル開発環境**: `scripts/dev-start.sh`（Emulator + API + Next.js一括起動）
- **Firebase Hosting**: `output: 'export'` + SPA rewrites設定
- **CORS本番対応**: Firebase HostingドメインをCORS_ORIGINSに追加
- **統合テスト**: API契約テスト3件 + 認証テスト12件 + AuthProviderテスト3件
- **CI/CD**: GitHub Actions（PR時テスト並列、main pushでCloud Build + Firebase Hosting + Firestoreルール並列デプロイ）
- **テスト合計**: BE 134件 + FE 32件 = **166件全パス**

### Phase 4a: ドラッグ&ドロップ手動編集（ADR-011）
- **@dnd-kit導入**: DndContext + useDraggable + useDroppable
- **ヘルパー間移動**: GanttBar → 別ヘルパー行へドロップで割当変更
- **未割当↔ヘルパー**: UnassignedSection ↔ GanttRow の双方向移動
- **リアルタイムバリデーション**: NGスタッフ/資格不適合/時間重複/希望休=拒否、勤務時間外=警告
- **視覚フィードバック**: ドロップゾーンの色分け（緑/黄/赤）+ カーソルスタイル
- **Firestore直接更新**: updateDoc() + onSnapshot自動反映
- **テスト**: FE 43件全パス

### Phase 4a-design: フロントエンドUIデザイン改善（PR #19 — 2026-02-14）
- **カラーパレット刷新**: グレー無彩色 → ティール系OKLch（医療系信頼感 + 温かみ）
  - Primary: `oklch(0.50 0.12 195)` — 洗練されたティール
  - Accent: `oklch(0.75 0.14 75)` — 暖色アンバー
  - サービス種別: physical_care(青系), daily_living(緑系), prevention(紫系)グラデーション
- **フォント変更**: Geist → **DM Sans（英数） + Noto Sans JP（日本語）** で読みやすさ向上
- **ヘッダー**: グレー背景 → **ティール→シアングラデーション** + Heart アイコン + ブランドタイポ
- **DayTabs**: 背景ベース → **アンダーラインインジケーター** + トランジション
- **StatsBar**: プレーンテキスト → **4カードダッシュボード** + icon + プログレスバー（割当率可視化）
- **ガントバー**: h-6 → **h-8拡大** + グラデーション + shadow + ホバースケール
- **GanttRow**: 均一背景 → **交互背景色**（偶数行微かなティント）
- **UnassignedSection**: フラットカード → **PackageOpenアイコン + バッジ表示** で即座に把握可能
- **OrderDetailPanel**: セクション分け強化 + **Clock/MapPin/User/AlertTriangleアイコン** で視認性向上
- **ローディング画面**: プレーンテキスト → **グラデーションヘッダー + スピナーアニメーション**
- **全項目の prevention サービスタイプ対応** — 将来の機能拡張に備えた色定義
- **ビルド**: ✅成功 | **テスト**: 43/43全パス | **デプロイ**: Firebase Hosting + Cloud Run成功
- **本番反映済み**: https://visitcare-shift-optimizer.web.app（リアルタイム）

### Phase 4b-seed: Seedデータ動的週対応（PR #20 — 2026-02-15）
- **問題**: seedデータの`week_start_date`が`2025-01-06`固定のため、本番環境で「今週」表示時にオーダー0件 → 割当不可
- **修正内容**:
  - `import-orders.ts`: デフォルト週を`getCurrentMonday()`（JST）に動的化
  - `staff-unavailability.csv`: 絶対日付→`day_of_week`形式に変更し、任意の週で利用可能に
  - `import-staff-unavailability.ts`: week引数対応 + day_of_weekから日付を計算
  - `csv_loader.py`: Python側も新CSV形式に対応
  - `dev-start.sh`: 起動時にseedデータを今週の日付で自動インポート
- **本番環境確認**: 2,783ドキュメント投入 → オーダー160件全割当成功（月30件/日4件）
- **テスト**: CI全パス（Optimizer 134/134 + Web 43/43 + Seed validation 9/9）

### Phase 4c-security: Firestoreセキュリティルール本番化 Phase 1（PR #21 — 2026-02-15）
- **実装**: 全アクセス許可（`allow read, write: if true`）→ 認証必須 + 最小権限write
- **認証必須化**: `request.auth != null` で未認証アクセスをブロック
- **FE Read**: 全コレクション読み取り可（認証済みユーザーのみ）
- **FE Write**: `orders`の3フィールドのみ（`assigned_staff_ids`, `manually_edited`, `updated_at`）
- **マスタコレクション**: customers / helpers / travel_times / staff_unavailability はFEからwrite不可（Admin SDKのみ）
- **テスト**: `@firebase/rules-unit-testing` + Vitestで21テストケース
  - 未認証ブロック 5件 + 認証済みRead 5件 + マスタWrite拒否 4件 + ordersUpdate 3件 + create/delete 2件 + 型バリデーション 2件
- **CIジョブ追加**: `.github/workflows/ci.yml` に `test-firestore-rules`（Firestore emulator上でテスト）
- **本番反映**: mainへマージ後、CI/CDで自動デプロイ
- **FE互換性**: AuthProvider（匿名認証）で `request.auth != null` を満たす
- **テスト結果**: Optimizer 134/134 + Web 43/43 + Firestore Rules 21/21 = **全パス**
- **ADR作成**: `docs/adr/ADR-012-firestore-security-rules-phase1.md`

### Phase 4d-master-edit PR 1/3: 基盤 + 利用者マスタCRUD（2026-02-15）
- **ブランチ**: `feature/phase4d-master-edit-customers`
- **Firestoreルール更新**: `customers` に `create, update` 許可 + `isValidCustomer()` バリデーション（delete不可維持）
- **新規依存**: react-hook-form, zod v4, @hookform/resolvers
- **shadcn/ui追加**: input, label, select, table, dropdown-menu, card, separator, checkbox
- **ナビゲーション**: Header.tsx に DropdownMenu（マスタ管理 → 利用者/ヘルパー）
- **利用者マスタ画面**: `/masters/customers`
  - 一覧表示（Table + 検索フィルター） + 新規追加/編集（Dialog）
  - WeeklyServicesEditor（7曜日×複数スロット、動的追加/削除）
  - react-hook-form + zod バリデーション → Firestore直接書き込み → onSnapshot自動反映
- **zodスキーマ**: customerSchema / helperSchema / unavailabilitySchema（PR 2/3で使用）
- **Firestoreユーティリティ**: createCustomer / updateCustomer
- **テスト**: Firestoreルール 29件（+9件追加） + Web 43件 = 全パス
- **ADR**: `docs/adr/ADR-013-phase4d-master-edit-ui.md`

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

## 本番環境修正履歴

### 2026-02-14（PR #17, #18）— Firestoreタイムゾーン修正
- **PR #17**: Firestoreクエリのタイムゾーンミスマッチ修正
  - `load_orders`/`load_staff_unavailabilities`の`week_start_date`クエリをJSTに統一
  - 原因: naive datetime（UTC扱い）≠ seedスクリプトのJST midnight Timestamp
- **PR #18**: Firestore日付変換のタイムゾーンをJSTに統一
  - `_ts_to_date_str()`で`astimezone(JST)`後に日付抽出するよう修正
  - 原因: UTC日付変換により全オーダーの曜日が1日前にずれ → Infeasible
- **本番動作確認**: 160/160オーダー全割当成功（Optimal, 5.3秒）

### 2026-02-14（PR #15, #16）
- **PR #15**: CORS問題修正 + seedスクリプト本番対応
  - Cloud Run: `--allow-unauthenticated` + `ALLOW_UNAUTHENTICATED=true`に変更
  - Cloud Run IAM: `allUsers` → `roles/run.invoker` バインディング追加
  - seedスクリプト: `SEED_TARGET=production`で本番Firestoreに接続可能に
  - `--week`引数と`--orders-only`モードを追加
- **PR #16**: CI/CDにFirestoreルールデプロイを追加（`--only hosting,firestore:rules`）
- **インフラ作業**:
  - Firestoreデータベース作成（asia-northeast1, native mode）
  - 本番Firestoreに2,783ドキュメントseed済み（customers:50, helpers:20, orders:160, travel_times:2550, staff_unavailability:3）
  - Firestoreセキュリティルールを手動デプロイ
  - ADCアカウントに`roles/datastore.owner`付与

### 2026-02-10（PR #11, #12）
- **PR #11**: `.env.production`にFirebase SDK設定追加（auth/invalid-api-keyエラー修正）
- **PR #12**: Proxy → `getDb()`/`getFirebaseAuth()`関数ベース遅延初期化（Firebase SDK v12互換性修正）
- **GCP設定**: Firebase Webアプリ登録 + Auth Identity Platform初期化 + Anonymous sign-in有効化

## 重要なドキュメント
- `docs/schema/firestore-schema.md` — 全コレクション定義 + クエリパターン
- `docs/schema/data-model.mermaid` — ER図
- `docs/adr/ADR-005-firestore-schema-design.md` — スキーマ設計判断
- `docs/adr/ADR-006-pulp-replaces-python-mip.md` — PuLP採用の経緯
- `docs/adr/ADR-007-fastapi-cloud-run-api.md` — FastAPI + Cloud Run API層
- `docs/adr/ADR-008-phase3a-ui-architecture.md` — Phase 3a UIアーキテクチャ
- `docs/adr/ADR-009-phase3b-integration.md` — Phase 3b 統合・認証・CI/CD
- `docs/adr/ADR-010-workload-identity-federation.md` — WIF CI/CD認証
- `docs/adr/ADR-011-phase4a-dnd-implementation.md` — Phase 4a DnD手動編集
- `docs/adr/ADR-012-firestore-security-rules-phase1.md` — Phase 4c Firestoreルール認証必須化
- `docs/adr/ADR-013-phase4d-master-edit-ui.md` — Phase 4d マスタ編集UI設計判断
- `shared/types/` — TypeScript型定義（Python Pydantic モデルの参照元）
- `optimizer/src/optimizer/` — 最適化エンジン + API
- `web/src/` — Next.js フロントエンド

## Seedコマンド（本番Firestore）
```bash
# 全データ再投入（今週）
cd seed && SEED_TARGET=production npx tsx scripts/import-all.ts --week 2026-02-09

# オーダーのみ週切替
cd seed && SEED_TARGET=production npx tsx scripts/import-all.ts --orders-only --week 2026-02-16
```

### Phase 4d-master-edit PR 2/3: ヘルパーマスタCRUD（2026-02-15）
- **ブランチ**: `feature/phase4d-master-edit-helpers`
- **Firestoreルール更新**: `helpers` に `create, update` 許可 + `isValidHelper()` バリデーション（delete不可維持）
- **ヘルパーマスタ画面**: `/masters/helpers`
  - 一覧表示（Table: 氏名/資格/身体介護可否/雇用形態/移動手段 + 検索フィルター）
  - 新規追加/編集（Dialog） — 資格Checkbox群、身体介護可否、移動手段/雇用形態Select
  - 希望勤務時間・対応可能時間（min/max）
  - WeeklyAvailabilityEditor（7曜日×複数スロット、start/endのみ）
- **Firestoreユーティリティ**: createHelper / updateHelper
- **テスト**: Firestoreルール 38件（+10件追加） + Web 43件 = 全パス

### Phase 4d-master-edit PR 3/3: 希望休管理 + NG/推奨スタッフUI（2026-02-15）
- **ブランチ**: `feature/phase4d-master-edit-unavailability`
- **Firestoreルール更新**: `staff_unavailability` に `create, update, delete` 許可 + `isValidUnavailability()` バリデーション
- **希望休管理ページ**: `/masters/unavailability`
  - 週ナビゲーション（前週/次週切替）付き一覧表示
  - 新規追加/編集/削除（Dialog） — スタッフ選択、不在スロット（日付+終日/時間帯）、備考
  - スタッフ名検索フィルター
- **NG/推奨スタッフUI**: CustomerEditDialogにStaffMultiSelectコンポーネント追加
  - NGスタッフ/推奨スタッフそれぞれ複数選択（検索付きDialog）
  - 相互排他（NGに設定済みのスタッフは推奨に表示されない、逆も同様）
- **Firestoreユーティリティ**: createStaffUnavailability / updateStaffUnavailability / deleteStaffUnavailability
- **Header**: マスタ管理メニューに「希望休管理」リンク追加
- **テスト**: Firestoreルール 45件（+7件追加） + Web 43件 = 全パス

### Phase 2Security: Custom Claims RBAC（PR #25 — 2026-02-15）
- **ブランチ**: `feature/phase2-rbac-auth`
- **Custom Claims実装**: Firebase Custom Claims で `role` + `helper_id` フィールド追加
- **ロール体系**: 3役（admin / service_manager / helper）
  - `admin`: 全機能管理可
  - `service_manager`: 利用者マスタ・希望休管理可（ヘルパーマスタ除外）
  - `helper`: 自身の希望休のみ管理可
  - デモモード: `hasNoRole()` で Custom Claims 未設定時も全権限維持（後方互換性）
- **Firestoreルール拡張**: `hasNoRole()`, `isManagerOrAbove()` ロール関数追加
- **Backend API強化**: `optimizer/api/auth.py` に `require_manager_or_above()` 依存注入関数追加
  - `/optimize` エンドポイント: manager以上のみ実行可能
  - ロール未設定（demo）は `ALLOW_UNAUTHENTICATED=true` で許可
- **Frontend権限制御**: `useAuthRole()` フック拡張
  - `canEditCustomers`: admin / service_manager / デモモード
  - `canEditHelpers`: admin / デモモード
  - `canEditUnavailability`: admin / service_manager / デモモード（helper は自身のみ）
  - マスタ管理画面（customers/helpers/unavailability）に権限ガード追加
- **テスト**: Backend 14/14（auth新規5件含む）+ Web 48/48 + Firestore 62/62 = **全パス**
- **CI/CD**: PR時テスト全パス → main にマージ（squash merge）
- **ADR作成**: `docs/adr/ADR-014-phase2-custom-claims-rbac.md`

### Google Maps Distance Matrix API実装（PR #26 — 2026-02-15）
- **ブランチ**: `feature/google-maps-travel-times`
- **API統合**: Google Maps Distance Matrix API クライアント実装
  - Batch処理: origins × destinations を最大25×25で分割してリクエスト
  - リトライロジック: transient(429/503) → exponential backoff (3回まで)、permanent(400/403) → Haversineフォールバック
  - カスタムエラークラス: `GoogleMapsAPIError` で型安全なエラー分類
- **Firestoreキャッシュ**: `travel_times` に `source: 'google_maps'` で30日有効期限付きで保存
  - キャッシュ済みペアはAPI再呼び出しをスキップ（ペア単位フィルター）
  - 個別ペア取得失敗 → 自動でHaversineフォールバック
- **後方互換性**: `GOOGLE_MAPS_API_KEY` 環境変数未設定時はHaversine推定値を使用（既存動作維持）
- **テスト**: 12件新規（haversine計算3 + API成功/失敗/リトライ 6 + エッジケース3） + 既存全パス
- **コードレビュー指摘対応**: 型安全性 + 部分キャッシュ最適化 + ログレベル + DRY改善
- **CI/CD**: PR時テスト全パス → main にマージ（squash merge）

### Google Maps Distance Matrix API本番設定（2026-02-15 完了）
- **Distance Matrix API有効化**: `routes.googleapis.com` + `distance-matrix-backend.googleapis.com` 有効化完了
- **API KEY作成**: Distance Matrix API専用（`service=distance-matrix-backend.googleapis.com`制限）
  - KEY: `AIzaSyBk1wSIB1iGWGTcsqK9nWJILnb-yTMytw4`
- **バッチサイズ修正**: `MAX_ELEMENTS_PER_REQUEST` を 25→10 に修正（API制限: 100要素/リクエスト）
- **本番Seed実行**: 2,550ペア全て `source: 'google_maps'` に更新済み（PR #27 マージ済み）
- **テスト**: CI全3ジョブ通過（Optimizer/Web/Firestore Rules）

### 週切替UI — カレンダー日付ピッカー（PR #28 — 2026-02-15）
- **ブランチ**: `feature/week-picker-ui`（マージ済み）
- **WeekSelector拡張**: 期間表示ボタンにPopover + Calendarを統合
  - shadcn/ui Popover + Calendar（react-day-picker v9.13.2）導入
  - カレンダーで任意の日付を選択 → その週に自動ジャンプ
  - 「今週に戻る」ボタン（現在週以外で表示）
  - 日本語ロケール対応
- **header variant対応**: ヘッダー内のWeekSelectorもカレンダー付きで動作
- **テスト**: Web 48/48 全パス、ビルド成功

### Cloud Build SA権限修正（2026-02-15）
- **問題**: Cloud Build SA(`1045989697649@cloudbuild.gserviceaccount.com`)に`roles/cloudbuild.builds.builder`のみで、Cloud Runデプロイ権限が不足
- **修正**: 以下3権限を付与
  - `roles/run.admin` — Cloud Runデプロイ
  - `roles/iam.serviceAccountUser` — SA権限委譲
  - `roles/artifactregistry.writer` — Dockerイメージpush

### マスタ管理画面UI改善（PR #30～#33 — 2026-02-15）
- **ブランチ**: 各個別ブランチ、全4PRmainマージ完了
- **実装内容**:
  - **PR #30**: マスタ間タブナビゲーション (`layout.tsx` に Tabs コンポーネント) + テーブルゼブラストライピング（3ページ全て）
  - **PR #31**: 利用者一覧に「NG/推奨スタッフ」列表示（Badge）、ヘルパー一覧に「勤務日数」「希望時間」列表示
  - **PR #32**: ヘルパー編集ダイアログを3セクション（基本情報/雇用条件/勤務スケジュール）に整理、時間フィールドに「最小/最大」サブラベル追加
  - **PR #33**: ガントバーテキスト表示閾値を 40px → 20px に調整、違反バッジとして「違反」「警告」を同時表示
- **ビルド**: ✅ npm run build 成功
- **テスト**: Web 48/48 全パス（各PRマージ時に確認）
- **本番デプロイ**: Firebase Hosting へ自動デプロイ完了
- **E2Eスクリーンショット確認済み**:
  - `/masters/customers/`: タブナビゲーション表示、NG/推奨 Badge 表示（"NG 2"、"推奨 1"形式）、ゼブラストライピング
  - `/masters/helpers/`: 勤務日数列（0-7の数字）、希望時間列（"6〜8h"形式）、ゼブラストライピング
  - ガントチャート: 短いバーにも利用者名表示、違反バッジ"違反10"と警告バッジ同時表示

### 制約パラメータUI（PR #35 — 2026-02-15）
- **ブランチ**: `feature/constraint-weights-ui`（マージ完了）
- **実装内容**: OptimizeButtonのパラメータセクション拡張
  - ソフト制約の重み（w_travel, w_preferred_staff, w_workload_balance, w_continuity）をSlider UIで調整可能に
  - デフォルト値: 1.0 → 最小0.1、最大2.0で±1.0の範囲調整可能
  - プレビュー表示: 目的関数値 (M1*...) の計算式表示
  - dry_run 確認ダイアログで最適化前にパラメータ確認可能
- **FE実装**: ConstraintWeightsForm コンポーネント追加（4つのSlider + 説明）
- **API更新**: `POST /optimize` リクエストに `w_travel, w_preferred_staff, w_workload_balance, w_continuity` フィールド追加
- **テスト**: Web 98/98 全パス（constraints test新規5件含む）
- **CI/CD**: 全3ジョブ通過（Optimizer/Web/Firestore Rules）

### マスタ管理機能の追加シナリオテスト（PR #36 — 2026-02-15）
- **ブランチ**: `feature/master-management-tests`（マージ完了）
- **テスト追加内容**:
  - `schemas.test.ts` — Zodスキーマ網羅テスト34件
    - customerSchema: 必須フィールド検証、座標境界値（lat: ±90, lng: ±180）、NG/推奨スタッフ配列
    - helperSchema: 資格配列、preferred_hours検証（min > max エラー）、transportation enum
    - unavailabilitySchema: 空スロット配列、all_day時の時刻検証
    - timeStringSchema: 形式検証（"09:30" OK、"9:30" NG）
    - serviceSlotSchema: staff_count境界（0,1,3,4）
  - `customers.test.ts` — Firestore CRUD ユニットテスト8件
    - createCustomer / updateCustomer 正常系 + serverTimestamp検証
  - `helpers.test.ts` — ヘルパー CRUD ユニットテスト8件
    - createHelper / updateHelper + customer_training_status初期化確認
- **合計テスト数**: 48→98件（+50件新規追加）
- **CI/CD**: 全テストパス（Optimizer/Web/Firestore Rules）

### オーダー割当スタッフ変更UI + 最適化差分表示（PR #37 — 2026-02-15）
- **ブランチ**: `feature/order-edit-diff-ui`（マージ完了）
- **実装内容**:
  - **割当スタッフ変更UI**: OrderDetailPanel内にStaffMultiSelectを統合
    - オーダー詳細パネルからスタッフを直接編集可能（Dialog: 検索 + Checkbox複数選択 + 確定/キャンセル）
    - 保存時に Firestore 更新 + onSnapshot自動反映 + toast通知
  - **差分表示**: 最適化実行時の割当と現在の割当を比較
    - useAssignmentDiff フック: 直近の最適化実行結果を取得 → 差分計算 → diffMap返却
    - AssignmentDiffBadge コンポーネント: 手動変更ある場合に「手動変更」バッジ表示（hover でスタッフ名確認）
    - page.tsx に新フック接続 + props受け渡し
- **新規ファイル**:
  - `useOrderEdit.ts` — saving状態管理 + updateOrderAssignment呼び出し + エラーハンドリング
  - `useAssignmentDiff.ts` — fetchOptimizationRuns/Detail + 差分検出ロジック
  - `AssignmentDiffBadge.tsx` — 差分バッジUI（Tooltip代替: title属性）
- **既存活用**: StaffMultiSelect（再利用）/ updateOrderAssignment（再利用）/ fetchOptimizationRuns/Detail API（再利用）
- **テスト**: Web 98/98 全パス
- **CI/CD**: 全3ジョブ通過（Optimizer/Web/Firestore Rules）

### 最適化結果の保存・履歴機能（PR #34 — 2026-02-15）
- **ブランチ**: `feature/optimization-history`（マージ完了）
- **Firestore新コレクション**: `optimization_runs` — 最適化実行記録を保存
  - フィールド: id / week_start_date / executed_at / executed_by / dry_run / status / objective_value / solve_time_seconds / total_orders / assigned_count / assignments / parameters
  - 読み取り: manager以上のみ（hasNoRole()でデモモード対応）
  - 書き込み: Admin SDKのみ（FE側write禁止）
- **BE実装**:
  - `optimizer/src/optimizer/models/optimization_run.py` — OptimizationRunRecord / OptimizationParameters Pydanticモデル
  - `optimizer/src/optimizer/data/firestore_writer.py` — `save_optimization_run()` 関数追加（UUID生成、SERVER_TIMESTAMP使用）
  - `/optimize` にrun_record保存ロジック追加（失敗時はログのみ、APIレスポンスに影響させない）
  - `GET /optimization-runs` — 一覧取得（week_start_dateフィルタ、limit、executed_at DESC）
  - `GET /optimization-runs/{run_id}` — 詳細取得（404対応）
- **FE実装**:
  - `/history` ページ — 履歴一覧テーブル（実行日時/対象週/ステータス/割当/実行時間/目的関数値）
  - RunDetailPanel — Sheet詳細パネル（割当結果テーブル、ヘルパー名マップ表示）
  - StatusBadge — Optimal(緑)/Feasible(黄)/テスト(グレー)表示
  - `useOptimizationRuns` フック — REST APIベース（非リアルタイム）
  - Header に History リンク追加
- **Firestore Rules テスト**: 7件新規追加（未認証/admin/service_manager/デモモード/helper/FE書き込み禁止）
- **CI/CD**: 全3ジョブ通過（Optimizer/Web/Firestore Rules）
- **テスト**: Optimizer 139/139 + Web 48/48 + Firestore 69/69 = **全パス**
- **UI/UX**: ゼブラストライピング、クリック対応で詳細表示、空状態ハンドリング

### E2Eテスト導入（Playwright）— PR #38（2026-02-15 完了）
- **ブランチ**: `feat/e2e-playwright`（マージ完了）
- **テスト対象（5画面 / 19テスト）**:
  - スケジュール画面（7件）: ヘッダー表示、曜日タブ、タブ切替、StatsBar、最適化ボタン、ドロップダウンメニュー、履歴遷移
  - マスタ管理（9件）: 利用者一覧、ヘルパー一覧、希望休ページ、各画面の新規追加・検索・タブナビゲーション
  - 履歴画面（3件）: ヘッダー表示、戻るボタン、テーブル・空状態・エラーの出し分け
- **CI統合**: `.github/workflows/ci.yml` に `test-e2e` ジョブ追加
- **テスト**: 19/19 ✅ | CI: 4ジョブ全て成功

### パフォーマンス最適化 — PR #39（2026-02-15 完了）
- **ブランチ**: `feat/performance-optimization`（マージ完了）
- **Backend最適化**:
  - **MIP変数枝刈り**: `_compute_feasible_pairs()` — 資格/NG/勤務日時で割当不可ペアを事前除外（`upBound=0`）
  - **制約事前計算**: `no_overlap`/`travel_time`制約のO(N²)ペア計算をヘルパーループ外へ移動
  - **日付グルーピング**: 同一日のオーダーペアのみチェック
  - **Firestoreクエリ最適化**: `load_travel_times()`にcustomer_idsフィルター追加
  - **Cloud Runメモリ**: 512Mi → 1Gi
- **Frontend最適化**:
  - **React.memo**: GanttBar/GanttRow コンポーネントのメモ化
  - **モジュール定数**: GRID_LINES をレンダー関数外へ抽出
  - **O(N log N)重複チェック**: checker.tsのO(N²)→ソート+隣接比較
- **ベンチマーク結果**:
  | スケール | オーダー/ヘルパー | 時間 | メモリ | ステータス |
  |---------|-----------------|------|--------|-----------|
  | ベースライン | 94/20 | 0.3s | - | Optimal |
  | 中規模 | 322/30 | 3.0s | - | Optimal |
  | 大規模 | 692/50 | 38.0s | 626MB | Optimal |
- **テスト**: Optimizer 156/156 + Web 98/98 + E2E 19/19 = 全パス
- **CI/CD**: 全4ジョブ通過

## 次のアクション（優先度順）

1. **本番環境改善** 🟠 — ローカル開発検証とのギャップ調査、本番ユーザーテスト
2. **ドキュメント整備** 🟡 — 操作マニュアル、トラブルシューティングガイド作成
3. **追加E2Eテスト** 🟡 — オーダー手動編集、ドラッグ&ドロップなどのユーザーシナリオ

## 最新テスト結果サマリー（2026-02-15 PR #39マージ後）
- **Optimizer**: 156/156 pass ← PR #39でベンチマーク4件+変数枝刈り関連テスト追加
- **Web (Next.js)**: 98/98 pass
- **Firestore Rules**: 69/69 pass
- **E2E Tests (Playwright)**: 19/19 pass
- **Seed**: 12/12 pass
- **CI/CD**: test-optimizer + test-web + test-firestore-rules + test-e2e 全4ジョブ成功
- **合計**: 354件 全パス ✅

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
