# Yap

```
        /\  __  /\
       /  \/  \/  \
      |   (o)(o)   |
       \    __    /
        \  /__\  /
         --------
```

**yap fast / listen faster**

Self-hosted LAN web tools for speech-to-text (ASR) and text-to-speech (TTS).

---

## Overview

Yap provides two self-hosted web applications:

| Tool | Description | Backend |
|------|-------------|---------|
| **Quick Mic** (ASR) | Record audio and transcribe to text | OpenAI Whisper |
| **Quick TTS** (TTS) | Convert text to natural speech | Piper TTS |

Both tools run as Docker containers with a terminal-style dark UI, designed for private LAN use.

## Features

### Quick Mic (ASR)
- Browser-based audio recording
- Live waveform visualization
- Recording timer
- Whisper-powered transcription
- Copy/download transcript
- Download original audio

### Quick TTS
- Text input or file upload
- Multiple voice selection
- Adjustable speaking rate
- Audio playback and download
- Media Session API support

## Screenshots

*(See `/docs/images/` for screenshot placeholders)*

| Quick Mic | Quick TTS |
|-----------|-----------|
| ![ASR Screenshot](docs/images/asr-recording.png) | ![TTS Screenshot](docs/images/tts-idle.png) |

## Quick Start

Yap supports **two run modes**:
1. **Production mode** (default): Uses Caddy reverse proxy with automatic HTTPS
2. **Local mode**: Direct port access for testing without Caddy

### Prerequisites

