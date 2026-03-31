# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-03-31（最適化エンジン本番スケール対応 完了）
**現在のフェーズ**: 本番デプロイ可能 + AIエージェント Phase 2a準備中

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
- **本番スケール対応**: 変数枝刈り+カバレッジ緩和+曜日分割+レビュー修正（406テスト、PR #330-334）
- **詳細アーカイブ**: `docs/handoff/archive/`

## デプロイURL

- **Web App**: https://visitcare-shift-optimizer.web.app
- **Optimizer API**: https://shift-optimizer-1045989697649.asia-northeast1.run.app

## 直近の実装（2026-03-31 セッション）

### 最適化エンジン本番スケール対応（全5PR完了）

| PR | 内容 |
|----|------|
| #330 | 本番データ精度検証ツール（Excel→CSV変換、2,393顧客/176ヘルパー/10,245サービス） |
| #331 | ベンチマーク拡張（160/500/1000オーダー規模） |
| #332 | 変数枝刈り（sparse x dict、変数88%削減） |
| #333 | カバレッジ制約緩和（Infeasible解消）+ 曜日分割（メモリ・時間削減） |
| #334 | Codexレビュー指摘12件修正（assigned_count/Feasible/time_budget/has_incumbent等） |

### 品質回帰マトリクス結果

| 指標 | Weekly | Daily | 評価 |
|------|--------|-------|------|
| 割当カバレッジ | 100% | 100% | 同等 |
| 継続性（1人担当率） | 35% | 39% | 同等 |
| ワークロード偏差 | stdev=1.8 | stdev=6.2 | **劣化（許容）** |

### ADR

- **ADR-021**: 日次分割による週次最適化品質のトレードオフ（仕様受容）

## 既知の課題

### P1: ワークロードバランス劣化
- 日次分割により特定ヘルパーに割当が集中する傾向（stdev 3.4倍悪化）
- Phase 2の週次リバランスパスまたはAIエージェント方式で対応予定
- サ責の手動調整で当面対応可能

### 参考: 本番規模スペック
- 10,050オーダー/176ヘルパー → 2GB以内・5分以内で処理可能（推定）
- Infeasible発生率 0%

## 次のアクション

1. **本番デプロイ**: Cloud Runへの最新コードデプロイ
2. **AIエージェント Phase 2a**: シフト管理AI RAG + 対話的生成
3. **P1対応**: ワークロード偏り改善（Issue起票済み）
