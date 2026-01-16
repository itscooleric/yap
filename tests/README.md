# Yap Tests

This directory contains automated tests for the Yap application.

## Test Files

| File | Description |
|------|-------------|
| `test_tts.py` | TTS service API tests (requires running TTS service) |
| `test_metrics.py` | Metrics service API tests (requires running metrics service) |
| `test_llm_proxy.py` | LLM proxy service tests with mock provider |
| `test_chat_integration.py` | Chat tab integration tests (mocked ASR, LLM, export) |
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
pytest tests/test_export.py tests/test_settings.py tests/test_read_along.py tests/test_chat_integration.py -v

# Run specific test file
pytest tests/test_settings.py -v

# Run chat integration tests
pytest tests/test_chat_integration.py -v

# Run LLM proxy tests with mock provider
pytest tests/test_llm_proxy.py::TestLLMProxyWithMockProvider -v
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

### LLM Proxy Tests

The LLM proxy tests verify the proxy service functionality using a mock provider.

**Running unit tests with mock provider (no service required):**

```bash
# Run mock provider tests (uses in-memory HTTP server)
pytest tests/test_llm_proxy.py::TestLLMProxyWithMockProvider -v
```

**Running integration tests (requires running LLM proxy service):**

```bash
# Start the LLM proxy service (when implemented)
# cd services/llm-proxy
# docker compose up -d

# Run integration tests
LLM_BASE_URL=http://localhost:8092 pytest tests/test_llm_proxy.py::TestLLMProxyIntegration -v
```

### Chat Tab Integration Tests

The chat tab tests verify the complete workflow including ASR, LLM, and export.

**Running chat workflow tests (no services required):**

