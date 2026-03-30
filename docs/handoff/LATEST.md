# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-03-30（AIエージェント基盤構築 + ヘルパー支援AIセキュリティ）
**現在のフェーズ**: AIエージェント方式 Phase 1実装中（ADR-018/019/020: ADK + Gemini 2.5 Flash）

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
- **Phase 6d**: ふせん/チェックリスト取込（既存ノート取込UIの複数ソース対応で実現、バックエンド変更なし）
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

## 直近の実装（2026-03-20 後半）

### 技術負債解消（#310-#312）

| PR | Issue | 内容 |
|----|-------|------|
| #310 | #270 | timeToMinutes を `web/src/utils/time.ts` に統合（7箇所→1箇所） |
| #311 | #271 | ヘルパー/利用者名フォーマットを `web/src/utils/name.ts` に統合（40箇所→4関数） |
| #312 | #272 | OptimizeButton の Firestore 二重サブスクリプション解消（props渡しに変更） |
| #313 | #299,#300 | ノート取込の複数ソース対応（CURAノート/ふせん/チェックリスト） |

### 新規共通ユーティリティ

```
web/src/utils/
├── time.ts    — timeToMinutes()
└── name.ts    — formatFullName(), formatCompactName(), formatDisplayName(), formatFullNameKana()
```

## 直近の実装（2026-03-30）

### AIエージェント基盤構築 + セキュリティ対応

| PR | 内容 |
|----|------|
| #320 | feat: AIエージェント基盤構築（ADK + Gemini 2.5 Flash） |
| #325 | feat: ヘルパー支援AIのデータスコーピング（P0セキュリティ） |

### #320 AIエージェント基盤（ADR-019/ADR-020）

- **LLMプロバイダ**: Gemini 2.5 Flash（デフォルト）/ Pro（複雑タスク）、Vertex AI asia-northeast1
- **フレームワーク**: Google ADK 1.28 (Python 3.12)
- **2系統エージェント**:
  - `shift_manager`: サ責用、Firestoreフルアクセスツール7個
  - `helper_support`: ヘルパー用、スコープ付きツール4個（P0セキュリティ対応済み）
- **セッション**: InMemory → Firestore SessionService (Phase 2)
- **新規ディレクトリ**: `agent/` (shift_manager + helper_support)
- **Firestoreスキーマ拡張**: `chat_sessions` コレクション追加
- **Closes**: #316 (LLMプロバイダ選定), #318 (最適化エンジン位置づけ: 内部ツール併用), #319 (ADR更新)

### #325 ヘルパー支援AIのデータスコーピング

| ツール（変更前） | ツール（変更後） | 理由 |
|----------------|----------------|------|
| `get_customers`（全顧客） | `get_my_customer_info` | 担当利用者のみ |
| `get_helper_availability`（全ヘルパー） | `get_my_profile` / `get_my_schedule` | 自分の情報のみ |
| `get_weekly_orders`（全オーダー） | `get_my_orders` | 自分担当のみ |

- Firebase Auth `helper_id` カスタムクレームをADK Stateに注入
- Closes #321

## 直近の実装（2026-03-23）

### Firestoreルール修正 + 戦略的ピボット

| PR | 内容 |
|----|------|
| #314 | fix: isValidSettings に note_import_sources 用条件追加 |
| #315 | docs: ADR-018 AIエージェント方式への戦略的ピボット + AsIs/ToBeダイアグラム |

## 最新テスト結果サマリー（2026-03-30）

- **Agent**: CIジョブ pass（ruff lint + import + ツール登録確認）
- **Optimizer**: 372件 pass
- **Web (Next.js)**: 1,086件 pass（#325 CI確認中）
- **TypeScript型チェック**: tsc --noEmit PASS
- **Firestore Rules**: 121件 pass
- **注意**: E2Eテスト / Optimizerテスト: #325 CI実行中（in_progress）

## 次のアクション（優先度順）

### AIエージェント方式（即座に対応すべき）
1. **test_scoped_tools.py 実装 (#322)**: スコープ付きツールのテスト（担当外アクセス拒否確認）
2. **RAGパイプライン設計 (#317)**
3. **チャットUIプロトタイプ**
4. **段階的ロールアウト計画 (#324)**
5. **LLMゴールデンセットテスト (#323)**

### 既存タスク
6. **本番テスト (#290)**: ノート取込（CURAノート/ふせん/チェックリスト全ソース）を本番環境で検証

## GitHub Issuesサマリー

- **オープンIssue**: 5件
  - #290 Phase 6a: 本番環境でのノート取込動作確認 [P1]
  - #317 RAGパイプライン設計 [P1]
  - #322 AIエージェント: API認証テスト追加 [P1]
  - #323 AIエージェント: LLMゴールデンセットテスト作成 [P1]
  - #324 AIエージェント: 段階的ロールアウト計画（Stage 0-4）[P1]

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
- `docs/adr/` — ADR-001〜ADR-018
- `docs/diagrams/` — AsIs/ToBe ダイアグラム（draw.io + D2）
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
