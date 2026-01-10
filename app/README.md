# Yap Unified Application

This folder contains the unified Yap web application that combines ASR (speech-to-text) and TTS (text-to-speech) into a single tabbed interface served from one domain.

## Architecture

```
app/
├── docker-compose.yml        # Production config with Caddy labels
├── docker-compose.local.yml  # Local development override
├── .env.example              # Environment template
├── README.md                 # This file
└── ui/                       # Static web UI
    ├── index.html            # Main HTML shell with tabs
    ├── favicon.svg           # Yak logo
    ├── config.js             # Optional config overrides
    ├── nginx.conf            # Nginx config for local mode
    ├── css/
    │   └── styles.css        # Shared styles
    └── js/
        ├── main.js           # Tab router and bootstrap
        ├── asr.js            # ASR tab logic
        ├── tts.js            # TTS tab logic
        ├── addons.js         # Apps window manager
        └── util.js           # Utility functions
```

## Quick Start

### Prerequisites

- Docker with Compose V2
- NVIDIA GPU with CUDA drivers (for ASR)
- For production: [caddy-docker-proxy](https://github.com/lucaslorentz/caddy-docker-proxy) running

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

Key variables:
| Variable | Description | Default |
|----------|-------------|---------|
| `APP_DOMAIN` | Domain for the unified app | `app.localhost` |
| `CADDY_NETWORK` | Docker network for Caddy | `caddy` |
| `WHISPER_MODELS_PATH` | Host path for Whisper models | `/srv/whisper-asr/models` |
| `PIPER_MODELS_PATH` | Host path for Piper voices | `/srv/piper/models` |
| `ASR_MODEL` | Whisper model size | `tiny.en` |

### 2. Create Model Directories

```bash
sudo mkdir -p /srv/whisper-asr/models
sudo mkdir -p /srv/piper/models
```

### 3. Download TTS Voice Models

```bash
cd /srv/piper/models

# Download Cori voice (recommended)
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/high/en_GB-cori-high.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/high/en_GB-cori-high.onnx.json

sudo chmod 644 *.onnx *.json
```

### 4. Start Services

**Production Mode (with Caddy):**

```bash
# Ensure Caddy network exists
docker network create caddy

# Start the unified app
cd app
docker compose up -d
```

Access at: `https://app.localhost` (or your configured `APP_DOMAIN`)

**Local Mode (without Caddy):**

```bash
cd app
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
```

Access at: `http://localhost:8080`

Direct backend ports (for debugging):
- ASR API: `http://localhost:9000`
- TTS API: `http://localhost:5000`

## URL Routing

The unified app routes API requests through the same domain:

| Path | Backend | Description |
|------|---------|-------------|
| `/` | nginx | Static UI |
| `/asr` | whisper-asr:9000 | Transcription endpoint |
| `/asr/*` | whisper-asr:9000 | ASR API |
| `/asr-docs` | whisper-asr:9000/docs | ASR API documentation |
| `/asr-openapi.json` | whisper-asr:9000/openapi.json | ASR OpenAPI spec |
| `/tts/*` | piper-tts:5000 | TTS API (prefix stripped) |
| `/tts/voices` | piper-tts:5000/voices | List voices |
| `/tts/health` | piper-tts:5000/health | Health check |
| `/tts/synthesize/*` | piper-tts:5000/synthesize/* | Synthesis |

## Features

### Tabs (In-Page Navigation)
- ASR and TTS are tabs within a single page - no page reloads
- Optional hash-based deep links (#asr, #tts) for bookmarking
- State preserved when switching tabs
- Recording indicator shows in header when recording is active

### ASR Tab
- Multi-clip recording with waveform visualization
- Per-clip transcription with status tracking
- Transcript copy modes: clean (no separators) or with clip markers
- Per-clip copy/download buttons
- Configurable transcript settings (separators, spacing, cleanup)
- Keyboard shortcut: Space to start/stop recording

### TTS Tab
- Text input or file upload
- Voice selection with preference persistence
- Adjustable speaking rate
- Audio playback with Media Session API support
- Download generated audio
- Keyboard shortcut: Ctrl+Enter to synthesize

### Apps (YAP Apps)
- Non-modal draggable/resizable windows centered on screen
- Cascade offset for multiple windows
- Enable/disable apps via toggle switches in the Apps panel
- Built-in apps:
  - Ollama Summarize: Summarize transcripts using local LLM
  - Send (Webhook): Send transcript or conversation to webhooks
- External apps loaded from manifest URL (iframe-based)

### App Settings (Gear Icon)
- Settings gear icon appears only when enabled apps have configurable settings
- Each app contributes its own settings schema (app-scoped, not global)
- Ollama app settings: URL (default localhost:11434), Model (default llama3), Allow non-localhost URLs
- Settings persist in localStorage (no file edits required)

## Troubleshooting

### Backend Unavailable

If a tab shows "backend unavailable":

1. Check container status:
   ```bash
   docker compose ps
   docker compose logs whisper-asr
   docker compose logs piper-tts
   ```

2. Verify network connectivity:
   ```bash
   # From inside the UI container
   docker exec yap-app-ui wget -qO- http://whisper-asr:9000/docs
   docker exec yap-app-ui wget -qO- http://piper-tts:5000/health
   ```

### No Voices Available

See the TTS troubleshooting section in the main README. Ensure:
- Voice model files (.onnx and .onnx.json) exist in `PIPER_MODELS_PATH`
- Files have correct permissions (readable by container)
- Container is restarted after adding models

### GPU Not Detected

Ensure NVIDIA Container Toolkit is installed:
```bash
nvidia-smi
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

## Development

The UI is built with plain ES modules - no build step required. Edit files in `ui/` and refresh the browser.

To test changes:
```bash
# Restart UI container to pick up nginx.conf changes
docker compose restart yap-app-ui

# Watch logs
docker compose logs -f
```
