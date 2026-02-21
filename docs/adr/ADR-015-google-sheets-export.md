# ADR-015: Google Sheets エクスポート方式の選定

## ステータス
承認済み (2026-02-19)

## コンテキスト

月次レポート画面（PR #75）で表示される4種の集計データ（ヘルパー別稼働時間、サービス種別分布、利用者別サービス回数、曜日別負荷）をGoogle Sheetsにエクスポートする機能を追加する。
経営者・サ責が使い慣れたスプレッドシート形式でデータを確認・加工できるようにし、「ワンクリックでSheetsに反映」というUXゴールを実現する。

## 決定

バックエンド（Cloud Run）でGoogle Sheets APIを呼び出す方式を採用する。

### エンドポイント設計

- **エンドポイント**: `POST /export-report`
- **認証**: 既存の `require_manager_or_above` デコレータを使用（admin / service_manager のみ）

#### リクエスト
```json
{
  "year_month": "2026-02",
  "user_email": "user@example.com"
}
```

#### レスポンス
```json
{
  "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
  "spreadsheet_url": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
  "title": "月次レポート 2026年2月",
  "year_month": "2026-02",
  "sheets_created": 4,
  "shared_with": "user@example.com"
}
```

### 認証方式

- ADC（Application Default Credentials）を使用
- Cloud RunのService Accountに Google Sheets API / Google Drive API のアクセス権を付与
- フロントエンドの認証フローは変更なし

> **実装後の変更（PR #106）**: Cloud Run の Compute Engine デフォルト SA は Google Drive ストレージを持たないため、
> SA ADC ではなく **Authorized User ADC（OAuth2 refresh token）を Secret Manager に保存する方式** を採用した。
> Secret name: `sheets-authorized-user-credentials`（Cloud Run 環境変数 `SHEETS_CREDENTIALS_SECRET` で参照）。
> SA self-impersonation（`google-auth` の `impersonate_service_account`）も検討したが、Authorized User ADC の方がシンプルなため採用。

### スプレッドシート管理

- 月ごとに新規スプレッドシートを作成
- 4種の集計データをそれぞれ別シートとして作成
- Drive APIで指定ユーザーにシートを共有
- フロントエンドはレスポンスのURLを受け取り新タブで表示

### 依存関係

- `google-api-python-client>=2.0` を pyproject.toml に追加
- GCP APIの有効化: `sheets.googleapis.com`, `drive.googleapis.com`

## 却下した代替案

### フロントエンドから直接 Sheets API 呼び出し

- メリット: バックエンド変更不要
- デメリット:
  - Firebase Auth と Google OAuth2 フローが別途必要（Sheets APIのスコープ追加）
  - フロントエンドでのAPIキー管理が複雑
  - 認可制御がフロントエンド依存になりセキュリティリスク増大

### CSV ダウンロード → 手動インポート

- メリット: 実装が最もシンプル、外部API依存なし
- デメリット:
  - UXが悪い（ダウンロード → Sheets開く → インポート の3ステップ）
  - 「ワンクリックでSheetsに反映」というゴールを達成できない
  - フォーマットの崩れや文字コード問題のリスク

## 影響

- **バックエンド**: `POST /export-report` エンドポイントを追加、`google-api-python-client` 依存追加
- **フロントエンド**: 月次レポート画面にエクスポートボタンを追加、レスポンスのURLで新タブ表示
- **GCPインフラ**: Cloud Run SA に Sheets/Drive API 権限を付与、API有効化が必要
- **既存機能**: 影響なし（新規エンドポイントの追加のみ）
- **認証**: 既存の `require_manager_or_above` パターンを継続使用
