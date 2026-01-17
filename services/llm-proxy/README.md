# YAP LLM Proxy Service

A lightweight FastAPI service that proxies chat requests from the Yap UI to Ollama.

## Features

- **Simple API**: Single `/chat` endpoint for sending messages to LLM
- **Ollama Integration**: Connects to local Ollama instance
- **Conversation History**: Supports multi-turn conversations
- **Error Handling**: Clear error messages for common issues
- **CORS Support**: Configured for Yap UI origins
- **Model Listing**: `/models` endpoint to discover available models

## Configuration

Environment variables:

- `OLLAMA_URL`: URL to Ollama API (default: `http://host.docker.internal:11434`)
- `DEFAULT_MODEL`: Default model to use (default: `llama3.2`)
- `REQUEST_TIMEOUT`: Timeout for Ollama requests in seconds (default: `120`)
- `CORS_ORIGINS`: Comma-separated list of allowed origins (default: `http://localhost:*,https://localhost:*`)

## API Endpoints

### POST /chat

Send a message to the LLM and get a response.

**Request:**
```json
{
  "message": "Hello, how are you?",
  "conversationHistory": [
    {"role": "user", "content": "Hi"},
    {"role": "assistant", "content": "Hello! How can I help you?"}
  ],
  "model": "llama3.2",
  "temperature": 0.7,
  "systemPrompt": "You are a helpful assistant."
}
```

**Response:**
```json
{
  "response": "I'm doing well, thank you for asking! How can I assist you today?",
  "model": "llama3.2",
  "timestamp": "2024-01-14T12:00:00Z"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "provider": "ollama",
  "ollama_url": "http://host.docker.internal:11434",
  "default_model": "llama3.2"
}
```

### GET /models

List available models from Ollama.

**Response:**
```json
{
  "models": ["llama3.2", "llama3.2:1b", "gemma3"],
  "default": "llama3.2"
}
```

## Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables (optional)
export OLLAMA_URL=http://localhost:11434
export DEFAULT_MODEL=llama3.2

# Run the service
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## Running with Docker

```bash
docker build -t yap-llm-proxy .
docker run -p 8000:8000 \
  -e OLLAMA_URL=http://host.docker.internal:11434 \
  yap-llm-proxy
```

## Prerequisites

This service requires Ollama to be installed and running:

1. Install Ollama: https://ollama.com
2. Pull a model: `ollama pull llama3.2`
3. Start Ollama: `ollama serve` (runs automatically on macOS/Windows)

## Error Handling

The service provides clear error messages:

- **503**: Cannot connect to Ollama - check if Ollama is running
- **504**: Request timeout - model may be too large or slow
- **500**: Ollama returned an error or empty response
- **422**: Invalid request parameters

All errors include actionable details to help debug issues.
