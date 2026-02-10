# ADR-010: Workload Identity Federation によるCI/CD認証

## ステータス
Accepted

## コンテキスト
Phase 3bで構築したCI/CD（GitHub Actions）のデプロイジョブが失敗していた。原因はGitHub SecretsにGCP認証情報（`GCP_SA_KEY`, `FIREBASE_SERVICE_ACCOUNT`）が未設定だったこと。

認証方式の選択肢:
1. **JSON鍵ファイル**: SA鍵をGitHub Secretsに保存 → 鍵ローテーション管理が必要、漏洩リスク
2. **Workload Identity Federation (WIF)**: OIDC トークン交換 → 長期鍵不要、GitHubリポジトリ単位でアクセス制御

## 決定
**Workload Identity Federation** を採用する。

### 構成
```
GitHub Actions (OIDC Token)
  → WIF Pool (github-actions-pool)
    → OIDC Provider (github-oidc)
      → attribute_condition: repository == "yasushihonda-acg/visitcare-shift-optimizer"
  → Service Account (github-actions@visitcare-shift-optimizer.iam.gserviceaccount.com)
    → roles/cloudbuild.builds.editor (Cloud Build submit)
    → roles/firebasehosting.admin (Firebase Hosting deploy)
    → roles/iam.serviceAccountUser (Cloud Run SA impersonation)
```

### CI/CD変更点
- `credentials_json` → `workload_identity_provider` + `service_account` に変更
- `FirebaseExtended/action-hosting-deploy@v0` → `firebase-tools` CLI に変更（WIF認証のADCを利用）
- deploy-hosting に `permissions.id-token: write` を追加

### GitHub Secrets
| Secret名 | 用途 |
|-----------|------|
| `WIF_PROVIDER` | WIF OIDC プロバイダーのフルパス |
| `WIF_SERVICE_ACCOUNT` | GitHub Actions用SAのメールアドレス |

## 理由
- 長期間有効なJSON鍵が不要でセキュリティリスクが低い
- 鍵ローテーションの運用負荷がない
- リポジトリ単位の`attribute_condition`で不正利用を防止
- Google推奨のベストプラクティスに準拠

## 結果
- GCPリソース作成完了（SA, WIF Pool, OIDC Provider, バインディング）
- GitHub Secrets設定完了（WIF_PROVIDER, WIF_SERVICE_ACCOUNT）
- ci.yml更新完了（両デプロイジョブをWIF認証に移行）
