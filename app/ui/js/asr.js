// Yap - ASR Tab (Automatic Speech Recognition)
// Multi-clip recording, transcription, and transcript management

import { util } from './util.js';
import { createAddonWindow } from './addons.js';

// ASR State
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let audioContext = null;
let analyser = null;
let animationId = null;
let startTime = null;
let timerInterval = null;

// Clips list: { id, createdAt, durationMs, mimeType, blob, objectUrl, status, transcript }
// status: 'recorded' | 'queued' | 'working' | 'transcribed' | 'error'
let clips = [];

// Transcript settings (persisted)
let transcriptSettings = {
  showSeparators: false,
  copyModeDefault: 'clean', // 'clean' or 'separators'
  betweenClips: 'blank', // 'single' or 'blank'
  cleanLineBreaks: false,
  lineBreakMode: 'paragraphs' // 'paragraphs' or 'single'
};

// DOM elements (set in init)
let elements = {};

// Constants
const BAR_COUNT = 48;

// Load settings from localStorage
function loadSettings() {
  transcriptSettings = {
    showSeparators: util.storage.get('settings.transcript.showSeparators', false),
    copyModeDefault: util.storage.get('settings.transcript.copyModeDefault', 'clean'),
    betweenClips: util.storage.get('settings.transcript.betweenClips', 'blank'),
    cleanLineBreaks: util.storage.get('settings.transcript.cleanLineBreaks', false),
    lineBreakMode: util.storage.get('settings.transcript.lineBreakMode', 'paragraphs')
  };
}

// Save settings to localStorage
function saveSettings() {
  util.storage.set('settings.transcript.showSeparators', transcriptSettings.showSeparators);
  util.storage.set('settings.transcript.copyModeDefault', transcriptSettings.copyModeDefault);
  util.storage.set('settings.transcript.betweenClips', transcriptSettings.betweenClips);
  util.storage.set('settings.transcript.cleanLineBreaks', transcriptSettings.cleanLineBreaks);
  util.storage.set('settings.transcript.lineBreakMode', transcriptSettings.lineBreakMode);
}

// Get combined transcript text based on settings
function getCombinedTranscript(withSeparators = null) {
  const useSeparators = withSeparators !== null ? withSeparators : transcriptSettings.showSeparators;
  const joiner = transcriptSettings.betweenClips === 'blank' ? '\n\n' : '\n';
  
  const transcribedClips = clips.filter(c => c.transcript && c.status === 'transcribed');
  if (transcribedClips.length === 0) return '';
  
  const parts = transcribedClips.map((clip, index) => {
    let text = clip.transcript;
    text = util.cleanupText(text, transcriptSettings.cleanLineBreaks, transcriptSettings.lineBreakMode);
    
    if (useSeparators) {
      return `--- Clip ${index + 1} ---\n${text}`;
    }
    return text;
  });
  
  return parts.join(joiner);
}

// Get single clip transcript
function getClipTranscript(clipId) {
  const clip = clips.find(c => c.id === clipId);
  if (!clip || !clip.transcript) return '';
  return util.cleanupText(clip.transcript, transcriptSettings.cleanLineBreaks, transcriptSettings.lineBreakMode);
}

// Update transcript display
function updateTranscriptDisplay() {
  if (!elements.transcript) return;
  
  const text = getCombinedTranscript(transcriptSettings.showSeparators);
  elements.transcript.value = text;
  
  const hasText = text.length > 0;
  elements.copyBtn.disabled = !hasText;
  elements.downloadTxtBtn.disabled = !hasText;
}

// Status management
function setStatus(status, text) {
  if (!elements.statusDot) return;
  elements.statusDot.className = 'status-dot ' + status;
  elements.statusText.textContent = text;
}

// Timer management
function updateTimer() {
  if (!startTime || !elements.timer) return;
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  elements.timer.textContent = util.formatSeconds(elapsed);
  
  // Update header recording indicator
  updateRecordingIndicator();
}

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 100);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  stopTimer();
  startTime = null;
  if (elements.timer) {
    elements.timer.textContent = '00:00';
  }
}

