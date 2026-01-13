# Yap - Copilot Instructions

## Project Overview

Yap is a **local LAN speech toolkit** combining ASR (speech-to-text via OpenAI Whisper) and TTS (text-to-speech via Piper TTS) in a unified tabbed web interface. Designed for private network use with a terminal-style dark UI.

## Architecture

**Single-domain microservices** architecture:
- **UI** (nginx/static): Unified frontend at `/` - [app/ui/](app/ui/)
- **ASR Backend** (Whisper): Routed at `/asr/*` - uses `onerahmet/openai-whisper-asr-webservice` image
- **TTS Backend** (Flask/Piper): Routed at `/tts/*` - [tts/app.py](tts/app.py)
- **Metrics** (FastAPI/SQLite): Routed at `/api/metrics/*` - [services/yap-metrics/app.py](services/yap-metrics/app.py)
- **Exporter** (FastAPI): Optional service for GitLab/GitHub/SFTP exports - [exporter/app.py](exporter/app.py)

Routing is handled via Caddy labels (production) or nginx proxy (local mode). See [app/docker-compose.yml](app/docker-compose.yml) for label configuration.

## Development Workflow

### Running Locally
```bash
# Production mode (requires Caddy proxy)
make app-up          # Start at https://APP_DOMAIN/

# Local mode (no Caddy, direct ports)
make app-local       # Start at http://localhost:8080
                     # ASR debug: http://localhost:9000
                     # TTS debug: http://localhost:5000
```

### Testing
```bash
pip install -r tests/requirements.txt

# Unit tests (no services needed)
pytest tests/test_export.py tests/test_settings.py tests/test_read_along.py -v

# TTS integration tests
TTS_BASE_URL=http://localhost:8080/tts pytest tests/test_tts.py -v

# Metrics integration tests
METRICS_BASE_URL=http://localhost:8091 pytest tests/test_metrics.py -v

# Mark integration tests with @pytest.mark.integration
```

## Code Patterns

### Frontend JavaScript (Vanilla ES6 Modules)
- Located in [app/ui/js/](app/ui/js/) - no build step, native ES modules
- Each tab is a module: `asr.js`, `tts.js`, `data.js`
- `main.js` is the tab router and bootstrap
- Settings use `util.storage.get/set()` wrapper around localStorage
- Pattern for exposing module to window:
```javascript
export const moduleName = {
  init() { /* DOM setup */ },
  someMethod() { /* ... */ }
};
window.moduleName = moduleName;
```

### Python Services (Flask/FastAPI)
- **TTS** ([tts/app.py](tts/app.py)): Flask app, Piper voice caching in `_voice_cache`
- **Metrics** ([services/yap-metrics/app.py](services/yap-metrics/app.py)): FastAPI, SQLite storage, context manager for DB
- **Exporter** ([exporter/app.py](exporter/app.py)): FastAPI, Pydantic models for requests
- All services have `/health` endpoints returning JSON status
- CORS configured via `CORS_ORIGINS` env var (defaults to localhost)

### Configuration Pattern
- Environment variables defined in `.env` files (see `app/.env.example`)
- Frontend config overrides in [app/ui/config.js](app/ui/config.js)
- Features like Apps are opt-in: `enableApps: true` in config.js

## Key Files to Understand

| Purpose | File |
|---------|------|
| Main HTML shell | [app/ui/index.html](app/ui/index.html) |
| ASR recording/transcription | [app/ui/js/asr.js](app/ui/js/asr.js) |
| TTS synthesis/read-along | [app/ui/js/tts.js](app/ui/js/tts.js) |
| Docker service definitions | [app/docker-compose.yml](app/docker-compose.yml) |
| Caddy routing labels | Lines 24-62 in docker-compose.yml |
| TTS Flask API | [tts/app.py](tts/app.py) |
| Metrics FastAPI | [services/yap-metrics/app.py](services/yap-metrics/app.py) |

## Conventions

- **No build system**: Frontend is vanilla JS/CSS served directly by nginx
- **Settings persistence**: Use `util.storage.get/set()` with dot-notation keys like `settings.asr.autoTranscribe`
- **Clip state machine**: ASR clips have status: `recorded` → `queued` → `working` → `transcribed` | `error`
- **Health checks**: All backends expose `/health` returning `{ "status": "ok", ... }`
- **Toast notifications**: Use `showGlobalToast(message, type)` from main.js

## Testing Notes

- Unit tests mock external services; integration tests require running containers
- Use `@pytest.mark.integration` decorator for tests needing live services
- TTS tests accept `TTS_BASE_URL` env var to point at proxy or direct service
- Test files follow `test_*.py` naming in [tests/](tests/) directory
