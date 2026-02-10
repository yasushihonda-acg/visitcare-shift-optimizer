# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-02-10（Seedデータ不整合修正完了）
**現在のフェーズ**: Phase 2b 完了 → Phase 3a 開始前

## 完了済み

### Phase 0: プロジェクト基盤構築
- Git初期化、環境分離設定
- 要件ドキュメント保存（SOW, PRD, 現行業務分析）
- ADR 4件作成

### Phase 1: データ設計 + Seedデータ
- **Firebase初期化**: Emulator設定（Firestore:8080, UI:4000）
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
    - リクエスト: `{week_start_date, time_limit_seconds?, dry_run?}`
    - レスポンス: `{assignments[], objective_value, solve_time_seconds, status, orders_updated}`
    - エラー: 409（Infeasible/オーダーなし）、422（日付不正/非月曜日）
- **Firestoreデータローダー**: `optimizer/src/optimizer/data/firestore_loader.py`
  - 5コレクション（customers, helpers, orders, travel_times, staff_unavailability）読み込み
  - Firestore Timestamp → Python datetime 変換
  - staff_count導出: Firestoreフィールド > customer.weekly_services > デフォルト1
  - StaffConstraint: Customer.ng_staff_ids/preferred_staff_idsから生成
- **Firestore書き戻し**: `optimizer/src/optimizer/data/firestore_writer.py`
  - Assignment[] → orders.assigned_staff_ids + status='assigned' バッチ更新
  - 500件/batchの自動分割
- **Dockerfile**: Python 3.12-slim + gunicorn/uvicorn
  - Docker build成功、ローカルヘルスチェック確認済み
- **Cloud Build**: `optimizer/cloudbuild.yaml`
- **Artifact Registry**: `optimizer/deploy/`
  - setup-ar.sh: リポジトリ作成 + クリーンアップポリシー適用
  - cleanup-policy.json: 最新2イメージ保持、古いものは自動削除
- **テスト**: 116件全パス（既存76件 + 新規40件）
  - Firestoreローダー: 28件（変換ロジック、staff_count導出、エッジケース）
  - API + 書き戻し: 12件（正常系、dry_run、409/422エラー、バッチ分割）
- **Seedデータ不整合修正**: 3つの問題を解消
  - 日曜: H003/H005/H010/H012/H016に日曜シフト追加（5行）
  - 早朝: H001(月水金)、H007(月-金)のstart_timeを07:00に変更
  - 土曜午後: H003/H005/H008/H010のend_timeを17:00に延長（移動時間制約で4名必要）
  - 統合テストからフィルタ除去、全160オーダーでOptimal（0.6秒）

## 未着手

### Phase 3a: UI基盤 + ガントチャート
### Phase 3b: 統合 + バリデーション

## 次のアクション候補
1. Artifact Registryセットアップ: `optimizer/deploy/setup-ar.sh` 実行
2. Cloud Runデプロイ: `gcloud builds submit` でCI/CD実行
3. Phase 3a: Next.js UI基盤 + ガントチャート

## データアクセス方法
```bash
# Emulator起動
firebase emulators:start --project demo-test

# Seed データ投入
cd seed && FIRESTORE_EMULATOR_HOST=localhost:8080 npm run import:all

# 最適化エンジン テスト
cd optimizer && .venv/bin/pytest tests/ -v

# APIローカル起動
cd optimizer && .venv/bin/uvicorn optimizer.api.main:app --reload --port 8080

# Docker起動
cd optimizer && docker build -t shift-optimizer . && docker run -p 8080:8080 shift-optimizer

# UI確認
# http://localhost:4000/firestore
# http://localhost:8080/docs (OpenAPI Swagger UI)
```

## 重要なドキュメント
- `docs/schema/firestore-schema.md` — 全コレクション定義 + クエリパターン
- `docs/schema/data-model.mermaid` — ER図
- `docs/adr/ADR-005-firestore-schema-design.md` — スキーマ設計判断
- `docs/adr/ADR-006-pulp-replaces-python-mip.md` — PuLP採用の経緯
- `docs/adr/ADR-007-fastapi-cloud-run-api.md` — FastAPI + Cloud Run API層
- `shared/types/` — TypeScript型定義（Python Pydantic モデルの参照元）
- `optimizer/src/optimizer/` — 最適化エンジン + API

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