// Recording indicator in header
function updateRecordingIndicator() {
  const indicator = document.getElementById('recordingIndicator');
  const indicatorTime = document.getElementById('recordingIndicatorTime');
  
  if (!indicator) return;
  
  if (mediaRecorder && mediaRecorder.state === 'recording' && startTime) {
    indicator.classList.add('active');
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    indicatorTime.textContent = util.formatSeconds(elapsed);
  } else {
    indicator.classList.remove('active');
  }
}

// Check if currently recording
export function isRecording() {
  return mediaRecorder && mediaRecorder.state === 'recording';
}

// Bar meter visualization
function drawBarMeter() {
  if (!analyser || !elements.canvas) return;

  const frequencyData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(frequencyData);

  const width = elements.canvas.offsetWidth;
  const height = elements.canvas.offsetHeight;

  elements.canvasCtx.fillStyle = '#1a1a24';
  elements.canvasCtx.fillRect(0, 0, width, height);

  const barWidth = width / BAR_COUNT;
  const gap = 2;
  const binSize = Math.floor(frequencyData.length / BAR_COUNT);
  if (binSize === 0) return;

  for (let i = 0; i < BAR_COUNT; i++) {
    let sum = 0;
    const startIdx = i * binSize;
    const endIdx = Math.min(startIdx + binSize, frequencyData.length);
    for (let j = startIdx; j < endIdx; j++) {
      sum += frequencyData[j];
    }
    const avg = sum / (endIdx - startIdx);

    const barHeight = Math.max(2, (avg / 255) * height);
    const x = i * barWidth;
    const y = height - barHeight;

    elements.canvasCtx.fillStyle = '#a855f7';
    elements.canvasCtx.fillRect(x + gap / 2, y, barWidth - gap, barHeight);
  }

  animationId = requestAnimationFrame(drawBarMeter);
}

function drawIdleBars() {
  if (!elements.canvas || !elements.canvasCtx) return;
  
  const width = elements.canvas.offsetWidth;
  const height = elements.canvas.offsetHeight;

  elements.canvasCtx.fillStyle = '#1a1a24';
  elements.canvasCtx.fillRect(0, 0, width, height);

  const barWidth = width / BAR_COUNT;
  const gap = 2;
  const minHeight = 2;

  for (let i = 0; i < BAR_COUNT; i++) {
    const x = i * barWidth;
    elements.canvasCtx.fillStyle = '#3a3a4a';
    elements.canvasCtx.fillRect(x + gap / 2, height - minHeight, barWidth - gap, minHeight);
  }
}

