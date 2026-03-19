# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-03-20（Phase 6c完了 / Phase 6d待機中）
**現在のフェーズ**: Phase 6b-6c完了、routes.py分割済み、Phase 6dはふせんスプレッドシート構造の提供待ち

## 完了済みフェーズ

- **Phase 0-1**: プロジェクト基盤 + データ設計 + Seedデータ（Firestore x 2,783ドキュメント）
- **Phase 2a**: 最適化エンジン（PuLP + CBC、156テスト全パス、最大692オーダー/50ヘルパー:38秒）
- **Phase 2b**: REST API (FastAPI) + Cloud Run デプロイ済み
- **Phase 3a-3b**: UI基盤（Next.js + ガントチャート） + 統合（認証、CORS、CI/CD）
- **Phase 4a-4d**: D&D手動編集、UIデザイン改善、マスタ管理（customers/helpers/unavailability）
- **Phase 4d-security**: RBAC (Custom Claims 3役体系) + Firestoreセキュリティルール
- **Phase 5b**: メール通知スタブ、Gmail API DWD、Google Chat DM催促、利用者軸ビュー、Undo/Redo
- **Phase 6a**: CURAノート取込・基本シフト反映自動化（sheets_reader/note_parser/note_diff + API + UI）
- **Phase 6b**: 当週シフト作成効率化（一括複製・休み希望反映・不定期パターン・当週ノート反映）
- **Phase 6c**: 当日対応効率化（変更通知・翌日チェックリスト・翌日Chat DM通知）
- **詳細アーカイブ**: `docs/handoff/archive/`

## デプロイURL

- **Web App**: https://visitcare-shift-optimizer.web.app
- **Optimizer API**: https://shift-optimizer-1045989697649.asia-northeast1.run.app

## 直近の実装（2026-03-19〜20）

### Phase 6b-6c 一括実装（#301-#309）

| PR | 内容 |
|----|------|
| #301 | service_typesマスタに hospital_visit/meeting/other 追加 |
| #302 | 基本→当週シフト一括複製API+UI（`/orders/duplicate-week`） |
| #303 | 休み希望の自動反映API+UI（`/orders/apply-unavailability`） |
| #304 | 不定期パターン自動判定API（`/orders/apply-irregular-patterns`） |
| #305 | オーダー変更通知API（`/notify/order-change`） |
| #306 | 翌日チェックリストAPI+UI（`/checklist/next-day`、`DailyChecklist.tsx`） |
| #307 | 翌日Chat DM通知API（`/notify/next-day`） |
| #308 | 品質ゲート対応（N+1→db.get_all、1件失敗=全件中断バグ修正、Literal型化、DRY抽出） |
| #309 | routes.pyドメイン別分割（1,404行→319行） |

### routes.py 分割後の構成

```
optimizer/api/
├── routes.py          (319行) /health, /optimize, /optimization-runs, /reset-assignments
├── routes_import.py   (329行) /import/notes, /import/notes/apply
├── routes_orders.py   (161行) /orders/duplicate-week, /orders/apply-*
├── routes_notify.py   (336行) /notify/chat-reminder, /notify/order-change, /notify/next-day
├── routes_report.py   (281行) /export-report, /checklist/next-day
└── routes_common.py    (66行) 共通ユーティリティ
```

### 新規UIコンポーネント

- `WeekDuplicateButton.tsx` — 週複製ボタン（ダイアログ付き）
- `UnavailabilityApplyButton.tsx` — 休み反映ボタン
- `DailyChecklist.tsx` — 翌日チェックリスト（ヘルパー別テーブル表示）

## 最新テスト結果サマリー（2026-03-20）

- **Optimizer**: 372件 pass
- **Web (Next.js)**: 1,076件 pass
- **TypeScript型チェック**: tsc --noEmit PASS
- **Firestore Rules**: 114件 pass

## 次のアクション（優先度順）

1. **Phase 6a 本番テスト (#290)**: ノート取込を本番環境で検証（少量データ）
2. **Phase 6d-1 (#299)**: ふせんスプレッドシート読み取り — **ユーザーからのシート構造情報が必要**
3. **Phase 6d-2 (#300)**: ふせん差分適用 — 6d-1依存
4. **email通知チャネル**: ADR-016 Gmail API DWD設定完了後に `POST /notify/next-day` の email channel を実装
5. **技術負債**: #270(timeToMinutes統合), #271(ヘルパー名共通化), #272(二重サブスクリプション) — 全てP2
6. **#289**: service_typesマスタ追加 → #301で解決済み（Issueクローズ漏れ）

## GitHub Issuesサマリー

- **オープンIssue**: 7件
  - Phase 6d: #299, #300
  - Phase 6a本番テスト: #290
  - service_types: #289（#301で解決済み、要クローズ）
  - 技術負債: #270, #271, #272

## データアクセス方法

```bash
# 一括起動（推奨、ローカル Emulator）
./scripts/dev-start.sh

# 最適化エンジン テスト
cd optimizer && .venv/bin/pytest tests/ -v

# 最適化API（ローカル、ポート8081）
cd optimizer && ALLOW_UNAUTHENTICATED=true .venv/bin/uvicorn optimizer.api.main:app --reload --port 8081

# Next.js dev
cd web && npm run dev  # → http://localhost:3000
```

## CI/CD（ADR-010）

- **GitHub Actions**: `.github/workflows/ci.yml`
- **認証**: Workload Identity Federation（JSON鍵不使用）
- PR時: test-optimizer + test-web 並列実行
- main push時: テスト通過後にCloud Build + Firebase Hosting + Firestoreルール 並列デプロイ

## 重要なドキュメント

- `docs/schema/firestore-schema.md`, `data-model.mermaid` — データモデル定義
- `docs/adr/` — ADR-001〜ADR-017
- `shared/types/` — TypeScript型定義
- `optimizer/src/optimizer/` — 最適化エンジン + API（routes分割済み）
- `web/src/` — Next.js フロントエンド

## GCP Sheets エクスポート（本番環境設定まとめ）

採用アプローチ: Authorized User ADC を Secret Manager に保存（`google-adc-credentials`）

## 参考資料（ローカルExcel）

プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
