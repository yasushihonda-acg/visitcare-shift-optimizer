# ADR-019: LLMプロバイダ選定

**ステータス**: 採択
**決定日**: 2026-03-30
**関連 ADR**: ADR-018

---

## コンテキスト

ADR-018でAIエージェント方式へのピボットが決定された。2系統のAIエージェント（シフト管理AI・ヘルパー支援AI）を構築するにあたり、LLMプロバイダを選定する必要がある。

### 評価観点

1. **日本語対応品質**: 訪問介護ドメインの専門用語を含む日本語での対話
2. **GCPとの統合容易性**: 既存インフラ（Firestore, Cloud Run, Firebase Auth）との親和性
3. **Function Calling / Tool Use**: Firestoreデータ参照ツールの正確な呼び出し
4. **API料金・レート制限**: ヘルパー20名 × 日次利用を想定したコスト
5. **Agent Development Kit (ADK) 対応**: Google公式エージェントフレームワークとの統合
6. **レスポンス速度**: チャット体験に影響するレイテンシ

---

## 検討した選択肢

### A. Google Gemini（Vertex AI経由）

| モデル | Input (≤200K) | Output | 特徴 |
|--------|--------------|--------|------|
| Gemini 2.5 Flash | $0.30/1M | $2.50/1M | 高速・低コスト・GA |
| Gemini 2.5 Pro | $1.25/1M | $10.00/1M | 高精度・GA |
| Gemini 2.5 Flash Lite | $0.10/1M | $0.40/1M | 最低コスト・GA |
| Gemini 3 Flash | $0.50/1M | $3.00/1M | Preview |
| Gemini 3.1 Pro | $2.00/1M | $12.00/1M | Preview |

**利点**:
- ADKネイティブ最適化（最小の統合コスト）
- Vertex AI統合（認証・モニタリング・ログ一元管理）
- 既存GCPプロジェクトのIAM・WIF活用
- Batch処理で50%割引可能
- Context Cachingで繰り返しコンテキスト大幅割引

**欠点**:
- 日本語品質はClaude/GPTに若干劣る場面あり

### B. Anthropic Claude（Vertex AI Model Garden経由）

| モデル | Input | Output | 特徴 |
|--------|-------|--------|------|
| Claude Sonnet 4.6 | $3.00/1M | $15.00/1M | 高精度コーディング |
| Claude Haiku 4.5 | $1.00/1M | $5.00/1M | 高速・低コスト |

**利点**:
- 日本語対応品質が高い
- 推論能力が高い
- Vertex AI Model Garden経由でGCP統合可能

**欠点**:
- ADKでの統合にカスタム設定が必要
- Geminiと比較してコストが高い（Flash比で10倍）
- Model Garden経由のレイテンシ

### C. OpenAI GPT（外部API）

| モデル | Input | Output | 特徴 |
|--------|-------|--------|------|
| GPT-4o | $2.50/1M | $10.00/1M | マルチモーダル |
| GPT-4o mini | $0.15/1M | $0.60/1M | 最低コスト |

**利点**:
- 成熟したFunction Calling
- 幅広いドキュメント・コミュニティ

**欠点**:
- GCP外のAPI依存（レイテンシ、認証別管理）
- ADK統合にカスタムモデルクライアント必要
- データ所在地の管理が複雑

---

## 決定

**Google Gemini をプライマリLLMプロバイダとして採用する。**

| 用途 | モデル | 理由 |
|------|--------|------|
| デフォルト（チャット応答） | **Gemini 2.5 Flash** | コスト効率最高、十分な日本語品質、GA安定 |
| 複雑な推論（制約チェック等） | **Gemini 2.5 Pro** | 高精度推論、必要時のみ呼び出し |
| 将来のコスト最適化 | **Gemini 2.5 Flash Lite** | 単純な検索・応答のダウングレード先 |

### モデルルーティング戦略

ADKはモデル非依存設計のため、以下のルーティングを実装:

```
ユーザー入力 → 複雑度判定
  ├── 単純な質問（データ参照のみ）→ Gemini 2.5 Flash
  ├── 複雑な推論（制約チェック、シフト提案）→ Gemini 2.5 Pro
  └── 将来: Vertex AI Model Optimizer で自動ルーティング
```

### 将来の拡張性

ADKのモデル非依存設計により、以下が容易に実現可能:
- Claude（Vertex AI Model Garden経由）への切替・A/Bテスト
- Gemini 3.x系への移行（GA後）
- コスト・品質のバランスに応じた動的モデル選択

---

## 理由

1. **ADKネイティブ統合**: 設定なしでVertex AI経由のGemini呼び出しが可能。認証はGCPサービスアカウントで一元管理
2. **コスト効率**: Flash ($0.30/1M input) は Claude Sonnet ($3.00) の1/10。ヘルパー20名の日常利用で月額コスト抑制
3. **既存インフラ活用**: Vertex AI API有効化のみで利用開始。新規API鍵管理・外部認証設定不要
4. **Context Caching**: ヘルパー/利用者情報のシステムプロンプトをキャッシュすることでコスト90%削減可能
5. **GA安定性**: Gemini 2.5 Flash/Pro は2026年3月時点でGA。Preview版（3.x）への依存を避ける

---

## コスト見積もり

### 前提
- ヘルパー20名 × 平日5日 × 月4週 = 400セッション/月
- 1セッション平均: 入力5,000トークン × 出力2,000トークン × 5ターン

### 月額コスト

| モデル | 入力コスト | 出力コスト | 月額計 |
|--------|----------|----------|--------|
| Gemini 2.5 Flash | $3.00 | $5.00 | **約$8/月** |
| Gemini 2.5 Pro | $6.25 | $20.00 | 約$26/月 |
| Claude Sonnet | $15.00 | $30.00 | 約$45/月 |

Context Caching適用後: **約$3-5/月**（システムプロンプト部分90%削減）

---

## リスク

| リスク | 影響度 | 対策 |
|-------|--------|------|
| 日本語品質がClaudeに劣る場面 | 中 | プロンプトエンジニアリングで補完。不十分なら部分的にClaude併用 |
| Gemini 2.5のFunction Calling精度 | 中 | ツール定義を明確に。テストで品質担保 |
| 3.x系PreviewのGA遅延 | 低 | 2.5 GAで十分。3.x移行は任意 |
| Vertex AI APIのレート制限 | 低 | 初期規模では問題なし。必要時にquota増加申請 |

---

## インフラ設計

### リージョン
- **asia-northeast1（東京）**: Vertex AI Gemini API、Cloud Run共に東京リージョンを使用
- データ残留要件: 個人情報（利用者/ヘルパー）のLLM処理は日本リージョン内で完結

### 認証
- **Workload Identity Federation**: 既存optimizer/と同じWIFパターン（ADR-010）
- Cloud Run → Vertex AI: サービスアカウント経由（`aiplatform.user` ロール）
- クライアント → Cloud Run: Firebase IDトークン（Bearer）

### 環境変数
```
GCP_PROJECT_ID=visitcare-shift-optimizer
GCP_REGION=asia-northeast1
GEMINI_MODEL_DEFAULT=gemini-2.5-flash
GEMINI_MODEL_ADVANCED=gemini-2.5-pro
```

---

## 次のステップ

1. Vertex AI API有効化: `gcloud services enable aiplatform.googleapis.com --project=visitcare-shift-optimizer`
2. ADR-020でADK + Gemini統合のアーキテクチャ詳細を記述
3. Seedデータでの品質評価プロトタイプ
