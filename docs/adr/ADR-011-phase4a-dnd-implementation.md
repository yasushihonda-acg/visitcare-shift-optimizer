# ADR-011: Phase 4a ドラッグ&ドロップ手動編集

## ステータス
承認済み (2026-02-14)

## コンテキスト

PRD核要件であるシフトの手動調整機能が未実装であった。ガントチャートでオーダーを閲覧できるが、割当変更はできない状態。実運用にはドラッグ&ドロップによるヘルパー間の割当変更が必要。

## 決定

### DnDライブラリ: @dnd-kit/core
- React hooks中心の設計で既存アーキテクチャと統一的
- Flexbox + absolute positioning レイアウトとの親和性が高い
- タッチ対応、キーボードアクセシビリティ対応
- 軽量（~10kb gzipped）

**却下した代替案:**
- react-beautiful-dnd: メンテナンス停止、React 19非対応
- react-dnd: HTML5 DnD API依存でタッチ非対応

### Firestore更新方法: クライアント直接 updateDoc()
- 単一ドキュメント更新のためトランザクション不要
- onSnapshot() リアルタイムリスナーが自動でUI反映
- API経由にするとレイテンシ増大（不要な往復）

### バリデーション戦略
| 制約 | severity | ドロップ可否 |
|------|----------|------------|
| NGスタッフ | error | 拒否 |
| 資格不適合 | error | 拒否 |
| 時間重複 | error | 拒否 |
| 希望休 | error | 拒否 |
| 勤務時間外 | warning | 許可+警告 |

## 実装スコープ

### Phase 4aに含む
- ヘルパー間のオーダー移動
- 未割当→ヘルパーへの割当
- ヘルパー→未割当への割当解除
- リアルタイムバリデーション（ドラッグ中の視覚フィードバック）
- トースト通知（success/warning/error）

### Phase 4aに含まない
- 時間シフト（横ドラッグ）
- 世帯リンク一括ドラッグ
- Undo/Redo

## 影響

### 新規ファイル
- `web/src/lib/dnd/types.ts` — DnD型定義
- `web/src/lib/dnd/validation.ts` — ドロップバリデーション
- `web/src/lib/firestore/updateOrder.ts` — Firestore更新
- `web/src/hooks/useDragAndDrop.ts` — DnD状態管理フック

### 変更ファイル
- `web/src/app/page.tsx` — DndContextラップ
- `web/src/components/gantt/GanttBar.tsx` — useDraggable追加
- `web/src/components/gantt/GanttRow.tsx` — useDroppable追加
- `web/src/components/gantt/GanttChart.tsx` — dropZoneStatuses prop追加
- `web/src/components/gantt/UnassignedSection.tsx` — draggable + droppable

## 結果
- PointerSensor で distance: 5px を設定し、クリック（詳細パネル表示）とドラッグを明確に区別
- `manually_edited: true` フラグで手動編集済みオーダーを識別（最適化時の保護に利用可能）
