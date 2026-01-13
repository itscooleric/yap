name: yap-new-service
description: Guide for creating new backend services in Yap

instructions: |
  You are helping create a new backend service for Yap.

  ## Service Template

  ### File Structure
  ```
  services/yap-{service-name}/
  ├── app.py              # FastAPI application
  ├── Dockerfile          # Container definition
  ├── requirements.txt    # Python dependencies
  └── README.md           # Service documentation
  ```

  ### Required Endpoints
  1. `GET /health` - Returns `{ "status": "ok", "service": "{name}", ... }`
  2. Document all endpoints in README.md

  ### app.py Template
  ```python
  """
  YAP {ServiceName} Service
  {Description}
  """
  import os
  from fastapi import FastAPI
  from fastapi.middleware.cors import CORSMiddleware

  CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:*,https://localhost:*").split(",")

  app = FastAPI(
      title="YAP {ServiceName}",
      description="{Description}",
      version="1.0.0"
  )

  app.add_middleware(
      CORSMiddleware,
      allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )

  @app.get("/health")
  async def health():
      return {"status": "ok", "service": "{service-name}"}
  ```

  ### Docker Integration
  - Add service to `app/docker-compose.yml` with Caddy labels
  - Route pattern: `/api/{service}/*` → `yap-{service}:{port}`
  - Include in both production and local mode

  ### Testing
  - Create `tests/test_{service}.py`
  - Use `{SERVICE}_BASE_URL` env var for integration tests
  - Mark integration tests with `@pytest.mark.integration`