```bash
# Run all chat integration tests (uses mocks)
pytest tests/test_chat_integration.py -v

# Run specific test classes
pytest tests/test_chat_integration.py::TestChatWorkflow -v
pytest tests/test_chat_integration.py::TestChatErrorHandling -v
pytest tests/test_chat_integration.py::TestChatExport -v
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

#### LLM Proxy Tests
- **Health checks**: Verify `/health` endpoint returns proper status
- **Chat endpoint**: Test `/chat` endpoint with valid request structure
- **Request validation**: Test validation of messages, temperature, max_tokens
- **Error handling**: Test handling of malformed JSON, empty requests
- **Provider configuration**: Test behavior with/without configured provider
- **Mock provider tests**: Test successful responses, errors, timeouts, invalid JSON
- **Streaming rejection**: Test that streaming requests are properly rejected

#### Chat Integration Tests
- **Recording workflow**: Test record → transcribe → send to LLM workflow
- **Text input workflow**: Test direct text input without ASR
- **Conversation history**: Test multi-turn conversation management
- **Error handling**: Test ASR failures, LLM failures, network errors
- **Export functionality**: Test markdown/JSON export of conversations
- **Export profiles**: Test GitLab, GitHub, SFTP export integration
- **UI state management**: Test recording, waiting, message received states
- **Settings management**: Test LLM provider configuration and UI preferences
- **Metrics integration**: Test chat event recording

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

## Manual Testing Checklist

In addition to automated tests, perform manual testing for the following scenarios:

### ASR (Speech Recognition) Tab
- [ ] **Recording**: Start/stop recording, verify waveform visualization
- [ ] **Audio upload**: Upload audio file and transcribe
- [ ] **Transcription**: Verify transcript accuracy and formatting
- [ ] **Multiple clips**: Record multiple clips and transcribe all
- [ ] **Copy/export**: Test copy to clipboard and export functionality
- [ ] **Clear**: Test clearing clips and transcript
- [ ] **Settings**: Verify ASR settings (auto-transcribe, separators, etc.)
- [ ] **Error handling**: Test with no audio, corrupted files, network issues

### TTS (Text-to-Speech) Tab
- [ ] **Text input**: Enter plain text and synthesize
- [ ] **Markdown preview**: Toggle markdown view and verify rendering
- [ ] **File upload**: Upload .txt or .md file
- [ ] **Voice selection**: Test different voice models
- [ ] **Speaking rate**: Adjust rate slider and verify playback speed
- [ ] **Audio playback**: Play synthesized audio
- [ ] **Read-along**: Test read-along mode with chunking
- [ ] **Download**: Download generated audio as .wav
- [ ] **Settings**: Verify TTS settings (chunk mode, max chunks, etc.)
- [ ] **Error handling**: Test with empty text, invalid file, unavailable voice

### Chat Tab (When Implemented)
- [ ] **Audio recording**: Record voice message for chat
- [ ] **Transcription**: Verify audio is transcribed correctly
- [ ] **Text input**: Type message directly without recording
- [ ] **Send to LLM**: Send message and receive response
- [ ] **Conversation flow**: Maintain context across multiple messages
- [ ] **Message display**: Verify user and assistant messages render correctly
- [ ] **Audio playback**: Play back user's voice messages in chat
- [ ] **Markdown rendering**: Verify markdown in assistant responses
- [ ] **Export conversation**: Export chat as markdown/JSON
- [ ] **Clear conversation**: Clear all messages
- [ ] **LLM configuration**: Configure provider URL, model, API key
- [ ] **Error handling**: Test with:
  - [ ] No LLM provider configured
  - [ ] Invalid provider URL
  - [ ] Network timeout
  - [ ] LLM server error (500)
  - [ ] Invalid API key
  - [ ] Recording failure
  - [ ] Transcription failure
- [ ] **Settings**: Verify chat settings (default input mode, auto-send, etc.)
- [ ] **Metrics**: Verify chat events are recorded in metrics

### Data/Metrics Tab
- [ ] **Metrics display**: View summary statistics
- [ ] **Time ranges**: Switch between today/7d/30d/all
- [ ] **Auto-refresh**: Enable auto-refresh and verify updates
- [ ] **Event history**: View paginated event list
- [ ] **Export history**: Export metrics as JSON
- [ ] **Clear history**: Clear event history
- [ ] **Enable/disable**: Toggle metrics on/off

### Export Functionality
- [ ] **GitLab export**: Configure and test GitLab profile
- [ ] **GitHub export**: Configure and test GitHub profile
- [ ] **SFTP export**: Configure and test SFTP profile
- [ ] **Webhook export**: Configure and test webhook profile
- [ ] **Path variables**: Test {year}, {month}, {timestamp} substitution
- [ ] **Error handling**: Test with invalid credentials, network issues

### Settings Panel
- [ ] **ASR settings**: Modify and save ASR preferences
- [ ] **TTS settings**: Modify and save TTS preferences
- [ ] **Chat settings**: Modify and save chat/LLM preferences
- [ ] **Metrics settings**: Toggle metrics and configure retention
- [ ] **Persistence**: Verify settings persist after page reload
- [ ] **Reset**: Test resetting to defaults

### Responsive/Mobile Testing
- [ ] **Mobile layout**: Test on <600px viewport
- [ ] **Tablet layout**: Test on 600-1024px viewport
- [ ] **Desktop layout**: Test on >1024px viewport
- [ ] **Floating action buttons**: Test mobile FAB cluster
- [ ] **Touch targets**: Verify minimum 44x44px tap targets
- [ ] **Orientation**: Test portrait and landscape modes

### Cross-Browser Testing
- [ ] **Chrome/Chromium**: Test all features
- [ ] **Firefox**: Test all features
- [ ] **Safari**: Test all features (especially audio APIs)
- [ ] **Edge**: Test all features

### Accessibility Testing
- [ ] **Keyboard navigation**: Tab through all controls
- [ ] **Screen reader**: Test with NVDA/JAWS/VoiceOver
- [ ] **Focus indicators**: Verify visible focus states
- [ ] **Color contrast**: Verify WCAG AA compliance
- [ ] **ARIA labels**: Verify semantic HTML and ARIA attributes

### Performance Testing
- [ ] **Large transcripts**: Test with 10,000+ character transcripts
- [ ] **Many clips**: Test with 50+ ASR clips
- [ ] **Long audio**: Test with 30+ minute audio files
- [ ] **Long conversations**: Test chat with 100+ messages
- [ ] **Network throttling**: Test with slow 3G connection
- [ ] **Memory usage**: Monitor for memory leaks during extended use

---

**Note**: This checklist should be updated as new features are added or existing features are modified.
