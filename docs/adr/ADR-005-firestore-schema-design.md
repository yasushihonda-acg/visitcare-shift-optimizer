# ADR-005: Firestore スキーマ設計

## ステータス

Accepted

## コンテキスト

Phase 1 で Firestore のスキーマ設計を行う。最適化エンジン（Python-MIP）が必要とするデータ構造を定義し、Phase 2 以降の開発を円滑にする必要がある。

## 決定事項

### 1. フラットコレクション構成

サブコレクションではなく、5つのトップレベルコレクションとして構成する。

- `customers` — 利用者マスタ
- `helpers` — スタッフマスタ
- `orders` — 週次オーダー
- `travel_times` — 移動時間キャッシュ
- `staff_unavailability` — 希望休

**理由**: サブコレクション（例: customers/{id}/orders）は Firestore のコレクショングループクエリが必要になり、クエリが複雑化する。最適化エンジンは週単位で全オーダーを一括取得するため、フラットコレクションの方がシンプル。

### 2. weekly_services を Customer に埋め込み

利用者の曜日別サービス定義（`weekly_services`）は別コレクションではなく Customer ドキュメントに埋め込む。

**理由**:
- 1利用者あたり最大7曜日×数件のサービス = 最大20件程度。Firestore の 1MB ドキュメント制限には遠く及ばない
- 利用者情報の取得時にサービス定義も同時に必要になるケースが大半
- 別コレクションにするとN+1クエリが発生

### 3. Orders は weekly_services から週次生成

`weekly_services` はテンプレート（「毎週月曜9:00に身体介護」）、`orders` はそれを特定の週に展開した実体。

**理由**:
- 最適化エンジンは特定週のオーダーに対してスタッフを割り当てる
- 手動編集、キャンセルなどの状態管理は個別オーダー単位で行う
- 不定期パターン（隔週等）への対応も orders 生成時に制御可能

### 4. CSV → Firestore パイプライン

Seed データは CSV ファイルで管理し、TypeScript スクリプトで Firestore Emulator にインポートする。

**理由**:
- CSV は非エンジニアでもレビュー・編集可能
- バリデーションスクリプトで参照整合性を担保
- Git管理によりデータのバージョン管理が可能
- 本番運用時は管理画面（Phase 3+）からの直接入力に移行

### 5. 移動時間はダミーデータ（Phase 1）

Phase 1 では座標間の Haversine 距離から移動時間を算出し、`source: 'dummy'` で保存。

**理由**:
- Google Maps Distance Matrix API は有料（Phase 2 で差替え）
- アルゴリズム開発には相対的な移動時間の大小関係があれば十分
- `source` フィールドにより、ダミーと実データの区別が可能

## 結果

- 5コレクション・フラット構成でシンプルなクエリパターンを実現
- Seed データ: 2,783 ドキュメント（customers 50, helpers 20, orders 160, travel_times 2,550, staff_unavailability 3）
- TypeScript型定義 → CSVバリデーション → Firestore投入の一貫したパイプラインが完成
