# LLM API Selection Research for Yap Chat Tab

## Executive Summary

This document evaluates LLM (Large Language Model) API providers for integration with Yap's upcoming chat tab feature. After comparing OpenWebUI, Ollama, n8n, and other providers, **we recommend Ollama as the primary provider for the MVP** due to its simplicity, privacy, and existing integration pattern in Yap.

> **📄 See also**: [OpenWebUI Detailed Analysis](OPENWEBUI_ANALYSIS.md) - In-depth comparison of OpenWebUI vs Ollama with implementation effort analysis, API details, and code examples.

### Quick Recommendation

- **MVP Provider**: Ollama (6-8 days implementation)
- **Alternative**: OpenWebUI (10-12 days, +50% effort, includes RAG/web search)
- **Best Approach**: Hybrid - Ship Ollama MVP, add OpenWebUI as optional backend later
- **Architecture**: Direct Ollama integration via OpenAI-compatible `/v1/chat/completions` endpoint (Ollama 0.1.0+), or optional thin proxy for CORS/error handling

---

## Evaluation Criteria

We evaluated each provider based on:

1. **Setup Complexity**: Installation, configuration, and maintenance effort
2. **Cost**: Free/paid tiers, hosting requirements
3. **Privacy**: Data handling, local vs remote processing
4. **Extensibility**: Model support, customization, future expansion
5. **API Compatibility**: Standard formats, ease of integration
6. **Yap Integration**: Fit with existing architecture and patterns

---

## Provider Analysis

### 1. Ollama

**Overview**: Local LLM runtime that runs models on your own hardware.

#### Pros
- ✅ **Already integrated**: Yap has existing Ollama integration in add-ons
- ✅ **Simple REST API**: Standard `/api/generate` and `/api/chat` endpoints
- ✅ **OpenAI-compatible API**: Native `/v1/chat/completions` endpoint (Ollama 0.1.0+)
- ✅ **100% local and private**: All processing happens on-device
- ✅ **Zero cost**: Free, open-source, self-hosted
- ✅ **Easy setup**: Single binary installation, works on macOS, Linux, Windows
- ✅ **Wide model support**: Access to 100+ models (Llama, Mistral, Gemma, etc.)
- ✅ **Minimal dependencies**: No external services required
- ✅ **Model switching**: Easy to change models via API
- ✅ **Docker support**: Can run in containers alongside Yap services

