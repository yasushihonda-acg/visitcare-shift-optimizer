# visitcare-shift-optimizer

## プロジェクト概要
訪問介護シフト最適化システム（Phase 5b完了: メール通知スタブまで実装済み）
GCP Project ID: `visitcare-shift-optimizer`

## 技術スタック
- **Frontend**: React / Next.js (TypeScript) → Firebase Hosting
- **Backend/DB**: Firebase Authentication + Cloud Firestore
- **Optimization Engine**: Python 3.12+ / PuLP 3.3.0 + CBC → Cloud Run（ADR-006）
- **API**: Cloud Run (REST)
- **移動時間**: Google Maps Distance Matrix API（Firestoreキャッシュ）

## ディレクトリ構成
```
visitcare-shift-optimizer/
├── docs/                    # 要件定義、ADR、分析ドキュメント
│   ├── requirements/        # SOW, PRD, 現行業務分析
│   ├── adr/                 # Architecture Decision Records
│   ├── schema/              # Firestoreスキーマ定義、ER図
│   ├── guides/              # 操作マニュアル、トラブルシューティング
│   └── handoff/             # セッション引継ぎメモ（LATEST.md + archive/）
├── shared/                  # 共有TypeScript型定義
│   └── types/               # Customer, Helper, Order, TravelTime, StaffUnavailability
├── seed/                    # Seedデータ（CSV）+ インポートスクリプト
│   ├── data/                # CSVファイル
│   ├── scripts/             # バリデーション・インポートスクリプト
│   └── tests/               # Vitest テスト
├── firebase/                # Firestore rules, indexes
├── optimizer/               # Python最適化エンジン（Cloud Run）※Phase 2a
├── web/                     # Next.js フロントエンド ※Phase 3a
├── scripts/                 # 開発ツール
│   └── dev-start.sh         # ローカル一括起動スクリプト
├── .github/workflows/       # CI/CD
│   └── ci.yml               # テスト + デプロイ
├── firebase.json            # Firebase Emulator + Hosting設定
└── CLAUDE.md
```

## Firestoreスキーマ
詳細: `docs/schema/firestore-schema.md`

| コレクション | 件数（Seed） | 説明 |
|-------------|-------------|------|
| service_types | 8 | サービス種別マスタ |
| customers | 50 | 利用者マスタ |
| helpers | 20 | スタッフマスタ |
| orders | ~160/週 | サービスオーダー |
| travel_times | ~2,550 | 移動時間キャッシュ |
| staff_unavailability | 随時 | 希望休 |

## 開発規約

### コミット規約
- Conventional Commits 形式: `feat:`, `fix:`, `docs:`, `test:`, `chore:`
- 日本語メッセージ可

### 最適化エンジン（Python）
- テストフレームワーク: pytest
- 制約は1つずつTDDで追加（Red → Green → Refactor）
- 各制約に対応するテストケースを必ず用意

### フロントエンド（Next.js）
- テストフレームワーク: Vitest + React Testing Library
- 状態管理: Firestoreリアルタイムリスナー中心

### ドメイン用語
| 日本語 | 英語（コード内） | 説明 |
|--------|-----------------|------|
| 利用者 | customer / client | サービスを受ける人 |
| ヘルパー/スタッフ | helper / staff | サービスを提供する人 |
| サ責 | service_manager | サービス提供責任者 |
| オーダー | order / service_request | 個別のサービス依頼 |
| 身体介護 | physical_care | 身体介護サービス |
| 生活援助 | daily_living | 生活援助サービス |
| 予防 | prevention | 介護予防サービス |

### デプロイ
- **Web App**: https://visitcare-shift-optimizer.web.app（Firebase Hosting）
- **Optimizer API**: https://shift-optimizer-1045989697649.asia-northeast1.run.app（Cloud Run）
- **CI/CD**: GitHub Actions（PR時テスト、main pushでデプロイ）

### ローカル開発
```bash
./scripts/dev-start.sh  # Emulator + API + Next.js 一括起動
```

### 外部キー（将来連携用）
- `kaiso_id`: 介ソルID
- `karakara_id`: カカラID
- `cura_id`: CURA ID
