// Yap - Apps Window Manager
// Shared apps functionality usable from ASR and TTS tabs

import { util } from './util.js';

let windowZIndex = 1001;
let windowCascadeOffset = 0;
const CASCADE_STEP = 24;

// HTML escape function to prevent XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Configuration system - localStorage backed with defaults
const CONFIG_NAMESPACE = 'yap.config';
const APPS_NAMESPACE = 'yap.apps';

// Get config value with localStorage override
export function getConfig(key) {
  try {
    const stored = localStorage.getItem(`${CONFIG_NAMESPACE}.${key}`);
    if (stored !== null) {
      return JSON.parse(stored);
    }
  } catch (err) {
    // Ignore parse errors
  }
  // Fall back to window.__YAP_CONFIG or app defaults
  const fileConfig = window.__YAP_CONFIG || {};
  
  // Backward compatibility: check for addon* keys and map to apps* keys
  if (key === 'appsManifestUrl' && fileConfig['addonManifestUrl'] !== undefined) {
    return fileConfig['addonManifestUrl'];
  }
  if (key === 'appsAllowedOrigins') {
    // Merge addonAllowedOrigins into appsAllowedOrigins
    const appsOrigins = fileConfig[key] || [];
    const addonOrigins = fileConfig['addonAllowedOrigins'] || [];
    const merged = [...new Set([...appsOrigins, ...addonOrigins])];
    if (merged.length > 0) return merged;
  }
  
  if (fileConfig[key] !== undefined) {
    return fileConfig[key];
  }
  // Check if any app has this as a default
  for (const app of builtInApps) {
    if (app.settingsSchema) {
      const field = app.settingsSchema.find(f => f.key === key);
      if (field && field.default !== undefined) {
        return field.default;
      }
    }
  }
  return undefined;
}

// Set config value
export function setConfig(key, value) {
  try {
    localStorage.setItem(`${CONFIG_NAMESPACE}.${key}`, JSON.stringify(value));
  } catch (err) {
    console.warn('Failed to save config:', err);
  }
}

// Get app enabled state
function isAppEnabled(appId) {
  try {
    const stored = localStorage.getItem(`${APPS_NAMESPACE}.enabled.${appId}`);
    if (stored !== null) {
      return JSON.parse(stored);
    }
  } catch (err) {
    // Ignore parse errors
  }
  // Default: enabled
  return true;
}

// Set app enabled state
function setAppEnabled(appId, enabled) {
  try {
    localStorage.setItem(`${APPS_NAMESPACE}.enabled.${appId}`, JSON.stringify(enabled));
  } catch (err) {
    console.warn('Failed to save app state:', err);
  }
}

// Validate URL - check if localhost when required
function isLocalhostUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || 
           parsed.hostname === '127.0.0.1' ||
           parsed.hostname === '::1';
  } catch {
    return false;
  }
}

// Validate URL for app use
export function validateUrl(url, requireLocalhost = true) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }
  try {
    new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
  // Only check localhost requirement if requireLocalhost is true
  if (requireLocalhost && !isLocalhostUrl(url)) {
    return { valid: false, error: 'Non-localhost URLs not allowed. Enable in app settings.' };
  }
  return { valid: true };
}

// Built-in apps registry
// Note: Ollama integration removed
const builtInApps = [];

// External apps loaded from manifest
let externalApps = [];

// Get all apps (built-in + external)
function getAllApps() {
  return [...builtInApps, ...externalApps];
}

// Get enabled apps
function getEnabledApps() {
  return getAllApps().filter(app => isAppEnabled(app.id));
}