#### Cons
- ⚠️ **Hardware requirements**: Needs sufficient RAM/VRAM for models (8GB+ for 7B models)
- ⚠️ **Performance varies**: Speed depends on local hardware
- ⚠️ **Model downloads**: Initial download can be large (GBs)
- ⚠️ **No built-in UI**: API-only (not a con for Yap's use case)

#### API Format
```bash
# OpenAI-compatible endpoint (Ollama 0.1.0+, recommended)
POST http://localhost:11434/v1/chat/completions
{
  "model": "llama3.2",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "stream": false
}

# Native Ollama chat endpoint
POST http://localhost:11434/api/chat
{
  "model": "llama3.2",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "stream": false
}

# Generate endpoint (simpler, native format)
POST http://localhost:11434/api/generate
{
  "model": "llama3.2",
  "prompt": "Hello!",
  "stream": false
}
```

> **Note**: Ollama 0.1.0+ exposes a native OpenAI-compatible `/v1/chat/completions` endpoint, eliminating the need for a compatibility proxy. The native `/api/chat` endpoint is also available and used by existing Yap integrations.

#### Integration Effort
**Low** - Existing patterns in `add-ons/ollama-summarize/` can be adapted.

#### Setup Complexity: ⭐⭐⭐⭐⭐ (Very Easy)
```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2
ollama serve
```

#### Best For
- MVP implementation
- Privacy-focused deployments
- Users with decent hardware
- Offline/air-gapped environments

---

### 2. OpenWebUI

**Overview**: Feature-rich web interface for LLMs that supports Ollama, OpenAI APIs, and more.

#### Pros
- ✅ **Comprehensive platform**: Complete UI, user management, RAG, and more
- ✅ **Multiple backend support**: Works with Ollama, OpenAI, LMStudio, etc.
- ✅ **OpenAI-compatible API**: Can expose `/api/chat` endpoints
- ✅ **Advanced features**: RAG, web search, image generation, function calling
- ✅ **User management**: Authentication, permissions, multi-user support
- ✅ **Active development**: Large community, frequent updates
- ✅ **Docker deployment**: Easy containerized setup
- ✅ **Plugin ecosystem**: Extensible with Python functions

#### Cons
- ⚠️ **Complexity**: Full-featured platform may be overkill for Yap
- ⚠️ **Resource intensive**: Requires database, storage, more memory
- ⚠️ **Setup overhead**: More configuration than simple Ollama
- ⚠️ **Potential UI duplication**: OpenWebUI has its own chat UI
- ⚠️ **API learning curve**: Need to understand OpenWebUI's specific API patterns

#### API Format
OpenWebUI exposes OpenAI-compatible endpoints:
```bash
POST http://localhost:8080/api/chat/completions
Authorization: Bearer <api_key>
{
  "model": "llama3.2",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

#### Integration Effort
**Medium** - Requires understanding OpenWebUI's API authentication and endpoints.

#### Setup Complexity: ⭐⭐⭐ (Moderate)
```bash
docker run -d -p 8080:8080 \
  -v open-webui:/app/backend/data \
  --name open-webui \
  ghcr.io/open-webui/open-webui:main
```

#### Best For
- Organizations needing full-featured AI platform
- Multi-user environments with authentication
- Advanced features like RAG and web search
- Future expansion beyond basic chat

---

### 3. n8n (LLM Orchestration)

**Overview**: Workflow automation platform that can orchestrate LLM calls via nodes.

#### Pros
- ✅ **Visual workflows**: No-code LLM orchestration
- ✅ **Multi-provider**: Connect to OpenAI, Anthropic, local models, etc.
- ✅ **Preprocessing**: Can chain operations (sanitize → call LLM → format)
- ✅ **Webhook support**: Can expose HTTP endpoints for Yap
- ✅ **Flexible**: Easy to add logic, conditions, transformations
- ✅ **Self-hosted**: Can run on same LAN as Yap

#### Cons
- ❌ **Indirect integration**: Not a direct LLM provider, needs backend LLM
- ❌ **Added complexity**: Another service to maintain
- ❌ **Latency**: Additional hop in the request chain
- ❌ **Overkill for simple chat**: Workflow engine not needed for basic LLM calls
- ❌ **Learning curve**: Requires understanding n8n workflows

#### API Format
Custom webhook endpoints defined in n8n workflows:
```bash
POST https://your-n8n.com/webhook/yap-chat
{
  "message": "Hello!",
  "conversationId": "123"
}
```

#### Integration Effort
**High** - Requires setting up n8n, creating workflows, and custom endpoint design.

#### Setup Complexity: ⭐⭐ (Moderate-Complex)
Requires n8n installation + workflow configuration + backend LLM setup.

#### Best For
- Complex workflows requiring preprocessing/postprocessing
- Integration with multiple external services
- Teams already using n8n
- Future advanced features (NOT recommended for MVP)

---

### 4. LiteLLM (Multi-Provider Proxy)

**Overview**: Unified OpenAI-compatible proxy that supports 100+ LLM providers.

#### Pros
- ✅ **Provider flexibility**: Switch between Ollama, OpenAI, Anthropic, Groq, etc.
- ✅ **OpenAI-compatible API**: Standard `/chat/completions` endpoint
- ✅ **Load balancing**: Route between multiple providers/models
- ✅ **Fallback support**: Auto-retry with different providers
- ✅ **Usage tracking**: Built-in logging and metrics
- ✅ **Model aliasing**: Abstract provider-specific model names
- ✅ **Docker support**: Easy containerized deployment

#### Cons
- ⚠️ **Another service**: Additional layer between Yap and LLM
- ⚠️ **Configuration overhead**: Need to configure providers, keys, models
- ⚠️ **Potential latency**: Small overhead for proxying
- ⚠️ **May be overkill for MVP**: If only using one provider

#### API Format
```bash
POST http://localhost:4000/chat/completions
{
  "model": "ollama/llama3.2",  # or "gpt-4", "claude-3", etc.
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

#### Integration Effort
**Medium** - Standardized API but requires LiteLLM setup and configuration.

#### Setup Complexity: ⭐⭐⭐ (Moderate)
```bash
docker run -p 4000:4000 \
  -e LITELLM_MASTER_KEY=sk-1234 \
  ghcr.io/berriai/litellm:main-latest
```

#### Best For
- Multi-provider scenarios
- Organizations wanting provider flexibility
- Future-proofing against provider changes
- Phase 2 implementation (not MVP)

---

### 5. OpenAI API (Cloud)

**Overview**: OpenAI's hosted GPT models via REST API.

#### Pros
- ✅ **Best quality**: State-of-the-art models (GPT-4o, o1, etc.)
- ✅ **Zero setup**: No local installation needed
- ✅ **Reliable**: Enterprise-grade infrastructure
- ✅ **Standard API**: Well-documented OpenAI format
- ✅ **Fast**: Low latency for small prompts

#### Cons
- ❌ **Privacy concerns**: Data sent to external service
- ❌ **Cost**: Pay per token (can get expensive)
- ❌ **Internet required**: No offline support
- ❌ **API key management**: Security considerations
- ❌ **Against Yap philosophy**: Yap emphasizes local processing

#### API Format
```bash
POST https://api.openai.com/v1/chat/completions
Authorization: Bearer sk-...
{
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

#### Integration Effort
**Low** - Standard API, many examples available.

#### Setup Complexity: ⭐⭐⭐⭐⭐ (Very Easy)
Just need API key.

#### Best For
- Users who prefer cloud convenience over privacy
- Organizations with OpenAI contracts
- Optional alternative provider (not MVP)

---

### 6. LocalAI

**Overview**: Drop-in OpenAI API replacement for local models.

#### Pros
- ✅ **OpenAI-compatible**: Uses same API format
- ✅ **Local and private**: Self-hosted
- ✅ **Multiple model formats**: GGML, GGUF, PyTorch, etc.
- ✅ **Feature-rich**: TTS, embeddings, image generation
- ✅ **Docker support**: Easy deployment

#### Cons
- ⚠️ **Setup complexity**: More involved than Ollama
- ⚠️ **Less polished**: Smaller community than Ollama
- ⚠️ **Performance tuning**: Requires more configuration
- ⚠️ **Documentation gaps**: Less comprehensive guides

#### Integration Effort
**Medium** - Similar to OpenAI API but needs local setup.

#### Setup Complexity: ⭐⭐⭐ (Moderate)

#### Best For
- Users wanting OpenAI API format with local models
- Not recommended over Ollama for Yap MVP

---

## Comparison Matrix

| Provider | Setup | Cost | Privacy | Extensibility | API Standard | Yap Fit | Recommendation |
|----------|-------|------|---------|---------------|--------------|---------|----------------|
| **Ollama** | ⭐⭐⭐⭐⭐ | Free | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Custom | ⭐⭐⭐⭐⭐ | **MVP** |
| **OpenWebUI** | ⭐⭐⭐ | Free | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | OpenAI-like | ⭐⭐⭐ | Future |
| **n8n** | ⭐⭐ | Free | Varies | ⭐⭐⭐⭐⭐ | Custom | ⭐⭐ | Not recommended |
| **LiteLLM** | ⭐⭐⭐ | Free | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | OpenAI | ⭐⭐⭐⭐ | Phase 2 |
| **OpenAI** | ⭐⭐⭐⭐⭐ | $$ | ⭐ | ⭐⭐⭐ | OpenAI | ⭐⭐ | Optional |
| **LocalAI** | ⭐⭐⭐ | Free | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | OpenAI | ⭐⭐⭐ | Not needed |

---

## Recommendation: Ollama for MVP

### Primary Justification

1. **Proven Integration**: Yap already has Ollama integration in `add-ons/ollama-summarize/`, providing working patterns to follow

2. **Aligns with Yap Philosophy**: 
   - Local processing (like Whisper ASR and Piper TTS)
   - Privacy-first (no external data sharing)
   - Self-hosted (runs on user's network)
   - Terminal aesthetic (API-only, custom UI)

3. **Simple Architecture**:
   - No authentication complexity
   - Single API endpoint
   - Minimal configuration
   - Easy to test and debug

4. **User Experience**:
   - One command to install (`ollama pull <model>`)
   - Works offline
   - No API keys or billing
   - Fast iteration during development

5. **Future-Proof**:
   - Can easily add LiteLLM proxy later for multi-provider support
   - Ollama API stable and widely adopted
   - Large model library (100+ models)

### Deferred Providers

- **OpenWebUI**: Valuable for future phases if users want advanced RAG, web search, or multi-user support. Consider as Phase 2 enhancement.

- **LiteLLM**: Excellent for Phase 2 when users request flexibility to use cloud providers (OpenAI, Anthropic) or switch between multiple local models.

- **n8n**: Too complex for direct LLM integration. Could be useful if Yap needs advanced workflows (e.g., "transcribe → summarize → translate → export"), but not for basic chat.

- **OpenAI/Cloud APIs**: Offer as optional alternative for users who prefer convenience over privacy. Not default due to cost and privacy concerns.

---

## Configuration Guidelines for Yap + Ollama

### Architecture Overview

```
┌─────────────────┐
│   Yap Chat UI   │  (Browser - /app/ui/js/chat.js)
└────────┬────────┘
         │ HTTP POST
         ▼
┌─────────────────┐
│  LLM Proxy API  │  (Python FastAPI - /llm-proxy/)
│  /llm/chat      │  - Request validation
│                 │  - CORS handling
│                 │  - Error formatting
└────────┬────────┘
         │ HTTP POST
         ▼
┌─────────────────┐
│     Ollama      │  (http://localhost:11434)
│  /api/chat      │  - Model inference
│                 │  - Context management
└─────────────────┘
```

### Setup Instructions

#### 1. Install Ollama

**macOS**:
```bash
# Download and install from ollama.com
brew install ollama
```

**Linux**:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows**:
```powershell
# Download OllamaSetup.exe from ollama.com
```

#### 2. Pull Recommended Model

For MVP, we recommend **llama3.2** (3B parameters, 2GB) for good balance of quality and speed:

```bash
ollama pull llama3.2

# Alternatives:
# ollama pull llama3.2:1b      # Faster, lower quality (1.3GB)
# ollama pull llama3.3:70b     # Best quality, slower (43GB)
# ollama pull gemma3           # Google's model (3.3GB)
```

#### 3. Verify Ollama Running

```bash
# Test Ollama health
curl http://localhost:11434/api/tags

# Test OpenAI-compatible endpoint (Ollama 0.1.0+)
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'

# Test native chat endpoint
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [{"role": "user", "content": "Hello!"}],
  "stream": false
}'
```

#### 4. Configure Yap LLM Proxy Service (Optional)

> **Note**: While Ollama 0.1.0+ provides native OpenAI-compatible endpoints, a thin proxy service can still be useful for:
> - CORS handling for browser-based applications
> - Consistent error formatting across providers
> - Request/response transformation
> - Future multi-provider support

**Option A: Direct Ollama Integration (Simpler)**

Use Ollama's native OpenAI-compatible endpoint directly:
```javascript
// Frontend can call Ollama's /v1/chat/completions directly
const response = await fetch('http://localhost:11434/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama3.2',
    messages: [{ role: 'user', content: 'Hello!' }],
    stream: false
  })
});
```

**Option B: Custom Proxy Service (More Control)**

Create `llm-proxy/app.py`:

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for your domain
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

# Configuration
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama3.2")
USE_OPENAI_ENDPOINT = os.getenv("USE_OPENAI_ENDPOINT", "true").lower() == "true"

class ChatRequest(BaseModel):
    message: str
    conversationHistory: list = []
    model: str = DEFAULT_MODEL

class ChatResponse(BaseModel):
    response: str
    model: str

@app.post("/llm/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Forward chat request to Ollama (using OpenAI-compatible or native endpoint)"""
    
    # Build messages array for Ollama
    messages = []
    for msg in request.conversationHistory:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })
    messages.append({"role": "user", "content": request.message})
    
    # Call Ollama using OpenAI-compatible endpoint (recommended) or native endpoint
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            if USE_OPENAI_ENDPOINT:
                # Use OpenAI-compatible endpoint (Ollama 0.1.0+)
                endpoint = f"{OLLAMA_URL}/v1/chat/completions"
                payload = {
                    "model": request.model,
                    "messages": messages,
                    "stream": False
                }
            else:
                # Use native Ollama endpoint
                endpoint = f"{OLLAMA_URL}/api/chat"
                payload = {
                    "model": request.model,
                    "messages": messages,
                    "stream": False
                }
            
            response = await client.post(endpoint, json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Extract response based on endpoint format
            if USE_OPENAI_ENDPOINT:
                # OpenAI format: choices[0].message.content
                content = data["choices"][0]["message"]["content"]
            else:
                # Native Ollama format: message.content
                content = data["message"]["content"]
            
            return ChatResponse(
                response=content,
                model=request.model
            )
            
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Ollama request failed: {str(e)}"
            )

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "provider": "ollama"}
```

