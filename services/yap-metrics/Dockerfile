FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .

# Create data directory
RUN mkdir -p /data

# Environment defaults
ENV METRICS_ENABLED=false
ENV METRICS_STORE_TEXT=false
ENV METRICS_RETENTION_DAYS=30
ENV METRICS_MAX_EVENTS=5000
ENV METRICS_DB_PATH=/data/metrics.sqlite

EXPOSE 8091

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8091"]
