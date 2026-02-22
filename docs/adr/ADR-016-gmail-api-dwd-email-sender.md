# ADR-016: メール送信手段 — Gmail API + Domain-Wide Delegation

**ステータス**: 承認済み
**決定日**: 2026-02-22
**関連 Issue**: #109

---

## コンテキスト

PR #108 でメール通知エンドポイント・テンプレートを実装したが、`sender.py` はスタブのまま（常に `emails_sent: 0` を返す）。送信手段として候補を比較し、採用方針を決定する。

---

## 検討した選択肢

### A. SendGrid（Free Tier）

| 項目 | 評価 |
|------|------|
| 初期設定 | API Key 取得 + Secret Manager 登録 |
| 制限 | 100通/日（Free Tier） |
| 外部依存 | あり（sendgrid パッケージ） |
| ドメイン認証 | SPF/DKIM 設定が必要 |
| コスト | 無料枠超過で課金 |

### B. Gmail API + Domain-Wide Delegation（採用）

| 項目 | 評価 |
|------|------|
| 初期設定 | Google Workspace 管理コンソールで DWD 許可 |
| 制限 | Gmail 送信上限（1日あたり 2,000通、十分） |
| 外部依存 | なし（`google-api-python-client` は既存依存） |
| ドメイン認証 | Google Workspace のドメインで自動 |
| コスト | Google Workspace 契約内（追加費用なし） |

### C. SMTP（Gmail / SendGrid）

| 項目 | 評価 |
|------|------|
| 設定 | SMTP 資格情報の管理が必要 |
| セキュリティ | 資格情報が環境変数に残る |
| 採用 | 見送り |

---

## 決定事項

**Gmail API + Domain-Wide Delegation（選択肢 B）を採用する。**

### 理由

1. **外部依存なし**: `google-api-python-client` は `google-maps-services-python` や Sheets API の既存利用のため追加パッケージ不要
2. **既存パターンと統一**: `_get_sheets_credentials()` と同じ SA self-impersonation + `impersonated_credentials` パターンを流用
3. **インフラ一元化**: GCP に閉じた構成で、シークレット管理が単純
4. **十分な送信上限**: 社内用途（サ責数名）では上限問題なし

### 認証フロー（Cloud Run）

```
Cloud Run (Compute Engine SA)
  → IAM Credentials API（SA self-impersonation）
  → SA with DWD enabled
    → subject = NOTIFICATION_SENDER_EMAIL（Google Workspace ユーザー）
      → Gmail API: users.messages.send
```

### ローカル開発

- `NOTIFICATION_SENDER_EMAIL` 未設定時は `emails_sent: 0` を返す（graceful degradation）
- `google.auth.default()` が Compute Engine 以外の場合は送信をスキップ（ローカルでは実際の送信不要）

---

## 実装詳細

### 環境変数

| 変数名 | 説明 | 設定先 |
|--------|------|--------|
| `NOTIFICATION_SENDER_EMAIL` | 送信元メールアドレス（Google Workspace ユーザー） | Cloud Run |
| `NOTIFICATION_SA_EMAIL` | DWD を有効化した SA メール（省略時はデフォルト Compute SA） | Cloud Run（省略可） |

### インフラ設定（手動）

1. **Google Workspace 管理コンソール**
   - セキュリティ → API 制御 → ドメイン全体の委任
   - SA のクライアント ID に `https://www.googleapis.com/auth/gmail.send` スコープを追加

2. **Cloud Run 環境変数**
   ```bash
   gcloud run services update shift-optimizer \
     --set-env-vars NOTIFICATION_SENDER_EMAIL=noreply@aozora-cg.com \
     --region asia-northeast1
   ```

3. **Cloud Run SA の IAM 権限**（既存設定の確認）
   - SA が自身に対して `roles/iam.serviceAccountTokenCreator` を持つこと（Sheets で既設定）

---

## 影響範囲

- `optimizer/src/optimizer/notification/sender.py` — 実装変更（スタブ → Gmail API）
- `optimizer/tests/test_notification.py` — `TestSender` を実際の送信フローに合わせて更新
- `routes.py`, フロントエンド: 変更なし（`send_email()` シグネチャ不変）

---

## 参考

- [Gmail API: users.messages.send](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send)
- [google-auth: Impersonated Credentials](https://googleapis.dev/python/google-auth/latest/reference/google.auth.impersonated_credentials.html)
- ADR-015: Google Sheets エクスポート（同じ SA self-impersonation パターン）
