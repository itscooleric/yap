# Screenshots

This directory contains screenshots for the Yap documentation.

## Current Screenshots

The following placeholder screenshots have been generated:

### ASR (Automatic Speech Recognition)

1. `asr-idle.png` - UI in idle state
2. `asr-recording.png` - UI during recording (showing waveform and timer)
3. `asr-transcribed.png` - UI with completed transcription

### TTS (Text-to-Speech)

1. `tts-idle.png` - UI in idle state with voice dropdown
2. `tts-synthesized.png` - UI with generated audio player
3. `tts-read-along.png` - Read-along mode with paragraph highlighting

### Export & Transfer

1. `export-panel.png` - Export panel showing GitLab/GitHub/SFTP options

## Updating Screenshots

To replace placeholders with actual screenshots:

1. Run the Yap application locally (see main README for instructions)
2. Capture screenshots at approximately 1200x800 resolution
3. Use the dark theme (default)
4. Avoid including personal data in screenshots
5. Compress images with `optipng` or similar tools
6. Replace the placeholder files with the same filenames

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