// Get app context for accessing app state
export function getAppContext() {
  return {
    // ASR context
    getTranscript: () => window.yapState?.asr?.getTranscript?.() || '',
    setTranscript: (text) => window.yapState?.asr?.setTranscript?.(text),
    getClips: () => window.yapState?.asr?.getClips?.() || [],
    
    // Conversation context for webhook/send apps
    getConversation: () => {
      const clips = window.yapState?.asr?.getClips?.() || [];
      if (clips.length === 0) return null;
      
      return {
        conversation_id: `yap-${Date.now()}`,
        created_at: clips[0]?.createdAt?.toISOString() || new Date().toISOString(),
        clips: clips.map((clip, index) => ({
          clip_id: clip.id,
          recorded_at: clip.createdAt?.toISOString() || new Date().toISOString(),
          transcript: clip.transcript || '',
          duration_ms: clip.durationMs || 0,
          tags: []
        }))
      };
    },
    
    // TTS context
    getTtsText: () => window.yapState?.tts?.getText?.() || '',
    getGeneratedAudio: () => window.yapState?.tts?.getGeneratedAudio?.() || null,
    
    // Message helper
    showMessage: (text, type) => window.yapState?.showMessage?.(text, type),
    
    // Config access
    getConfig,
    setConfig,
    validateUrl
  };
}

// Calculate centered position with cascade offset
function getCenteredPosition(winWidth, winHeight) {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  
  let x = Math.max(20, (viewportW - winWidth) / 2 + windowCascadeOffset);
  let y = Math.max(20, (viewportH - winHeight) / 2 + windowCascadeOffset);
  
  // Clamp to viewport bounds
  x = Math.min(x, viewportW - winWidth - 20);
  y = Math.min(y, viewportH - winHeight - 20);
  
  // Ensure minimum visibility
  x = Math.max(20, x);
  y = Math.max(20, y);
  
  // Increment cascade for next window
  windowCascadeOffset += CASCADE_STEP;
  if (windowCascadeOffset > 120) {
    windowCascadeOffset = 0;
  }
  
  return { x, y };
}

// Create a draggable, resizable app window
export function createAppWindow(title, contentRenderer, options = {}) {
  const winWidth = options.width || 360;
  const winHeight = options.height || 320;
  
  const win = document.createElement('div');
  win.className = 'addon-window';
  
  // Calculate centered position
  const pos = getCenteredPosition(winWidth, winHeight);
  win.style.left = pos.x + 'px';
  win.style.top = pos.y + 'px';
  win.style.width = winWidth + 'px';
  win.style.height = winHeight + 'px';
  win.style.zIndex = ++windowZIndex;

  win.innerHTML = `
    <div class="addon-window-header">
      <span class="addon-window-title">${title}</span>
      <button class="addon-window-close" title="Close">x</button>
    </div>
    <div class="addon-window-content"></div>
    <div class="addon-window-resize"></div>
  `;

  document.body.appendChild(win);

  const header = win.querySelector('.addon-window-header');
  const closeBtn = win.querySelector('.addon-window-close');
  const content = win.querySelector('.addon-window-content');
  const resizeHandle = win.querySelector('.addon-window-resize');

  // Close
  closeBtn.addEventListener('click', () => {
    win.remove();
  });

  // Bring to front on click
  win.addEventListener('mousedown', () => {
    win.style.zIndex = ++windowZIndex;
  });

  // Dragging
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  header.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    const rect = win.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    let newX = e.clientX - dragOffsetX;
    let newY = e.clientY - dragOffsetY;
    // Clamp to viewport
    newX = Math.max(0, Math.min(newX, window.innerWidth - win.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - win.offsetHeight));
    win.style.left = newX + 'px';
    win.style.top = newY + 'px';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Resizing
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let startWidth = 0;
  let startHeight = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    startWidth = win.offsetWidth;
    startHeight = win.offsetHeight;
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = startWidth + (e.clientX - resizeStartX);
    const newHeight = startHeight + (e.clientY - resizeStartY);
    win.style.width = Math.max(280, newWidth) + 'px';
    win.style.height = Math.max(180, newHeight) + 'px';
  });

  document.addEventListener('mouseup', () => {
    isResizing = false;
  });

  // Render content
  contentRenderer(content, getAppContext());

  return win;
}

// Keep backward-compatible alias
export const createAddonWindow = createAppWindow;

// Open app window
export function openAppWindow(app) {
  if (!isAppEnabled(app.id)) {
    return; // Don't open disabled apps
  }
  
  // Handle different app types
  if (app.type === 'iframe') {
    openIframeApp(app);
  } else {
    // Built-in app with render function
    createAppWindow(app.name, app.render);
  }
}

// Keep backward-compatible alias
export const openAddonWindow = openAppWindow;

// Re-render callback for app list
let renderAppListCallback = null;

