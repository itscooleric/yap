# QuickYap - Quick TTS

Text-to-speech synthesis using Piper TTS.

```
    /\  __  /\
   /  \/  \/  \
  |   (o)(o)   |
   \    __    /
    \  /__\  /
     --------
```

## Features

- Text input or .txt file upload
- Multiple voice selection
- Adjustable speaking rate (length_scale)
- Audio playback with HTML5 controls
- Download synthesized audio as .wav
- Media Session API support for lock screen controls

## Requirements

- Docker with Compose V2
- External Docker network named `caddy` (for Caddy reverse proxy)
- [caddy-docker-proxy](https://github.com/lucaslorentz/caddy-docker-proxy) running
- Piper voice model files (.onnx + .onnx.json)

## Quick Start

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` to set your domain and paths:
   ```bash
   TTS_DOMAIN=tts.yourdomain.com
   PIPER_MODELS_PATH=/srv/piper/models
   ```

3. Create the models directory:
   ```bash
   sudo mkdir -p /srv/piper/models
   ```

4. Download Piper voice models (see below)

5. Create the external caddy network (if not exists):
   ```bash
   docker network create caddy
   ```

6. Build and start the services:
   ```bash
   docker compose up -d --build
   ```

7. Access the UI at your configured domain (e.g., https://tts.yourdomain.com)

## Downloading Piper Voices

Piper voices can be downloaded from the [Piper releases page](https://github.com/rhasspy/piper/blob/master/VOICES.md).

**Important**: The TTS service will start even without voice models installed, but it will display a clear warning in the logs and the `/health` endpoint will show `voices_count: 0`. You must download at least one voice for the service to work.

### Recommended: Cori (British English)

The default voice selection prefers `en_GB-cori-high`. Download it:

```bash
# Navigate to models directory
cd ${QUICKYAP_TTS_MODELS_DIR:-/srv/piper/models}

# Download Cori high quality (recommended)
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/high/en_GB-cori-high.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/high/en_GB-cori-high.onnx.json

# OR download Cori medium quality (smaller, faster)
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/medium/en_GB-cori-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/medium/en_GB-cori-medium.onnx.json

# Set permissions
sudo chmod 644 *.onnx *.json
```

**Note**: Files must be named exactly as shown (e.g., `en_GB-cori-high.onnx`, not `cori-high.onnx`).

### Verify Installation

After downloading models, verify they are detected:

```bash
# Check health endpoint (local mode)
curl http://localhost:5000/health
# Expected: {"status":"ok","voices_count":1}

# List voices (local mode)
curl http://localhost:5000/voices
# Expected: ["en_GB-cori-high"]

# For Caddy mode, use your domain:
curl -k https://$QUICKYAP_TTS_DOMAIN/voices
```

If `voices_count` is 0, check:
- Both `.onnx` and `.onnx.json` files exist
- File names match exactly (case-sensitive)
- File permissions are correct
- Restart the container: `docker compose restart` or `make tts-restart`

### Other Popular Voices

```bash
# US English - Amy (medium)
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx.json

# US English - Lessac (high)
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/high/en_US-lessac-high.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/high/en_US-lessac-high.onnx.json
```

Browse all voices at: https://huggingface.co/rhasspy/piper-voices/tree/main

## Local Development (Without Caddy)

For local testing without the Caddy proxy:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

This exposes:
- UI: http://localhost:8081
- API: http://localhost:5000

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `TTS_DOMAIN` | Domain for Caddy routing | `tts.localhost` |
| `PIPER_MODELS_PATH` | Host path for voice models | `/srv/piper/models` |

## Speaking Rate (length_scale)

The speaking rate slider maps to Piper's `length_scale` parameter:

| length_scale | Effect |
|--------------|--------|
| 0.5 | Fast (2x speed) |
| 1.0 | Normal speed |
| 1.5 | Slow |
| 2.0 | Very slow (0.5x speed) |

## API Endpoints

Once running, the following endpoints are available:

- `GET /health` - Health check
- `GET /voices` - List available voices
- `POST /synthesize/{voice}?length_scale=1.0` - Synthesize text to speech

### Example API Usage

```bash
# List voices
curl https://tts.yourdomain.com/voices

# Synthesize speech
curl -X POST "https://tts.yourdomain.com/synthesize/en_GB-cori-high?length_scale=1.0" \
  -H "Content-Type: text/plain" \
  -d "Hello, this is a test." \
  --output speech.wav
```

## Troubleshooting

### No voices available

Ensure voice model files are in the configured `PIPER_MODELS_PATH`:
- Each voice needs both `.onnx` and `.onnx.json` files
- Check file permissions (readable by container)

### Synthesis slow

- Consider using medium quality voices instead of high
- Longer texts take more time to process

### Audio not playing

- Check browser console for errors
- Ensure the browser supports WAV audio playback

## Screenshots

See `/docs/images/` for screenshots of the UI.

## License

MIT - See [LICENSE](../LICENSE)
