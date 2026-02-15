# VisitCare シフト最適化システム トラブルシューティングガイド

> **対象読者**: 運用担当者、開発者

---

## 目次

1. [よくある問題と解決策](#1-よくある問題と解決策)
2. [本番環境の運用手順](#2-本番環境の運用手順)
3. [ローカル開発環境セットアップ](#3-ローカル開発環境セットアップ)
4. [問い合わせ先](#4-問い合わせ先)

---

## 1. よくある問題と解決策

### 1.1 通信エラー（「通信エラー: サーバーに接続できません」）

**症状**: 最適化実行時に「通信エラー: サーバーに接続できません」というトーストが表示される。

**原因と対策**:

| 原因 | 確認方法 | 対策 |
|------|----------|------|
| Cloud Run コールドスタート | 初回アクセスから30秒以内に再試行 | アプリは自動リトライ（最大3回）を行います。通常は数秒後に成功します |
| Cloud Run サービス停止 | GCPコンソール → Cloud Run でサービス状態を確認 | サービスを再デプロイ |
| ネットワーク障害 | ブラウザのDevToolsでNetworkタブを確認 | ネットワーク接続を確認し、再試行 |

**自動リトライの仕組み**: フロントエンドは通信エラー・429・502・503・504レスポンスに対して、1秒後 → 2秒後の間隔で自動リトライします。

### 1.2 CORSエラー

**症状**: ブラウザのDevToolsコンソールに `CORS policy` 関連のエラーが表示される。

**原因と対策**:

- **Cloud Run コールドスタート**: 初回リクエストでCORSプリフライトがタイムアウトすることがあります。自動リトライで解消されるのを待ってください。
- **CORS_ORIGINS 設定漏れ**: Cloud Run の環境変数 `CORS_ORIGINS` に本番URLが含まれていない場合に発生します。

```bash
# Cloud Run の環境変数確認
gcloud run services describe shift-optimizer \
  --region asia-northeast1 \
  --format "value(spec.template.spec.containers[0].env)"

# CORS_ORIGINSの更新（カンマ区切りで複数指定可）
gcloud run services update shift-optimizer \
  --region asia-northeast1 \
  --set-env-vars "CORS_ORIGINS=https://visitcare-shift-optimizer.web.app"
```

### 1.3 認証エラー（401 / 403）

**症状**: API呼び出しで 401 Unauthorized または 403 Forbidden が返る。

**原因と対策**:

| 原因 | 確認方法 | 対策 |
|------|----------|------|
| Firebase IDトークン期限切れ | DevToolsのNetworkタブでAuthorizationヘッダーを確認 | ページをリロードして再認証 |
| ロール未設定 | Firebase Console → Authentication → Custom Claims | ユーザーにロール（admin / service_manager）を付与 |
| 匿名ユーザーでの操作 | ヘッダーにロールバッジが表示されていない | Googleアカウントでログインし直す |

**Custom Claims の設定方法**:

```bash
# Firebase Admin SDKを使用してロールを設定
firebase functions:shell
# shell内で:
admin.auth().setCustomUserClaims('ユーザーUID', { role: 'service_manager' })
```

### 1.4 最適化 Infeasible（「制約を満たす割当が見つかりません」）

**症状**: 最適化実行時に「最適化不可: 制約を満たす割当が見つかりません」エラー（409）。

**原因**: ハード制約（必ず満たすべき条件）を同時に満たす割当が存在しない状態。

**よくある原因と対策**:

| 原因 | 確認方法 | 対策 |
|------|----------|------|
| ヘルパー不足 | StatsBarでヘルパー数 < オーダー数を確認 | ヘルパーマスタでスタッフを追加 |
| 全スタッフがNG指定 | 利用者マスタで対象利用者のNG設定を確認 | NG設定を見直す |
| 希望休との競合 | 希望休管理で対象週を確認 | 希望休を調整するか、オーダーの日時を変更 |
| 身体介護の資格不足 | ヘルパーマスタで「身体介護可」の人数を確認 | 身体介護対応可能なヘルパーを追加 |
| 時間帯の競合 | 同時間帯に複数オーダーが集中 | オーダーの時間帯を分散 |

**対処手順**:
1. まず **テスト実行** でパラメータ（重み付け）を調整して再試行
2. それでも Infeasible の場合は、上記の原因を順に確認
3. データの見直し（NG設定、希望休、オーダー数）を行い、再度実行

### 1.5 対象週にオーダーがない（409）

**症状**: 「対象週 YYYY-MM-DD に最適化対象のオーダーがありません」エラー。

**原因と対策**:
- 選択した週にオーダーデータが存在しない
- 週の開始日が月曜日でない（API は月曜始まりを要求）
- Seedデータが対象週に対応していない

**確認方法**:
1. スケジュール画面で対象週に切り替え、オーダーが表示されるか確認
2. Firebase コンソール → Firestore → `orders` コレクションで対象週のデータを確認

### 1.6 入力エラー（422）

**症状**: 「入力エラー: ...」トースト表示。

**よくある原因**:
- 日付フォーマットが不正（`YYYY-MM-DD` 形式が必要）
- 選択した日付が月曜日でない

通常のUI操作では発生しません。APIを直接呼び出す場合は日付形式に注意してください。

### 1.7 画面が読み込み中のまま止まる

**症状**: スピナーが表示されたまま画面が進まない。

**対策**:
1. ブラウザをリロード（Ctrl+R / Cmd+R）
2. ブラウザのキャッシュをクリア
3. DevToolsのConsoleタブでエラーを確認
4. Firebase Emulator（ローカル）の場合は、Emulatorが起動しているか確認

### 1.8 ドラッグ&ドロップが動かない

**症状**: オーダーバーをドラッグしても移動しない。

**確認事項**:
- 5px以上ドラッグしないと開始されません（クリックとの区別のため）
- タッチデバイスでは長押し後にドラッグしてください
- ブラウザのズームレベルが極端でないか確認

---

## 2. 本番環境の運用手順

### 2.1 デプロイ

CI/CDはGitHub Actionsで自動化されています。

- **PR作成時**: テスト自動実行
- **main push時**: Firebase Hosting + Cloud Run に自動デプロイ

**手動デプロイが必要な場合**:

```bash
# フロントエンド（Firebase Hosting）
cd web && npm run build && firebase deploy --only hosting

# バックエンド（Cloud Run）
cd optimizer && gcloud run deploy shift-optimizer \
  --source . \
  --region asia-northeast1 \
  --project visitcare-shift-optimizer
```

### 2.2 週次Seedデータ更新

本番環境で新しい週のデータを準備する場合:

1. Firestoreの `orders` コレクションに新しい週のオーダーデータを登録
2. 必要に応じて `customers` / `helpers` / `staff_unavailability` を更新
3. スケジュール画面で対象週に切り替え、データが正しく表示されることを確認
4. 最適化をテスト実行して結果を確認
5. 問題なければ本実行

### 2.3 環境変数一覧

**Cloud Run（Optimizer API）**:

| 変数 | 説明 | 例 |
|------|------|----|
| `CORS_ORIGINS` | 許可するオリジン（カンマ区切り） | `https://visitcare-shift-optimizer.web.app` |
| `GOOGLE_CLOUD_PROJECT` | GCPプロジェクトID | `visitcare-shift-optimizer` |
| `ALLOW_UNAUTHENTICATED` | 認証スキップ（ローカル開発用のみ） | `true`（本番では設定しない） |

**Next.js（Web App）**:

| 変数 | 説明 | 例 |
|------|------|----|
| `NEXT_PUBLIC_OPTIMIZER_API_URL` | Optimizer APIのURL | `https://shift-optimizer-....run.app` |
| `NEXT_PUBLIC_AUTH_MODE` | 認証モード | `required`（本番） / `demo`（開発） |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase設定 | Firebase コンソールから取得 |

### 2.4 ログ確認

```bash
# Cloud Run ログの確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=shift-optimizer" \
  --limit 50 \
  --format "table(timestamp,severity,textPayload)"

# エラーログのみ
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=shift-optimizer AND severity>=ERROR" \
  --limit 20
```

### 2.5 ヘルスチェック

```bash
# APIヘルスチェック
curl https://shift-optimizer-1045989697649.asia-northeast1.run.app/health
# 期待レスポンス: {"status":"ok"}
```

---

## 3. ローカル開発環境セットアップ

### 3.1 前提条件

- Node.js 18+
- Python 3.12+
- Firebase CLI (`npm install -g firebase-tools`)
- Java Runtime（Firebase Emulator用）

### 3.2 リポジトリのクローンと依存関係インストール

```bash
git clone <repository-url>
cd visitcare-shift-optimizer

# フロントエンド
cd web && npm install && cd ..

# バックエンド
cd optimizer && python -m venv .venv && .venv/bin/pip install -e ".[dev]" && cd ..

# Seedデータツール
cd seed && npm install && cd ..
```

### 3.3 環境変数の設定

```bash
# web/.env.local（テンプレートからコピー）
cp web/.env.local.example web/.env.local
```

`web/.env.local` の設定:
```
NEXT_PUBLIC_AUTH_MODE=demo
NEXT_PUBLIC_OPTIMIZER_API_URL=http://localhost:8081
NEXT_PUBLIC_USE_EMULATOR=true
```

### 3.4 一括起動

```bash
./scripts/dev-start.sh
```

これにより以下が自動で起動します:

| サービス | URL | 説明 |
|----------|-----|------|
| Firebase Emulator UI | http://localhost:4000 | Firestoreデータの確認・操作 |
| Optimizer API | http://localhost:8081 | 最適化エンジンAPI |
| Web App | http://localhost:3000 | Next.js 開発サーバー |

起動時に Seed データ（利用者50件、ヘルパー20件、オーダー約160件/週）が自動でインポートされます。

### 3.5 個別起動

```bash
# Firebase Emulator のみ
firebase emulators:start --import=seed/emulator-data

# Optimizer API のみ
cd optimizer
ALLOW_UNAUTHENTICATED=true \
FIRESTORE_EMULATOR_HOST=localhost:8080 \
.venv/bin/uvicorn optimizer.api.main:app --host 0.0.0.0 --port 8081 --reload

# Next.js のみ
cd web && npm run dev
```

### 3.6 テスト実行

```bash
# フロントエンド（Vitest）
cd web && npm test

# バックエンド（pytest）
cd optimizer && .venv/bin/pytest

# Seedバリデーション
cd seed && npm test

# E2Eテスト（Playwright）
cd web && npx playwright test
```

---

## 4. 問い合わせ先

| 種別 | 連絡先 |
|------|--------|
| システム障害 | GitHub Issues で報告 |
| 操作方法の質問 | サービス提供責任者（サ責）に確認 |
| データ修正依頼 | 管理者に連絡 |
| 機能要望・バグ報告 | GitHub Issues で起票 |
