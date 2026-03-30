# ADR-020: AIエージェントアーキテクチャ

**ステータス**: 採択
**決定日**: 2026-03-30
**関連 ADR**: ADR-018, ADR-019

---

## コンテキスト

ADR-018でAIエージェント方式へのピボット、ADR-019でGemini（Vertex AI）の採用が決定された。本ADRでは、2系統のAIエージェントの技術アーキテクチャを定義する。

### 構築するエージェント

| エージェント | 対象ユーザー | 主機能 |
|------------|-------------|--------|
| シフト管理AI | サ責（service_manager） | Firestoreデータを参照した対話的シフト生成支援 |
| ヘルパー支援AI | 各ヘルパー（helper） | メンタルサポート + 業務お困りごと対応 |

---

## 決定

### 技術スタック

| コンポーネント | 選定技術 | 理由 |
|--------------|---------|------|
| エージェントフレームワーク | **Google Agent Development Kit (ADK)** | GCPネイティブ、Gemini最適化、OSS |
| 言語 | **Python 3.12** | ADK最成熟実装、既存optimizer/と統一 |
| APIフレームワーク | **FastAPI**（カスタム統合） | 既存パターン踏襲、Firebase Auth統合 |
| セッション管理 | **Firestore SessionService** | ADK公式サポート、既存DB活用 |
| 長期メモリ | **VertexAiMemoryBankService** | セッション横断の知識蓄積 |
| LLM | **Gemini 2.5 Flash / Pro** | ADR-019 |
| デプロイ | **Cloud Run** | 既存パターン完備 |
| データアクセス | **ADK Tool Use**（構造化クエリ） | 初期はVector Search不要 |

### アーキテクチャ図

```
┌─────────────────────────────────────────────────┐
│  Next.js Web App (Firebase Hosting)              │
│  ┌─────────────┐  ┌─────────────┐               │
│  │ シフト管理   │  │ ヘルパー支援 │               │
│  │ チャットUI   │  │ チャットUI   │               │
│  └──────┬──────┘  └──────┬──────┘               │
│         │  SSE           │  SSE                  │
└─────────┼────────────────┼───────────────────────┘
          │                │
     Firebase IDトークン (Bearer)
          │                │
┌─────────┼────────────────┼───────────────────────┐
│  Agent Service (Cloud Run)                       │
│  ┌──────┴──────────────────┴──────┐              │
│  │  FastAPI + Firebase Auth       │              │
│  │  ロール判定 → エージェント振分  │              │
│  └──────┬──────────────────┬──────┘              │
│  ┌──────┴──────┐  ┌───────┴──────┐              │
│  │ ADK Runner  │  │ ADK Runner   │              │
│  │ shift_mgr   │  │ helper_sup   │              │
│  │   agent     │  │   agent      │              │
│  └──────┬──────┘  └───────┬──────┘              │
│         │                 │                      │
│  ┌──────┴─────────────────┴──────┐              │
│  │  ADK Tools (Function Calling)  │              │
│  │  ・get_customers              │              │
│  │  ・get_helpers                │              │
│  │  ・get_weekly_orders          │              │
│  │  ・check_constraints          │              │
│  │  ・suggest_assignment (→API)  │              │
│  └──────┬─────────────────┬──────┘              │
└─────────┼─────────────────┼──────────────────────┘
          │                 │
┌─────────┼─────────────────┼──────────────────────┐
│  GCP Services                                    │
│  ┌──────┴──────┐  ┌──────┴───────┐              │
│  │ Firestore   │  │ Vertex AI    │              │
│  │ ・customers │  │ ・Gemini API │              │
│  │ ・helpers   │  │ ・Memory Bank│              │
│  │ ・orders    │  │              │              │
│  │ ・sessions  │  │              │              │
│  └─────────────┘  └──────────────┘              │
│                                                  │
│  ┌─────────────┐                                │
│  │ Optimizer   │ ← AIエージェントの内部ツール    │
│  │ (Cloud Run) │   制約チェック・候補生成用       │
│  └─────────────┘                                │
└──────────────────────────────────────────────────┘
```

### ADKメモリアーキテクチャ

```
Session（1会話の履歴）
  → Firestore SessionService で永続化
  → adk_sessions コレクション（ADK内部管理）

State（key-value、スコープ別）
  → session スコープ: 現在の会話内変数
  → user: プレフィックス: ユーザー横断で永続化
    例: user:helper_profile, user:担当利用者リスト
  → app: プレフィックス: 全ユーザー共有
    例: app:business_rules, app:domain_glossary

Memory（長期記憶）
  → VertexAiMemoryBankService
  → セッション完了時に自動抽出・統合
  → ヘルパー支援AIで蓄積された相談履歴・傾向
```

