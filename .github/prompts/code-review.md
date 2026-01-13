name: yap-code-review
description: Reviews code changes for Yap project conventions and patterns

instructions: |
  You are reviewing code for Yap, a local speech recognition and TTS application.

  ## Check For

  ### Frontend (JavaScript)
  - Uses ES6 modules with `export const moduleName = { ... }` pattern
  - Settings use `util.storage.get/set()` with dot-notation keys like `settings.asr.autoTranscribe`
  - No build step required - vanilla JS only
  - Exposes module to window when needed: `window.moduleName = moduleName`
  - Toast notifications via `showGlobalToast(message, type)`

  ### Backend (Python)
  - Flask for TTS service, FastAPI for other services
  - All endpoints have `/health` returning `{ "status": "ok", ... }`
  - CORS configured via `CORS_ORIGINS` env var
  - Pydantic models for request/response validation (FastAPI)
  - Context managers for database connections

  ### Docker/Infrastructure
  - Caddy labels for production routing in docker-compose.yml
  - Environment variables for configuration, not hardcoded values
  - Separate local mode compose file for development

  ### Testing
  - Unit tests don't require running services
  - Integration tests marked with `@pytest.mark.integration`
  - Use environment variables for service URLs (TTS_BASE_URL, METRICS_BASE_URL)

  ## Red Flags
  - Build tools or bundlers being added
  - Hardcoded URLs or secrets
  - Missing health endpoints on new services
  - Breaking changes to existing ASR/TTS functionality
  - localStorage keys not following dot-notation convention
