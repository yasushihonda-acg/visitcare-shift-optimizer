# ADR-009: Phase 3b 統合・認証・CI/CD

## ステータス
Accepted

## コンテキスト
Phase 3aまでにFE（Next.js）とBE（FastAPI + PuLP）が個別に完成しているが、以下の課題があった:
1. FE `OptimizeResponse`に`total_orders`, `assigned_count`があるがBEに存在しない（型不整合）
2. FE→BE API呼び出しに認証ヘッダーなし（Cloud Runは認証必須）
3. Firebase Hosting未設定
4. CORS設定がlocalhost:3000のみ
5. CI/CDパイプラインなし

## 決定

### 1. FE-BE型統一
BEスキーマに`total_orders`, `assigned_count`を追加（FEの既存UIコードを壊さない方向）。

### 2. 認証アーキテクチャ（2モード）
```
環境変数: NEXT_PUBLIC_AUTH_MODE = "required" | "demo"
         ALLOW_UNAUTHENTICATED = "false" | "true"  (BE側)

[本番/requiredモード]
  FE: Firebase Auth (メール/パスワード) → IDトークン取得
  → Authorization: Bearer <token> ヘッダー付きでAPI呼び出し
  BE: firebase-admin でトークン検証

[デモモード]
  FE: 匿名認証で自動サインイン → IDトークン取得
  → 同じ Authorization ヘッダーで API 呼び出し
  BE: ALLOW_UNAUTHENTICATED=true でトークン検証スキップ
```

**DRY原則**: 同一コンポーネント・同一APIクライアントを使用。AuthProviderが環境に応じたサインインフローを制御。

### 3. Firebase Hosting + Static Export
- Next.js `output: 'export'` でSSG/SPA出力
- Firebase Hostingで静的ファイルを配信
- firebase.tsを遅延初期化Proxyパターンに変更（SSRビルドエラー回避）

### 4. CI/CD（GitHub Actions）
- PR時: test-optimizer + test-web を並列実行
- main push時: テスト通過後にCloud Build + Firebase Hosting を並列デプロイ

## 結果
- FE-BE型統一完了（BE 128テスト + FE 32テスト = 160テスト全パス）
- 認証基盤完了（required/demoの2モード、BE認証ミドルウェア）
- Firebase Hosting設定完了（static export + SPA rewrites）
- CORS本番URL追加
- CI/CDパイプライン構築完了
