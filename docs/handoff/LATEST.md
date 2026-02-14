# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-02-14（フロントエンドデザイン改善 PR #19 + タイムゾーン修正 + 本番環境修正）
**現在のフェーズ**: Phase 4a-design 完了 + 本番環境フルリリース

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
- **テスト**: 134件全パス
- **パフォーマンス**: 160オーダー/20ヘルパーで **2.0秒**

### Phase 2b: API層 + Cloud Run
- **REST API**: FastAPI（ADR-007）
  - `GET /health` — ヘルスチェック
  - `POST /optimize` — シフト最適化実行
- **Cloud Run デプロイ済み**: `https://shift-optimizer-1045989697649.asia-northeast1.run.app`
  - asia-northeast1 / 512Mi / max 3インスタンス / 認証必須
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

## デプロイURL
- **Web App**: https://visitcare-shift-optimizer.web.app
- **Optimizer API**: https://shift-optimizer-1045989697649.asia-northeast1.run.app

## データアクセス方法
```bash
# 一括起動（推奨）
./scripts/dev-start.sh

# 個別起動:
# Emulator起動
firebase emulators:start --project demo-test

# Seed データ投入
cd seed && FIRESTORE_EMULATOR_HOST=localhost:8080 npm run import:all

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

## 次のアクション（優先度順）

1. **フロントエンドデザイン改善** 🟡 — UX/見た目のベストプラクティス適用
2. **Phase 4b: マスタ編集UI** 🟡 — 利用者・スタッフのCRUD画面
3. **Cloud Buildサービスアカウントへのrun.services.setIamPolicy権限付与** 🟠 — CI/CDからの`--allow-unauthenticated`を正常動作させる
4. **Firestoreセキュリティルール本番化** 🟠 — 現行allow all→RBAC
5. **Google Maps API実移動時間** 🟠 — ダミー→実測値（有料）
6. **週切替UI** 🟡 — 日付ピッカーで任意の週を表示

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
