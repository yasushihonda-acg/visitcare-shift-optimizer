FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml ./
COPY src/ ./src/

RUN pip install --no-cache-dir .

RUN useradd -m -u 1000 agent
USER agent

CMD ["sh", "-c", "exec gunicorn src.api.main:app --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8080} --workers 2 --timeout 300"]
