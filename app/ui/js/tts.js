// Yap - TTS Tab (Text-to-Speech)
// Text input, voice selection, synthesis, and audio playback

import { util } from './util.js';

// TTS State
let voices = [];
let currentAudioUrl = null;
let currentAudioBlob = null;

// DOM elements (set in init)
let elements = {};

// Load available voices
async function loadVoices() {
  try {
    const response = await fetch('/tts/voices');
    if (!response.ok) {
      throw new Error('Failed to fetch voices: ' + response.status);
    }

    const data = await response.json();

    // Normalize response to array of strings
    if (Array.isArray(data)) {
      voices = data.map(v => typeof v === 'string' ? v : (v.name || v.id || String(v)));
    } else if (data && typeof data === 'object' && Array.isArray(data.voices)) {
      voices = data.voices.map(v => typeof v === 'string' ? v : (v.name || v.id || String(v)));
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      voices = Object.keys(data);
    } else {
      throw new Error('Unrecognized voices format');
    }

    populateVoiceSelect();

  } catch (err) {
    console.error('Failed to load voices:', err);
    if (elements.voiceSelect) {
      elements.voiceSelect.innerHTML = '<option value="">No voices available</option>';
    }
    showMessage('Failed to load voices: ' + err.message, 'error');
  }
}

function populateVoiceSelect() {
  if (!elements.voiceSelect) return;
  
  elements.voiceSelect.innerHTML = '';

  if (voices.length === 0) {
    elements.voiceSelect.innerHTML = '<option value="">No voices available</option>';
    elements.synthesizeBtn.disabled = true;
    return;
  }

  // Try to restore last selected voice from localStorage
  const savedVoice = util.storage.get('tts.voice', null);

  // Find default voice (prefer saved, then en_GB-cori-high, then en_GB-cori-medium)
  let defaultVoice = voices[0];
  if (savedVoice && voices.includes(savedVoice)) {
    defaultVoice = savedVoice;
  } else if (voices.includes('en_GB-cori-high')) {
    defaultVoice = 'en_GB-cori-high';
  } else if (voices.includes('en_GB-cori-medium')) {
    defaultVoice = 'en_GB-cori-medium';
  }

  voices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice;
    option.textContent = voice;
    if (voice === defaultVoice) {
      option.selected = true;
    }
    elements.voiceSelect.appendChild(option);
  });

  updateSynthesizeButton();
}

function updateSynthesizeButton() {
  if (!elements.synthesizeBtn || !elements.textInput || !elements.voiceSelect) return;
  elements.synthesizeBtn.disabled = !elements.textInput.value.trim() || !elements.voiceSelect.value;
}

// Status management
function setStatus(status, text) {
  if (!elements.statusDot) return;
  elements.statusDot.className = 'status-dot ' + status;
  elements.statusText.textContent = text;
}

// Messages
function showMessage(text, type = '') {
  if (!elements.message) return;
  elements.message.textContent = text;
  elements.message.className = 'message ' + type;
  elements.message.style.display = 'block';

  setTimeout(() => {
    elements.message.style.display = 'none';
  }, 2500);
}

// Synthesize text to speech
async function synthesize() {
  const text = elements.textInput.value.trim();
  const voice = elements.voiceSelect.value;
  const lengthScale = elements.rateSlider.value;

  if (!text || !voice) {
    showMessage('Please enter text and select a voice', 'error');
    return;
  }

  setStatus('processing', 'Synthesizing...');
  elements.synthesizeBtn.disabled = true;

  try {
    const url = `/tts/synthesize/${encodeURIComponent(voice)}?length_scale=${lengthScale}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: text
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Synthesis failed: ${response.status}`);
    }

    const audioBlob = await response.blob();

    // Cleanup previous audio
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
    }

    currentAudioUrl = URL.createObjectURL(audioBlob);
    currentAudioBlob = audioBlob;
    elements.audioPlayer.src = currentAudioUrl;

    // Setup Media Session API for lock screen controls
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Yap TTS',
        artist: voice,
        album: 'Text-to-Speech'
      });
    }

    elements.outputPanel.style.display = 'block';
    setStatus('done', 'Synthesis complete');
    showMessage('Audio generated successfully', 'success');

    // Auto-play
    elements.audioPlayer.play().catch(() => {});

  } catch (err) {
    console.error('Synthesis error:', err);
    setStatus('error', 'Error');
    showMessage(`Synthesis failed: ${err.message}`, 'error');
  } finally {
    elements.synthesizeBtn.disabled = false;
    updateSynthesizeButton();
  }
}

