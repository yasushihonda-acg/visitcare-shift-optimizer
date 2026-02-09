# ADR-007: FastAPI + Cloud Run による REST API 層

## ステータス
Accepted（2026-02-10）

## コンテキスト
Phase 2aで完成した最適化エンジン（PuLP+CBC）を、外部から呼び出し可能なREST APIとしてCloud Runにデプロイする必要がある。フレームワーク選定とデプロイ構成を決定する。

## 決定
**FastAPI + gunicorn/uvicorn → Cloud Run** を採用する。

### API設計
- `GET /health` — ヘルスチェック
- `POST /optimize` — シフト最適化実行（week_start_date指定）

### Artifact Registry
- リポジトリ: `asia-northeast1-docker.pkg.dev/visitcare-shift-optimizer/optimizer`
- クリーンアップポリシー: 最新2イメージのみ保持、古いものは自動削除

## 理由

### FastAPI選定
- **Pydantic統合**: 既存のPydanticモデルをそのままリクエスト/レスポンスに使用可能
- **OpenAPI自動生成**: Swagger UIが自動提供され、Phase 3aのFE開発時にAPI仕様の確認が容易
- **型安全性**: Python型ヒントベースでバリデーションが自動実行

### 検討した代替案
- **Flask**: シンプルだが、Pydantic統合が手動。OpenAPI生成にはFlask-RESTX等の追加ライブラリが必要
- **Cloud Functions**: コールドスタートが遅い。PuLP+CBCの初期化コストを考慮するとCloud Runが適切

### Artifact Registryクリーンアップ
- デモフェーズではイメージ蓄積によるストレージコストを抑制
- keepCount=2で直前バージョンへのロールバック可能性を確保

## 結果
- optimizer/src/optimizer/api/ — FastAPIアプリケーション
- optimizer/src/optimizer/data/firestore_loader.py — Firestore読み込み
- optimizer/src/optimizer/data/firestore_writer.py — 結果書き戻し
- optimizer/Dockerfile — Cloud Run用コンテナ
- optimizer/deploy/ — Artifact Registryセットアップスクリプト
- テスト: 116件全パス（既存76件 + 新規40件）