#### 5. Add to Docker Compose (Optional Proxy)

Add to `app/docker-compose.yml` if using custom proxy:

```yaml
services:
  llm-proxy:
    build: ../llm-proxy
    environment:
      - OLLAMA_URL=http://host.docker.internal:11434
      - DEFAULT_MODEL=llama3.2
      - USE_OPENAI_ENDPOINT=true  # Use Ollama's native OpenAI-compatible endpoint
    labels:
      caddy: ${APP_DOMAIN}
      caddy.route: /llm/*
      caddy.route.0_reverse_proxy: "{{upstreams 8000}}"
    networks:
      - caddy
```

**Note**: For direct integration without a proxy, you can configure the frontend to call Ollama's OpenAI-compatible endpoint (`http://ollama:11434/v1/chat/completions`) directly, provided CORS is handled appropriately.

#### 6. Frontend Integration

In `app/ui/js/chat.js`:

```javascript
async function sendMessage(message, history) {
  const response = await fetch('/llm/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message,
      conversationHistory: history,
      model: settings.get('chat.model', 'llama3.2')
    })
  });
  
  if (!response.ok) {
    throw new Error('Chat request failed');
  }
  
  const data = await response.json();
  return data.response;
}
```

#### 7. Settings UI

Add to Settings panel:

