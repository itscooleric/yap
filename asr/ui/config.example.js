// Yap ASR Configuration
// Copy this file to config.js and adjust the values as needed.
// This file is loaded by index.html to configure cross-linking and app settings.

window.__YAP_CONFIG = {
  // Cross-linking URLs (leave empty or use relative paths for same-domain)
  asrUrl: '',           // e.g., 'https://asr.yourdomain.com' or '' for current page
  ttsUrl: '/tts/',      // e.g., 'https://tts.yourdomain.com' or relative path

  // === YAP Apps Configuration ===
  
  // External apps manifest URL (optional)
  // If set, YAP will fetch apps from this manifest and display them in the Apps panel.
  // appsManifestUrl: 'https://example.com/yap-apps/manifest.json',
  appsManifestUrl: null,
  
  // Allowed origins for external iframe apps (REQUIRED for external apps)
  // Only postMessage communication from these origins will be accepted.
  appsAllowedOrigins: [],

  // === Ollama App Configuration ===
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3'
};
