# ADR-012: Firestoreセキュリティルール本番化 Phase 1

## ステータス
承認済み (2026-02-15)

## コンテキスト

現在のFirestoreルール（`firebase/firestore.rules`）は `allow read, write: if true` で全アクセス許可。
本番WebApp（https://visitcare-shift-optimizer.web.app）が公開されている状態でセキュリティリスクが高い。

## 決定

### Phase 1: 認証必須化 + 最小権限write

**認証必須化**: `request.auth != null` で未認証アクセスをブロックする。

**最小権限write**: フロントエンドからのwrite対象は `orders` コレクションの3フィールドのみに限定する。

| コレクション | FE Read | FE Write | 根拠 |
|-------------|---------|----------|------|
| customers | 認証済み | 不可 | マスタデータ（Admin SDKのみ） |
| helpers | 認証済み | 不可 | マスタデータ（Admin SDKのみ） |
| orders | 認証済み | 3フィールドのみ | `updateOrder.ts` のパターンに準拠 |
| travel_times | 認証済み | 不可 | キャッシュ（Admin SDKのみ） |
| staff_unavailability | 認証済み | 不可 | マスタデータ（Admin SDKのみ） |

**ordersの許可フィールド**: `assigned_staff_ids`（配列）, `manually_edited`（真偽値）, `updated_at`（タイムスタンプ）

**却下した代替案:**
- Custom Claims/RBAC: Phase 2で導入予定。Phase 1では認証有無のみで判定
- Cloud Functions経由のwrite: レイテンシ増大。DnDのリアルタイム性を損なう

### バックエンドアクセス
- Cloud Run（最適化エンジン）: Admin SDKでルールをバイパス
- seedスクリプト: Admin SDKでルールをバイパス

## テスト戦略

`@firebase/rules-unit-testing` + Vitest でユニットテスト。
Firestoreエミュレータ上でルールの許可/拒否を検証する。

## 影響

### 変更ファイル
- `firebase/firestore.rules` — ルール本体
- `.github/workflows/ci.yml` — テストジョブ追加

### 新規ファイル
- `firebase/package.json` — テスト依存関係
- `firebase/vitest.config.ts` — テスト設定
- `firebase/__tests__/firestore.rules.test.ts` — ルールテスト

## 今後の展開
- Phase 2: Custom Claims による RBAC（admin / service_manager / helper）
- Phase 3: ドキュメントレベルのアクセス制御（自分の担当オーダーのみ更新可等）
