FROM python:3.12-slim

WORKDIR /app

# ソースコード + pyproject.toml コピー
COPY pyproject.toml ./
COPY src/ ./src/

# パッケージインストール（editable mode不可なので通常install）
RUN pip install --no-cache-dir .

# 非rootユーザーで実行
RUN useradd -m -u 1000 optimizer
USER optimizer

# gunicorn + uvicorn で起動
# PORT環境変数はCloud Runが自動設定（デフォルト8080）
CMD ["sh", "-c", "exec gunicorn optimizer.api.main:app --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8080} --workers 1 --timeout 300"]
