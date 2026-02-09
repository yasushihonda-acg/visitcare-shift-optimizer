# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-02-09（Phase 2a 完了時）
**現在のフェーズ**: Phase 2a 完了 → Phase 2b 開始前

## 完了済み

### Phase 0: プロジェクト基盤構築
- Git初期化、環境分離設定
- 要件ドキュメント保存（SOW, PRD, 現行業務分析）
- ADR 4件作成

### Phase 1: データ設計 + Seedデータ
- **Firebase初期化**: Emulator設定（Firestore:8080, UI:4000）
- **TypeScript型定義**: `shared/types/` — 全5コレクションの型（strict mode）
- **Firestoreルール**: 開発用allow all + 複合インデックス3件
- **CSVデータ**: 鹿児島市中心部のデモデータ6ファイル
  - customers: 50名（3世帯ペア、NG/推奨スタッフ設定含む）
  - helpers: 20名（有資格16名/無資格4名）
  - customer-services: 160件/週（身体58%/生活42%）
  - helper-availability: 94エントリ
  - staff-unavailability: 3名分サンプル
  - customer-staff-constraints: NG7件/推奨12件
- **インポートスクリプト**: バリデーション→クリア→順次投入
- **移動時間**: Haversine距離×市街地係数1.3÷車速40km/h（`source: 'dummy'`）
- **ドキュメント**: スキーマ定義書、ER図（Mermaid）、ADR-005
- **テスト**: バリデーションunit + Emulator統合テスト
- **Emulatorテスト確認済み**: 2,783ドキュメント正常投入

### Phase 2a: 最適化エンジン
- **技術変更**: Python-MIP → **PuLP 3.3.0 + CBC**（ADR-006）
  - 理由: Python-MIPがPython 3.12非対応（安定版なし）
- **Python環境**: Python 3.12 + venv + pyproject.toml（editable install）
- **Pydanticモデル**: `optimizer/src/optimizer/models/` — TS型定義と完全対応
- **CSVデータローダー**: `optimizer/src/optimizer/data/csv_loader.py`
  - seed/data/ → Pydanticモデル変換
  - Customer.weekly_services → Order生成（日付付き）
  - 移動時間: Haversine距離ベース自動計算
- **MIPエンジン**: `optimizer/src/optimizer/engine/`
  - 決定変数: `x[helper_id, order_id] ∈ {0, 1}`
  - 基本制約: 各オーダーに必要人数分を割当
  - **ハード制約×8**（全TDDで実装）:
    1. 資格制約（身体介護に無資格者不可）
    2. 重複禁止（同一ヘルパーの時間帯重複不可）
    3. 移動時間確保（連続訪問間の移動時間確保）
    4. NGスタッフ回避
    5. 勤務可能時間（availability外は不可）
    6. 希望休（unavailability反映）
    7. 世帯連続訪問（linked_order同一ヘルパー）
    8. 研修中スタッフ（単独訪問不可）
  - **ソフト制約**: 推奨スタッフ優先、移動時間最小化
  - **目的関数**: 重み付き加算（移動時間 + 非推奨ペナルティ）
- **テスト**: 76件全パス（pytest）
  - モデル: 14件
  - CSVローダー: 18件
  - ソルバー基本: 10件
  - 制約別: 24件（各制約3件程度）
  - ソフト制約: 2件
  - 統合テスト: 8件
- **パフォーマンス**: Seedデータ全量（142オーダー/20ヘルパー）で **0.7秒**（目標3分以内）
- **既知の問題**: Seedデータ不整合（18オーダー除外）
  - 日曜勤務ヘルパー0人（日曜オーダー4件）
  - 早朝7:00-8:00のavailability不足
  - 土曜13:00-14:00の同時オーダー > availableヘルパー

## 未着手

### Phase 2b: API層 + Cloud Run（次のアクション）
- Cloud Run Dockerfile作成
- REST API設計（POST /optimize）
- Firestore連携（CSVローダーの代わりにFirestoreから読み込み）
- 最適化結果のFirestore書き戻し（orders.assigned_staff_ids更新）

### Phase 3a: UI基盤 + ガントチャート
### Phase 3b: 統合 + バリデーション

## 次のアクション候補
1. Seedデータの不整合修正（日曜ヘルパー追加、早朝availability拡張）
2. Phase 2b: Cloud Run Dockerfile + API設計
3. Firestore連携のデータローダー実装

## データアクセス方法
```bash
# Emulator起動
firebase emulators:start --project demo-test

# Seed データ投入
cd seed && FIRESTORE_EMULATOR_HOST=localhost:8080 npm run import:all

# 最適化エンジン テスト
cd optimizer && .venv/bin/pytest tests/ -v

# UI確認
# http://localhost:4000/firestore
```

## 重要なドキュメント
- `docs/schema/firestore-schema.md` — 全コレクション定義 + クエリパターン
- `docs/schema/data-model.mermaid` — ER図
- `docs/adr/ADR-005-firestore-schema-design.md` — スキーマ設計判断
- `docs/adr/ADR-006-pulp-replaces-python-mip.md` — PuLP採用の経緯
- `shared/types/` — TypeScript型定義（Python Pydantic モデルの参照元）
- `optimizer/src/optimizer/` — 最適化エンジン本体

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
