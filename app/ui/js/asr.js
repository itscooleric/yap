// Yap - ASR Tab (Automatic Speech Recognition)
// Multi-clip recording, transcription, and transcript management

import { util } from './util.js';
import { createAddonWindow } from './addons.js';
import { openExportPanel } from './export.js';

// Import data module for metrics recording
function getDataModule() {
  return window.yapState?.data || { recordEvent: async () => {}, isEnabled: () => false };
}

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
  collapseBlankLines: true,
  trimWhitespace: true,
  betweenClips: 'blank', // 'single' or 'blank'
  cleanLineBreaks: false,
  lineBreakMode: 'paragraphs', // 'paragraphs' or 'single'
  // QoL settings
  autoTranscribe: false,
  autoCopy: false,
  confirmClear: true,
  confirmDeleteClip: true
};

// DOM elements (set in init)
let elements = {};

// Constants
const BAR_COUNT = 48;

// Load settings from localStorage
function loadSettings() {
  transcriptSettings = {
    showSeparators: util.storage.get('settings.transcript.showSeparators', false),
    collapseBlankLines: util.storage.get('settings.transcript.collapseBlankLines', true),
    trimWhitespace: util.storage.get('settings.transcript.trimWhitespace', true),
    betweenClips: util.storage.get('settings.transcript.betweenClips', 'blank'),
    cleanLineBreaks: util.storage.get('settings.transcript.cleanLineBreaks', false),
    lineBreakMode: util.storage.get('settings.transcript.lineBreakMode', 'paragraphs'),
    // QoL settings
    autoTranscribe: util.storage.get('settings.asr.autoTranscribe', false),
    autoCopy: util.storage.get('settings.asr.autoCopy', false),
    confirmClear: util.storage.get('settings.asr.confirmClear', true),
    confirmDeleteClip: util.storage.get('settings.asr.confirmDeleteClip', true)
  };
}

// Save settings to localStorage
function saveSettings() {
  util.storage.set('settings.transcript.showSeparators', transcriptSettings.showSeparators);
  util.storage.set('settings.transcript.collapseBlankLines', transcriptSettings.collapseBlankLines);
  util.storage.set('settings.transcript.trimWhitespace', transcriptSettings.trimWhitespace);
  util.storage.set('settings.transcript.betweenClips', transcriptSettings.betweenClips);
  util.storage.set('settings.transcript.cleanLineBreaks', transcriptSettings.cleanLineBreaks);
  util.storage.set('settings.transcript.lineBreakMode', transcriptSettings.lineBreakMode);
  util.storage.set('settings.asr.autoTranscribe', transcriptSettings.autoTranscribe);
  util.storage.set('settings.asr.autoCopy', transcriptSettings.autoCopy);
  util.storage.set('settings.asr.confirmClear', transcriptSettings.confirmClear);
  util.storage.set('settings.asr.confirmDeleteClip', transcriptSettings.confirmDeleteClip);
}

// Format transcript text for display/copy based on settings
function formatTranscript(text) {
  let result = text;
  
  // Trim leading/trailing whitespace
  if (transcriptSettings.trimWhitespace) {
    result = result.trim();
  }
  
  // Collapse multiple blank lines
  if (transcriptSettings.collapseBlankLines) {
    result = result.replace(/\n{3,}/g, '\n\n');
  }
  
  // Apply line break cleanup
  result = util.cleanupText(result, transcriptSettings.cleanLineBreaks, transcriptSettings.lineBreakMode);
  
  return result;
}

