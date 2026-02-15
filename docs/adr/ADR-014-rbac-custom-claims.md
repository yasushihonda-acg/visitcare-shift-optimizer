# ADR-014: Firebase Custom Claims による RBAC

## ステータス
承認済み (2026-02-15)

## コンテキスト

ADR-012（Phase 1）で認証必須化 + 最小権限writeを実装した。
現在は全認証ユーザーが同一権限を持ち、マスタ編集・最適化実行・D&D編集を全員が行える状態。
運用上、admin / サービス提供責任者（サ責） / ヘルパーの3ロールで権限を分離する必要がある。

## 決定

### 認証方式
- **本番（required モード）**: Google ソーシャルログイン（`signInWithPopup` + `GoogleAuthProvider`）
- **デモ（demo モード）**: 匿名認証を維持（ログイン不要、seedデータで動作確認可能）
- DRY原則: AuthProvider のコア認証ロジックは共通化し、モード分岐は最小限

### ロール体系
Firebase Custom Claims の `role` フィールドで管理（`request.auth.token.role`）。

| ロール | 説明 | 対象ユーザー |
|--------|------|-------------|
| `admin` | 全権限 | システム管理者 |
| `service_manager` | スケジュール管理 + マスタ編集（ヘルパー除く） | サービス提供責任者 |
| `helper` | 自分のスケジュール閲覧 + 自分の希望休管理 | ヘルパースタッフ |

### 権限マトリクス

| 操作 | admin | service_manager | helper |
|------|:-----:|:---------------:|:------:|
| ガントチャート閲覧（全体） | ✅ | ✅ | - |
| ガントチャート閲覧（自分のみ） | - | - | ✅ |
| 最適化実行 | ✅ | ✅ | - |
| D&D手動編集 | ✅ | ✅ | - |
| 利用者マスタ閲覧 | ✅ | ✅ | - |
| 利用者マスタ編集 | ✅ | ✅ | - |
| ヘルパーマスタ閲覧 | ✅ | ✅ | ✅（自分のみ） |
| ヘルパーマスタ編集 | ✅ | - | - |
| 希望休閲覧（全体） | ✅ | ✅ | - |
| 希望休管理（自分のみ） | ✅ | ✅ | ✅ |
| ユーザー管理（Claims設定） | ✅ | - | - |

### Custom Claims 構造

```json
{
  "role": "admin" | "service_manager" | "helper",
  "helper_id": "helper-xxx"  // helperロール時のみ、紐づくヘルパーID
}
```

サイズ制限: 1000バイト以内（上記構造で十分収まる）

### 実装層

#### 1. Firestoreルール
```
request.auth.token.role == 'admin'
request.auth.token.role == 'service_manager'
request.auth.token.role == 'helper'
request.auth.token.helper_id == helperId  // ヘルパー自身のドキュメント判定
```

#### 2. バックエンドAPI（FastAPI）
- `verify_auth` のデコード済みトークンから `role` を取得
- `/optimize` エンドポイント: admin / service_manager のみ

#### 3. フロントエンド（Next.js）
- `useAuthRole` フック: `getIdTokenResult()` から claims 取得
- UI表示制御: ロールに基づくメニュー/ボタンの条件表示
- ルートガード: 権限不足時のリダイレクト

### Custom Claims 管理
- Firebase Admin SDK を使用する CLI スクリプト（`scripts/set-custom-claims.ts`）
- admin ユーザーが CLI で他ユーザーのロールを設定
- 将来: 管理画面UIからの設定も検討

### デモモードとの共存
- デモモード: 匿名認証ユーザーには Custom Claims なし → Firestore ルールで `role == null` を許容
- デモモード用 Firestore ルールは既存の `isAuthenticated()` のみで動作を維持
- 環境変数 `NEXT_PUBLIC_AUTH_MODE` で demo/required を切り替え（既存仕組みを維持）

## 却下した代替案

### メール/パスワード認証
- 運用負荷（パスワードリセット、アカウント管理）が高い
- Google Workspace 連携で組織管理が容易な Google ログインを採用

### Cloud Functions での認可
- レイテンシ増大、コールドスタート問題
- Firestore ルール + IDトークンの方がリアルタイム性を維持できる

### カスタムトークン（Custom Token）
- Custom Claims で十分な権限制御が可能
- カスタムトークンは認証フロー全体の置き換えが必要で過剰

## 影響

- Firestore ルール: `isAuthenticated()` に加え `hasRole()` ヘルパー関数を追加
- バックエンド: `verify_auth` の戻り値からロール参照を追加
- フロントエンド: AuthProvider 拡張 + useAuthRole フック追加
- 既存テスト: ロール別テストケースの追加が必要
- デモモード: 影響なし（既存の匿名認証フローを維持）

## PR構成

| PR | 内容 | 依存 |
|----|------|------|
| PR 1/3 | 認証基盤 + GoogleログインUI + Custom Claims CLI + useAuthRole | - |
| PR 2/3 | Firestoreルール + バックエンドAPI認可 | PR 1 |
| PR 3/3 | フロントエンド権限制御UI | PR 1, 2 |
