# QuickYap

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

QuickYap provides two self-hosted web applications:

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

### Prerequisites

- Docker with Compose V2
- NVIDIA GPU with CUDA drivers (for ASR)
- [caddy-docker-proxy](https://github.com/lucaslorentz/caddy-docker-proxy) for reverse proxy

### 1. Clone the Repository

```bash
git clone https://github.com/itscooleric/quick-yap.git
cd quick-yap
```

### 2. Create Docker Network

```bash
docker network create caddy
```

### 3. Setup ASR (Quick Mic)

```bash
cd asr
cp .env.example .env
# Edit .env to configure domain and paths
sudo mkdir -p /srv/whisper-asr/models
docker compose up -d
```

### 4. Setup TTS (Quick TTS)

```bash
cd tts
cp .env.example .env
# Edit .env to configure domain and paths
sudo mkdir -p /srv/piper/models

# Download a voice (example: British English Cori)
cd /srv/piper/models
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/high/en_GB-cori-high.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/high/en_GB-cori-high.onnx.json

cd /path/to/quick-yap/tts
docker compose up -d --build
```

### 5. Access the UIs

Configure your DNS or hosts file to point to your server:

- ASR: `https://asr.yourdomain.com`
- TTS: `https://tts.yourdomain.com`

## Local Development (Without Caddy)

For testing without the Caddy reverse proxy:

```bash
# ASR
cd asr
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
# UI: http://localhost:8080, API: http://localhost:9000

# TTS
cd tts
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
# UI: http://localhost:8081, API: http://localhost:5000
```

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
├── .gitignore
├── LICENSE
└── README.md
```

## Configuration

### ASR Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ASR_DOMAIN` | Domain for Caddy routing | `asr.localhost` |
| `WHISPER_MODELS_PATH` | Host path for model cache | `/srv/whisper-asr/models` |
| `ASR_MODEL` | Whisper model (tiny/base/small/medium/large-v2/large-v3) | `base` |
| `ASR_ENGINE` | ASR engine | `openai_whisper` |

### TTS Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TTS_DOMAIN` | Domain for Caddy routing | `tts.localhost` |
| `PIPER_MODELS_PATH` | Host path for voice models | `/srv/piper/models` |

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

### ASR Issues

**GPU not detected**
```bash
# Verify NVIDIA Container Toolkit
nvidia-smi
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

**Microphone not working**
- Check browser permissions
- Ensure HTTPS or localhost (required for `getUserMedia`)
- Check browser console for errors

**Model download slow**
- First startup downloads the Whisper model
- Models are cached for subsequent runs

### TTS Issues

**No voices available**
- Ensure voice files (`.onnx` + `.onnx.json`) are in the models directory
- Check file permissions

**Synthesis slow**
- Use medium quality voices for faster synthesis
- Longer texts take more time

### General Issues

**Container won't start**
```bash
docker compose logs -f
```

**Network issues**
```bash
docker network inspect caddy
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT - See [LICENSE](LICENSE)

---

*QuickYap - yap fast / listen faster*
