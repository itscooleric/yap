# QuickYap - Quick Mic (ASR)

Speech-to-text transcription using OpenAI Whisper.

```
    /\  __  /\
   /  \/  \/  \
  |   (o)(o)   |
   \    __    /
    \  /__\  /
     --------
```

## Features

- Record audio directly in the browser
- Live waveform visualization during recording
- Recording timer (mm:ss)
- Transcribe using Whisper ASR
- Copy transcript to clipboard
- Download transcript as .txt
- Download original audio recording

## Requirements

- Docker with Compose V2
- NVIDIA GPU with CUDA drivers
- External Docker network named `caddy` (for Caddy reverse proxy)
- [caddy-docker-proxy](https://github.com/lucaslorentz/caddy-docker-proxy) running

## Quick Start

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` to set your domain and paths:
   ```bash
   ASR_DOMAIN=asr.yourdomain.com
   WHISPER_MODELS_PATH=/srv/whisper-asr/models
   ASR_MODEL=base
   ```

3. Create the model cache directory:
   ```bash
   sudo mkdir -p /srv/whisper-asr/models
   ```

4. Create the external caddy network (if not exists):
   ```bash
   docker network create caddy
   ```

5. Start the services:
   ```bash
   docker compose up -d
   ```

6. Access the UI at your configured domain (e.g., https://asr.yourdomain.com)

## Local Development (Without Caddy)

For local testing without the Caddy proxy:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
```

This exposes:
- UI: http://localhost:8080
- API: http://localhost:9000

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `ASR_DOMAIN` | Domain for Caddy routing | `asr.localhost` |
| `WHISPER_MODELS_PATH` | Host path for model cache | `/srv/whisper-asr/models` |
| `ASR_MODEL` | Whisper model size | `base` |
| `ASR_ENGINE` | ASR engine | `openai_whisper` |

### Model Sizes

| Model | Parameters | VRAM | Speed |
|-------|------------|------|-------|
| tiny | 39M | ~1GB | Fastest |
| base | 74M | ~1GB | Fast |
| small | 244M | ~2GB | Moderate |
| medium | 769M | ~5GB | Slow |
| large-v2 | 1550M | ~10GB | Slowest |
| large-v3 | 1550M | ~10GB | Slowest |

## API Endpoints

Once running, the following endpoints are available:

- `POST /asr` - Transcribe audio file
- `GET /docs` - Swagger UI documentation
- `GET /openapi.json` - OpenAPI specification

### Example API Usage

```bash
curl -X POST "https://asr.yourdomain.com/asr?output=txt" \
  -H "accept: application/json" \
  -F "audio_file=@recording.webm"
```

## Troubleshooting

### GPU not detected

Ensure NVIDIA Container Toolkit is installed:
```bash
nvidia-smi  # Should show GPU
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

### Model download slow

First startup downloads the model. This can take several minutes depending on model size and connection speed. Models are cached in the configured `WHISPER_MODELS_PATH`.

### Microphone not working

- Check browser permissions for microphone access
- Ensure HTTPS or localhost (required for getUserMedia)
- Check browser console for errors

## Screenshots

See `/docs/images/` for screenshots of the UI.

## License

MIT - See [LICENSE](../LICENSE)
