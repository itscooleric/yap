// Yap - Add-ons Window Manager
// Shared add-ons functionality usable from ASR and TTS tabs

import { util } from './util.js';

let windowZIndex = 1001;
let windowCascadeOffset = 0;
const CASCADE_STEP = 24;

// Configuration system - localStorage backed with defaults
const CONFIG_NAMESPACE = 'yap.config';

// Default configuration
const defaultConfig = {
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3',
  allowNonLocalhost: false
};

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
  // Fall back to window.__YAP_CONFIG or defaults
  const fileConfig = window.__YAP_CONFIG || {};
  return fileConfig[key] !== undefined ? fileConfig[key] : defaultConfig[key];
}

// Set config value
export function setConfig(key, value) {
  try {
    localStorage.setItem(`${CONFIG_NAMESPACE}.${key}`, JSON.stringify(value));
  } catch (err) {
    console.warn('Failed to save config:', err);
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

// Validate URL for add-on use
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
    return { valid: false, error: 'Non-localhost URLs not allowed. Enable in Settings.' };
  }
  return { valid: true };
}

// Addon registry
const addons = [
  {
    id: 'ollama-summarize',
    name: 'Ollama Summarize',
    description: 'Summarize transcript with Ollama',
    render: renderOllamaSummarize,
    context: 'asr',
    settings: [
      { key: 'ollamaUrl', label: 'Ollama URL', type: 'url', default: 'http://localhost:11434', localOnly: true },
      { key: 'ollamaModel', label: 'Model', type: 'string', default: 'llama3' }
    ]
  }
];

