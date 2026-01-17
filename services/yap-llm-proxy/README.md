# YAP LLM Proxy Service

A lightweight proxy service that forwards chat requests to OpenAI-compatible LLM providers.

## Features

- **OpenAI-compatible API**: Works with OpenWebUI, Ollama, OpenAI, and other compatible providers
- **Error handling**: Proper timeout and connection error handling with meaningful messages
- **Logging**: Comprehensive request/response logging for debugging
- **Health checks**: Built-in health endpoint for monitoring
- **CORS support**: Configurable CORS for frontend integration
- **Validation**: Request validation using Pydantic models

## Configuration

Set the following environment variables:

```bash
# Required: URL to your LLM provider's OpenAI-compatible endpoint
LLM_PROVIDER_URL=http://localhost:11434/v1/chat/completions

# Optional: API key if your provider requires authentication
LLM_API_KEY=

# Optional: Default model to use (can be overridden per request)
LLM_MODEL=llama3

# Optional: Request timeout in seconds
LLM_TIMEOUT=60

# Optional: CORS origins (comma-separated or *)
CORS_ORIGINS=*
```

## Endpoints

### GET /
API information and available endpoints.

### GET /health
Health check endpoint returning service status and configuration.

**Response:**
```json
{
  "status": "ok",
  "service": "yap-llm-proxy",
  "version": "1.0.0",
  "provider_configured": true,
  "model": "llama3",
  "timestamp": "2024-01-14T12:00:00"
}
```

### POST /chat
Forward chat completion request to LLM provider.

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "model": "llama3",
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "llama3",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "I'm doing well, thank you for asking!"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

## Running Locally

### With Docker

```bash
docker build -t yap-llm-proxy .
docker run -p 8092:8092 \
  -e LLM_PROVIDER_URL=http://host.docker.internal:11434/v1/chat/completions \
  -e LLM_MODEL=llama3 \
  yap-llm-proxy
```

### With Python

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export LLM_PROVIDER_URL=http://localhost:11434/v1/chat/completions
export LLM_MODEL=llama3

# Run the service
python main.py
```

## Testing

```bash
# Health check
curl http://localhost:8092/health

# Chat request
curl -X POST http://localhost:8092/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7,
    "max_tokens": 100
  }'
```

## Supported LLM Providers

Any provider with an OpenAI-compatible API endpoint:

- **Ollama**: `http://localhost:11434/v1/chat/completions`
- **OpenWebUI**: `http://localhost:3000/v1/chat/completions`
- **OpenAI**: `https://api.openai.com/v1/chat/completions`
- **LocalAI**: `http://localhost:8080/v1/chat/completions`
- **Text Generation WebUI (oobabooga)**: `http://localhost:5000/v1/chat/completions`
- **LM Studio**: `http://localhost:1234/v1/chat/completions`

## Error Handling

The service returns appropriate HTTP status codes:

- **200**: Success
- **422**: Validation error (invalid request)
- **502**: Bad gateway (provider returned error or unreachable)
- **503**: Service unavailable (provider not configured)
- **504**: Gateway timeout (request exceeded timeout)
- **500**: Internal server error (unexpected error)

## Security Notes

- **API Keys**: Never commit API keys to version control
- **CORS**: Configure `CORS_ORIGINS` appropriately for production
- **Network**: Deploy behind a reverse proxy (Caddy) in production
- **Timeouts**: Adjust `LLM_TIMEOUT` based on your provider's response times

## Development

```bash
# Install dev dependencies
pip install -r requirements.txt

# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8092
```

## License

Part of the Yap project. See main project LICENSE file.
