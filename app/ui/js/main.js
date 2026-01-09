// Yap - Main Application
// Tab router, bootstrap, and initialization

import { asr } from './asr.js';
import { tts } from './tts.js';
import { initAddonPanel } from './addons.js';

// App state
let activeTab = 'asr';
let asrEnabled = true;
let ttsEnabled = true;

// Tab elements
const tabs = {
  asr: null,
  tts: null
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

// Switch tabs
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
  
  // Update tagline
  const tagline = document.querySelector('.tagline');
  if (tagline) {
    if (tabName === 'asr') {
      tagline.textContent = 'local automatic speech recognition';
    } else if (tabName === 'tts') {
      tagline.textContent = 'local text-to-speech';
    }
  }
  
  activeTab = tabName;
}

// Check backend availability
async function checkBackends() {
  // Check ASR
  try {
    const response = await fetch('/asr/docs');
    asrEnabled = response.ok;
  } catch {
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

// Initialize application
function init() {
  // Cache tab elements
  tabs.asr = document.getElementById('asr-tab');
  tabs.tts = document.getElementById('tts-tab');
  
  // Initialize ASR
  if (tabs.asr) {
    asr.init(tabs.asr);
  }
  
  // Initialize TTS
  if (tabs.tts) {
    tts.init(tabs.tts);
  }
  
  // Initialize addon panel
  initAddonPanel();
  
  // Setup tab navigation
  document.querySelectorAll('.nav-tabs button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });
  
  // Setup recording indicator
  setupRecordingIndicator();
  
  // Check backend availability
  checkBackends();
  
  // Expose global helpers
  window.yapState = window.yapState || {};
  window.yapState.showMessage = showMessage;
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
