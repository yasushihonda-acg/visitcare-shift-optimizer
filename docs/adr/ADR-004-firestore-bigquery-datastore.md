# ADR-004: データストアにFirestore + BigQueryを採用（Cloud SQLは不採用）

## ステータス
承認済み

## コンテキスト
訪問介護シフト最適化システムのデータストアを選定する必要がある。
候補はCloud SQL（PostgreSQL）、Firestore + BigQuery の2構成。

現行業務はExcel 4シート + VBAマクロ + Google Forms + 複数の補助ファイルで運用されており、
これを**フルスクラッチのWebアプリケーション**として一元化する。
Excel/スプレッドシートの「柔軟だが属人的」な運用を、「構造化されつつ柔軟」なWebアプリに置き換える設計が求められる。

### 扱うデータの特性
- 利用者プロフィール: NG/推奨スタッフリスト、曜日別サービス、補足備考など**ネストした属性が多い**
- ヘルパープロフィール: 曜日別勤務可能時間帯、資格リスト、同行段階ステータス
- 最適化結果（シフト）: スタッフ×時間帯の割当。**リアルタイムでガントチャートUIに反映**する必要がある
- 移動時間: Google Maps APIキャッシュ（ADR-003で設計済み）
- 週次変動: キャンセル・追加・不定期パターン

### システム要件
- ガントチャートUIでのリアルタイム表示・ドラッグ&ドロップ編集
- 最適化エンジン（Cloud Run）からの結果一括書込
- 将来的な分析・レポート機能（最適化結果の履歴比較等）

## 決定
**Firestore（メインDB）+ BigQuery（分析用、Phase 3以降）** を採用する。Cloud SQLは採用しない。

### 役割分担
| 層 | 技術 | 用途 |
|---|---|---|
| メインDB | Cloud Firestore | マスタデータ、シフト結果、リアルタイム同期 |
| 分析基盤 | BigQuery | 最適化結果の履歴蓄積・比較分析（Phase 3+） |
| 連携 | Firebase Extension (Firestore → BQ) | リアルタイムストリーミングエクスポート |

### フェーズ別アーキテクチャ
```
Phase 1-2:  CSV → Firestore ← Next.js (リアルタイムリスナー)
                     ↓ ↑
              Cloud Run (Python-MIP) 結果書込

Phase 3+:   Firestore → [BQ Extension] → BigQuery → 分析・レポート
```

## 理由

### 1. ドキュメントモデルがドメインに適合
利用者・ヘルパーのデータは**可変長のネスト構造**（NGスタッフリスト、曜日別スケジュール、資格リスト等）を持つ。
Cloud SQLでは正規化による多テーブルJOINが必要だが、Firestoreではドキュメント内に自然に表現できる。

### 2. リアルタイム同期がコア要件
ガントチャートUIでの即時反映、最適化実行中のプログレス表示、手動編集時のバリデーション警告など、
**リアルタイム性がUXの核**である。Firestoreのリアルタイムリスナーはこれを標準機能として提供する。
Cloud SQLでは WebSocket/SSE を自前実装する必要があり、開発・運用コストが増大する。

### 3. サーバーレス運用でコスト最適
- Cloud SQL: 最低でもインスタンス維持費（月$9〜$50+）+ 運用管理が必要
- Firestore: サーバーレス。無料枠（50K reads/20K writes/日）でデモフェーズは十分カバー可能
- 小規模チームでのDB運用負荷を最小化できる

### 4. 複雑なJOIN/トランザクションが不要
最適化エンジンはFirestoreから必要データを**一括取得→メモリ上で計算→結果を一括書込**するため、
DB側での複雑なJOINやリアルタイムトランザクション整合性は不要。

### 5. BigQueryで分析ニーズを補完
Firestoreの弱点であった集計・分析クエリは、Firebase公式ExtensionによるBigQueryへのリアルタイムストリーミングで補完できる。
「先週 vs 今週の移動時間比較」「スタッフ稼働率推移」等の分析はBigQuery側で実施する。

### 6. Firestoreの進化（2025-2026）
- **Pipeline Operations**（2026/01 GA）: 集約、正規表現マッチング等100+の新クエリ機能。従来の「クエリが弱い」弱点が大幅改善
- **Vector Search**: 将来的なスタッフ-利用者マッチング類似度検索への応用可能性
- **Query Insights**: 実行計画・コスト可視化による最適化

## Cloud SQLを不採用とした理由
- リアルタイム同期を自前実装するコスト > Firestore標準機能の利用
- インスタンス管理・スケーリング設定が不要な方がデモ開発のスピードに合う
- RDBMSの強みである複雑なJOIN・トランザクションがこのドメインでは活きない
- Firebase Auth / Hosting との統合がFirestoreの方がシームレス

## リスクと対策
| リスク | 影響 | 対策 |
|---|---|---|
| Firestoreクエリの制約 | 複雑な検索条件が書けない | Pipeline Operations (Enterprise) or BQ Export で補完 |
| 読取回数増によるコスト増 | 大規模化時に月額増 | キャッシュ戦略、リスナーのスコープ最小化 |
| 移動時間マトリクスの格納 | 2,401×2,401は非効率 | ADR-003の設計に従いAPIキャッシュで対応 |
| オフライン対応不要の場合の過剰機能 | Firestoreのオフライン同期は不使用 | 機能を無効化して余計な複雑性を排除 |

## 参考
- [Firestore Pipeline Operations (2026/01)](https://firebase.blog/posts/2026/01/firestore-enterprise-pipeline-operations)
- [Firestore → BigQuery Extension](https://extensions.dev/extensions/firebase/firestore-bigquery-export)
- [Firebase Pricing](https://firebase.google.com/pricing)