### 既存最適化エンジンの位置づけ

**決定: (a) AIエージェントの内部ツールとして併用する。**

- optimizer/ Cloud RunサービスはそのままA維持
- AIエージェントの `suggest_assignment` ツールから HTTP で呼び出し
- 制約チェック・候補生成用の検証エンジンとして活用
- AIが提案するシフトの整合性チェックに利用

```python
# agent/src/shift_manager/tools/schedule_tools.py
@tool
async def suggest_assignment(
    customer_id: str,
    date: str,
    time_slot: str,
) -> dict:
    """既存最適化エンジンを呼び出し、制約を満たすスタッフ候補を取得"""
    response = await httpx.AsyncClient().post(
        f"{OPTIMIZER_API_URL}/api/suggest",
        json={"customer_id": customer_id, "date": date, "time_slot": time_slot},
    )
    return response.json()
```

### RAG戦略: 段階的アプローチ

| フェーズ | データアクセス方式 | 用途 |
|---------|-----------------|------|
| **Phase 1（初期）** | **ADK Tool Use**（構造化Firestoreクエリ） | 顧客/ヘルパー/オーダーの検索・参照 |
| Phase 2（中期） | Firestore Vector Search追加 | 自然言語での類似検索（「先週と同じパターンで」） |
| Phase 3（将来） | Vertex AI RAG Engine | 外部ドキュメント（CURAノート等）の大規模検索 |

**Phase 1の理由**: 既存Firestoreスキーマは構造化データ（50顧客/20ヘルパー/160オーダー）であり、Tool Useによる明示的なクエリで十分カバー可能。Vector Searchは自然言語検索ニーズが明確になってから導入する。

---

## ディレクトリ構成

```
agent/
├── pyproject.toml
├── Dockerfile
├── cloudbuild.yaml
├── src/
│   ├── shift_manager/          # シフト管理AIエージェント
│   │   ├── __init__.py
│   │   ├── agent.py            # root_agent（ADK規約）
│   │   ├── prompts.py          # システムプロンプト
│   │   └── tools/
│   │       ├── __init__.py
│   │       ├── customer_tools.py
│   │       ├── helper_tools.py
│   │       ├── order_tools.py
│   │       └── schedule_tools.py
│   ├── helper_support/         # ヘルパー支援AIエージェント
│   │   ├── __init__.py
│   │   ├── agent.py
│   │   ├── prompts.py
│   │   └── tools/
│   │       └── __init__.py
│   ├── shared/                 # 共通モジュール
│   │   ├── __init__.py
│   │   ├── firestore_client.py
│   │   ├── auth.py
│   │   └── config.py
│   └── api/
│       ├── __init__.py
│       └── main.py             # FastAPI + ADK Runner統合
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_shift_manager.py
    └── test_helper_support.py
```

---

## セキュリティ

### 認証・認可

| ロール | アクセス可能エージェント |
|--------|---------------------|
| admin | shift_manager, helper_support（全ヘルパー） |
| service_manager | shift_manager |
| helper | helper_support（自分のみ） |

- Firebase IDトークンでロール判定（既存 `require_manager_or_above` パターン踏襲）
- ヘルパーは自分のセッション・データのみアクセス可能

### データ保護

- 会話データはFirestoreに保存（既存セキュリティルール適用）
- Vertex AI API呼び出しはVPC内（Cloud Run → Vertex AI）
- PII（個人情報）はLLMへの送信前にフィルタリング検討（Phase 2以降）

---

## 影響

### ADR影響

| ADR | 変更 |
|-----|------|
| ADR-001 (数理最適化採用) | ステータス: **Superseded by ADR-018/020**。エンジンは内部ツールとして存続 |
| ADR-006 (PuLP+CBC) | ステータス: **Modified**。単独サービスから内部ツールへ役割変更 |
| ADR-007 (FastAPI+Cloud Run) | 影響なし。agent/も同パターン採用 |
| ADR-018 (AIエージェントピボット) | 本ADRで具体化。#318（エンジン位置づけ）解決 |

---

## リスク

| リスク | 影響度 | 対策 |
|-------|--------|------|
| ADK Python版のバージョン不安定 | 中 | バージョン固定、変更追従のCI |
| Firestore SessionServiceの制限 | 低 | 公式サポート済み。必要時にカスタム実装切替 |
| optimizer API内部呼出のレイテンシ | 低 | Cloud Run間通信。同一リージョンで低遅延 |
| メモリ蓄積のストレージコスト | 低 | 初期は20ヘルパー規模。モニタリングで対応 |
