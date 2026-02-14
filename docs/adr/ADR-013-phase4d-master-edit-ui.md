# ADR-013: マスタ編集UI（Phase 4d）

## ステータス
承認済み (2026-02-15)

## コンテキスト

現在のシステムではマスタデータ（利用者・ヘルパー・希望休）の編集手段がseedスクリプトのみ。
運用上、UI上でのCRUD操作が必要。ADR-012のFirestoreセキュリティルールでFE Writeがブロックされているため、ルール更新が前提。

## 決定

### 設計判断

| 判断 | 選択 | 理由 |
|------|------|------|
| Write方式 | Firestoreルール更新 | デモフェーズ。`updateOrder.ts`と同パターン。Phase 2 RBACで権限を絞る前提 |
| 削除 | なし（`allow delete: if false`維持） | 誤削除防止。将来soft deleteを検討 |
| バリデーション | react-hook-form + zod v4 | 型安全。shared/types/と整合するスキーマ |
| ナビゲーション | ヘッダーにDropdownMenu | 既存スケジュール画面を汚さない |
| リスト表示 | shadcn/ui Table | 50件/20件のデータに適切 |
| 編集UI | Dialog + フォーム | OrderDetailPanel(Sheet)との差別化。状態が隔離される |
| 週間スケジュール編集 | 開閉セクション + 動的スロット追加/削除 | 7曜日×複数枠の複雑構造に対応 |

### ルーティング

`output: 'export'`（静的HTML）+ Firebase SPA rewriteで動作。

```
/                        → 既存スケジュール（ガントチャート）
/masters/customers       → 利用者マスタ
/masters/helpers         → ヘルパーマスタ（PR 2）
/masters/unavailability  → 希望休管理（PR 3）
```

### Firestoreルール変更

ADR-012からの変更点:
- `customers`: `allow write: if false` → `allow create, update: if isAuthenticated() && isValidCustomer(); allow delete: if false`
- `isValidCustomer()`: name(family/given), address, location(lat/lng), ng_staff_ids(list), preferred_staff_ids(list), weekly_services(map), service_managerの型検証

### データフロー

```
ユーザー操作 → Dialog内フォーム
  → react-hook-form + zodバリデーション
  → OK → createXxx() / updateXxx() (Firestore SDK)
  → Firestoreルール検証
  → ドキュメント書き込み
  → onSnapshotリスナー発火（既存hook）
  → useCustomers() Map更新
  → Table自動リレンダ
  → Dialog閉じる + toast.success
```

### PR分割

3 PRに分割して段階的に実装:
1. **PR 1**: 基盤（依存追加・ナビ・レイアウト）+ 利用者マスタCRUD
2. **PR 2**: ヘルパーマスタCRUD
3. **PR 3**: 希望休管理 + NG/推奨スタッフUI

## 却下した代替案

- **Cloud Functions経由のwrite**: デモフェーズでは過剰。直接Firestoreルールで十分
- **ページ内インライン編集**: 複雑な週間サービス構造に不向き。Dialogのほうが状態管理がクリーン
- **React Context/Zustandでのローカルstate管理**: onSnapshotリスナーの自動反映で不要

## 影響

- Firestoreセキュリティルール変更（ADR-012の拡張）
- 新規依存追加: react-hook-form, zod, @hookform/resolvers
- shadcn/uiコンポーネント追加: input, label, select, table, dropdown-menu, card, separator, checkbox
- 既存スケジュール画面への影響なし（Header.tsxへのDropdownMenu追加のみ）
