// Yap - Add-ons Window Manager
// Shared add-ons functionality usable from ASR and TTS tabs

import { util } from './util.js';

let windowZIndex = 1001;
let windowCascadeOffset = 0;
const CASCADE_STEP = 24;

// Configuration system - localStorage backed with defaults
const CONFIG_NAMESPACE = 'yap.config';
const ADDONS_NAMESPACE = 'yap.addons';

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
  // Fall back to window.__YAP_CONFIG or addon defaults
  const fileConfig = window.__YAP_CONFIG || {};
  if (fileConfig[key] !== undefined) {
    return fileConfig[key];
  }
  // Check if any addon has this as a default
  for (const addon of addons) {
    if (addon.settingsSchema) {
      const field = addon.settingsSchema.find(f => f.key === key);
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

// Get addon enabled state
function isAddonEnabled(addonId) {
  try {
    const stored = localStorage.getItem(`${ADDONS_NAMESPACE}.enabled.${addonId}`);
    if (stored !== null) {
      return JSON.parse(stored);
    }
  } catch (err) {
    // Ignore parse errors
  }
  // Default: enabled
  return true;
}

// Set addon enabled state
function setAddonEnabled(addonId, enabled) {
  try {
    localStorage.setItem(`${ADDONS_NAMESPACE}.enabled.${addonId}`, JSON.stringify(enabled));
  } catch (err) {
    console.warn('Failed to save addon state:', err);
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
    return { valid: false, error: 'Non-localhost URLs not allowed. Enable in add-on settings.' };
  }
  return { valid: true };
}

// Addon registry - each addon can declare a settingsSchema
const addons = [
  {
    id: 'ollama-summarize',
    name: 'Ollama Summarize',
    description: 'Summarize transcript with Ollama',
    render: renderOllamaSummarize,
    context: 'asr',
    settingsTitle: 'Ollama',
    settingsSchema: [
      { key: 'ollamaUrl', label: 'Ollama URL', type: 'url', default: 'http://localhost:11434', localOnly: true },
      { key: 'ollamaModel', label: 'Model', type: 'string', default: 'llama3' },
      { key: 'allowNonLocalhost', label: 'Allow non-localhost URLs', type: 'boolean', default: false, hint: 'Enable to connect to remote services' }
    ]
  }
];

// Get enabled addons
function getEnabledAddons() {
  return addons.filter(addon => isAddonEnabled(addon.id));
}

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
  if (!isAddonEnabled(addon.id)) {
    return; // Don't open disabled addons
  }
  createAddonWindow(addon.name, addon.render);
}

// Re-render callback for addon list
let renderAddonListCallback = null;

// Initialize addon panel
export function initAddonPanel() {
  const addonsBtn = document.getElementById('addonsBtn');
  const addonPanel = document.getElementById('addonPanel');
  const addonPanelClose = document.getElementById('addonPanelClose');
  const addonPanelList = document.getElementById('addonPanelList');

  if (!addonsBtn || !addonPanel) return;

  // Render addon list with enable/disable toggles
  function renderAddonList() {
    addonPanelList.innerHTML = '';
    addons.forEach(addon => {
      const enabled = isAddonEnabled(addon.id);
      const div = document.createElement('div');
      div.className = 'addon-item' + (enabled ? '' : ' disabled');
      div.innerHTML = `
        <div class="addon-item-info">
          <div class="addon-item-name">${addon.name}</div>
          <div class="addon-item-desc">${addon.description}</div>
        </div>
        <label class="addon-toggle" title="${enabled ? 'Disable' : 'Enable'} add-on">
          <input type="checkbox" ${enabled ? 'checked' : ''}>
          <span class="addon-toggle-slider"></span>
        </label>
      `;
      
      const checkbox = div.querySelector('input[type="checkbox"]');
      const infoArea = div.querySelector('.addon-item-info');
      
      // Toggle enable/disable
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        setAddonEnabled(addon.id, checkbox.checked);
        div.classList.toggle('disabled', !checkbox.checked);
        // Update settings button visibility
        updateSettingsButtonVisibility();
      });
      
      // Click on info area opens the addon window (if enabled)
      infoArea.addEventListener('click', () => {
        if (isAddonEnabled(addon.id)) {
          addonPanel.style.display = 'none';
          openAddonWindow(addon);
        }
      });
      
      addonPanelList.appendChild(div);
    });
  }
  
  renderAddonListCallback = renderAddonList;
  renderAddonList();

  // Toggle panel - position it centered below header
  addonsBtn.addEventListener('click', () => {
    if (addonPanel.style.display === 'none') {
      renderAddonList(); // Refresh state
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
}

// Update settings button visibility based on enabled addons with settings
function updateSettingsButtonVisibility() {
  const settingsBtn = document.getElementById('settingsBtn');
  if (!settingsBtn) return;
  
  const enabledAddonsWithSettings = getEnabledAddons().filter(a => a.settingsSchema && a.settingsSchema.length > 0);
  settingsBtn.style.display = enabledAddonsWithSettings.length > 0 ? '' : 'none';
}

// Initialize settings panel
export function initSettingsPanel() {
  const settingsBtn = document.getElementById('settingsBtn');
  if (!settingsBtn) return;

  settingsBtn.addEventListener('click', () => {
    openSettingsWindow();
  });
  
  // Update visibility based on enabled addons
  updateSettingsButtonVisibility();
}

// Open settings window
function openSettingsWindow() {
  createAddonWindow('Add-on Settings', renderSettingsPanel, { width: 400, height: 400 });
}

// Render settings panel - dynamically built from enabled add-ons' settings
function renderSettingsPanel(container, ctx) {
  const enabledAddons = getEnabledAddons();
  const addonsWithSettings = enabledAddons.filter(a => a.settingsSchema && a.settingsSchema.length > 0);
  
  if (addonsWithSettings.length === 0) {
    container.innerHTML = `
      <div class="settings-empty">
        <p>No add-on settings available.</p>
        <p class="settings-hint">Enable add-ons with configurable settings to see options here.</p>
      </div>
    `;
    return;
  }
  
  // Build settings UI from add-ons' schemas
  let html = '';
  
  addonsWithSettings.forEach(addon => {
    html += `<div class="settings-section" data-addon="${addon.id}">`;
    html += `<div class="settings-section-title">${addon.settingsTitle || addon.name}</div>`;
    
    addon.settingsSchema.forEach(field => {
      const fieldId = `settings_${addon.id}_${field.key}`;
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
  addonsWithSettings.forEach(addon => {
    addon.settingsSchema.forEach(field => {
      const fieldId = `settings_${addon.id}_${field.key}`;
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
    addonsWithSettings.forEach(addon => {
      addon.settingsSchema.forEach(field => {
        const fieldId = `settings_${addon.id}_${field.key}`;
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
            // Check if allowNonLocalhost is enabled for this addon
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
    addonsWithSettings.forEach(addon => {
      addon.settingsSchema.forEach(field => {
        const fieldId = `settings_${addon.id}_${field.key}`;
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

// Maximum prompt length for Ollama requests
const MAX_OLLAMA_PROMPT_LENGTH = 50000;

// Ollama Summarize addon renderer
function renderOllamaSummarize(container, ctx) {
  container.classList.add('ollama-addon');

  // Get config from runtime settings (defaults come from settingsSchema via getConfig)
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
    // Get fresh config values (defaults come from settingsSchema via getConfig)
    const currentUrl = getConfig('ollamaUrl');
    const currentModel = getConfig('ollamaModel');
    const allowNonLocalhost = getConfig('allowNonLocalhost') ?? false;

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
    const urlValidation = ctx.validateUrl(currentUrl, !allowNonLocalhost);
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