```javascript
// In settings.js
{
  section: 'Chat / LLM',
  settings: [
    {
      key: 'chat.model',
      label: 'Model',
      type: 'select',
      options: ['llama3.2', 'llama3.2:1b', 'llama3.3:70b', 'gemma3'],
      default: 'llama3.2'
    },
    {
      key: 'chat.ollamaUrl',
      label: 'Ollama URL',
      type: 'text',
      default: 'http://localhost:11434',
      hint: 'Only change if Ollama is on a different machine'
    }
  ]
}
```

### Testing Configuration

```bash
# 1. Start Ollama
ollama serve

# 2. Start Yap services
make app-up

# 3. Test proxy endpoint
curl http://localhost:8080/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello!",
    "model": "llama3.2"
  }'

# Expected response:
# {
#   "response": "Hello! How can I help you today?",
#   "model": "llama3.2"
# }
```

### User Documentation

Add to README.md:

```markdown
### Chat Tab

The Chat tab enables conversational interaction with local LLM models via Ollama.

**Prerequisites**:
1. Install Ollama: https://ollama.com
2. Pull a model: `ollama pull llama3.2`
3. Start Ollama: `ollama serve` (runs automatically on macOS/Windows)

**Features**:
- Record audio → transcribe → send to LLM
- Text input for direct chat
- Conversation history preserved
- Export conversations to GitLab/GitHub
- Multiple model support

**Recommended Models**:
- `llama3.2` - Fast, good quality (2GB)
- `llama3.2:1b` - Faster, lower quality (1.3GB)
- `llama3.3:70b` - Best quality, requires 64GB+ RAM (43GB)
```

