# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-03-30（AIエージェント Stage 0完了 + RAG設計決定）
**現在のフェーズ**: AIエージェント方式 Phase 2a準備中（Stage 0完了、RAG方針確定）

## 完了済みフェーズ

- **Phase 0-1**: プロジェクト基盤 + データ設計 + Seedデータ（Firestore x 2,783ドキュメント）
- **Phase 2a**: 最適化エンジン（PuLP + CBC、156テスト全パス、最大692オーダー/50ヘルパー:38秒）
- **Phase 2b**: REST API (FastAPI) + Cloud Run デプロイ済み
- **Phase 3a-3b**: UI基盤（Next.js + ガントチャート） + 統合（認証、CORS、CI/CD）
- **Phase 4a-4d**: D&D手動編集、UIデザイン改善、マスタ管理（customers/helpers/unavailability）
- **Phase 4d-security**: RBAC (Custom Claims 3役体系) + Firestoreセキュリティルール
- **Phase 5b**: メール通知スタブ、Gmail API DWD、Google Chat DM催促、利用者軸ビュー、Undo/Redo
- **Phase 6a-6d**: CURAノート取込、当週シフト効率化、当日対応効率化、ふせん/チェックリスト取込
- **AIエージェント Phase 1**: ADK基盤 + セキュリティ + 認証テスト + Stage 0完了
- **詳細アーカイブ**: `docs/handoff/archive/`

## デプロイURL

- **Web App**: https://visitcare-shift-optimizer.web.app
- **Optimizer API**: https://shift-optimizer-1045989697649.asia-northeast1.run.app

## 直近の実装（2026-03-30 後半セッション）

### テスト基盤 + Stage 0実行 + RAG設計決定

| PR | 内容 |
|----|------|
| #326 | test: API認証テスト26件（AUTH-01〜AUTH-07）— #322 Closes |
| #327 | test: LLMゴールデンセットテスト12件（Stage 0ゲート）— #323 Closes |
| #328 | fix: Vertex AI設定をADK公式パターンに修正（Stage 0で発見） |

### Stage 0 結果

| 実行 | 結果 | 失敗（偶発） |
|------|------|-------------|
| 1回目 | 11/12 (91.7%) | Q2: LLM中間応答のみ |
| 2回目 | 11/12 (91.7%) | H2: 空応答 |

各失敗は単体再実行でパス → LLM非決定性。ゲート基準達成。

### Stage 0で発見・修正したバグ（PR #328）

- `Part.from_text()` → キーワード引数 `text=` に修正（google-genai 1.69）
- `vertexai/gemini-2.5-flash` → `gemini-2.5-flash`（ADK公式はプレフィックスなし + `GOOGLE_GENAI_USE_VERTEXAI` 環境変数）
- config.pyにVertex AI環境変数のデフォルト設定追加

### RAGパイプライン設計決定（#317）

QAセカンドオピニオンを経て確定:

| 選択肢 | 判定 |
|--------|------|
| **LLM-as-retriever**（構造化ツール + 全ノート返却） | **採用（Phase 2a）** |
| Firestore Vector Search | 待機（Phase 2b、必要時） |
| Vertex AI Vector Search ($280+/月) | 却下 |
| Vertex AI RAG Engine ($65+/月) | 却下 |

理由: データ規模（500ノート ≈ 25K-50Kトークン）がGeminiの1Mコンテキストに余裕で収まる。

**QAが発見した重大な盲点:**
1. CURAノートがFirestoreに永続化されていない（`notes`コレクション未設計）
2. customer.notesフィールドがツールから未公開
3. ヘルパー支援AIがケア観察データにアクセス不能

## 次のアクション（優先度順）

### Phase 2a: ノートアクセス基盤（#317 残作業）
1. 既存 `notes` フィールドを `get_customer_detail` / `get_my_customer_info` に追加
2. `notes` コレクション設計 + CURAノート永続化パイプライン
3. `get_customer_notes(customer_id)` ツール追加
4. ノート検索用ゴールデンセストテスト3-5件追加

### Stage 1 準備（#324）
5. Cloud Runデプロイ（agent/） + Cloud Logging設定
6. チャットUIプロトタイプ

### 既存タスク
7. 本番テスト (#290): ノート取込を本番環境で検証

## GitHub Issuesサマリー

| # | タイトル | 状態 |
|---|---------|------|
| #290 | 本番環境でのノート取込動作確認 | Open [P1] |
| #317 | RAGパイプライン設計 | Open [P1] — 方針確定済み、実装待ち |
| #324 | 段階的ロールアウト計画（Stage 0-4） | Open [P1] — Stage 0完了 |

**クローズ済み（本セッション）**: #322, #323

## テスト結果サマリー（2026-03-30）

- **Agent**: 32 passed, 12 skipped（LLMテストはCIスキップ）
- **Optimizer**: 全パス
- **Web (Next.js)**: 全パス
- **Firestore Rules**: 全パス
- **E2E**: 全パス
- CI全5ジョブ SUCCESS

## データアクセス方法

```bash
# 一括起動（推奨、ローカル Emulator）
./scripts/dev-start.sh

# LLMゴールデンセットテスト（Gemini API呼び出し）
cd agent && GOOGLE_GENAI_USE_VERTEXAI=true GOOGLE_CLOUD_PROJECT=visitcare-shift-optimizer GOOGLE_CLOUD_LOCATION=asia-northeast1 .venv/bin/python -m pytest tests/test_llm_quality.py -v --run-llm

# 最適化エンジン テスト
cd optimizer && .venv/bin/pytest tests/ -v
```

## 重要なドキュメント

- `docs/schema/firestore-schema.md` — データモデル定義
- `docs/adr/ADR-018` — AIエージェント方式ピボット
- `docs/adr/ADR-019` — LLMプロバイダ選定（Gemini 2.5 Flash）
- `docs/adr/ADR-020` — エージェントアーキテクチャ
- `agent/` — AIエージェント（ADK + FastAPI）
- `optimizer/` — 最適化エンジン + API
- `web/` — Next.js フロントエンド
