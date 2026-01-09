// Yap - Add-ons Window Manager
// Shared add-ons functionality usable from ASR and TTS tabs

import { util } from './util.js';

let windowZIndex = 1001;

// Addon registry
const addons = [
  {
    id: 'ollama-summarize',
    name: 'Ollama Summarize',
    description: 'Summarize transcript with Ollama',
    render: renderOllamaSummarize,
    context: 'asr' // Can be 'asr', 'tts', or 'both'
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
    showMessage: (text, type) => window.yapState?.showMessage?.(text, type)
  };
}

// Create a draggable, resizable addon window
export function createAddonWindow(title, contentRenderer) {
  const win = document.createElement('div');
  win.className = 'addon-window';
  win.style.top = '120px';
  win.style.left = '50%';
  win.style.transform = 'translateX(-50%)';
  win.style.width = '360px';
  win.style.height = '320px';
  win.style.zIndex = ++windowZIndex;

  win.innerHTML = `
    <div class="addon-window-header">
      <span class="addon-window-title">${title}</span>
      <button class="addon-window-close">x</button>
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
    isDragging = true;
    win.style.transform = 'none';
    const rect = win.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    win.style.left = (e.clientX - dragOffsetX) + 'px';
    win.style.top = (e.clientY - dragOffsetY) + 'px';
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

  // Toggle panel
  addonsBtn.addEventListener('click', () => {
    addonPanel.style.display = addonPanel.style.display === 'none' ? 'block' : 'none';
  });

  addonPanelClose.addEventListener('click', () => {
    addonPanel.style.display = 'none';
  });
}

// Ollama Summarize addon renderer
function renderOllamaSummarize(container, ctx) {
  container.classList.add('ollama-addon');

  const config = window.__YAP_CONFIG || {};
  const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
  const ollamaModel = config.ollamaModel || 'llama3';

  container.innerHTML = `
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

    // Limit total prompt size
    const maxLength = 50000;
    const fullPrompt = prompt + '\n\n' + transcriptText;
    if (fullPrompt.length > maxLength) {
      errorDiv.textContent = 'Transcript too long. Max ' + maxLength + ' characters.';
      errorDiv.style.display = 'block';
      return;
    }

    summarizeBtn.disabled = true;
    summarizeBtn.textContent = 'Working...';
    errorDiv.style.display = 'none';
    outputDiv.style.display = 'none';

    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
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
      errorDiv.textContent = 'Could not connect to Ollama. Is it running at ' + ollamaUrl + '?';
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

export const addons_module = { addons, initAddonPanel, openAddonWindow, createAddonWindow };