// Canvas DPI correction
function resizeCanvas() {
  if (!elements.canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = elements.canvas.getBoundingClientRect();
  elements.canvas.width = rect.width * dpr;
  elements.canvas.height = rect.height * dpr;
  elements.canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawIdleBars();
}

// Clips management
function updateClipsUI() {
  if (!elements.clipsContainer) return;
  
  elements.clipsCount.textContent = clips.length;

  if (clips.length === 0) {
    elements.clipsContainer.innerHTML = '<div class="no-clips">No clips recorded</div>';
    elements.transcribeAllBtn.disabled = true;
    elements.clearBtn.disabled = true;
    return;
  }

  elements.transcribeAllBtn.disabled = false;
  elements.clearBtn.disabled = false;

  elements.clipsContainer.innerHTML = '';
  clips.forEach((clip, index) => {
    const div = document.createElement('div');
    div.className = 'clip-item';
    div.dataset.clipId = clip.id;

    const durationStr = util.formatDuration(clip.durationMs);
    const hasTranscript = clip.transcript && clip.status === 'transcribed';

    div.innerHTML = `
      <div class="clip-info">
        <span class="clip-name">Clip ${index + 1}</span>
        <span class="clip-duration">${durationStr}</span>
        <span class="clip-status ${clip.status}">${clip.status}</span>
      </div>
      <div class="clip-actions">
        ${hasTranscript ? `<button class="small" data-action="copy-text" data-id="${clip.id}">Copy text</button>` : ''}
        <button class="small" data-action="transcribe" data-id="${clip.id}" ${clip.status === 'transcribed' ? 'disabled' : ''}>Transcribe</button>
        <button class="small" data-action="download" data-id="${clip.id}">Download</button>
        <button class="small danger" data-action="remove" data-id="${clip.id}">X</button>
      </div>
    `;
    elements.clipsContainer.appendChild(div);
  });
  
  updateTranscriptDisplay();
}

function addClip(blob, mimeType, durationMs) {
  const id = util.generateId();
  const objectUrl = URL.createObjectURL(blob);
  const clip = {
    id,
    createdAt: new Date(),
    durationMs,
    mimeType,
    blob,
    objectUrl,
    status: 'recorded',
    transcript: null
  };
  clips.push(clip);
  updateClipsUI();
  return clip;
}

function removeClip(id) {
  const index = clips.findIndex(c => c.id === id);
  if (index !== -1) {
    const clip = clips[index];
    URL.revokeObjectURL(clip.objectUrl);
    clips.splice(index, 1);
    updateClipsUI();
  }
}

function clearAllClips() {
  clips.forEach(clip => URL.revokeObjectURL(clip.objectUrl));
  clips = [];
  if (elements.transcript) {
    elements.transcript.value = '';
  }
  elements.copyBtn.disabled = true;
  elements.downloadTxtBtn.disabled = true;
  updateClipsUI();
  setStatus('', 'Idle');
}

function updateClipStatus(id, status, transcript = null) {
  const clip = clips.find(c => c.id === id);
  if (clip) {
    clip.status = status;
    if (transcript !== null) {
      clip.transcript = transcript;
    }
    updateClipsUI();
  }
}

// Recording
async function startRecording() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;

    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(analyser);

    const mimeType = util.getSupportedMimeType();
    const options = mimeType ? { mimeType } : {};
    mediaRecorder = new MediaRecorder(audioStream, options);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
      const blob = new Blob(audioChunks, { type: actualMimeType });
      const durationMs = startTime ? Date.now() - startTime : 0;

      addClip(blob, actualMimeType, durationMs);

      stopTimer();
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      drawIdleBars();
      updateRecordingIndicator();

      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (audioContext) {
        const ctx = audioContext;
        audioContext = null;
        analyser = null;
        ctx.close().catch(err => console.warn('AudioContext close error:', err));
      }

      setStatus('done', 'Clip saved');
    };

    mediaRecorder.start();
    startTimer();
    drawBarMeter();

    setStatus('recording', 'Recording...');
    elements.recordBtn.disabled = true;
    elements.recordBtn.classList.add('recording');
    elements.stopBtn.disabled = false;
    updateRecordingIndicator();

  } catch (err) {
    console.error('Recording error:', err);
    setStatus('error', 'Microphone access denied');
    showMessage('Error: Could not access microphone. Please allow microphone access.', 'error');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  elements.recordBtn.disabled = false;
  elements.recordBtn.classList.remove('recording');
  elements.stopBtn.disabled = true;
}

// Transcription
async function transcribeSingleClip(clip) {
  updateClipStatus(clip.id, 'working');

  try {
    const formData = new FormData();
    const ext = util.getExtensionFromMimeType(clip.mimeType);
    formData.append('audio_file', clip.blob, `recording.${ext}`);

    const response = await fetch('/asr?output=txt', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const cleanedText = text.trim();
    updateClipStatus(clip.id, 'transcribed', cleanedText);
    return cleanedText;

  } catch (err) {
    console.error('Transcription error:', err);
    updateClipStatus(clip.id, 'error');
    throw err;
  }
}

async function transcribeAll() {
  if (clips.length === 0) {
    showMessage('No clips to transcribe', 'error');
    return;
  }

  setStatus('processing', 'Transcribing...');
  elements.transcribeAllBtn.disabled = true;
  elements.recordBtn.disabled = true;

  // Mark all non-transcribed as queued
  clips.forEach(clip => {
    if (clip.status === 'recorded') {
      updateClipStatus(clip.id, 'queued');
    }
  });

  let hasError = false;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (clip.status === 'transcribed') continue;

    setStatus('processing', `Transcribing clip ${i + 1}/${clips.length}...`);

    try {
      await transcribeSingleClip(clip);
    } catch (err) {
      hasError = true;
    }
  }

  updateTranscriptDisplay();
  setStatus(hasError ? 'error' : 'done', hasError ? 'Done with errors' : 'Done');
  showMessage(hasError ? 'Transcription completed with errors' : 'Transcription complete', hasError ? 'error' : 'success');

  elements.transcribeAllBtn.disabled = false;
  elements.recordBtn.disabled = false;
}