---

## Implementation Roadmap

### Phase 1: MVP (Ollama Only)
1. Create LLM proxy service (`llm-proxy/app.py`)
2. Add Docker service definition
3. Build chat UI tab (`app/ui/js/chat.js`)
4. Integrate ASR recording component
5. Add basic settings (model selection)
6. Implement conversation export
7. Write integration tests
8. Document setup process

**Timeline**: 2-3 weeks
**Complexity**: Medium
**Risk**: Low (proven technology)

### Phase 2: Multi-Provider Support (LiteLLM)
1. Deploy LiteLLM proxy
2. Update proxy service to support multiple providers
3. Add provider selection in settings
4. Support API key management for cloud providers
5. Add provider health checks

**Timeline**: 1-2 weeks (after MVP)
**Complexity**: Medium
**Risk**: Low

### Phase 3: Advanced Features (OpenWebUI Integration)
1. Optional OpenWebUI deployment for advanced users
2. RAG support for document-aware chat
3. Web search integration
4. Multi-user support with authentication

**Timeline**: 3-4 weeks (future enhancement)
**Complexity**: High
**Risk**: Medium (architectural changes)

---

## Security Considerations

### For Ollama (MVP)

1. **Network Exposure**:
   - Ollama runs on localhost by default (✅ secure)
   - Don't expose Ollama port (11434) to internet
   - Proxy service should validate all inputs

