// Yap - Main Application
// Tab router, bootstrap, and initialization

import { asr } from './asr.js';
import { tts } from './tts.js';
import { chat } from './chat.js';
import * as data from './data.js';
import { initAddonPanel } from './addons.js';
import { metrics } from './metrics.js';

// App state
let activeTab = 'asr';
let asrEnabled = true;
let ttsEnabled = true;
let chatEnabled = true;

// Tab elements
const tabs = {
  asr: null,
  tts: null,
  chat: null,
  data: null
};

// Show message (global helper)
function showMessage(text, type = '') {
  const activeMessage = document.querySelector('.tab-content.active .message');
  if (activeMessage) {
    activeMessage.textContent = text;
    activeMessage.className = 'message ' + type;
    activeMessage.style.display = 'block';
    setTimeout(() => {
      activeMessage.style.display = 'none';
    }, 2500);
  }
}

// Show global toast notification (works anywhere)
function showGlobalToast(message, type = '') {
  const toast = document.getElementById('toastNotification');
  if (toast) {
    toast.textContent = message;
    toast.className = 'toast-notification' + (type ? ' ' + type : '');
    toast.style.display = 'block';
    
    setTimeout(() => {
      toast.style.display = 'none';
    }, 2500);
  }
}

// Switch tabs (in-page, no navigation)
function switchTab(tabName) {
  if (tabName === activeTab) return;
  
  // Update tab buttons
  document.querySelectorAll('.nav-tabs button[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
  
  // Update URL hash for deep linking (optional)
  if (history.replaceState) {
    history.replaceState(null, null, '#' + tabName);
  }
  
  activeTab = tabName;
  
  // Update FAB toolbar mode for current tab
  updateFabMode(tabName);
}

// Update FAB toolbar mode based on current tab
function updateFabMode(tabName) {
  const asrButtons = document.querySelectorAll('#mobileToolbar [data-mode="asr"]');
  const dataButtons = document.querySelectorAll('#mobileToolbar [data-mode="data"]');
  
  if (tabName === 'data') {
    // Hide ASR buttons, show Data buttons
    asrButtons.forEach(btn => btn.style.display = 'none');
    dataButtons.forEach(btn => btn.style.display = 'flex');
  } else {
    // Show ASR buttons, hide Data buttons
    asrButtons.forEach(btn => btn.style.display = 'flex');
    dataButtons.forEach(btn => btn.style.display = 'none');
  }
}

// Check backend availability
async function checkBackends() {
  // Check ASR - error means backend unavailable
  try {
    const response = await fetch('/asr/docs');
    asrEnabled = response.ok;
  } catch (err) {
    // Network error or backend not running
    asrEnabled = false;
  }
  
  // Check TTS
  ttsEnabled = await tts.checkHealth();
  
  // Update tab buttons
  const asrBtn = document.querySelector('[data-tab="asr"]');
  const ttsBtn = document.querySelector('[data-tab="tts"]');
  
  if (asrBtn) {
    asrBtn.classList.toggle('disabled', !asrEnabled);
    if (!asrEnabled) {
      asrBtn.title = 'ASR backend unavailable';
    }
  }
  
  if (ttsBtn) {
    ttsBtn.classList.toggle('disabled', !ttsEnabled);
    if (!ttsEnabled) {
      ttsBtn.title = 'TTS backend unavailable';
    }
  }
  
  // Show hint if backend is disabled
  if (!asrEnabled) {
    const asrTab = document.getElementById('asr-tab');
    if (asrTab) {
      const hint = document.createElement('div');
      hint.className = 'backend-hint';
      hint.textContent = 'ASR backend is not available. Check that the whisper-asr service is running.';
      asrTab.querySelector('.panel')?.prepend(hint);
    }
  }
  
  if (!ttsEnabled) {
    const ttsTab = document.getElementById('tts-tab');
    if (ttsTab) {
      const hint = document.createElement('div');
      hint.className = 'backend-hint';
      hint.textContent = 'TTS backend is not available. Check that the piper-tts service is running.';
      ttsTab.querySelector('.panel')?.prepend(hint);
    }
  }
  
  // If current tab is disabled, switch to an enabled one
  if (activeTab === 'asr' && !asrEnabled && ttsEnabled) {
    switchTab('tts');
  } else if (activeTab === 'tts' && !ttsEnabled && asrEnabled) {
    switchTab('asr');
  }
}

// Handle recording indicator click
function setupRecordingIndicator() {
  const indicator = document.getElementById('recordingIndicator');
  if (indicator) {
    indicator.addEventListener('click', () => {
      if (asr.isRecording()) {
        switchTab('asr');
      }
    });
  }
}

// Handle hash-based routing for deep links
function handleHashRoute() {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'asr' || hash === 'tts' || hash === 'chat' || hash === 'data') {
    switchTab(hash);
  }
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Only trigger if not typing in an input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    // D key - open Data tab
    if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      switchTab('data');
    }
    
    // S key - open Settings
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      const settingsBtn = document.getElementById('settingsBtn');
      if (settingsBtn) {
        settingsBtn.click();
      }
    }
  });
}

// Initialize application
async function init() {
  // Cache tab elements
  tabs.asr = document.getElementById('asr-tab');
  tabs.tts = document.getElementById('tts-tab');
  tabs.chat = document.getElementById('chat-tab');
  tabs.data = document.getElementById('data-tab');
  
  // Initialize ASR
  if (tabs.asr) {
    await asr.init(tabs.asr);
  }
  
  // Initialize TTS
  if (tabs.tts) {
    tts.init(tabs.tts);
  }
  
  // Initialize Chat
  if (tabs.chat) {
    chat.init();
  }
  
  // Initialize Data/Metrics tab
  if (tabs.data) {
    await data.init(tabs.data);
  }
  
  // Initialize addon panel and settings
  initAddonPanel();
  
  // Setup global Settings button - works from all tabs
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      // Open unified Settings panel from any tab
      asr.openSettingsPanel();
    });
  }
  
  // Setup tab navigation (in-page, no page reload)
  document.querySelectorAll('.nav-tabs button[data-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });
  
  // Setup Data tab Refresh FAB button
  const mobileRefreshBtn = document.getElementById('mobileRefreshBtn');
  if (mobileRefreshBtn) {
    mobileRefreshBtn.addEventListener('click', async () => {
      if (window.yapState?.data?.refreshData) {
        try {
          await window.yapState.data.refreshData();
          showGlobalToast('Data refreshed', 'success');
        } catch (err) {
          console.error('Failed to refresh data:', err);
          showGlobalToast('Refresh failed', 'error');
        }
      }
    });
  }
  
  // Setup recording indicator
  setupRecordingIndicator();
  
  // Handle initial hash route
  handleHashRoute();
  window.addEventListener('hashchange', handleHashRoute);
  
  // Setup keyboard shortcuts
  setupKeyboardShortcuts();
  
  // Check backend availability
  checkBackends();
  
  // Initialize FAB mode for initial tab
  updateFabMode(activeTab);
  
  // Expose global helpers
  window.yapState = window.yapState || {};
  window.yapState.showMessage = showMessage;
  window.yapState.showGlobalToast = showGlobalToast;
  window.yapState.data = data;  // Expose data module for ASR/TTS to record events
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