async function transcribeSingle(clipId) {
  const clip = clips.find(c => c.id === clipId);
  if (!clip) return;

  setStatus('processing', 'Transcribing...');

  try {
    await transcribeSingleClip(clip);
    updateTranscriptDisplay();
    setStatus('done', 'Done');
    showMessage('Transcription complete', 'success');
  } catch (err) {
    setStatus('error', 'Error');
    showMessage(`Transcription failed: ${err.message}`, 'error');
  }
}

// Download functions
function downloadClip(clipId) {
  const clip = clips.find(c => c.id === clipId);
  if (!clip) return;

  const ext = util.getExtensionFromMimeType(clip.mimeType);
  const a = document.createElement('a');
  a.href = clip.objectUrl;
  a.download = `clip-${clipId}-${Date.now()}.${ext}`;
  a.click();
}

function downloadTranscript() {
  const text = getCombinedTranscript(transcriptSettings.copyModeDefault === 'separators');
  if (!text) return;
  util.downloadText(text, `transcript-${Date.now()}.txt`);
}

// Copy functions
async function copyTranscript(withSeparators = null) {
  const useSeparators = withSeparators !== null ? withSeparators : (transcriptSettings.copyModeDefault === 'separators');
  const text = getCombinedTranscript(useSeparators);
  if (!text) return;
  
  const success = await util.copyToClipboard(text);
  showMessage(success ? 'Copied' : 'Copy failed', success ? 'success' : 'error');
}

