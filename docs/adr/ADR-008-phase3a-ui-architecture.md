# ADR-008: Phase 3a UIアーキテクチャ

## ステータス
採択（2026-02-10）

## コンテキスト
Phase 2a/2b で最適化エンジンとAPIが完成し、フロントエンドUIの構築が必要。
訪問介護シフトの可視化にはガントチャート（時間軸表示）が不可欠。

## 決定

| 項目 | 選定 | 理由 |
|------|------|------|
| フレームワーク | Next.js 15 App Router | プロジェクト既定、TypeScript標準 |
| レンダリング | CSR (Client-Side) | Firestore onSnapshotによるリアルタイム更新が主 |
| スタイリング | Tailwind CSS v4 + shadcn/ui | 軽量、アクセシブル、カスタマイズ容易 |
| ガントチャート | CSS Grid カスタム実装 | 5分粒度の精密制御、ライブラリ不要 |
| データ取得 | Firestore onSnapshot | リアルタイム更新、オフライン対応 |
| 日付操作 | date-fns (ja locale) | 軽量、tree-shakable |
| テスト | Vitest + React Testing Library | Next.js推奨、高速 |

### ガントチャート設計
- 時間軸: 7:00〜21:00（14時間 = 168スロット × 5分）
- Y軸: ヘルパー行（割当済みオーダーのみ表示）
- 色分け: 身体介護=青、生活援助=緑
- 制約違反: 赤ボーダー（error）/ 黄ボーダー（warning）

### 型の扱い
- `shared/types/`: firebase-admin の Timestamp 依存（サーバー側）
- `web/src/types/`: Date 型に変換したクライアント版
- `firestore-converter.ts`: Timestamp → Date の再帰変換レイヤー

## 却下した選択肢

### SSR/SSG
- Firestore onSnapshot はクライアント側APIのため、SSRとの相性が悪い
- シフト表示はリアルタイム性が重要

### ガントチャートライブラリ（react-gantt-timeline等）
- 5分粒度の精密制御が困難
- 介護シフト特有のUI要件（色分け、違反表示）に対応しづらい
- バンドルサイズの増加

### Redux / Zustand
- Firestore onSnapshot が状態管理を兼ねるため、別途の状態管理ライブラリは不要
- React Context + hooks で十分

## 影響
- web/ ディレクトリが新規追加
- Firebase Hosting 設定が必要（Phase 3b）
- optimizer API に CORS 設定を追加
