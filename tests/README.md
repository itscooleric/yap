# Yap Tests

This directory contains automated tests for the Yap application.

## Test Files

| File | Description |
|------|-------------|
| `test_tts.py` | TTS service API tests (requires running TTS service) |
| `test_metrics.py` | Metrics service API tests (requires running metrics service) |
| `test_export.py` | Export functionality unit tests |
| `test_settings.py` | Settings functionality unit tests |
| `test_read_along.py` | TTS read-along functionality unit tests |

## Running Tests

### Prerequisites

Install test dependencies:

```bash
pip install -r tests/requirements.txt
```

### Unit Tests (No Services Required)

These tests don't require any running services:

```bash
# Run all unit tests
pytest tests/test_export.py tests/test_settings.py tests/test_read_along.py -v

# Run specific test file
pytest tests/test_settings.py -v
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

### Metrics Tests

The metrics tests verify that the metrics service is working correctly.

**Running against local metrics service:**

```bash
# Start the metrics service
cd services/yap-metrics
docker compose up -d

# Run the tests
METRICS_BASE_URL=http://localhost:8091 pytest tests/test_metrics.py -v
```

### All Tests

To run all tests (requires all services running):

```bash
pytest tests/ -v
```

### Test Coverage

#### TTS Tests
- **Health checks**: Verify `/health` endpoint returns proper status
- **Voice listing**: Verify `/voices` endpoint returns available voices
- **Synthesis (POST)**: Test text-to-speech generation with POST requests
- **Synthesis (GET)**: Test text-to-speech generation with GET requests
- **Error handling**: Test 400 (no text) and 404 (invalid voice) responses
- **Method validation**: Verify 405 errors don't occur on valid endpoints

#### Metrics Tests
- **Health checks**: Verify `/health` endpoint returns proper status
- **Configuration**: Verify `/api/metrics/config` returns settings
- **Event recording**: Test recording ASR/TTS events
- **Summary**: Test summary statistics for different time ranges
- **History**: Test paginated history with filtering
- **Export**: Test JSON export of all events
- **Clear**: Test clearing history and text-only clearing

#### Export Tests
- **Payload formats**: Verify transcript_only and full_session payloads
- **File path variables**: Test {year}, {month}, {timestamp} substitution
- **Profile validation**: Test webhook and GitLab profile validation
- **CORS detection**: Test CORS error detection logic

#### Settings Tests
- **ASR defaults**: Verify default values for ASR settings
- **TTS defaults**: Verify default values for TTS settings
- **Metrics defaults**: Verify metrics are enabled by default
- **Persistence**: Test JSON serialization and merging with defaults
- **Validation**: Test value validation for settings

#### Read-Along Tests
- **Text chunking**: Test paragraph and line splitting
- **Chunk limits**: Test max chunks and max chars validation
- **Playback state**: Test start/pause/resume/stop state transitions
- **Highlighting**: Test chunk highlighting during playback
- **Error handling**: Test graceful error handling

### Continuous Integration

These tests can be integrated into CI pipelines:

```yaml
# Example GitHub Actions workflow
- name: Install test dependencies
  run: pip install -r tests/requirements.txt

# Run unit tests (no services needed)
- name: Run unit tests
  run: pytest tests/test_export.py tests/test_settings.py tests/test_read_along.py -v

# Integration tests (requires services)
- name: Start services
  run: |
    cd tts && docker compose up -d
    cd ../services/yap-metrics && docker compose up -d
    sleep 10

- name: Run integration tests
  run: pytest tests/test_tts.py tests/test_metrics.py -v

- name: Stop services
  run: |
    cd tts && docker compose down
    cd ../services/yap-metrics && docker compose down
```

## Test Coverage

The test suite includes:

### Unit Tests
- **test_tts.py**: TTS service endpoint tests
- **test_exporter.py**: Export service (GitLab/GitHub/SFTP) tests
- **test_settings.py**: Settings and configuration tests
- **test_read_along.py**: TTS read-along functionality tests

### Integration Tests
- **test_integration.py**: End-to-end workflow tests

### Running Specific Test Groups

**Run only unit tests (no services required):**
```bash
pytest tests/test_settings.py tests/test_read_along.py -v
```

**Run service tests (requires TTS service):**
```bash
# Start TTS service first
cd tts && docker compose up -d

# Run tests
pytest tests/test_tts.py -v
```

**Run exporter tests (requires exporter service):**
```bash
# Start exporter service first
cd exporter && docker compose up -d

# Run tests
EXPORTER_BASE_URL=http://localhost:8090 pytest tests/test_exporter.py -v
```

**Run integration tests (requires both services):**
```bash
# Start services
cd tts && docker compose up -d
cd exporter && docker compose up -d

# Run tests
pytest tests/test_integration.py -v -m integration
```

## Writing New Tests

When adding new tests:

1. Follow the existing test structure (use test classes)
2. Add descriptive docstrings
3. Use `pytest.skip()` when services are not available
4. Test both happy paths and error cases
5. Verify HTTP status codes and response formats
6. Keep unit tests separate from integration tests
