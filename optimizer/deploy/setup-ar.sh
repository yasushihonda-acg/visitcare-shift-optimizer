#!/bin/bash
# Artifact Registry リポジトリ作成 + クリーンアップポリシー適用
set -euo pipefail

PROJECT_ID="visitcare-shift-optimizer"
REGION="asia-northeast1"
REPO_NAME="optimizer"

echo "=== Artifact Registry API 有効化 ==="
gcloud services enable artifactregistry.googleapis.com --project="$PROJECT_ID"

echo "=== リポジトリ作成 ==="
gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --description="visitcare optimizer Docker images" \
  2>/dev/null || echo "リポジトリは既に存在します"

echo "=== クリーンアップポリシー適用（最新2イメージ保持） ==="
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
gcloud artifacts repositories set-cleanup-policies "$REPO_NAME" \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --policy="$SCRIPT_DIR/cleanup-policy.json"

echo "=== 完了 ==="
gcloud artifacts repositories describe "$REPO_NAME" \
  --location="$REGION" \
  --project="$PROJECT_ID"
