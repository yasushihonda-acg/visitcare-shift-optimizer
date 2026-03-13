# ハンドオフメモ - visitcare-shift-optimizer

**最終更新**: 2026-03-13（PR #265 同一住所インジケーター偽陽性修正 マージ済み）
**現在のフェーズ**: Phase 0-5b 完了 → 実績確認・月次レポート・Google Sheetsエクスポート（本番動作確認済み）

## 完了済みフェーズ

- **Phase 0-1**: プロジェクト基盤 + データ設計 + Seedデータ（Firestore x 2,783ドキュメント）
- **Phase 2a**: 最適化エンジン（PuLP + CBC、156テスト全パス、最大692オーダー/50ヘルパー:38秒）
- **Phase 2b**: REST API (FastAPI) + Cloud Run デプロイ済み
- **Phase 3a-3b**: UI基盤（Next.js + ガントチャート） + 統合（認証、CORS、CI/CD）
- **Phase 4a-4d**: D&D手動編集、UIデザイン改善、マスタ管理（customers/helpers/unavailability）
- **Phase 4d-security**: RBAC (Custom Claims 3役体系) + Firestoreセキュリティルール
- **Phase 5b**: メール通知スタブ、Gmail API DWD、Google Chat DM催促、利用者軸ビュー、Undo/Redo
- **詳細アーカイブ**: `docs/handoff/archive/2026-02-detailed-history.md`（〜2026-02-25）、`docs/handoff/archive/2026-03-detailed-history.md`（2026-03-07〜03-11）

## デプロイURL

- **Web App**: https://visitcare-shift-optimizer.web.app
- **Optimizer API**: https://shift-optimizer-1045989697649.asia-northeast1.run.app

## データアクセス方法

```bash
# 一括起動（推奨、ローカル Emulator）
./scripts/dev-start.sh

# 本番 Firestore へのseed投入（今週の日付）
cd seed && SEED_TARGET=production npx tsx scripts/import-all.ts

# 最適化エンジン テスト
cd optimizer && .venv/bin/pytest tests/ -v

# 最適化API（ローカル、ポート8081）
cd optimizer && ALLOW_UNAUTHENTICATED=true .venv/bin/uvicorn optimizer.api.main:app --reload --port 8081

# Next.js dev
cd web && npm run dev  # → http://localhost:3000

# テスト
cd web && npm test          # Vitest
cd optimizer && .venv/bin/pytest tests/ -v  # pytest
```

## CI/CD（ADR-010）

- **GitHub Actions**: `.github/workflows/ci.yml`
- **認証**: Workload Identity Federation（JSON鍵不使用）
  - SA: `github-actions@visitcare-shift-optimizer.iam.gserviceaccount.com`
  - WIF Pool: `github-actions-pool` / OIDC Provider: `github-oidc`
- PR時: test-optimizer + test-web 並列実行
- main push時: テスト通過後にCloud Build + Firebase Hosting + Firestoreルール 並列デプロイ
- 必要なGitHub Secrets: `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`

## 直近の実装（2026-03-13）

