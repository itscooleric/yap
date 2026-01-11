// Yap Unified UI Configuration
// This file configures the Yap application settings.
// For local development, you can modify these values.

window.__YAP_CONFIG = {
  // === Feature Flags ===
  
  // Enable/disable Apps ecosystem (default: false)
  // When false, the Apps button is hidden and built-in apps are not shown.
  // Set to true to enable the Apps panel and built-in apps (Send/Webhook).
  enableApps: false,
  
  // === YAP Apps Configuration ===
  
  // External apps manifest URL (optional)
  // If set, YAP will fetch apps from this manifest and display them in the Apps panel.
  // Set to null or omit to use only built-in apps.
  // appsManifestUrl: 'https://example.com/yap-apps/manifest.json',
  appsManifestUrl: null,
  
  // Allowed origins for external iframe apps (REQUIRED for external apps)
  // Only postMessage communication from these origins will be accepted.
  // Use explicit origins, no wildcards. Example: ['https://apps.example.com']
  appsAllowedOrigins: []
  
  // Backward compatibility: addonManifestUrl and addonAllowedOrigins 
  // are mapped to appsManifestUrl and appsAllowedOrigins if present.
};
