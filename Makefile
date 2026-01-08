.PHONY: help asr-up asr-down asr-logs asr-restart tts-up tts-down tts-logs tts-restart tts-health tts-voices tts-model-cori

# Default target
help:
	@echo "QuickYap Makefile"
	@echo ""
	@echo "ASR (Quick Mic) targets:"
	@echo "  make asr-up        - Start ASR services"
	@echo "  make asr-down      - Stop ASR services"
	@echo "  make asr-logs      - View ASR logs"
	@echo "  make asr-restart   - Restart ASR services"
	@echo ""
	@echo "TTS (Quick TTS) targets:"
	@echo "  make tts-up        - Start TTS services"
	@echo "  make tts-down      - Stop TTS services"
	@echo "  make tts-logs      - View TTS logs"
	@echo "  make tts-restart   - Restart TTS services"
	@echo "  make tts-health    - Check TTS health"
	@echo "  make tts-voices    - List available voices"
	@echo ""
	@echo "TTS Model helpers:"
	@echo "  make tts-model-cori - Show commands to download Cori voice"

# ASR targets
asr-up:
	cd asr && docker compose up -d

asr-down:
	cd asr && docker compose down

asr-logs:
	cd asr && docker compose logs -f

asr-restart:
	cd asr && docker compose restart

# TTS targets
tts-up:
	cd tts && docker compose up -d --build

tts-down:
	cd tts && docker compose down

tts-logs:
	cd tts && docker compose logs -f

tts-restart:
	cd tts && docker compose restart

tts-health:
	@echo "Checking TTS health..."
	@echo "Note: Update the domain/port based on your setup"
	@echo ""
	@echo "For Caddy setup, use:"
	@echo "  curl -k https://\$$QUICKYAP_TTS_DOMAIN/health"
	@echo ""
	@echo "For local setup, use:"
	@echo "  curl http://localhost:5000/health"

tts-voices:
	@echo "Listing TTS voices..."
	@echo "Note: Update the domain/port based on your setup"
	@echo ""
	@echo "For Caddy setup, use:"
	@echo "  curl -k https://\$$QUICKYAP_TTS_DOMAIN/voices"
	@echo ""
	@echo "For local setup, use:"
	@echo "  curl http://localhost:5000/voices"

# Model download helper
tts-model-cori:
	@echo "Commands to download Cori voice model:"
	@echo ""
	@echo "  # Create models directory (if needed)"
	@echo "  sudo mkdir -p \$$QUICKYAP_TTS_MODELS_DIR"
	@echo "  cd \$$QUICKYAP_TTS_MODELS_DIR"
	@echo ""
	@echo "  # Download Cori high quality (recommended)"
	@echo "  wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/high/en_GB-cori-high.onnx"
	@echo "  wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/high/en_GB-cori-high.onnx.json"
	@echo ""
	@echo "  # OR download Cori medium quality (smaller, faster)"
	@echo "  wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/medium/en_GB-cori-medium.onnx"
	@echo "  wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/cori/medium/en_GB-cori-medium.onnx.json"
	@echo ""
	@echo "  # Verify permissions"
	@echo "  sudo chmod 644 *.onnx *.json"
	@echo ""
	@echo "After downloading, restart TTS: make tts-restart"
