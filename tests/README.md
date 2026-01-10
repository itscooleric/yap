# Yap Tests

This directory contains automated tests for the Yap application.

## Running Tests

### Prerequisites

Install test dependencies:

```bash
pip install -r tests/requirements.txt
```

### TTS Tests

The TTS tests verify that the Text-to-Speech service is working correctly.

**Running against local TTS service:**

```bash
# Start the TTS service locally (with at least one voice model)
cd tts
docker compose up -d

# Run the tests
pytest tests/test_tts.py -v
```

**Running against unified app (local mode):**

```bash
# Start the unified app in local mode
cd app
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d

# Run tests against the proxied TTS endpoint
TTS_BASE_URL=http://localhost:8080/tts pytest tests/test_tts.py -v
```

**Running against unified app (Caddy mode):**

```bash
# Start the unified app with Caddy
cd app
docker compose up -d

# Run tests (replace APP_DOMAIN with your configured domain)
TTS_BASE_URL=https://app.localhost/tts pytest tests/test_tts.py -v -k "not 405"
```

### Test Coverage

- **Health checks**: Verify `/health` endpoint returns proper status
- **Voice listing**: Verify `/voices` endpoint returns available voices
- **Synthesis (POST)**: Test text-to-speech generation with POST requests
- **Synthesis (GET)**: Test text-to-speech generation with GET requests
- **Error handling**: Test 400 (no text) and 404 (invalid voice) responses
- **Method validation**: Verify 405 errors don't occur on valid endpoints

### Continuous Integration

These tests can be integrated into CI pipelines:

```yaml
# Example GitHub Actions workflow
- name: Install test dependencies
  run: pip install -r tests/requirements.txt

- name: Start TTS service
  run: |
    cd tts
    docker compose up -d
    sleep 10  # Wait for service to be ready

- name: Run TTS tests
  run: pytest tests/test_tts.py -v

- name: Stop services
  run: cd tts && docker compose down
```

## Writing New Tests

When adding new tests:

1. Follow the existing test structure (use test classes)
2. Add descriptive docstrings
3. Use `pytest.skip()` when voices are not available
4. Test both happy paths and error cases
5. Verify HTTP status codes and response formats
