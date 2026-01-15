FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .

# Environment defaults
ENV LLM_PROVIDER_URL=""
ENV LLM_API_KEY=""
ENV LLM_MODEL="gpt-3.5-turbo"
ENV LLM_TIMEOUT="60"
ENV LLM_MAX_TOKENS="2000"
ENV LLM_TEMPERATURE="0.7"
ENV LOG_REQUESTS="true"

EXPOSE 8092

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8092"]