// Check if Apps ecosystem is enabled
function isAppsEnabled() {
  const config = window.__YAP_CONFIG || {};
  return config.enableApps === true;
}

// Initialize app panel (apps menu)
export function initAppPanel() {
  const addonsBtn = document.getElementById('addonsBtn');
  const addonPanel = document.getElementById('addonPanel');
  const addonPanelClose = document.getElementById('addonPanelClose');
  const addonPanelList = document.getElementById('addonPanelList');

  if (!addonsBtn || !addonPanel) return;

  // Hide Apps button if enableApps is false
  if (!isAppsEnabled()) {
    addonsBtn.style.display = 'none';
    addonPanel.style.display = 'none';
    return;
  }

  // Render app list with enable/disable toggles
  function renderAppList() {
    addonPanelList.innerHTML = '';
    
    const allApps = getAllApps();
    
    if (allApps.length === 0) {
      addonPanelList.innerHTML = '<div class="addon-item-empty">No apps available</div>';
      return;
    }
    
    allApps.forEach(app => {
      const enabled = isAppEnabled(app.id);
      const div = document.createElement('div');
      div.className = 'addon-item' + (enabled ? '' : ' disabled');
      div.innerHTML = `
        <div class="addon-item-info">
          <div class="addon-item-name">${app.name}</div>
          <div class="addon-item-desc">${app.description}</div>
        </div>
        <label class="addon-toggle" title="${enabled ? 'Disable' : 'Enable'} app">
          <input type="checkbox" ${enabled ? 'checked' : ''}>
          <span class="addon-toggle-slider"></span>
        </label>
      `;
      
      const checkbox = div.querySelector('input[type="checkbox"]');
      const infoArea = div.querySelector('.addon-item-info');
      
      // Toggle enable/disable
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        setAppEnabled(app.id, checkbox.checked);
        div.classList.toggle('disabled', !checkbox.checked);
        // Update settings button visibility
        updateSettingsButtonVisibility();
      });
      
      // Click on info area opens the app window (if enabled)
      infoArea.addEventListener('click', () => {
        if (isAppEnabled(app.id)) {
          addonPanel.style.display = 'none';
          openAppWindow(app);
        }
      });
      
      addonPanelList.appendChild(div);
    });
  }
  
  renderAppListCallback = renderAppList;
  renderAppList();

  // Toggle panel - position it centered below header
  addonsBtn.addEventListener('click', () => {
    if (addonPanel.style.display === 'none') {
      renderAppList(); // Refresh state
      // Position panel centered below the button
      const btnRect = addonsBtn.getBoundingClientRect();
      const panelWidth = 260;
      let left = btnRect.left + (btnRect.width / 2) - (panelWidth / 2);
      // Clamp to viewport
      left = Math.max(10, Math.min(left, window.innerWidth - panelWidth - 10));
      addonPanel.style.left = left + 'px';
      addonPanel.style.top = (btnRect.bottom + 8) + 'px';
      addonPanel.style.right = 'auto';
      addonPanel.style.display = 'block';
    } else {
      addonPanel.style.display = 'none';
    }
  });

  addonPanelClose.addEventListener('click', () => {
    addonPanel.style.display = 'none';
  });

  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (addonPanel.style.display === 'block' && 
        !addonPanel.contains(e.target) && 
        e.target !== addonsBtn) {
      addonPanel.style.display = 'none';
    }
  });
  
  // Load external apps from manifest if configured
  loadExternalApps();
}

// Backward-compatible alias
export const initAddonPanel = initAppPanel;

// Update settings button visibility
// Settings button is always visible since ASR settings are always available
function updateSettingsButtonVisibility() {
  const settingsBtn = document.getElementById('settingsBtn');
  if (!settingsBtn) return;
  
  // Always show settings button - ASR settings are always available
  settingsBtn.style.display = '';
}

// Initialize settings panel (legacy - main.js now handles the Settings button)
export function initSettingsPanel() {
  // Settings button click handler is set up in main.js
  // Just ensure the button is visible
  updateSettingsButtonVisibility();
}

// Open settings window
function openSettingsWindow() {
  createAppWindow('Settings', renderSettingsPanel, { width: 400, height: 400 });
}