// Get combined transcript text based on settings
function getCombinedTranscript(withSeparators = null) {
  const useSeparators = withSeparators !== null ? withSeparators : transcriptSettings.showSeparators;
  const joiner = transcriptSettings.betweenClips === 'blank' ? '\n\n' : '\n';
  
  const transcribedClips = clips.filter(c => c.transcript && c.status === 'transcribed');
  if (transcribedClips.length === 0) return '';
  
  const parts = transcribedClips.map((clip, index) => {
    let text = clip.transcript;
    text = formatTranscript(text);
    
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
  return formatTranscript(clip.transcript);
}

// Update transcript display
function updateTranscriptDisplay() {
  if (!elements.transcript) return;
  
  const text = getCombinedTranscript(transcriptSettings.showSeparators);
  elements.transcript.value = text;
  
  const hasText = text.length > 0;
  elements.copyBtn.disabled = !hasText;
  elements.downloadTxtBtn.disabled = !hasText;
  if (elements.exportBtn) {
    elements.exportBtn.disabled = !hasText;
  }
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
    updateMobileToolbarState();
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
  updateMobileToolbarState();
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

// Handle uploaded audio file
function handleAudioFileUpload(file) {
  if (!file) return;

  // Validate file type - check both MIME type and extension
  const validTypes = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/flac', 'audio/x-flac'];
  const lastDotIndex = file.name.lastIndexOf('.');
  const fileExt = lastDotIndex > 0 ? file.name.slice(lastDotIndex + 1).toLowerCase() : '';
  const validExts = ['mp3', 'wav', 'webm', 'ogg', 'm4a', 'flac'];
  const DEFAULT_MIME_TYPE = 'audio/wav';
  
  if (!validTypes.includes(file.type) && !validExts.includes(fileExt)) {
    showMessage('Invalid file type. Please upload an audio file.', 'error');
    // Reset file input display
    if (elements.fileName) {
      elements.fileName.textContent = 'No file selected';
    }
    return;
  }

  // Get audio duration by loading the file in a temporary Audio element
  // This allows us to display accurate clip duration in the UI
  // If duration extraction fails, we fallback to 0 (unknown duration)
  const reader = new FileReader();
  reader.onload = (e) => {
    const blob = new Blob([e.target.result], { type: file.type || DEFAULT_MIME_TYPE });
    const tempUrl = URL.createObjectURL(blob);
    const tempAudio = new Audio();
    
    const cleanup = () => {
      URL.revokeObjectURL(tempUrl);
    };
    
    tempAudio.onloadedmetadata = () => {
      const durationMs = Math.floor(tempAudio.duration * 1000);
      cleanup();
      
      // Add as clip
      addClip(blob, file.type || DEFAULT_MIME_TYPE, durationMs);
      
      setStatus('done', 'File uploaded');
      showMessage(`Uploaded: ${file.name}`, 'success');
      
      // Reset file input
      if (elements.fileInput) {
        elements.fileInput.value = '';
      }
      if (elements.fileName) {
        elements.fileName.textContent = 'No file selected';
      }
    };
    
    tempAudio.onerror = () => {
      // Fallback: if we can't get duration, use 0
      cleanup();
      addClip(blob, file.type || DEFAULT_MIME_TYPE, 0);
      
      setStatus('done', 'File uploaded');
      showMessage(`Uploaded: ${file.name} (duration unknown)`, 'success');
      
      // Reset file input
      if (elements.fileInput) {
        elements.fileInput.value = '';
      }
      if (elements.fileName) {
        elements.fileName.textContent = 'No file selected';
      }
    };
    
    tempAudio.src = tempUrl;
  };
  
  reader.onerror = () => {
    showMessage('Failed to read file', 'error');
    setStatus('error', 'Upload failed');
    // Reset file input display
    if (elements.fileName) {
      elements.fileName.textContent = 'No file selected';
    }
  };
  
  reader.readAsArrayBuffer(file);
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

      const newClip = addClip(blob, actualMimeType, durationMs);
      
      // Record metrics event
      getDataModule().recordEvent('asr_record', {
        duration: durationMs / 1000,
        status: 'success'
      });

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
      
      // Auto-transcribe if enabled
      if (transcriptSettings.autoTranscribe && newClip) {
        setTimeout(() => {
          transcribeSingle(newClip.id).then(() => {
            // Auto-copy after transcription if enabled
            if (transcriptSettings.autoCopy) {
              copyTranscript().then(() => {
                showMessage('Transcribed and copied', 'success');
              });
            }
          });
        }, 100);
      }
    };

    mediaRecorder.start();
    startTimer();
    drawBarMeter();

    setStatus('recording', 'Recording...');
    elements.recordBtn.disabled = true;
    elements.recordBtn.classList.add('recording');
    elements.stopBtn.disabled = false;
    updateRecordingIndicator();
    updateMobileToolbarState();

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
  updateMobileToolbarState();
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
    
    // Record metrics event
    getDataModule().recordEvent('asr_transcribe', {
      duration: clip.durationMs / 1000,
      outputChars: cleanedText.length,
      status: 'success'
    });
    
    return cleanedText;

  } catch (err) {
    console.error('Transcription error:', err);
    updateClipStatus(clip.id, 'error');
    
    // Record failed transcription
    getDataModule().recordEvent('asr_transcribe', {
      duration: clip.durationMs / 1000,
      status: 'error'
    });
    
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
  const text = getCombinedTranscript();
  if (!text) return;
  util.downloadText(text, `transcript-${Date.now()}.txt`);
}

// Copy functions
async function copyTranscript() {
  // Copy exactly what is displayed in the transcript area
  const text = getCombinedTranscript();
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
  createAddonWindow('Settings', (container) => {
    container.innerHTML = `
      <div class="settings-section-title">Data & Metrics</div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch" id="settingEnableMetrics"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">Metrics tracking status (view only)</span>
        </div>
        <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 2.8rem;">Server-side SQLite storage • Click for configuration info • Max 5000 events, 30 days retention</span>
      </div>
      
      <div class="settings-section-title">Behavior</div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch ${transcriptSettings.autoTranscribe ? 'active' : ''}" id="settingAutoTranscribe"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">Auto-transcribe when recording stops</span>
        </div>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch ${transcriptSettings.autoCopy ? 'active' : ''}" id="settingAutoCopy"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">Auto-copy after transcription</span>
        </div>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch ${transcriptSettings.confirmClear ? 'active' : ''}" id="settingConfirmClear"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">Confirm before clearing</span>
        </div>
        <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 2.8rem;">Shift+Click always bypasses</span>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch ${transcriptSettings.confirmDeleteClip ? 'active' : ''}" id="settingConfirmDeleteClip"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">Confirm before deleting clip</span>
        </div>
      </div>
      
      <div class="settings-section-title" style="margin-top: 1.5rem;">Formatting</div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch ${transcriptSettings.showSeparators ? 'active' : ''}" id="settingShowSeparators"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">Show clip separators</span>
        </div>
        <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 2.8rem;">Display "--- Clip N ---"</span>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch ${transcriptSettings.collapseBlankLines ? 'active' : ''}" id="settingCollapseBlankLines"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">Collapse multiple blank lines</span>
        </div>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch ${transcriptSettings.trimWhitespace ? 'active' : ''}" id="settingTrimWhitespace"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">Trim leading/trailing whitespace</span>
        </div>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="margin-bottom: 0.5rem;">Between clips</label>
        <select id="settingBetweenClips" class="formatting-select" style="width: 100%;">
          <option value="blank" ${transcriptSettings.betweenClips === 'blank' ? 'selected' : ''}>Blank line</option>
          <option value="single" ${transcriptSettings.betweenClips === 'single' ? 'selected' : ''}>Single newline</option>
        </select>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch ${transcriptSettings.cleanLineBreaks ? 'active' : ''}" id="settingCleanLineBreaks"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">Normalize whitespace</span>
        </div>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="margin-bottom: 0.5rem;">Line break mode</label>
        <select id="settingLineBreakMode" class="formatting-select" style="width: 100%;">
          <option value="paragraphs" ${transcriptSettings.lineBreakMode === 'paragraphs' ? 'selected' : ''}>Keep paragraphs</option>
          <option value="single" ${transcriptSettings.lineBreakMode === 'single' ? 'selected' : ''}>Single line</option>
        </select>
      </div>
      
      <div class="settings-section-title" style="margin-top: 1.5rem;">Keyboard Shortcuts</div>
      <div style="font-size: 0.75rem; color: var(--text-muted);">
        <p><strong>Space</strong> – Start/Stop recording</p>
        <p><strong>Ctrl+Enter</strong> – Transcribe all</p>
        <p><strong>Ctrl+Shift+C</strong> – Copy transcript</p>
      </div>
    `;
    
    // Event handler - Metrics
    const metricsToggle = container.querySelector('#settingEnableMetrics');
    if (metricsToggle) {
      // Check if metrics are enabled via data module
      const dataModule = getDataModule();
      const metricsEnabled = dataModule.isEnabled();
      metricsToggle.classList.toggle('active', metricsEnabled);
      
      metricsToggle.addEventListener('click', function() {
        // Since metrics are now server-side, show info message
        alert('Metrics are controlled by the METRICS_ENABLED environment variable in your docker-compose.yml.\n\nCurrent status: ' + (metricsEnabled ? 'Enabled' : 'Disabled') + '\n\nTo change: Update METRICS_ENABLED in app/.env or docker-compose.yml and restart the yap-metrics service.');
      });
    }
    
    // Event handlers - Behavior
    container.querySelector('#settingAutoTranscribe').addEventListener('click', function() {
      transcriptSettings.autoTranscribe = !transcriptSettings.autoTranscribe;
      this.classList.toggle('active', transcriptSettings.autoTranscribe);
      saveSettings();
    });
    
    container.querySelector('#settingAutoCopy').addEventListener('click', function() {
      transcriptSettings.autoCopy = !transcriptSettings.autoCopy;
      this.classList.toggle('active', transcriptSettings.autoCopy);
      saveSettings();
    });
    
    container.querySelector('#settingConfirmClear').addEventListener('click', function() {
      transcriptSettings.confirmClear = !transcriptSettings.confirmClear;
      this.classList.toggle('active', transcriptSettings.confirmClear);
      saveSettings();
    });
    
    container.querySelector('#settingConfirmDeleteClip').addEventListener('click', function() {
      transcriptSettings.confirmDeleteClip = !transcriptSettings.confirmDeleteClip;
      this.classList.toggle('active', transcriptSettings.confirmDeleteClip);
      saveSettings();
    });
    
    // Event handlers - Formatting
    container.querySelector('#settingShowSeparators').addEventListener('click', function() {
      transcriptSettings.showSeparators = !transcriptSettings.showSeparators;
      this.classList.toggle('active', transcriptSettings.showSeparators);
      saveSettings();
      updateTranscriptDisplay();
    });
    
    container.querySelector('#settingCollapseBlankLines').addEventListener('click', function() {
      transcriptSettings.collapseBlankLines = !transcriptSettings.collapseBlankLines;
      this.classList.toggle('active', transcriptSettings.collapseBlankLines);
      saveSettings();
      updateTranscriptDisplay();
    });
    
    container.querySelector('#settingTrimWhitespace').addEventListener('click', function() {
      transcriptSettings.trimWhitespace = !transcriptSettings.trimWhitespace;
      this.classList.toggle('active', transcriptSettings.trimWhitespace);
      saveSettings();
      updateTranscriptDisplay();
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
  }, { width: 380, height: 550, windowId: 'settings' });
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
    downloadTxtBtn: container.querySelector('#downloadTxtBtn'),
    exportBtn: container.querySelector('#exportBtn'),
    transcript: container.querySelector('#transcript'),
    statusDot: container.querySelector('#asrStatusDot'),
    statusText: container.querySelector('#asrStatusText'),
    timer: container.querySelector('#timer'),
    canvas: container.querySelector('#waveform'),
    message: container.querySelector('#asrMessage'),
    clipsContainer: container.querySelector('#clipsContainer'),
    clipsCount: container.querySelector('#clipsCount'),
    fileInput: container.querySelector('#asrFileInput'),
    uploadBtn: container.querySelector('#asrUploadBtn'),
    fileName: container.querySelector('#asrFileName')
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
  elements.clearBtn?.addEventListener('click', (e) => {
    // Shift+Click bypasses confirmation; also skip if confirmClear is false
    const shouldConfirm = transcriptSettings.confirmClear && !e.shiftKey;
    if (!shouldConfirm || confirm('Clear all clips and transcript?')) {
      clearAllClips();
      showMessage('Cleared', 'success');
    }
  });
  
  elements.copyBtn?.addEventListener('click', () => copyTranscript());
  elements.downloadTxtBtn?.addEventListener('click', downloadTranscript);
  elements.exportBtn?.addEventListener('click', () => {
    openExportPanel(
      () => getCombinedTranscript(),
      () => clips.slice()
    );
  });

  // File upload handlers
  elements.uploadBtn?.addEventListener('click', () => elements.fileInput?.click());

  elements.fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      // Show filename immediately for better UX
      // Will be reset if validation fails in handleAudioFileUpload
      if (elements.fileName) {
        elements.fileName.textContent = file.name;
      }
      handleAudioFileUpload(file);
    }
  });

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
      // Skip confirmation if confirmDeleteClip is false
      if (!transcriptSettings.confirmDeleteClip || confirm('Remove this clip?')) {
        removeClip(id);
      }
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Only handle if ASR tab is active
    const asrTab = document.getElementById('asr-tab');
    if (!asrTab || !asrTab.classList.contains('active')) return;
    
    // Space: toggle recording (only when body is focused)
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      if (!elements.recordBtn.disabled) {
        startRecording();
      } else if (!elements.stopBtn.disabled) {
        stopRecording();
      }
    }
    
    // Ctrl+Enter or Cmd+Enter: Transcribe All
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!elements.transcribeAllBtn.disabled) {
        transcribeAll();
      }
    }
    
    // Ctrl+Shift+C or Cmd+Shift+C: Copy transcript
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      if (!elements.copyBtn.disabled) {
        copyTranscript();
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
    getClips: () => clips.slice(),
    openSettings: openSettingsPanel
  };
}

export { openSettingsPanel };
export const asr = { init, isRecording, openSettingsPanel };