- **fix (#265, 2026-03-13)** ✅: 同一住所インジケーターの偽陽性を修正
  - `useAddressGroups` に `activeCustomerIds` フィルタパラメータを追加
  - 当日オーダーがあるメンバーが2名以上のグループのみインジケーター表示
  - AddressGroupInfo型（index + type: household/facility/mixed）で種別管理
  - テスト12件（フィルタ関連3件追加）全パス

- **feat (#263, 2026-03-13)** ✅: 同一住所の利用者をガントチャート上で視覚的に識別可能にする
  - GanttBar下部3pxアンダーラインで同一住所グループを色分け（5色ローテーション）
  - 🏠（世帯）/🏢（施設）アイコンをバー内・未割当セクションに表示
  - Union-Findで same_household/same_facility を統合しグループ計算
  - tooltipに住所情報を追記

- **fix (#259, 2026-03-12)** ✅: Dialog/Sheetのaria-describedby警告を解消
  - `aria-describedby={undefined}` を SheetContent / DialogContent に追加
  - Radix UIコンソール警告（`Missing Description or aria-describedby`）を解消

- **feat (#258, 2026-03-12)** ✅: キャンセル/復元をトグルボタン化しパネル内でリアルタイム切替可能に
  - Selectドロップダウンを廃止し、キャンセル・復元・完了を個別ボタンに変更
  - `selectedOrder` をIDベースで管理し、Firestoreリアルタイム更新がパネルに即反映
  - パネルを閉じずにキャンセル⇔復元をワンクリックでトグル切替可能に
  - OrderDetailPanel テスト 27件、page.tsx テスト 3件パス

- **fix (#257, 2026-03-12)** ✅: キャンセル操作前に確認ダイアログを追加
  - `window.confirm` でキャンセル確定前に確認を挟み誤操作防止
  - 確認メッセージに「復元可能」の案内を含む

- **fix (#256, 2026-03-12)** ✅: キャンセル復元UIをセレクトから明示的な復元ボタンに変更
  - Undo2アイコン付き「復元」ボタンで誤操作しにくいUIに変更
  - OrderDetailPanel テスト 24件パス

- **fix (#255, 2026-03-12)** ✅: キャンセル済みオーダーをpendingに復元可能にする
  - `cancelled → pending` 状態遷移を追加（誤キャンセル取り消し機能）
  - updateOrder テスト 23件、OrderDetailPanel 24件、Firestoreルール 114件パス
  - CI SUCCESS

- **feat (#254, 2026-03-12)** ✅: サービス種別フィルタUIを改善し検索機能を追加
  - カテゴリフィルタの選択/未選択状態の視認性大幅改善（ゴースト→カラー切り替え）
  - テキスト検索窓を追加（コード・名前・カテゴリで絞り込み可能、カテゴリフィルタと併用可）
  - テスト4件追加（計15テスト全パス）
  - CI SUCCESS（run #22992254818、7m45s）

- **feat (#253, 2026-03-12)** ✅: サービス種別全105種を復元しカテゴリフィルタUIを追加（PR #252をリバート）
  - seed CSV: 訪問介護9種→全105種（5カテゴリ: 訪問介護・通所介護Ⅰ・地域密着型・訪問看護・大規模型Ⅰ）に復元
  - サービス種別マスタ管理画面にカテゴリフィルタ（複数選択可能）を追加
  - カテゴリ別色分けバッジ（CATEGORY_STYLES / CATEGORY_ACTIVE_STYLES）
  - テスト11件追加（4基本 + 7カテゴリフィルタ）
  - .gitignore に seed/emulator-data/ 追加
  - CI SUCCESS（E2E 67 passed, 3 skipped）
  - **要対応**: 本番Firestoreへの再投入が必要（`cd seed && SEED_TARGET=production npx tsx scripts/import-all.ts`）

- **refactor (#250, 2026-03-11)** ✅: メール送信機能を削除（Google Chat DM催促は維持）
  - Backend: `notification/sender.py`, `templates.py`, `recipients.py` 削除、メール3エンドポイント削除
  - Frontend: NotifyConfirmDialog, NotifyChangesButton, 通知設定ページ, Header通知メニュー 削除
  - 維持: `chat_sender.py`, `/notify/chat-reminder`, `ChatReminderDialog.tsx`

## 最新テスト結果サマリー（2026-03-12）

- **Optimizer**: 297件 pass ✅
- **Web (Next.js)**: **986件以上** pass ✅（PR #255/256でVitest累計増加）
- **Firestore Rules**: **114件** pass ✅（PR #255でcancelled→pending許可テスト追加）
- **E2E Tests (Playwright)**: **73テスト以上** pass ✅
- **CI/CD**: PR #265 main push CI SUCCESS（最新）

## 重要なドキュメント

- `docs/schema/firestore-schema.md`, `data-model.mermaid` — データモデル定義
- `docs/adr/` — ADR-001〜ADR-015（スキーマ設計、PuLP、FastAPI、UI、認証、DnD、ルール、マスタ編集、Google Sheetsエクスポート等）
- `shared/types/` — TypeScript型定義（Python Pydantic参照元）
- `optimizer/src/optimizer/` — 最適化エンジン + API
- `web/src/` — Next.js フロントエンド

## Seedコマンド（本番Firestore）

```bash
# 全データ再投入（今週）
cd seed && SEED_TARGET=production npx tsx scripts/import-all.ts

# オーダーのみ週切替
cd seed && SEED_TARGET=production npx tsx scripts/import-all.ts --orders-only --week 2026-02-16

# 複数週一括投入
cd seed && SEED_TARGET=production npx tsx scripts/import-all.ts --weeks 2026-02-09,2026-02-16,2026-02-23
```

## GCP Sheets エクスポート（本番環境設定まとめ）

採用アプローチ: Authorized User ADC を Secret Manager に保存（`google-adc-credentials`）

**注意事項**:
- スプレッドシートは `yasushi.honda@aozora-cg.com` の個人 Drive に作成される
- ADC の refresh token が失効した場合:
  ```bash
  gcloud auth application-default login \
    --scopes="openid,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive"
  gcloud secrets versions add google-adc-credentials \
    --data-file="$HOME/.config/gcloud/application_default_credentials.json" \
    --project=visitcare-shift-optimizer
  ```

## 次のアクション（優先度順）

1. **本番Firestoreへのサービス種別再投入**: `cd seed && SEED_TARGET=production npx tsx scripts/import-all.ts`（PR #253対応、105種全復元）
2. **allowed_staff_ids の本番運用確認**: 意図しない Infeasible が発生しないか確認。必要なら `seed/scripts/rollback-allowed-staff.ts` でロールバック
3. **E2Eテスト拡充**（任意）:
   - 基本予定一覧詳細シート（行クリック詳細シート）E2E
   - 変更確認チェックボタン（アンバーリング→緑確認ボタン→解除）E2E
4. **次フェーズ方針決定**: Phase 6（モバイル対応・PWA化・オフライン対応）等を検討

## GitHub Issuesサマリー

- **オープンIssue**: 0件
- **クローズ済み（直近）**: #265（偽陽性修正）、#264（偽陽性issue）、#263（同一住所インジケーター）、#260（同一住所issue）、#259（aria警告解消）、#258（トグルボタン化）

## 参考資料（ローカルExcel）

プロジェクトディレクトリに以下のExcel/Wordファイルあり（.gitignore済み）:
- `シフト作成_編集ファイル(基本シフト)20251231.xlsx` - 基本シフト4シート
- `Excel（...）マクロ.docx` - VBAマクロソース
- `1.5 のコピー.xlsx` - 当週加工データ
- `時間繋がっている人 のコピー.xlsx` - 夫婦/兄弟連続訪問一覧
- `希望休申請フォーム（訪問介護）のコピー.xlsx` - 希望休フォーム回答
- `訪問介護　不定期 のコピー.xlsx` - 不定期パターン（利用者別シート）
