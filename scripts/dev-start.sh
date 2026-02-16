#!/usr/bin/env bash
# ローカル開発環境一括起動スクリプト
# 使用方法: ./scripts/dev-start.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

cleanup() {
  echo ""
  echo "=== 停止中... ==="
  kill 0 2>/dev/null || true
  wait 2>/dev/null || true
  echo "=== 全プロセス停止完了 ==="
}
trap cleanup EXIT

echo "=== VisitCare Shift Optimizer - 開発環境起動 ==="
echo ""

# 1. .env.local の存在確認
if [ ! -f web/.env.local ]; then
  echo "[WARN] web/.env.local が見つかりません。テンプレートからコピーします..."
  cp web/.env.local.example web/.env.local
  echo "[INFO] web/.env.local を作成しました。必要に応じて値を編集してください。"
fi

# 2. Firebase Emulator起動
echo "[1/4] Firebase Emulator 起動中..."
firebase emulators:start --project demo-visitcare --import=seed/emulator-data --export-on-exit=seed/emulator-data &
EMULATOR_PID=$!
sleep 5

# 3. Seedデータインポート（今週の日付で）
echo "[2/4] Seed データインポート中（今週の日付）..."
cd "$ROOT_DIR/seed"
FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/import-all.ts
cd "$ROOT_DIR"

# 4. Optimizer API起動
echo "[3/4] Optimizer API 起動中 (port 8081)..."
cd "$ROOT_DIR/optimizer"
ALLOW_UNAUTHENTICATED=true \
FIRESTORE_EMULATOR_HOST=localhost:8080 \
.venv/bin/uvicorn optimizer.api.main:app --host 0.0.0.0 --port 8081 --reload &
API_PID=$!
cd "$ROOT_DIR"

# 4. Next.js dev起動
echo "[4/4] Next.js dev 起動中 (port 3000)..."
cd "$ROOT_DIR/web"
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-visitcare npm run dev &
WEB_PID=$!
cd "$ROOT_DIR"

echo ""
echo "=== 開発環境起動完了 ==="
echo "  Firebase Emulator UI: http://localhost:4000"
echo "  Optimizer API:        http://localhost:8081"
echo "  Web App:              http://localhost:3000"
echo ""
echo "Ctrl+C で全プロセスを停止します"
echo ""

wait
