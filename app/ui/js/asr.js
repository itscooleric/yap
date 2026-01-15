// Yap - ASR Tab (Automatic Speech Recognition)
// Multi-clip recording, transcription, and transcript management

import { util } from './util.js';
import { createAddonWindow } from './addons.js';
import { openExportPanel } from './export.js';
import { storage } from './storage.js';
import { audioDevices } from './audioDevices.js';

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
let storageInitialized = false;

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

// Mobile toolbar settings
let mobileSettings = {
  enableMobileToolbar: null, // null = auto-detect, true = force on, false = force off
  confirmExport: true,
  oneTapExport: false,
  lastExportTarget: null
};

// LLM settings (persisted)
let llmSettings = {
  apiEndpoint: 'http://localhost:11434/v1/chat/completions',
  modelName: 'llama3',
  apiKey: '',
  temperature: 0.7,
  maxTokens: 2048
};

// DOM elements (set in init)
let elements = {};

// Constants
const BAR_COUNT = 48;
const MOBILE_BREAKPOINT = 900; // px

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
  
  mobileSettings = {
    enableMobileToolbar: util.storage.get('settings.mobile.enableToolbar', null),
    confirmExport: util.storage.get('settings.mobile.confirmExport', true),
    oneTapExport: util.storage.get('settings.mobile.oneTapExport', false),
    lastExportTarget: util.storage.get('settings.mobile.lastExportTarget', null),
    preventRefresh: util.storage.get('settings.mobile.preventRefresh', true) // Default ON
  };
  
  llmSettings = {
    apiEndpoint: util.storage.get('settings.llm.apiEndpoint', 'http://localhost:11434/v1/chat/completions'),
    modelName: util.storage.get('settings.llm.modelName', 'llama3'),
    apiKey: util.storage.get('settings.llm.apiKey', ''),
    temperature: util.storage.get('settings.llm.temperature', 0.7),
    maxTokens: util.storage.get('settings.llm.maxTokens', 2048)
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

function saveMobileSettings() {
  util.storage.set('settings.mobile.enableToolbar', mobileSettings.enableMobileToolbar);
  util.storage.set('settings.mobile.confirmExport', mobileSettings.confirmExport);
  util.storage.set('settings.mobile.oneTapExport', mobileSettings.oneTapExport);
  util.storage.set('settings.mobile.lastExportTarget', mobileSettings.lastExportTarget);
  util.storage.set('settings.mobile.preventRefresh', mobileSettings.preventRefresh);
}

function saveLLMSettings() {
  util.storage.set('settings.llm.apiEndpoint', llmSettings.apiEndpoint);
  util.storage.set('settings.llm.modelName', llmSettings.modelName);
  util.storage.set('settings.llm.apiKey', llmSettings.apiKey);
  util.storage.set('settings.llm.temperature', llmSettings.temperature);
  util.storage.set('settings.llm.maxTokens', llmSettings.maxTokens);
}

// Validate URL format
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Validate LLM settings and show errors
function validateLLMSettings(container) {
  let isValid = true;
  const errors = [];
  
  // Clear previous errors
  container.querySelectorAll('.llm-error').forEach(el => el.remove());
  
  // Validate API endpoint
  const endpoint = llmSettings.apiEndpoint.trim();
  if (!endpoint) {
    errors.push({ field: 'llmApiEndpoint', message: 'API endpoint is required' });
    isValid = false;
  } else if (!isValidUrl(endpoint)) {
    errors.push({ field: 'llmApiEndpoint', message: 'Invalid URL format (must start with http:// or https://)' });
    isValid = false;
  }
  
  // Validate model name
  if (!llmSettings.modelName.trim()) {
    errors.push({ field: 'llmModelName', message: 'Model name is required' });
    isValid = false;
  }
  
  // Validate temperature
  const temp = parseFloat(llmSettings.temperature);
  if (isNaN(temp) || temp < 0 || temp > 2) {
    errors.push({ field: 'llmTemperature', message: 'Temperature must be between 0 and 2' });
    isValid = false;
  }
  
  // Validate maxTokens
  const tokens = parseInt(llmSettings.maxTokens);
  if (isNaN(tokens) || tokens < 1) {
    errors.push({ field: 'llmMaxTokens', message: 'Max tokens must be a positive number' });
    isValid = false;
  }
  
  // Display errors
  errors.forEach(error => {
    const input = container.querySelector(`#${error.field}`);
    if (input) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'llm-error';
      errorDiv.style.cssText = 'color: var(--error); font-size: 0.7rem; margin-top: 0.25rem;';
      errorDiv.textContent = error.message;
      input.parentElement.appendChild(errorDiv);
    }
  });
  
  return isValid;
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

// Get LLM settings (exposed as public API)
function getLLMSettings() {
  return { ...llmSettings };
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

async function addClip(blob, mimeType, durationMs) {
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
  
  // Persist to IndexedDB
  if (storageInitialized) {
    await storage.saveClip(clip);
  }
  
  return clip;
}

async function removeClip(id) {
  const index = clips.findIndex(c => c.id === id);
  if (index !== -1) {
    const clip = clips[index];
    URL.revokeObjectURL(clip.objectUrl);
    clips.splice(index, 1);
    updateClipsUI();
    
    // Remove from IndexedDB
    if (storageInitialized) {
      await storage.deleteClip(id);
    }
  }
}

async function clearAllClips() {
  clips.forEach(clip => URL.revokeObjectURL(clip.objectUrl));
  clips = [];
  if (elements.transcript) {
    elements.transcript.value = '';
  }
  elements.copyBtn.disabled = true;
  elements.downloadTxtBtn.disabled = true;
  updateClipsUI();
  setStatus('', 'Idle');
  
  // Clear from IndexedDB
  if (storageInitialized) {
    await storage.clearAllClips();
  }
}

async function updateClipStatus(id, status, transcript = null) {
  const clip = clips.find(c => c.id === id);
  if (clip) {
    clip.status = status;
    if (transcript !== null) {
      clip.transcript = transcript;
    }
    updateClipsUI();
    
    // Persist transcript update to IndexedDB
    if (storageInitialized && (transcript !== null || status === 'transcribed')) {
      await storage.updateClipTranscript(id, clip.transcript, status);
    }
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
    // Get audio constraints from device manager (selected device or default)
    let audioConstraints = audioDevices.getAudioConstraints();
    let usedFallback = false;
    
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    } catch (constraintErr) {
      // If specific device fails (OverconstrainedError/NotFoundError), fall back to default
      if (constraintErr.name === 'OverconstrainedError' || constraintErr.name === 'NotFoundError') {
        console.warn('Selected device unavailable, falling back to default:', constraintErr);
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: audioDevices.getFallbackConstraints() });
        usedFallback = true;
        showMessage('Selected mic unavailable, using default', 'warning');
      } else {
        throw constraintErr;
      }
    }

    // Update actual active device from the opened stream
    const audioTrack = audioStream.getAudioTracks()[0];
    if (audioTrack) {
      const settings = audioTrack.getSettings();
      audioDevices.setActualActiveDeviceId(settings.deviceId || null);
    }

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
        audioStream = null;
      }
      if (audioContext) {
        const ctx = audioContext;
        audioContext = null;
        analyser = null;
        ctx.close().catch(err => console.warn('AudioContext close error:', err));
      }
      
      // Clear actual active device (no longer recording)
      audioDevices.setActualActiveDeviceId(null);

      setStatus('done', 'Clip saved');
      
      // Auto-transcribe if enabled
      if (transcriptSettings.autoTranscribe && newClip) {
        setTimeout(() => {
          transcribeSingle(newClip.id).then(() => {
            // Auto-copy after transcription if enabled
            if (transcriptSettings.autoCopy) {
              copyTranscript().then((success) => {
                // Use global toast for reliable feedback
                const toastFn = window.yapState?.showGlobalToast || showToast;
                if (success) {
                  toastFn('Transcribed and copied!', 'success');
                } else {
                  toastFn('Transcribed, but copy failed', 'error');
                }
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
    // Update toggle button to show Stop state
    elements.recordBtn.textContent = 'Stop';
    elements.recordBtn.classList.add('recording');
    updateRecordingIndicator();
    updateMobileToolbarState();

  } catch (err) {
    console.error('Recording error:', err);
    // Handle different error types with appropriate messages
    if (err.name === 'NotAllowedError') {
      setStatus('error', 'Permission denied');
      showMessage('Error: Microphone permission denied. Please allow access in browser settings.', 'error');
    } else if (err.name === 'NotFoundError') {
      setStatus('error', 'No microphone found');
      showMessage('Error: No microphone found. Please connect a microphone and try again.', 'error');
    } else {
      setStatus('error', 'Microphone access denied');
      showMessage('Error: Could not access microphone. Please allow microphone access.', 'error');
    }
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  // Update toggle button to show Record state
  elements.recordBtn.textContent = 'Record';
  elements.recordBtn.classList.remove('recording');
  updateMobileToolbarState();
}

// Toggle between recording and stopping
function toggleRecording() {
  if (isRecording()) {
    stopRecording();
  } else {
    startRecording();
  }
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
  if (!text) return false;
  
  const success = await util.copyToClipboard(text);
  showMessage(success ? 'Copied' : 'Copy failed', success ? 'success' : 'error');
  return success;
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
  // Get current mic info for display
  const hasLabels = audioDevices.hasLabels();
  const activeMicLabel = audioDevices.getActiveMicLabel();
  const devices = audioDevices.getDevices();
  const selectedId = audioDevices.getSelectedDeviceId();
  const shouldShowSelector = audioDevices.shouldShowSelector();
  
  createAddonWindow('Settings', (container) => {
    const enableToolbarChecked = mobileSettings.enableMobileToolbar === null ? '' : (mobileSettings.enableMobileToolbar ? 'checked' : '');
    const toolbarDisabled = mobileSettings.enableMobileToolbar === null;
    
    // Build mic options HTML
    let micOptionsHtml = '<option value="">Default microphone</option>';
    if (hasLabels && devices.length > 0) {
      devices.forEach(device => {
        if (device.deviceId === 'default') return;
        const selected = device.deviceId === selectedId ? 'selected' : '';
        const label = device.label || `Microphone (${device.deviceId.substring(0, 8)}...)`;
        micOptionsHtml += `<option value="${device.deviceId}" ${selected}>${label}</option>`;
      });
    }
    
    container.innerHTML = `
      <div class="settings-section-title">Microphone</div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
          Active mic: <span id="settingActiveMic" style="color: var(--text-primary);">${activeMicLabel}</span>
        </div>
        ${!hasLabels ? `
          <button id="settingMicEnableBtn" class="small" style="margin-bottom: 0.5rem;">Enable microphone access</button>
          <span style="font-size: 0.7rem; color: var(--text-muted); display: block;">Grant permission to see available devices</span>
        ` : ''}
        ${shouldShowSelector ? `
          <label style="margin-bottom: 0.5rem;">Select microphone</label>
          <select id="settingMicSelector" class="formatting-select" style="width: 100%;">
            ${micOptionsHtml}
          </select>
          <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem; display: block;">Selection persists across sessions</span>
        ` : ''}
        ${hasLabels && !shouldShowSelector ? `
          <span style="font-size: 0.7rem; color: var(--text-muted);">Only one microphone available</span>
        ` : ''}
      </div>
      
      <div class="settings-section-title">Mobile/Tablet</div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch ${mobileSettings.enableMobileToolbar === true ? 'active' : ''}" id="settingEnableToolbar"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">Enable mobile toolbar</span>
        </div>
        <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 2.8rem;">Auto-enabled on screens < 900px</span>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch ${mobileSettings.preventRefresh ? 'active' : ''}" id="settingPreventRefresh"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">Prevent accidental refresh</span>
        </div>
        <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 2.8rem;">Warn before leaving with unsaved work</span>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch ${mobileSettings.confirmExport ? 'active' : ''}" id="settingConfirmExport"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">Confirm before export</span>
        </div>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch ${mobileSettings.oneTapExport ? 'active' : ''}" id="settingOneTapExport"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">One-tap export uses last target</span>
        </div>
        <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 2.8rem;">Requires confirm export OFF</span>
      </div>
      
      <div class="settings-section-title">Data & Metrics</div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="toggle-container">
          <div class="toggle-switch" id="settingEnableMetrics"></div>
          <span style="font-size: 0.8rem; color: var(--text-primary);">Metrics tracking status (view only)</span>
        </div>
        <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 2.8rem;">Server-side SQLite storage • Click for configuration info • Max 5000 events, 30 days retention</span>
      </div>
      
      <div class="settings-section-title">Chat/LLM Provider</div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="margin-bottom: 0.5rem; font-size: 0.8rem;">API Endpoint URL</label>
        <input type="text" id="llmApiEndpoint" class="formatting-select" style="width: 100%; font-size: 0.8rem;" value="${llmSettings.apiEndpoint}" placeholder="http://localhost:11434/v1/chat/completions">
        <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem; display: block;">OpenAI-compatible endpoint (e.g., Ollama, LM Studio)</span>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="margin-bottom: 0.5rem; font-size: 0.8rem;">Model Name</label>
        <input type="text" id="llmModelName" class="formatting-select" style="width: 100%; font-size: 0.8rem;" value="${llmSettings.modelName}" placeholder="llama3">
        <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem; display: block;">Model identifier (e.g., llama3, gpt-4, mistral)</span>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="margin-bottom: 0.5rem; font-size: 0.8rem;">API Key/Token (Optional)</label>
        <input type="password" id="llmApiKey" class="formatting-select" style="width: 100%; font-size: 0.8rem;" value="${llmSettings.apiKey}" placeholder="Leave empty for local models">
        <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem; display: block;">Required for cloud APIs (OpenAI, Anthropic, etc.)</span>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="margin-bottom: 0.5rem; font-size: 0.8rem;">Temperature (0-2)</label>
        <input type="number" id="llmTemperature" class="formatting-select" style="width: 100%; font-size: 0.8rem;" value="${llmSettings.temperature}" min="0" max="2" step="0.1">
        <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem; display: block;">Controls randomness (0 = focused, 2 = creative)</span>
      </div>
      
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="margin-bottom: 0.5rem; font-size: 0.8rem;">Max Tokens</label>
        <input type="number" id="llmMaxTokens" class="formatting-select" style="width: 100%; font-size: 0.8rem;" value="${llmSettings.maxTokens}" min="1" step="1">
        <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem; display: block;">Maximum response length (tokens)</span>
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
    
    // Event handlers - Microphone Settings
    const micEnableBtn = container.querySelector('#settingMicEnableBtn');
    if (micEnableBtn) {
      micEnableBtn.addEventListener('click', async function() {
        const success = await audioDevices.requestMicPermission();
        if (success) {
          showMessage('Microphone access enabled', 'success');
          // Close and re-open settings to refresh UI with device list
          // Find and close the current settings window
          const settingsWindow = container.closest('.addon-window');
          if (settingsWindow) {
            settingsWindow.remove();
          }
          // Re-open with fresh state
          setTimeout(() => openSettingsPanel(), 100);
        } else {
          showMessage('Microphone access denied', 'error');
        }
      });
    }
    
    const micSelector = container.querySelector('#settingMicSelector');
    if (micSelector) {
      micSelector.addEventListener('change', function(e) {
        const deviceId = e.target.value || null;
        audioDevices.selectDevice(deviceId);
        // Update the active mic label
        const activeMicSpan = container.querySelector('#settingActiveMic');
        if (activeMicSpan) {
          activeMicSpan.textContent = audioDevices.getActiveMicLabel();
        }
      });
    }
    
    // Event handlers - Mobile Settings
    container.querySelector('#settingEnableToolbar').addEventListener('click', function() {
      if (mobileSettings.enableMobileToolbar === null) {
        mobileSettings.enableMobileToolbar = true;
      } else {
        mobileSettings.enableMobileToolbar = !mobileSettings.enableMobileToolbar;
      }
      this.classList.toggle('active', mobileSettings.enableMobileToolbar === true);
      saveMobileSettings();
      updateMobileToolbarVisibility();
    });
    
    container.querySelector('#settingPreventRefresh').addEventListener('click', function() {
      mobileSettings.preventRefresh = !mobileSettings.preventRefresh;
      this.classList.toggle('active', mobileSettings.preventRefresh);
      saveMobileSettings();
      setupBeforeUnloadHandler();
    });
    
    container.querySelector('#settingConfirmExport').addEventListener('click', function() {
      mobileSettings.confirmExport = !mobileSettings.confirmExport;
      this.classList.toggle('active', mobileSettings.confirmExport);
      saveMobileSettings();
    });
    
    container.querySelector('#settingOneTapExport').addEventListener('click', function() {
      mobileSettings.oneTapExport = !mobileSettings.oneTapExport;
      this.classList.toggle('active', mobileSettings.oneTapExport);
      saveMobileSettings();
    });
    
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
    
    // Event handlers - LLM Settings
    const llmApiEndpointInput = container.querySelector('#llmApiEndpoint');
    const llmModelNameInput = container.querySelector('#llmModelName');
    const llmApiKeyInput = container.querySelector('#llmApiKey');
    const llmTemperatureInput = container.querySelector('#llmTemperature');
    const llmMaxTokensInput = container.querySelector('#llmMaxTokens');
    
    if (llmApiEndpointInput) {
      llmApiEndpointInput.addEventListener('blur', function() {
        llmSettings.apiEndpoint = this.value.trim();
        if (validateLLMSettings(container)) {
          saveLLMSettings();
          showMessage('LLM settings saved', 'success');
        }
      });
    }
    
    if (llmModelNameInput) {
      llmModelNameInput.addEventListener('blur', function() {
        llmSettings.modelName = this.value.trim();
        if (validateLLMSettings(container)) {
          saveLLMSettings();
          showMessage('LLM settings saved', 'success');
        }
      });
    }
    
    if (llmApiKeyInput) {
      llmApiKeyInput.addEventListener('blur', function() {
        // API key is optional and doesn't require validation
        // (empty string is valid for local models like Ollama)
        llmSettings.apiKey = this.value.trim();
        saveLLMSettings();
        showMessage('LLM settings saved', 'success');
      });
    }
    
    if (llmTemperatureInput) {
      llmTemperatureInput.addEventListener('blur', function() {
        const temp = parseFloat(this.value);
        if (!isNaN(temp)) {
          llmSettings.temperature = temp;
          if (validateLLMSettings(container)) {
            saveLLMSettings();
            showMessage('LLM settings saved', 'success');
          }
        } else {
          validateLLMSettings(container);
        }
      });
    }
    
    if (llmMaxTokensInput) {
      llmMaxTokensInput.addEventListener('blur', function() {
        const tokens = parseInt(this.value);
        if (!isNaN(tokens)) {
          llmSettings.maxTokens = tokens;
          if (validateLLMSettings(container)) {
            saveLLMSettings();
            showMessage('LLM settings saved', 'success');
          }
        } else {
          validateLLMSettings(container);
        }
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
  }, { width: 380, height: 580, singleton: true, singletonId: 'settings-panel' });
}

// Mobile toolbar functions
function showToast(message, type = '') {
  // Try to use the fixed toast element first
  let toast = document.getElementById('toastNotification');
  if (toast) {
    toast.textContent = message;
    toast.className = 'toast-notification' + (type ? ' ' + type : '');
    toast.style.display = 'block';
    
    setTimeout(() => {
      toast.style.display = 'none';
    }, 2500);
  } else {
    // Fallback: create a temporary toast
    toast = document.createElement('div');
    toast.className = 'toast' + (type ? ' ' + type : '');
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 2500);
  }
}

function updateMobileToolbarVisibility() {
  const toolbar = document.querySelector('#mobileToolbar');
  if (!toolbar) return;
  
  const viewportWidth = window.innerWidth;
  const shouldShow = mobileSettings.enableMobileToolbar === true || 
                     (mobileSettings.enableMobileToolbar === null && viewportWidth < MOBILE_BREAKPOINT);
  
  toolbar.style.display = shouldShow ? 'flex' : 'none';
}

function updateMobileToolbarState() {
  const mobileRecordBtn = document.querySelector('#mobileRecordBtn');
  const mobileTranscribeBtn = document.querySelector('#mobileTranscribeBtn');
  const mobileCopyBtn = document.querySelector('#mobileCopyBtn');
  const mobileExportBtn = document.querySelector('#mobileExportBtn');
  const mobileStatusDot = document.querySelector('#mobileStatusDot');
  const mobileStatusText = document.querySelector('#mobileStatusText');
  
  if (!mobileRecordBtn) return;
  
  // Update Record/Stop button with SVG icons
  const isRecording = mediaRecorder && mediaRecorder.state === 'recording';
  const recordIcon = mobileRecordBtn.querySelector('.fab-icon:not(.fab-icon-stop)');
  const stopIcon = mobileRecordBtn.querySelector('.fab-icon-stop');
  
  if (isRecording) {
    if (recordIcon) recordIcon.style.display = 'none';
    if (stopIcon) stopIcon.style.display = 'block';
    mobileRecordBtn.classList.add('fab-recording');
    mobileRecordBtn.title = 'Stop';
  } else {
    if (recordIcon) recordIcon.style.display = 'block';
    if (stopIcon) stopIcon.style.display = 'none';
    mobileRecordBtn.classList.remove('fab-recording');
    mobileRecordBtn.title = 'Record';
  }
  
  // Update Transcribe button - show spinner when transcribing
  const hasUntranscribed = clips.some(c => c.status === 'recorded' || c.status === 'queued');
  const isTranscribing = clips.some(c => c.status === 'working');
  const transcribeIcon = mobileTranscribeBtn.querySelector('.fab-icon');
  const transcribeSpinner = mobileTranscribeBtn.querySelector('.fab-spinner');
  
  if (isTranscribing) {
    if (transcribeIcon) transcribeIcon.style.display = 'none';
    if (transcribeSpinner) transcribeSpinner.style.display = 'block';
    mobileTranscribeBtn.disabled = true;
  } else {
    if (transcribeIcon) transcribeIcon.style.display = 'block';
    if (transcribeSpinner) transcribeSpinner.style.display = 'none';
    mobileTranscribeBtn.disabled = !hasUntranscribed;
  }
  
  // Update Copy and Export buttons
  const hasTranscript = getCombinedTranscript().trim().length > 0;
  mobileCopyBtn.disabled = !hasTranscript;
  mobileExportBtn.disabled = !hasTranscript;
  
  // Update status
  if (isRecording) {
    mobileStatusDot.className = 'fab-status-dot recording';
    mobileStatusText.textContent = 'Recording';
  } else if (isTranscribing) {
    mobileStatusDot.className = 'fab-status-dot working';
    mobileStatusText.textContent = 'Transcribing...';
  } else if (hasTranscript) {
    mobileStatusDot.className = 'fab-status-dot success';
    mobileStatusText.textContent = 'Ready';
  } else {
    mobileStatusDot.className = 'fab-status-dot idle';
    mobileStatusText.textContent = 'Idle';
  }
}

function setupMobileToolbar(container) {
  const mobileRecordBtn = document.querySelector('#mobileRecordBtn');
  const mobileTranscribeBtn = document.querySelector('#mobileTranscribeBtn');
  const mobileCopyBtn = document.querySelector('#mobileCopyBtn');
  const mobileExportBtn = document.querySelector('#mobileExportBtn');
  
  if (!mobileRecordBtn) return;
  
  // Record/Stop button
  mobileRecordBtn.addEventListener('click', () => {
    const isRecording = mediaRecorder && mediaRecorder.state === 'recording';
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });
  
  // Transcribe button
  mobileTranscribeBtn.addEventListener('click', () => {
    transcribeAll();
  });
  
  // Copy button with feedback
  mobileCopyBtn.addEventListener('click', async () => {
    const success = await copyTranscript();
    showToast(success !== false ? 'Copied!' : 'Copy failed', success !== false ? 'success' : 'error');
  });
  
  // Export button
  mobileExportBtn.addEventListener('click', () => {
    if (mobileSettings.oneTapExport && mobileSettings.lastExportTarget) {
      showToast('One-tap export not yet implemented');
    } else {
      openExportPanel(
        () => getCombinedTranscript(),
        () => clips.slice()
      );
    }
  });
  
  // Update toolbar on window resize
  window.addEventListener('resize', updateMobileToolbarVisibility);
  
  // Initial visibility
  updateMobileToolbarVisibility();
  updateMobileToolbarState();
}

// Check if there's unsaved work (clips or transcripts)
function hasUnsavedWork() {
  // Check if there are any clips
  if (clips.length > 0) return true;
  
  // Check if transcript has content
  if (elements.transcript && elements.transcript.value.trim().length > 0) return true;
  
  return false;
}

// Beforeunload handler function reference (for adding/removing)
let beforeUnloadHandler = null;

// Setup beforeunload warning for unsaved work
function setupBeforeUnloadHandler() {
  // Remove existing handler if any
  if (beforeUnloadHandler) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
  }
  
  // Only add handler if prevent refresh is enabled
  if (mobileSettings.preventRefresh) {
    beforeUnloadHandler = (e) => {
      if (hasUnsavedWork()) {
        // Standard way to trigger browser's "are you sure?" dialog
        e.preventDefault();
        // Chrome requires returnValue to be set
        e.returnValue = 'You have unsaved recordings. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', beforeUnloadHandler);
  }
}

// Restore session from IndexedDB
async function restoreSession() {
  const hasSaved = await storage.hasSavedClips();
  if (!hasSaved) return;
  
  // Prompt user to restore
  const restore = confirm('You have saved recordings from a previous session. Would you like to restore them?');
  
  if (restore) {
    const savedClips = await storage.loadClips();
    if (savedClips.length > 0) {
      clips = savedClips;
      updateClipsUI();
      updateTranscriptDisplay();
      showMessage(`Restored ${savedClips.length} clip(s)`, 'success');
      setStatus('done', 'Session restored');
    }
  } else {
    // User declined, clear saved clips
    await storage.clearAllClips();
  }
}

// Initialize ASR tab
export async function init(container) {
  loadSettings();
  
  // Initialize IndexedDB storage
  storageInitialized = await storage.initDB();
  
  // Initialize audio devices module
  await audioDevices.init();
  
  // Cache DOM elements
  elements = {
    recordBtn: container.querySelector('#recordBtn'),
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
  elements.recordBtn?.addEventListener('click', toggleRecording);
  elements.transcribeAllBtn?.addEventListener('click', transcribeAll);
  elements.clearBtn?.addEventListener('click', async (e) => {
    // Shift+Click bypasses confirmation; also skip if confirmClear is false
    const shouldConfirm = transcriptSettings.confirmClear && !e.shiftKey;
    if (!shouldConfirm || confirm('Clear all clips and transcript?')) {
      await clearAllClips();
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
  
  // Setup mobile toolbar
  setupMobileToolbar(container);
  
  // Setup beforeunload handler for refresh protection
  setupBeforeUnloadHandler();
  
  // Restore saved session if available
  if (storageInitialized) {
    await restoreSession();
  }
  
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
    openSettings: openSettingsPanel,
    getLLMSettings
  };
}

export { openSettingsPanel };
export const asr = { init, isRecording, openSettingsPanel, getLLMSettings };