// Get addon context for accessing app state
export function getAddonContext() {
  return {
    // ASR context
    getTranscript: () => window.yapState?.asr?.getTranscript?.() || '',
    setTranscript: (text) => window.yapState?.asr?.setTranscript?.(text),
    getClips: () => window.yapState?.asr?.getClips?.() || [],
    
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

// Create a draggable, resizable addon window
export function createAddonWindow(title, contentRenderer, options = {}) {
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
  contentRenderer(content, getAddonContext());

  return win;
}

// Open addon window
export function openAddonWindow(addon) {
  createAddonWindow(addon.name, addon.render);
}

// Initialize addon panel
export function initAddonPanel() {
  const addonsBtn = document.getElementById('addonsBtn');
  const addonPanel = document.getElementById('addonPanel');
  const addonPanelClose = document.getElementById('addonPanelClose');
  const addonPanelList = document.getElementById('addonPanelList');

  if (!addonsBtn || !addonPanel) return;

  // Render addon list
  function renderAddonList() {
    addonPanelList.innerHTML = '';
    addons.forEach(addon => {
      const div = document.createElement('div');
      div.className = 'addon-item';
      div.innerHTML = `
        <div>
          <div class="addon-item-name">${addon.name}</div>
          <div class="addon-item-desc">${addon.description}</div>
        </div>
      `;
      div.addEventListener('click', () => {
        addonPanel.style.display = 'none';
        openAddonWindow(addon);
      });
      addonPanelList.appendChild(div);
    });
  }
  renderAddonList();

  // Toggle panel - position it centered below header
  addonsBtn.addEventListener('click', () => {
    if (addonPanel.style.display === 'none') {
      // Position panel centered below the button
      const btnRect = addonsBtn.getBoundingClientRect();
      const panelWidth = 220;
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
}

// Initialize settings panel
export function initSettingsPanel() {
  const settingsBtn = document.getElementById('settingsBtn');
  if (!settingsBtn) return;

  settingsBtn.addEventListener('click', () => {
    openSettingsWindow();
  });
}

// Open settings window
function openSettingsWindow() {
  createAddonWindow('Settings', renderSettingsPanel, { width: 400, height: 380 });
}

// Render settings panel
function renderSettingsPanel(container, ctx) {
  container.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-title">Connections</div>
      
      <div class="settings-row">
        <label for="settingsOllamaUrl">Ollama URL</label>
        <input type="url" id="settingsOllamaUrl" placeholder="http://localhost:11434">
        <div class="settings-hint" id="ollamaUrlHint"></div>
      </div>
      
      <div class="settings-row">
        <label for="settingsOllamaModel">Ollama Model</label>
        <input type="text" id="settingsOllamaModel" placeholder="llama3">
      </div>
      
      <div class="settings-row">
        <label class="settings-toggle-label">
          <input type="checkbox" id="settingsAllowNonLocalhost">
          <span>Allow non-localhost URLs</span>
        </label>
        <div class="settings-hint">Enable to connect to remote services</div>
      </div>
    </div>
    
    <div class="settings-actions">
      <button class="small primary" id="settingsSaveBtn">Save</button>
      <button class="small" id="settingsResetBtn">Reset to Defaults</button>
    </div>
    
    <div class="settings-message" id="settingsMessage" style="display: none;"></div>
  `;

  const ollamaUrlInput = container.querySelector('#settingsOllamaUrl');
  const ollamaModelInput = container.querySelector('#settingsOllamaModel');
  const allowNonLocalhostInput = container.querySelector('#settingsAllowNonLocalhost');
  const ollamaUrlHint = container.querySelector('#ollamaUrlHint');
  const saveBtn = container.querySelector('#settingsSaveBtn');
  const resetBtn = container.querySelector('#settingsResetBtn');
  const messageDiv = container.querySelector('#settingsMessage');

  // Load current values
  ollamaUrlInput.value = getConfig('ollamaUrl');
  ollamaModelInput.value = getConfig('ollamaModel');
  allowNonLocalhostInput.checked = getConfig('allowNonLocalhost');

  // Validate URL on input
  ollamaUrlInput.addEventListener('input', () => {
    const url = ollamaUrlInput.value.trim();
    if (!url) {
      ollamaUrlHint.textContent = '';
      ollamaUrlHint.className = 'settings-hint';
      return;
    }
    const validation = validateUrl(url, !allowNonLocalhostInput.checked);
    if (!validation.valid) {
      ollamaUrlHint.textContent = validation.error;
      ollamaUrlHint.className = 'settings-hint error';
    } else {
      ollamaUrlHint.textContent = '';
      ollamaUrlHint.className = 'settings-hint';
    }
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const url = ollamaUrlInput.value.trim() || defaultConfig.ollamaUrl;
    const model = ollamaModelInput.value.trim() || defaultConfig.ollamaModel;
    const allowNonLocalhost = allowNonLocalhostInput.checked;

    // Validate URL
    const validation = validateUrl(url, !allowNonLocalhost);
    if (!validation.valid) {
      messageDiv.textContent = validation.error;
      messageDiv.className = 'settings-message error';
      messageDiv.style.display = 'block';
      return;
    }

    setConfig('ollamaUrl', url);
    setConfig('ollamaModel', model);
    setConfig('allowNonLocalhost', allowNonLocalhost);

    messageDiv.textContent = 'Settings saved';
    messageDiv.className = 'settings-message success';
    messageDiv.style.display = 'block';
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 2000);
  });

  // Reset to defaults
  resetBtn.addEventListener('click', () => {
    ollamaUrlInput.value = defaultConfig.ollamaUrl;
    ollamaModelInput.value = defaultConfig.ollamaModel;
    allowNonLocalhostInput.checked = defaultConfig.allowNonLocalhost;
    
    // Clear stored values
    localStorage.removeItem(`${CONFIG_NAMESPACE}.ollamaUrl`);
    localStorage.removeItem(`${CONFIG_NAMESPACE}.ollamaModel`);
    localStorage.removeItem(`${CONFIG_NAMESPACE}.allowNonLocalhost`);
    
    ollamaUrlHint.textContent = '';
    messageDiv.textContent = 'Reset to defaults';
    messageDiv.className = 'settings-message success';
    messageDiv.style.display = 'block';
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 2000);
  });
}

// Maximum prompt length for Ollama requests
const MAX_OLLAMA_PROMPT_LENGTH = 50000;

// Ollama Summarize addon renderer
function renderOllamaSummarize(container, ctx) {
  container.classList.add('ollama-addon');

  // Get config from runtime settings
  const ollamaUrl = getConfig('ollamaUrl');
  const ollamaModel = getConfig('ollamaModel');

  container.innerHTML = `
    <div class="addon-info">
      Using: ${ollamaModel} at ${ollamaUrl}
    </div>
    <div style="margin-bottom: 0.5rem; font-size: 0.75rem; color: var(--text-secondary);">
      Prompt:
    </div>
    <textarea id="ollamaPrompt" placeholder="Enter a prompt, e.g.: Summarize the following transcript:">Summarize the following transcript:</textarea>
    <div class="btn-row">
      <button class="small primary" id="ollamaSummarizeBtn">Summarize</button>
      <button class="small" id="ollamaReplaceBtn" disabled>Replace transcript</button>
    </div>
    <div class="output" id="ollamaOutput" style="display: none;"></div>
    <div class="error-msg" id="ollamaError" style="display: none;"></div>
  `;

  const promptInput = container.querySelector('#ollamaPrompt');
  const summarizeBtn = container.querySelector('#ollamaSummarizeBtn');
  const replaceBtn = container.querySelector('#ollamaReplaceBtn');
  const outputDiv = container.querySelector('#ollamaOutput');
  const errorDiv = container.querySelector('#ollamaError');

  let lastOutput = '';

  summarizeBtn.addEventListener('click', async () => {
    // Get fresh config values
    const currentUrl = getConfig('ollamaUrl');
    const currentModel = getConfig('ollamaModel');

    const transcriptText = ctx.getTranscript();
    if (!transcriptText) {
      errorDiv.textContent = 'No transcript to summarize';
      errorDiv.style.display = 'block';
      outputDiv.style.display = 'none';
      return;
    }

    const prompt = promptInput.value.trim();
    if (!prompt) {
      errorDiv.textContent = 'Please enter a prompt';
      errorDiv.style.display = 'block';
      return;
    }

    // Validate URL
    const urlValidation = ctx.validateUrl(currentUrl, true);
    if (!urlValidation.valid) {
      errorDiv.textContent = urlValidation.error;
      errorDiv.style.display = 'block';
      return;
    }

    // Limit total prompt size
    const fullPrompt = prompt + '\n\n' + transcriptText;
    if (fullPrompt.length > MAX_OLLAMA_PROMPT_LENGTH) {
      errorDiv.textContent = 'Transcript too long. Max ' + MAX_OLLAMA_PROMPT_LENGTH + ' characters.';
      errorDiv.style.display = 'block';
      return;
    }

    summarizeBtn.disabled = true;
    summarizeBtn.textContent = 'Working...';
    errorDiv.style.display = 'none';
    outputDiv.style.display = 'none';

    try {
      const response = await fetch(`${currentUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: currentModel,
          prompt: fullPrompt,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Ollama error: ${response.status} ${response.statusText}${errorText ? ' - ' + errorText.substring(0, 100) : ''}`);
      }

      const data = await response.json();
      lastOutput = data.response || '';

      outputDiv.textContent = lastOutput;
      outputDiv.style.display = 'block';
      replaceBtn.disabled = !lastOutput;

    } catch (err) {
      console.error('Ollama error:', err);
      errorDiv.textContent = 'Could not connect to Ollama. Is it running at ' + currentUrl + '?';
      errorDiv.style.display = 'block';
    } finally {
      summarizeBtn.disabled = false;
      summarizeBtn.textContent = 'Summarize';
    }
  });

  replaceBtn.addEventListener('click', () => {
    if (lastOutput) {
      ctx.setTranscript(lastOutput);
      ctx.showMessage?.('Transcript replaced', 'success');
    }
  });
}

export const addons_module = { addons, initAddonPanel, openAddonWindow, createAddonWindow, initSettingsPanel, getConfig, setConfig };