// Render settings panel - dynamically built from enabled apps' settings
function renderSettingsPanel(container, ctx) {
  const enabledApps = getEnabledApps();
  const appsWithSettings = enabledApps.filter(a => a.settingsSchema && a.settingsSchema.length > 0);
  
  if (appsWithSettings.length === 0) {
    container.innerHTML = `
      <div class="settings-empty">
        <p>No app settings available.</p>
        <p class="settings-hint">Enable apps with configurable settings to see options here.</p>
      </div>
    `;
    return;
  }
  
  // Build settings UI from apps' schemas
  let html = '';
  
  appsWithSettings.forEach(app => {
    html += `<div class="settings-section" data-app="${app.id}">`;
    html += `<div class="settings-section-title">${app.settingsTitle || app.name} Settings</div>`;
    
    app.settingsSchema.forEach(field => {
      const fieldId = `settings_${app.id}_${field.key}`;
      html += `<div class="settings-row">`;
      
      if (field.type === 'boolean') {
        html += `
          <label class="settings-toggle-label">
            <input type="checkbox" id="${fieldId}" data-key="${field.key}">
            <span>${field.label}</span>
          </label>
        `;
      } else {
        html += `<label for="${fieldId}">${field.label}</label>`;
        if (field.type === 'url') {
          html += `<input type="url" id="${fieldId}" data-key="${field.key}" placeholder="${field.default || ''}">`;
        } else {
          html += `<input type="text" id="${fieldId}" data-key="${field.key}" placeholder="${field.default || ''}">`;
        }
      }
      
      if (field.hint) {
        html += `<div class="settings-hint">${field.hint}</div>`;
      }
      html += `<div class="settings-field-error" id="${fieldId}_error"></div>`;
      html += `</div>`;
    });
    
    html += `</div>`;
  });
  
  html += `
    <div class="settings-actions">
      <button class="small primary" id="settingsSaveBtn">Save</button>
      <button class="small" id="settingsResetBtn">Reset to Defaults</button>
    </div>
    <div class="settings-message" id="settingsMessage" style="display: none;"></div>
  `;
  
  container.innerHTML = html;
  
  // Load current values
  appsWithSettings.forEach(app => {
    app.settingsSchema.forEach(field => {
      const fieldId = `settings_${app.id}_${field.key}`;
      const input = container.querySelector(`#${fieldId}`);
      if (!input) return;
      
      const currentValue = getConfig(field.key);
      if (field.type === 'boolean') {
        input.checked = currentValue !== undefined ? currentValue : (field.default ?? false);
      } else {
        input.value = currentValue !== undefined ? currentValue : (field.default ?? '');
      }
    });
  });
  
  const saveBtn = container.querySelector('#settingsSaveBtn');
  const resetBtn = container.querySelector('#settingsResetBtn');
  const messageDiv = container.querySelector('#settingsMessage');
  
  // Save settings
  saveBtn.addEventListener('click', () => {
    let hasError = false;
    
    // Validate and collect values
    appsWithSettings.forEach(app => {
      app.settingsSchema.forEach(field => {
        const fieldId = `settings_${app.id}_${field.key}`;
        const input = container.querySelector(`#${fieldId}`);
        const errorDiv = container.querySelector(`#${fieldId}_error`);
        if (!input) return;
        
        errorDiv.textContent = '';
        
        if (field.type === 'boolean') {
          setConfig(field.key, input.checked);
        } else {
          const value = input.value.trim() || (field.default ?? '');
          
          // Validate URL fields
          if (field.type === 'url' && field.localOnly) {
            // Check if allowNonLocalhost is enabled for this app
            const allowNonLocalhost = getConfig('allowNonLocalhost');
            if (!allowNonLocalhost && !isLocalhostUrl(value)) {
              errorDiv.textContent = 'Non-localhost URLs not allowed';
              hasError = true;
              return;
            }
          }
          
          setConfig(field.key, value);
        }
      });
    });
    
    if (hasError) {
      messageDiv.textContent = 'Please fix errors above';
      messageDiv.className = 'settings-message error';
      messageDiv.style.display = 'block';
      return;
    }
    
    messageDiv.textContent = 'Settings saved';
    messageDiv.className = 'settings-message success';
    messageDiv.style.display = 'block';
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 2000);
  });
  
  // Reset to defaults
  resetBtn.addEventListener('click', () => {
    appsWithSettings.forEach(app => {
      app.settingsSchema.forEach(field => {
        const fieldId = `settings_${app.id}_${field.key}`;
        const input = container.querySelector(`#${fieldId}`);
        if (!input) return;
        
        // Clear stored value
        localStorage.removeItem(`${CONFIG_NAMESPACE}.${field.key}`);
        
        // Reset input to default
        if (field.type === 'boolean') {
          input.checked = field.default ?? false;
        } else {
          input.value = field.default ?? '';
        }
        
        // Clear any errors
        const errorDiv = container.querySelector(`#${fieldId}_error`);
        if (errorDiv) errorDiv.textContent = '';
      });
    });
    
    messageDiv.textContent = 'Reset to defaults';
    messageDiv.className = 'settings-message success';
    messageDiv.style.display = 'block';
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 2000);
  });
}