async function copyClipTranscript(clipId) {
  const text = getClipTranscript(clipId);
  if (!text) return;
  
  const success = await util.copyToClipboard(text);
  showMessage(success ? 'Copied' : 'Copy failed', success ? 'success' : 'error');
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

// Settings panel
function openSettingsPanel() {
  createAddonWindow('Transcript Settings', (container) => {
    container.innerHTML = `
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="margin-bottom: 0.5rem;">Display separators in transcript</label>
        <div class="toggle-container">
          <div class="toggle-switch ${transcriptSettings.showSeparators ? 'active' : ''}" id="settingShowSeparators"></div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Show "--- Clip N ---"</span>
        </div>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="margin-bottom: 0.5rem;">Default copy mode</label>
        <select id="settingCopyMode" class="formatting-select" style="width: 100%;">
          <option value="clean" ${transcriptSettings.copyModeDefault === 'clean' ? 'selected' : ''}>Clean (no separators)</option>
          <option value="separators" ${transcriptSettings.copyModeDefault === 'separators' ? 'selected' : ''}>With separators</option>
        </select>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="margin-bottom: 0.5rem;">Between clips</label>
        <select id="settingBetweenClips" class="formatting-select" style="width: 100%;">
          <option value="blank" ${transcriptSettings.betweenClips === 'blank' ? 'selected' : ''}>Blank line</option>
          <option value="single" ${transcriptSettings.betweenClips === 'single' ? 'selected' : ''}>Single newline</option>
        </select>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="margin-bottom: 0.5rem;">Clean line breaks</label>
        <div class="toggle-container">
          <div class="toggle-switch ${transcriptSettings.cleanLineBreaks ? 'active' : ''}" id="settingCleanLineBreaks"></div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Normalize whitespace</span>
        </div>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="margin-bottom: 0.5rem;">Line break mode</label>
        <select id="settingLineBreakMode" class="formatting-select" style="width: 100%;">
          <option value="paragraphs" ${transcriptSettings.lineBreakMode === 'paragraphs' ? 'selected' : ''}>Keep paragraphs</option>
          <option value="single" ${transcriptSettings.lineBreakMode === 'single' ? 'selected' : ''}>Single line</option>
        </select>
      </div>
    `;
    
    // Event handlers
    container.querySelector('#settingShowSeparators').addEventListener('click', function() {
      transcriptSettings.showSeparators = !transcriptSettings.showSeparators;
      this.classList.toggle('active', transcriptSettings.showSeparators);
      saveSettings();
      updateTranscriptDisplay();
    });
    
    container.querySelector('#settingCopyMode').addEventListener('change', function() {
      transcriptSettings.copyModeDefault = this.value;
      saveSettings();
    });
    
    container.querySelector('#settingBetweenClips').addEventListener('change', function() {
      transcriptSettings.betweenClips = this.value;
      saveSettings();
      updateTranscriptDisplay();
    });
    
    container.querySelector('#settingCleanLineBreaks').addEventListener('click', function() {
      transcriptSettings.cleanLineBreaks = !transcriptSettings.cleanLineBreaks;
      this.classList.toggle('active', transcriptSettings.cleanLineBreaks);
      saveSettings();
      updateTranscriptDisplay();
    });
    
    container.querySelector('#settingLineBreakMode').addEventListener('change', function() {
      transcriptSettings.lineBreakMode = this.value;
      saveSettings();
      updateTranscriptDisplay();
    });
  });
}

// Initialize ASR tab
export function init(container) {
  loadSettings();
  
  // Cache DOM elements
  elements = {
    recordBtn: container.querySelector('#recordBtn'),
    stopBtn: container.querySelector('#stopBtn'),
    transcribeAllBtn: container.querySelector('#transcribeAllBtn'),
    clearBtn: container.querySelector('#clearBtn'),
    copyBtn: container.querySelector('#copyBtn'),
    copyCleanBtn: container.querySelector('#copyCleanBtn'),
    copySeparatorsBtn: container.querySelector('#copySeparatorsBtn'),
    downloadTxtBtn: container.querySelector('#downloadTxtBtn'),
    settingsBtn: container.querySelector('#asrSettingsBtn'),
    transcript: container.querySelector('#transcript'),
    statusDot: container.querySelector('#asrStatusDot'),
    statusText: container.querySelector('#asrStatusText'),
    timer: container.querySelector('#timer'),
    canvas: container.querySelector('#waveform'),
    message: container.querySelector('#asrMessage'),
    clipsContainer: container.querySelector('#clipsContainer'),
    clipsCount: container.querySelector('#clipsCount')
  };
  
  if (elements.canvas) {
    elements.canvasCtx = elements.canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  // Event listeners
  elements.recordBtn?.addEventListener('click', startRecording);
  elements.stopBtn?.addEventListener('click', stopRecording);
  elements.transcribeAllBtn?.addEventListener('click', transcribeAll);
  elements.clearBtn?.addEventListener('click', () => {
    if (confirm('Clear all clips and transcript?')) {
      clearAllClips();
      showMessage('Cleared', 'success');
    }
  });
  
  elements.copyBtn?.addEventListener('click', () => copyTranscript());
  elements.copyCleanBtn?.addEventListener('click', () => copyTranscript(false));
  elements.copySeparatorsBtn?.addEventListener('click', () => copyTranscript(true));
  elements.downloadTxtBtn?.addEventListener('click', downloadTranscript);
  elements.settingsBtn?.addEventListener('click', openSettingsPanel);

  // Clip actions handler
  elements.clipsContainer?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'transcribe') {
      transcribeSingle(id);
    } else if (action === 'download') {
      downloadClip(id);
    } else if (action === 'copy-text') {
      copyClipTranscript(id);
    } else if (action === 'remove') {
      if (confirm('Remove this clip?')) {
        removeClip(id);
      }
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Only handle if ASR tab is active
    const asrTab = document.getElementById('asr-tab');
    if (!asrTab || !asrTab.classList.contains('active')) return;
    
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      if (!elements.recordBtn.disabled) {
        startRecording();
      } else if (!elements.stopBtn.disabled) {
        stopRecording();
      }
    }
  });

  // Initial state
  updateClipsUI();
  drawIdleBars();
  
  // Expose state for addons
  window.yapState = window.yapState || {};
  window.yapState.asr = {
    getTranscript: () => getCombinedTranscript(false),
    setTranscript: (text) => {
      if (elements.transcript) {
        elements.transcript.value = text;
        elements.copyBtn.disabled = !text;
        elements.downloadTxtBtn.disabled = !text;
        // Note: This replaces the transcript directly, bypassing clip-based display
      }
    },
    getClips: () => clips.slice()
  };
}

export const asr = { init, isRecording };