// Download audio
function downloadAudio() {
  if (!currentAudioUrl || !currentAudioBlob) return;

  const voice = elements.voiceSelect.value || 'tts';
  const a = document.createElement('a');
  a.href = currentAudioUrl;
  a.download = `yap-${voice}-${Date.now()}.wav`;
  a.click();
}

// Initialize TTS tab
export function init(container) {
  // Cache DOM elements
  elements = {
    textInput: container.querySelector('#ttsTextInput'),
    charCount: container.querySelector('#charCount'),
    fileInput: container.querySelector('#ttsFileInput'),
    uploadBtn: container.querySelector('#ttsUploadBtn'),
    fileName: container.querySelector('#ttsFileName'),
    voiceSelect: container.querySelector('#voiceSelect'),
    rateSlider: container.querySelector('#rateSlider'),
    rateValue: container.querySelector('#rateValue'),
    synthesizeBtn: container.querySelector('#synthesizeBtn'),
    clearBtn: container.querySelector('#ttsClearBtn'),
    outputPanel: container.querySelector('#ttsOutputPanel'),
    audioPlayer: container.querySelector('#ttsAudioPlayer'),
    downloadBtn: container.querySelector('#ttsDownloadBtn'),
    playBtn: container.querySelector('#ttsPlayBtn'),
    statusDot: container.querySelector('#ttsStatusDot'),
    statusText: container.querySelector('#ttsStatusText'),
    message: container.querySelector('#ttsMessage')
  };

  // Load voices
  loadVoices();

  // Text input handlers
  elements.textInput?.addEventListener('input', () => {
    if (elements.charCount) {
      elements.charCount.textContent = elements.textInput.value.length;
    }
    updateSynthesizeButton();
  });

  // File upload
  elements.uploadBtn?.addEventListener('click', () => elements.fileInput?.click());

  elements.fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      elements.fileName.textContent = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        elements.textInput.value = e.target.result;
        if (elements.charCount) {
          elements.charCount.textContent = elements.textInput.value.length;
        }
        updateSynthesizeButton();
      };
      reader.readAsText(file);
    }
  });

  // Rate slider
  elements.rateSlider?.addEventListener('input', () => {
    if (elements.rateValue) {
      elements.rateValue.textContent = elements.rateSlider.value + 'x';
    }
  });

  // Voice selection
  elements.voiceSelect?.addEventListener('change', () => {
    if (elements.voiceSelect.value) {
      util.storage.set('tts.voice', elements.voiceSelect.value);
    }
    updateSynthesizeButton();
  });

  // Clear text
  elements.clearBtn?.addEventListener('click', () => {
    elements.textInput.value = '';
    if (elements.charCount) {
      elements.charCount.textContent = '0';
    }
    if (elements.fileName) {
      elements.fileName.textContent = 'No file selected';
    }
    if (elements.fileInput) {
      elements.fileInput.value = '';
    }
    updateSynthesizeButton();
  });

  // Synthesize
  elements.synthesizeBtn?.addEventListener('click', synthesize);

  // Play button
  elements.playBtn?.addEventListener('click', () => {
    if (elements.audioPlayer.paused) {
      elements.audioPlayer.play();
    } else {
      elements.audioPlayer.pause();
    }
  });

  // Download
  elements.downloadBtn?.addEventListener('click', downloadAudio);

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    // Only handle if TTS tab is active
    const ttsTab = document.getElementById('tts-tab');
    if (!ttsTab || !ttsTab.classList.contains('active')) return;
    
    if (e.ctrlKey && e.key === 'Enter') {
      if (!elements.synthesizeBtn.disabled) {
        synthesize();
      }
    }
  });

  // Expose state for addons
  window.yapState = window.yapState || {};
  window.yapState.tts = {
    getText: () => elements.textInput?.value || '',
    getGeneratedAudio: () => currentAudioBlob
  };
}

// Check if TTS backend is available
export async function checkHealth() {
  try {
    const response = await fetch('/tts/health');
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

export const tts = { init, checkHealth };