// ============================================
// External Apps Loading (Manifest-based)
// ============================================

// Load external apps from manifest URL
async function loadExternalApps() {
  const manifestUrl = getConfig('appsManifestUrl');
  if (!manifestUrl) {
    return; // No manifest configured, skip
  }

  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      console.warn('Failed to fetch apps manifest:', response.status);
      return;
    }

    const manifest = await response.json();
    
    // Validate manifest version
    if (manifest.version !== 1) {
      console.warn('Unsupported manifest version:', manifest.version);
      return;
    }

    // Parse apps from manifest
    if (Array.isArray(manifest.apps)) {
      externalApps = manifest.apps.map(app => ({
        id: app.id,
        name: app.name,
        description: app.description || '',
        type: app.type || 'iframe',
        entryUrl: app.entryUrl
      }));
      
      // Refresh the app list if callback is registered
      if (renderAppListCallback) {
        renderAppListCallback();
      }
    }
  } catch (err) {
    console.warn('Error loading apps manifest:', err);
  }
}

// ============================================
// Iframe App Container + PostMessage Bridge
// ============================================

// Get allowed origins for postMessage validation
function getAllowedOrigins() {
  const configured = getConfig('appsAllowedOrigins') || [];
  return Array.isArray(configured) ? configured : [];
}

// Validate message origin against allowlist
function isAllowedOrigin(origin) {
  const allowed = getAllowedOrigins();
  return allowed.includes(origin);
}

// Active iframe apps and their windows
const activeIframeApps = new Map();

