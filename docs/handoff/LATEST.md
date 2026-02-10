# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-02-10（CI/CD WIF認証移行完了）
**現在のフェーズ**: Phase 3b 完了 + CI/CDデプロイ修正済み

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
  - ハード制約×8 + ソフト制約（推奨スタッフ優先、移動時間最小化）
- **テスト**: 76件全パス
- **パフォーマンス**: 142オーダー/20ヘルパーで **0.7秒**

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
- **Firebase Client SDK**: `web/src/lib/firebase.ts`（エミュレータ対応）
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
- **CI/CD**: GitHub Actions（PR時テスト並列、main pushでCloud Build + Firebase Hosting並列デプロイ）
- **テスト合計**: BE 128件 + FE 32件 = **160件全パス**

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
cd optimizer && .venv/bin/pytest tests/ -v  # 128件

# 最適化API（ローカル、ポート8081）
cd optimizer && ALLOW_UNAUTHENTICATED=true .venv/bin/uvicorn optimizer.api.main:app --reload --port 8081

# Next.js dev
cd web && npm run dev  # → http://localhost:3000

# テスト
cd web && npm test          # Vitest (32件)
cd optimizer && .venv/bin/pytest tests/ -v  # pytest (128件)
```

## CI/CD（ADR-010）
- **GitHub Actions**: `.github/workflows/ci.yml`
- **認証**: Workload Identity Federation（JSON鍵不使用）
  - SA: `github-actions@visitcare-shift-optimizer.iam.gserviceaccount.com`
  - WIF Pool: `github-actions-pool` / OIDC Provider: `github-oidc`
- PR時: test-optimizer + test-web 並列実行
- main push時: テスト通過後にCloud Build + Firebase Hosting 並列デプロイ
- 必要なGitHub Secrets: `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`
- **全4ジョブ成功確認済み**（PR #7, #8, #9）

## 重要なドキュメント
- `docs/schema/firestore-schema.md` — 全コレクション定義 + クエリパターン
- `docs/schema/data-model.mermaid` — ER図
- `docs/adr/ADR-005-firestore-schema-design.md` — スキーマ設計判断
- `docs/adr/ADR-006-pulp-replaces-python-mip.md` — PuLP採用の経緯
- `docs/adr/ADR-007-fastapi-cloud-run-api.md` — FastAPI + Cloud Run API層
- `docs/adr/ADR-008-phase3a-ui-architecture.md` — Phase 3a UIアーキテクチャ
- `docs/adr/ADR-009-phase3b-integration.md` — Phase 3b 統合・認証・CI/CD
- `docs/adr/ADR-010-workload-identity-federation.md` — WIF CI/CD認証
- `shared/types/` — TypeScript型定義（Python Pydantic モデルの参照元）
- `optimizer/src/optimizer/` — 最適化エンジン + API
- `web/src/` — Next.js フロントエンド

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
