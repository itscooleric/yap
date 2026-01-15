# YAP LLM Proxy Service

A lightweight proxy service that forwards chat requests from Yap to configured LLM providers.

## Features

- **OpenAI-compatible API**: Works with any provider that supports the OpenAI chat completions format
- **Multiple providers**: OpenWebUI, Ollama, OpenAI, n8n, and more
- **Authentication**: Supports API key authentication
- **Error handling**: Graceful handling of timeouts, connection errors, and provider errors
- **Request logging**: Logs all requests and responses for debugging
- **Configurable**: All settings via environment variables

## Supported Providers

Any LLM provider with an OpenAI-compatible `/v1/chat/completions` endpoint:

- **Ollama**: Set `LLM_PROVIDER_URL=http://ollama:11434` (note: Ollama needs proxy for OpenAI compatibility)
- **OpenWebUI**: Set `LLM_PROVIDER_URL=http://openwebui:8080`
- **OpenAI**: Set `LLM_PROVIDER_URL=https://api.openai.com` + `LLM_API_KEY=sk-...`
- **LocalAI**: Set `LLM_PROVIDER_URL=http://localai:8080`
- **n8n**: Configure n8n to expose OpenAI-compatible endpoint

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER_URL` | _(required)_ | Base URL of LLM provider |
| `LLM_API_KEY` | _(optional)_ | API key for authentication |
| `LLM_MODEL` | `gpt-3.5-turbo` | Default model to use |
| `LLM_TIMEOUT` | `60` | Request timeout in seconds |
| `LLM_MAX_TOKENS` | `2000` | Maximum tokens in response |
| `LLM_TEMPERATURE` | `0.7` | Sampling temperature (0.0-2.0) |
| `LOG_REQUESTS` | `true` | Log requests/responses for debugging |
| `CORS_ORIGINS` | `http://localhost:*,...` | Allowed CORS origins |

## API Endpoints

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "llm-proxy",
  "provider_configured": true,
  "model": "gpt-3.5-turbo"
}
```

### `POST /chat`

Forward chat request to LLM provider.

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "model": "gpt-3.5-turbo",
  "temperature": 0.7,
  "max_tokens": 2000
}
```

**Response (Success):**
```json
{
  "message": "Hello! How can I help you today?",
  "model": "gpt-3.5-turbo",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  },
  "finish_reason": "stop"
}
```

**Response (Error):**
```json
{
  "detail": "LLM provider not configured. Set LLM_PROVIDER_URL environment variable."
}
```

## Error Handling

The service handles errors gracefully and returns meaningful HTTP status codes:

- `400`: Bad request (e.g., streaming requested but not supported)
- `502`: Cannot connect to LLM provider
- `503`: LLM provider not configured
- `504`: Request timed out
- `500`: Unexpected error

All errors are logged with request details for debugging.

## Request Logging

When `LOG_REQUESTS=true`, each request is logged as JSON:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "request": {
    "model": "gpt-3.5-turbo",
    "messages_count": 2,
    "temperature": 0.7,
    "max_tokens": 2000
  },
  "response": {
    "message_length": 150,
    "finish_reason": "stop",
    "usage": {"total_tokens": 175}
  },
  "duration_seconds": 2.34
}
```

## Development

Run locally:
```bash
# Install dependencies
pip install -r requirements.txt

# Set required environment variables
export LLM_PROVIDER_URL=http://localhost:11434
export LLM_MODEL=llama2

# Run service
python app.py
```

Service will start on http://localhost:8092

## Testing

See `tests/test_llm_proxy.py` for unit and integration tests.

```bash
# Unit tests (no LLM provider needed)
pytest tests/test_llm_proxy.py -v -m "not integration"

# Integration tests (requires running LLM provider)
export LLM_BASE_URL=http://localhost:8092
pytest tests/test_llm_proxy.py -v -m integration
```
