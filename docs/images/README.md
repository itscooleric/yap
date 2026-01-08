# Screenshots

This directory contains screenshots for the QuickYap documentation.

## Required Screenshots

Please capture and add the following screenshots:

### ASR (Quick Mic)

1. `asr-idle.png` - UI in idle state
2. `asr-recording.png` - UI during recording (showing waveform and timer)
3. `asr-transcribed.png` - UI with completed transcription

### TTS (Quick TTS)

1. `tts-idle.png` - UI in idle state with voice dropdown
2. `tts-synthesized.png` - UI with generated audio player

## Screenshot Guidelines

- Use a browser window size of approximately 1200x800
- Use the dark theme (default)
- Avoid including personal data in screenshots
- Compress images to keep repository size reasonable (use PNG for UI, optimize with tools like `optipng` or `pngquant`)

## Taking Screenshots

### Linux (using scrot or gnome-screenshot)
```bash
gnome-screenshot -w -f asr-idle.png
```

### macOS
```bash
# Cmd+Shift+4, then Space, then click window
```

### Browser DevTools
1. Open DevTools (F12)
2. Press Ctrl+Shift+P
3. Type "screenshot"
4. Select "Capture screenshot" or "Capture full size screenshot"