- Docker with Compose V2
- NVIDIA GPU with CUDA drivers (for ASR)
- For production mode: [caddy-docker-proxy](https://github.com/lucaslorentz/caddy-docker-proxy)

### Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/itscooleric/quick-yap.git
cd quick-yap
```

#### 2. Configure Environment

Copy the root environment example:

```bash
cp .env.example .env
```

Edit `.env` to customize your setup:

```bash
# ASR Configuration
YAP_ASR_DOMAIN=asr.yourdomain.com
YAP_ASR_MODELS_DIR=/srv/whisper-asr/models
YAP_ASR_MODEL=base

# TTS Configuration  
YAP_TTS_DOMAIN=tts.yourdomain.com
YAP_TTS_MODELS_DIR=/srv/piper/models

# Network (for Caddy mode)
YAP_CADDY_NETWORK=caddy
```

#### 3. Create Model Directories

```bash
sudo mkdir -p $YAP_ASR_MODELS_DIR
sudo mkdir -p $YAP_TTS_MODELS_DIR
```

#### 4. Download TTS Voice Models

The TTS service requires voice models to work. Download at least one:

```bash
cd $YAP_TTS_MODELS_DIR

# Recommended: British English Cori (high quality)
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/high/en_GB-cori-high.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/high/en_GB-cori-high.onnx.json

# Set permissions
sudo chmod 644 *.onnx *.json
```

Or use the Makefile helper:

```bash
make tts-model-cori  # Shows download commands
```

**Note**: TTS will start even without models, but will show a clear warning message. See [Troubleshooting](#troubleshooting) for details.

#### 5. Start Services

**Production Mode (with Caddy):**

```bash
# Create Caddy network (if not exists)
docker network create caddy

# Start ASR
cd asr && docker compose up -d

# Start TTS
cd tts && docker compose up -d --build
```

Or use the Makefile:

```bash
make asr-up
make tts-up
```

Access via configured domains:
- ASR: `https://asr.yourdomain.com`
- TTS: `https://tts.yourdomain.com`

**Local Mode (without Caddy):**

```bash
# ASR on localhost:8080 (API on :9000)
cd asr && docker compose -f docker-compose.yml -f docker-compose.local.yml up -d

# TTS on localhost:8081 (API on :5000)
cd tts && docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Access via localhost:
- ASR: `http://localhost:8080`
- TTS: `http://localhost:8081`

## Configuration

### Environment Variables

Yap uses a hierarchical configuration system:

1. **Root `.env`** (optional) - Sets global defaults using `YAP_*` prefixed variables
2. **Service-specific `.env`** in `asr/` and `tts/` - Can override root values

Root variables (in `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `YAP_ASR_DOMAIN` | ASR domain for Caddy | `asr.example.internal` |
| `YAP_ASR_MODELS_DIR` | Host path for Whisper models | `/srv/whisper-asr/models` |
| `YAP_ASR_MODEL` | Whisper model size | `base` |
| `YAP_ASR_ENGINE` | ASR engine | `openai_whisper` |
| `YAP_TTS_DOMAIN` | TTS domain for Caddy | `tts.example.internal` |
| `YAP_TTS_MODELS_DIR` | Host path for Piper voices | `/srv/piper/models` |
| `YAP_CADDY_NETWORK` | Docker network name | `caddy` |

### Whisper Model Sizes

| Model | Parameters | VRAM | Speed | Quality |
|-------|------------|------|-------|---------|
| tiny | 39M | ~1GB | Fastest | Low |
| base | 74M | ~1GB | Fast | Good |
| small | 244M | ~2GB | Moderate | Better |
| medium | 769M | ~5GB | Slow | High |
| large-v2/v3 | 1550M | ~10GB | Slowest | Highest |

## Repository Structure

```
quick-yap/
├── asr/                    # Speech-to-Text (Quick Mic)
│   ├── docker-compose.yml
│   ├── docker-compose.local.yml
│   ├── .env.example
│   ├── README.md
│   └── ui/
│       ├── index.html
│       └── favicon.svg
├── tts/                    # Text-to-Speech (Quick TTS)
│   ├── docker-compose.yml
│   ├── docker-compose.local.yml
│   ├── Dockerfile
│   ├── app.py
│   ├── .env.example
│   ├── README.md
│   └── ui/
│       ├── index.html
│       └── favicon.svg
├── docs/
│   └── images/
│       └── README.md
├── .env.example           # Root configuration template
├── .gitignore
├── LICENSE
├── Makefile              # Helper commands
└── README.md
```

## Makefile Helpers

Common commands for managing Yap services:

```bash
make help           # Show all available commands

# ASR
make asr-up         # Start ASR services
make asr-down       # Stop ASR services
make asr-logs       # View ASR logs
make asr-restart    # Restart ASR

# TTS
make tts-up         # Start TTS services
make tts-down       # Stop TTS services
make tts-logs       # View TTS logs
make tts-restart    # Restart TTS
make tts-health     # Check TTS health endpoint
make tts-voices     # List available voices
make tts-model-cori # Show commands to download Cori voice
```

## Security Notes

> **Warning**: These tools are designed for private LAN use and have **no authentication** by default.

### Recommendations

1. **Do not expose to the public internet** without authentication
2. If you must expose publicly, add authentication via Caddy:

```caddyfile
asr.yourdomain.com {
    basicauth /* {
        user $2a$14$hashedpassword
    }
    # ... rest of config
}
```

3. Use HTTPS (automatic with Caddy)
4. Consider VPN access for remote use

### What is exposed

- ASR: Audio recordings are sent to your server for transcription
- TTS: Text is sent to your server for synthesis
- No data is sent to external services (all processing is local)

## Troubleshooting

### TTS Issues

**No voices available / TTS won't synthesize**

The TTS backend will start successfully even without voice models, but it will display a prominent warning in the logs. To fix:

1. Check the TTS logs:
   ```bash
   make tts-logs
   # or
   cd tts && docker compose logs -f
   ```

2. If you see "NO VOICES FOUND" warning, download voice models:
   ```bash
   make tts-model-cori  # Shows commands to download
   ```

3. Verify the models are in the correct directory:
   ```bash
   ls -la $YAP_TTS_MODELS_DIR
   # Should show .onnx and .onnx.json files
   ```

4. Test API endpoints (Caddy mode):
   ```bash
   # Check health endpoint
   curl -k https://$YAP_TTS_DOMAIN/health
   # Should return: {"status":"ok","voices_count":1}
   
   # List available voices
   curl -k https://$YAP_TTS_DOMAIN/voices
   # Should return: ["en_GB-cori-high"]
   
   # Check API docs endpoint
   curl -k https://$YAP_TTS_DOMAIN/openapi.json | head
   ```

5. Test API endpoints (Local mode):
   ```bash
   curl http://localhost:5000/health
   curl http://localhost:5000/voices
   curl http://localhost:5000/openapi.json | head
   ```

**Voice files present but not detected**

Each voice model requires BOTH files to work:
- `.onnx` - The neural network model file
- `.onnx.json` - The model configuration file

If voices are empty or not detected:
- Ensure both `.onnx` AND `.onnx.json` files exist for each voice
- Check file permissions: `sudo chmod 644 *.onnx *.json`
- Verify the `PIPER_MODELS_PATH` environment variable matches your directory
- Restart the TTS service: `make tts-restart`

**Synthesis slow**
- Use medium quality voices instead of high for faster synthesis
- Longer texts take more time to process

### ASR Issues

**GPU not detected**
```bash
# Verify NVIDIA Container Toolkit
nvidia-smi
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

If GPU isn't detected, ensure:
- NVIDIA drivers are installed
- NVIDIA Container Toolkit is installed
- Docker has been restarted after toolkit installation

**Microphone not working**
- Check browser permissions
- Ensure HTTPS or localhost (required for `getUserMedia`)
- Check browser console for errors

**Model download slow**
- First startup downloads the Whisper model
- Models are cached in `$YAP_ASR_MODELS_DIR` for subsequent runs
- Larger models (medium, large) take longer to download

### General Issues

**Container won't start**
```bash
# Check logs
docker compose logs -f

# Check container status
docker ps -a
```

**Network issues (Caddy mode)**
```bash
# Verify Caddy network exists
docker network inspect caddy

# If network doesn't exist, create it
docker network create caddy
```

**Environment variables not being used**
- Ensure `.env` file exists in the appropriate directory (root, asr/, or tts/)
- Check for typos in variable names
- Restart containers after changing `.env`: `make tts-restart` or `make asr-restart`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT - See [LICENSE](LICENSE)

---

*Yap - yap fast / listen faster*
