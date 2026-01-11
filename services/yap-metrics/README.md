# YAP Metrics Service

Local-only metrics and history storage for YAP. All data is stored on the server in SQLite and never transmitted externally.

## Features

- Track ASR and TTS usage events
- Store duration, character counts, and status
- Optional text content storage (disabled by default)
- Automatic cleanup based on retention policy
- Export history as JSON

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `METRICS_ENABLED` | `false` | Enable/disable metrics collection |
| `METRICS_STORE_TEXT` | `false` | Store text content (transcripts, TTS input) |
| `METRICS_RETENTION_DAYS` | `30` | Days to retain events |
| `METRICS_MAX_EVENTS` | `5000` | Maximum events to keep |
| `METRICS_DB_PATH` | `/data/metrics.sqlite` | Database file path |
| `CORS_ORIGINS` | `http://localhost:*` | Allowed CORS origins |

## API Endpoints

### Health Check
```
GET /health
```
Returns service status and configuration.

### Get Configuration
```
GET /api/metrics/config
```
Returns current metrics configuration.

### Record Event
```
POST /api/metrics/event
Content-Type: application/json

{
  "event_type": "asr_transcribe",
  "duration_seconds": 12.5,
  "input_chars": 0,
  "output_chars": 150,
  "status": "success",
  "text_content": "optional transcript",
  "metadata": {"model": "whisper-tiny"}
}
```

Event types:
- `asr_record` - Audio recording
- `asr_transcribe` - Transcription
- `tts_synthesize` - TTS synthesis
- `tts_play` - TTS playback

### Get Summary
```
GET /api/metrics/summary?range=7d
```
Range options: `today`, `7d`, `30d`, `all`

### Get History
```
GET /api/metrics/history?limit=50&offset=0&event_type=asr_transcribe
```

### Clear History
```
DELETE /api/metrics/history
DELETE /api/metrics/history?clear_text_only=true
```

### Export History
```
GET /api/metrics/export
```
Returns all events as JSON.

## Docker Usage

```yaml
services:
  yap-metrics:
    build: ./services/yap-metrics
    container_name: yap-metrics
    restart: unless-stopped
    volumes:
      - ./data/metrics:/data
    environment:
      - METRICS_ENABLED=true
      - METRICS_STORE_TEXT=false
      - METRICS_RETENTION_DAYS=30
    ports:
      - "8091:8091"
```

## Privacy

- **Metrics are disabled by default** - opt-in only
- **Text storage is disabled by default** - separate opt-in
- **Data never leaves the server** - no external API calls
- **Clearable from UI** - user has full control
