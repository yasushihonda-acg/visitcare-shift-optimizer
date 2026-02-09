# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-02-09（Phase 1 完了時）
**現在のフェーズ**: Phase 1 完了 → Phase 2a 開始前

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

## 未着手

### Phase 2a: 最適化エンジン（次のアクション）
- Python-MIP + CBC でシフト最適化
- `shared/types/` を参照して Pydantic モデル作成
- Emulator上の Seed データでアルゴリズム開発・テスト
- `docs/schema/firestore-schema.md` のクエリパターン参照

### Phase 2b: API層 + Cloud Run
### Phase 3a: UI基盤 + ガントチャート
### Phase 3b: 統合 + バリデーション

## 次のアクション候補
1. Phase 2a の `/impl-plan` 策定
2. Python 最適化エンジンの制約定義（TDD）
3. Cloud Run Dockerfile + API設計

## データアクセス方法
```bash
# Emulator起動
firebase emulators:start --project demo-test

# Seed データ投入
cd seed && FIRESTORE_EMULATOR_HOST=localhost:8080 npm run import:all

# テスト実行
npm run test

# UI確認
# http://localhost:4000/firestore
```

## 重要なドキュメント
- `docs/schema/firestore-schema.md` — 全コレクション定義 + クエリパターン
- `docs/schema/data-model.mermaid` — ER図
- `docs/adr/ADR-005-firestore-schema-design.md` — スキーマ設計判断
- `shared/types/` — TypeScript型定義（Python Pydantic モデルの参照元）

## 参考資料（ローカルExcel）
プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