2. **Model Safety**:
   - Use official Ollama models only
   - Review custom Modelfiles before importing
   - Be aware models may generate harmful content

3. **Resource Limits**:
   - Set max conversation length to prevent memory exhaustion
   - Implement request timeouts (60-120s)
   - Rate limit chat requests if needed

4. **Data Privacy**:
   - All data stays local (✅ private)
   - No telemetry sent to external services
   - Conversation history in browser localStorage (encrypt if needed)

### For Future Cloud Providers

1. **API Key Storage**:
   - Store keys server-side, not in browser
   - Use environment variables or secrets manager
   - Rotate keys regularly

2. **Cost Controls**:
   - Set usage limits per user/day
   - Monitor token consumption
   - Implement fallback to free providers

3. **Data Handling**:
   - Warn users when using cloud providers
   - Provide opt-in consent
   - Document data retention policies of each provider

---

## FAQ

### Why not use OpenWebUI directly instead of Ollama?

OpenWebUI is a full platform with its own UI, user management, and database. For Yap:
- We want a simple API backend, not a complete platform
- Yap already has its own UI/UX design
- Ollama is lighter weight and easier to deploy
- OpenWebUI can be added later as an optional advanced mode

### Can users switch between Ollama and OpenAI?

Not in MVP, but Phase 2 (LiteLLM) will enable this with a simple model prefix:
- `ollama/llama3.2` → local Ollama
- `gpt-4o-mini` → OpenAI (requires API key)
- `anthropic/claude-3` → Anthropic (requires API key)

### What about conversation memory/context?

MVP will handle this client-side:
- Browser stores conversation history
- Each request includes previous messages
- Ollama handles context window (typically 4K-128K tokens)

Phase 2 could add server-side conversation storage.

### How do we handle long conversations?

1. **Truncation**: Keep last N messages (e.g., 20)
2. **Summarization**: Use Ollama to summarize old messages
3. **Context limits**: Warn user when approaching model's context window

### What if Ollama isn't running?

Proxy service will return clear error:
```json
{
  "error": "Cannot connect to Ollama. Please start Ollama: ollama serve"
}
```

Frontend displays user-friendly toast with setup link.

---

## Conclusion

**Ollama is the clear choice for Yap's MVP chat feature** due to its simplicity, privacy, existing integration patterns, and alignment with Yap's local-first philosophy. 

### Key Advantages

1. **Native OpenAI Compatibility**: Ollama 0.1.0+ exposes a native OpenAI-compatible `/v1/chat/completions` endpoint, eliminating the need for a compatibility proxy layer.

2. **Flexible Integration Options**:
   - **Direct Integration**: Use Ollama's OpenAI-compatible endpoint directly from the frontend
   - **Optional Proxy**: Add a thin proxy service for CORS handling, error formatting, and future multi-provider support

3. **Simple Architecture**: The recommended architecture uses either:
   - Direct Ollama integration via `/v1/chat/completions` (simplest)
   - Optional thin proxy service for enhanced error handling and CORS (more control)

Future phases can add multi-provider support (LiteLLM) and advanced features (OpenWebUI) without requiring significant architectural changes, making this a future-proof foundation.

### Next Steps

1. Create GitHub issue for LLM proxy service implementation
2. Define API contract for chat endpoints
3. Design chat UI wireframes following Yap's dark terminal theme
4. Set up development environment with Ollama
5. Begin MVP implementation following this research

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-14  
**Author**: Copilot Agent  
**Review Status**: Pending stakeholder approval