// Open an iframe-based external app
function openIframeApp(app) {
  if (!app.entryUrl) {
    console.warn('Iframe app missing entryUrl:', app.id);
    return;
  }

  // Parse origin from entryUrl for validation
  let appOrigin;
  try {
    appOrigin = new URL(app.entryUrl).origin;
  } catch (err) {
    console.warn('Invalid entryUrl for app:', app.id);
    return;
  }

  // Check if origin is allowed
  if (!isAllowedOrigin(appOrigin)) {
    console.warn('Origin not in appsAllowedOrigins:', appOrigin);
    window.yapState?.showMessage?.(`App origin not allowed: ${appOrigin}`, 'error');
    return;
  }

  // Create the app window with iframe content
  const win = createAppWindow(app.name, (container, ctx) => {
    container.classList.add('iframe-app-container');
    container.innerHTML = `
      <iframe 
        src="${app.entryUrl}" 
        class="iframe-app-frame"
        sandbox="allow-scripts allow-same-origin allow-forms"
        allow="clipboard-write"
      ></iframe>
    `;

    const iframe = container.querySelector('iframe');
    
    // Store reference for cleanup
    activeIframeApps.set(app.id, { win, iframe, origin: appOrigin });

    // Wait for iframe to load, then send init message
    iframe.addEventListener('load', () => {
      sendToIframe(iframe, appOrigin, {
        type: 'yap:init',
        payload: {
          version: '1',
          capabilities: {
            setTranscript: true,
            getTranscript: true,
            showMessage: true
          }
        }
      });

      // Send initial context
      sendContextToIframe(iframe, appOrigin, ctx);
    });
  }, { width: 500, height: 450 });

  // Clean up when window is closed
  const observer = new MutationObserver(() => {
    if (!document.body.contains(win)) {
      activeIframeApps.delete(app.id);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
}

// Send message to iframe
function sendToIframe(iframe, origin, message) {
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(message, origin);
  }
}

// Send context update to iframe
function sendContextToIframe(iframe, origin, ctx) {
  const transcript = ctx.getTranscript();
  const conversation = ctx.getConversation();
  
  sendToIframe(iframe, origin, {
    type: 'yap:context',
    payload: {
      transcript,
      conversation
    }
  });
}

// Handle incoming postMessage from iframes
function handleIframeMessage(event) {
  // Validate origin
  if (!isAllowedOrigin(event.origin)) {
    return; // Ignore messages from non-allowed origins
  }

  const data = event.data;
  if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
    return; // Invalid message shape
  }

  // Only handle yap: prefixed messages
  if (!data.type.startsWith('yap:')) {
    return;
  }

  const ctx = getAppContext();

  switch (data.type) {
    case 'yap:requestContext':
      // Find the iframe that sent this message and respond
      for (const [appId, appData] of activeIframeApps) {
        if (appData.origin === event.origin) {
          sendContextToIframe(appData.iframe, appData.origin, ctx);
          break;
        }
      }
      break;

    case 'yap:setTranscript':
      if (data.payload && typeof data.payload.text === 'string') {
        ctx.setTranscript(data.payload.text);
      }
      break;

    case 'yap:showMessage':
      if (data.payload && typeof data.payload.text === 'string') {
        const kind = data.payload.kind || 'info';
        const type = kind === 'error' ? 'error' : (kind === 'success' ? 'success' : '');
        ctx.showMessage(data.payload.text, type);
      }
      break;

    case 'yap:closeApp':
      // Find and close the app window that sent this message
      for (const [appId, appData] of activeIframeApps) {
        if (appData.origin === event.origin) {
          appData.win.remove();
          activeIframeApps.delete(appId);
          break;
        }
      }
      break;

    default:
      // Ignore unknown message types (per spec)
      break;
  }
}

// Register global message handler
window.addEventListener('message', handleIframeMessage);

// ============================================
// Built-in App: Send / Webhook
// ============================================

const WEBHOOKS_STORAGE_KEY = 'yap.apps.sendWebhooks';

// Load webhook profiles from localStorage
function loadWebhookProfiles() {
  try {
    const stored = localStorage.getItem(WEBHOOKS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.warn('Failed to load webhook profiles:', err);
  }
  return [];
}

// Save webhook profiles to localStorage
function saveWebhookProfiles(profiles) {
  try {
    localStorage.setItem(WEBHOOKS_STORAGE_KEY, JSON.stringify(profiles));
  } catch (err) {
    console.warn('Failed to save webhook profiles:', err);
  }
}

// Create default n8n webhook template
function createN8nTemplate() {
  return {
    id: 'n8n-template',
    name: 'n8n Webhook (template)',
    url: 'http://localhost:5678/webhook/yap',
    method: 'POST',
    headers: '{"Content-Type": "application/json"}',
    bodyType: 'transcript'
  };
}

// Render Send/Webhook app
function renderSendWebhook(container, ctx) {
  container.classList.add('send-webhook-app');

  let profiles = loadWebhookProfiles();
  let selectedProfileId = profiles.length > 0 ? profiles[0].id : null;
  let currentView = 'main'; // 'main' | 'edit'
  let editingProfile = null;

  function render() {
    if (currentView === 'edit') {
      renderEditView();
    } else {
      renderMainView();
    }
  }

  function renderMainView() {
    const transcript = ctx.getTranscript();
    const hasTranscript = transcript && transcript.length > 0;

    container.innerHTML = `
      <div class="webhook-section">
        <label>Destination</label>
        <div class="webhook-destination-row">
          <select id="webhookProfileSelect" class="webhook-select">
            ${profiles.length === 0 ? '<option value="">No destinations configured</option>' : ''}
            ${profiles.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === selectedProfileId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
          <button class="small" id="webhookEditBtn" ${profiles.length === 0 ? 'disabled' : ''}>Edit</button>
          <button class="small" id="webhookNewBtn">New</button>
        </div>
      </div>

      <div class="webhook-section">
        <label>Send Mode</label>
        <div class="webhook-mode-row">
          <label class="webhook-radio-label">
            <input type="radio" name="webhookMode" value="transcript" checked>
            <span>Transcript only</span>
          </label>
          <label class="webhook-radio-label">
            <input type="radio" name="webhookMode" value="conversation">
            <span>Full conversation</span>
          </label>
        </div>
      </div>

      <div class="webhook-actions">
        <button class="small primary" id="webhookSendBtn" ${!hasTranscript || profiles.length === 0 ? 'disabled' : ''}>Send Now</button>
        <button class="small" id="webhookDryRunBtn" ${!hasTranscript || profiles.length === 0 ? 'disabled' : ''}>Dry Run (Preview)</button>
        <button class="small" id="webhookAddN8nBtn">Add n8n Template</button>
      </div>

      <div class="webhook-output" id="webhookOutput" style="display: none;"></div>
      <div class="webhook-error" id="webhookError" style="display: none;"></div>
    `;

    // Event handlers
    container.querySelector('#webhookProfileSelect')?.addEventListener('change', (e) => {
      selectedProfileId = e.target.value;
    });

    container.querySelector('#webhookNewBtn')?.addEventListener('click', () => {
      editingProfile = null;
      currentView = 'edit';
      render();
    });

    container.querySelector('#webhookEditBtn')?.addEventListener('click', () => {
      editingProfile = profiles.find(p => p.id === selectedProfileId) || null;
      if (editingProfile) {
        currentView = 'edit';
        render();
      }
    });

    container.querySelector('#webhookAddN8nBtn')?.addEventListener('click', () => {
      const template = createN8nTemplate();
      template.id = 'n8n-' + Date.now();
      profiles.push(template);
      saveWebhookProfiles(profiles);
      selectedProfileId = template.id;
      render();
    });

    container.querySelector('#webhookSendBtn')?.addEventListener('click', () => {
      executeWebhook(false);
    });

    container.querySelector('#webhookDryRunBtn')?.addEventListener('click', () => {
      executeWebhook(true);
    });
  }

  function renderEditView() {
    const isNew = !editingProfile;
    const profile = editingProfile || {
      id: '',
      name: '',
      url: '',
      method: 'POST',
      headers: '{"Content-Type": "application/json"}',
      bodyType: 'transcript'
    };

    container.innerHTML = `
      <div class="webhook-edit-header">
        <span>${isNew ? 'New Destination' : 'Edit Destination'}</span>
      </div>

      <div class="webhook-section">
        <label for="webhookName">Name</label>
        <input type="text" id="webhookName" value="${escapeHtml(profile.name)}" placeholder="My Webhook">
      </div>

      <div class="webhook-section">
        <label for="webhookUrl">URL</label>
        <input type="url" id="webhookUrl" value="${escapeHtml(profile.url)}" placeholder="https://...">
      </div>

      <div class="webhook-section">
        <label for="webhookMethod">Method</label>
        <select id="webhookMethod">
          <option value="POST" ${profile.method === 'POST' ? 'selected' : ''}>POST</option>
          <option value="PUT" ${profile.method === 'PUT' ? 'selected' : ''}>PUT</option>
          <option value="PATCH" ${profile.method === 'PATCH' ? 'selected' : ''}>PATCH</option>
        </select>
      </div>

      <div class="webhook-section">
        <label for="webhookHeaders">Headers (JSON)</label>
        <textarea id="webhookHeaders" rows="2" placeholder='{"Content-Type": "application/json"}'>${escapeHtml(profile.headers || '')}</textarea>
        <div class="settings-hint">⚠️ Headers may contain auth tokens. Store securely.</div>
      </div>

      <div class="webhook-actions">
        <button class="small primary" id="webhookSaveBtn">Save</button>
        <button class="small" id="webhookCancelBtn">Cancel</button>
        ${!isNew ? '<button class="small danger" id="webhookDeleteBtn">Delete</button>' : ''}
      </div>

      <div class="webhook-error" id="webhookEditError" style="display: none;"></div>
    `;

    container.querySelector('#webhookSaveBtn')?.addEventListener('click', () => {
      const name = container.querySelector('#webhookName').value.trim();
      const url = container.querySelector('#webhookUrl').value.trim();
      const method = container.querySelector('#webhookMethod').value;
      const headers = container.querySelector('#webhookHeaders').value.trim();

      if (!name || !url) {
        container.querySelector('#webhookEditError').textContent = 'Name and URL are required';
        container.querySelector('#webhookEditError').style.display = 'block';
        return;
      }

      // Validate headers JSON
      if (headers) {
        try {
          JSON.parse(headers);
        } catch (e) {
          container.querySelector('#webhookEditError').textContent = 'Invalid JSON in headers';
          container.querySelector('#webhookEditError').style.display = 'block';
          return;
        }
      }

      if (isNew) {
        const newProfile = {
          id: Date.now().toString(),
          name,
          url,
          method,
          headers
        };
        profiles.push(newProfile);
        selectedProfileId = newProfile.id;
      } else {
        editingProfile.name = name;
        editingProfile.url = url;
        editingProfile.method = method;
        editingProfile.headers = headers;
      }

      saveWebhookProfiles(profiles);
      currentView = 'main';
      render();
    });

    container.querySelector('#webhookCancelBtn')?.addEventListener('click', () => {
      currentView = 'main';
      render();
    });

    container.querySelector('#webhookDeleteBtn')?.addEventListener('click', () => {
      if (confirm('Delete this destination?')) {
        profiles = profiles.filter(p => p.id !== editingProfile.id);
        saveWebhookProfiles(profiles);
        selectedProfileId = profiles.length > 0 ? profiles[0].id : null;
        currentView = 'main';
        render();
      }
    });
  }

  async function executeWebhook(dryRun) {
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile) return;

    const mode = container.querySelector('input[name="webhookMode"]:checked')?.value || 'transcript';
    const outputDiv = container.querySelector('#webhookOutput');
    const errorDiv = container.querySelector('#webhookError');

    // Build payload
    let payload;
    if (mode === 'transcript') {
      payload = {
        transcript: ctx.getTranscript(),
        created_at: new Date().toISOString(),
        source: 'yap'
      };
    } else {
      const conversation = ctx.getConversation();
      payload = conversation || {
        conversation_id: 'yap-' + Date.now(),
        created_at: new Date().toISOString(),
        clips: []
      };
    }

    if (dryRun) {
      // Show preview - escape user data to prevent XSS
      outputDiv.innerHTML = `<strong>Dry Run Preview:</strong>\n<pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>\n<strong>URL:</strong> ${escapeHtml(profile.url)}\n<strong>Method:</strong> ${escapeHtml(profile.method)}`;
      outputDiv.style.display = 'block';
      errorDiv.style.display = 'none';
      return;
    }

    // Execute webhook
    outputDiv.style.display = 'none';
    errorDiv.style.display = 'none';

    try {
      let headers = { 'Content-Type': 'application/json' };
      if (profile.headers) {
        try {
          headers = { ...headers, ...JSON.parse(profile.headers) };
        } catch (e) {
          // Use default headers if parse fails
        }
      }

      const response = await fetch(profile.url, {
        method: profile.method || 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const responseText = await response.text().catch(() => '');
      const snippet = responseText.substring(0, 200);

      if (response.ok) {
        outputDiv.innerHTML = `<strong>✓ Success (${escapeHtml(response.status)})</strong>\n${escapeHtml(snippet)}${responseText.length > 200 ? '...' : ''}`;
        outputDiv.style.display = 'block';
        ctx.showMessage?.('Webhook sent successfully', 'success');
      } else {
        errorDiv.textContent = `Error ${response.status}: ${snippet}`;
        errorDiv.style.display = 'block';
      }
    } catch (err) {
      errorDiv.textContent = `Network error: ${err.message}`;
      errorDiv.style.display = 'block';
    }
  }

  render();
}

// Add Send/Webhook to built-in apps
builtInApps.push({
  id: 'send-webhook',
  name: 'Send (Webhook)',
  description: 'Send transcript or conversation to webhooks',
  type: 'built-in',
  render: renderSendWebhook,
  context: 'asr'
});

export const addons_module = { builtInApps, externalApps, getAllApps, initAppPanel, initAddonPanel, openAppWindow, openAddonWindow, createAppWindow, createAddonWindow, initSettingsPanel, getConfig, setConfig };
