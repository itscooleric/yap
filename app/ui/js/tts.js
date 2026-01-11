// Yap - TTS Tab (Text-to-Speech)
// Text input, voice selection, synthesis, and audio playback
// Includes markdown preview and dedicated read-along panel

import { util } from './util.js';

// TTS State
let voices = [];
let currentAudioUrl = null;
let currentAudioBlob = null;
let markdownPreviewEnabled = false;

// Read-along state
let readAlongChunks = [];
let currentChunkIndex = -1;
let chunkAudioBlobs = [];
let chunkAudioUrls = [];
let isReadAlongPlaying = false;
let isReadAlongPaused = false;
let readAlongAudio = null;

// Settings (persisted)
let ttsSettings = {
  markdownPreview: false,
  chunkMode: 'paragraph', // 'paragraph' or 'line'
  maxChunks: 30,
  maxCharsPerChunk: 1200
};

// DOM elements (set in init)
let elements = {};

// Load settings from localStorage
function loadSettings() {
  ttsSettings = {
    markdownPreview: util.storage.get('settings.tts.markdownPreview', false),
    chunkMode: util.storage.get('settings.tts.chunkMode', 'paragraph'),
    maxChunks: util.storage.get('settings.tts.maxChunks', 30),
    maxCharsPerChunk: util.storage.get('settings.tts.maxCharsPerChunk', 1200)
  };
  markdownPreviewEnabled = ttsSettings.markdownPreview;
}

// Save settings
function saveSettings() {
  util.storage.set('settings.tts.markdownPreview', ttsSettings.markdownPreview);
  util.storage.set('settings.tts.chunkMode', ttsSettings.chunkMode);
  util.storage.set('settings.tts.maxChunks', ttsSettings.maxChunks);
  util.storage.set('settings.tts.maxCharsPerChunk', ttsSettings.maxCharsPerChunk);
}

// Simple Markdown renderer (no CDN, sanitized)
function renderMarkdown(text) {
  if (!text) return '';
  
  // Escape HTML to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Process markdown (order matters)
  // Headers (must be at start of line)
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr>');
  html = html.replace(/^\*\*\*+$/gm, '<hr>');
  
  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Code blocks (fenced with ```)
  html = html.replace(/```([^`]+)```/gs, '<pre><code>$1</code></pre>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Unordered lists
  html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>');
  
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ol-item">$1</li>');
  html = html.replace(/(<li class="ol-item">.*<\/li>\n?)+/gs, '<ol>$&</ol>');
  html = html.replace(/class="ol-item"/g, '');
  
  // Paragraphs - wrap text blocks
  // Split by double newlines
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    // Don't wrap if already a block element
    if (/^<(h[1-6]|ul|ol|li|pre|blockquote|hr)/.test(block)) {
      return block;
    }
    // Wrap in paragraph
    return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');
  
  return html;
}

// Split text into chunks for read-along
function splitIntoChunks(text) {
  const mode = ttsSettings.chunkMode;
  let chunks = [];
  
  if (mode === 'paragraph') {
    // Split by blank lines (paragraphs)
    chunks = text.split(/\n\n+/).map(c => c.trim()).filter(c => c.length > 0);
  } else {
    // Split by newlines (lines)
    chunks = text.split(/\n/).map(c => c.trim()).filter(c => c.length > 0);
  }
  
  // Further split chunks that are too long
  const finalChunks = [];
  for (const chunk of chunks) {
    if (chunk.length <= ttsSettings.maxCharsPerChunk) {
      finalChunks.push(chunk);
    } else {
      // Split long chunk by sentences or at character limit
      // Match sentences including trailing punctuation, or remaining text
      const sentencePattern = /[^.!?]+[.!?]+\s*/g;
      const sentences = chunk.match(sentencePattern) || [];
      
      // Check if there's remaining text after the last sentence
      const matchedLength = sentences.reduce((acc, s) => acc + s.length, 0);
      if (matchedLength < chunk.length) {
        sentences.push(chunk.substring(matchedLength));
      }
      
      if (sentences.length === 0) {
        // No sentence boundaries, use the whole chunk
        sentences.push(chunk);
      }
      
      let current = '';
      for (const sentence of sentences) {
        if ((current + sentence).length <= ttsSettings.maxCharsPerChunk) {
          current += sentence;
        } else {
          if (current) finalChunks.push(current.trim());
          current = sentence;
        }
      }
      if (current) finalChunks.push(current.trim());
    }
  }
  
  return finalChunks;
}

// Check chunk limits
function checkChunkLimits(chunks) {
  if (chunks.length > ttsSettings.maxChunks) {
    return {
      valid: false,
      message: `Text has ${chunks.length} chunks, but max is ${ttsSettings.maxChunks}. Split text or increase limit.`
    };
  }
  
  const longChunks = chunks.filter(c => c.length > ttsSettings.maxCharsPerChunk);
  if (longChunks.length > 0) {
    return {
      valid: false,
      message: `${longChunks.length} chunk(s) exceed ${ttsSettings.maxCharsPerChunk} chars. Consider splitting text.`
    };
  }
  
  return { valid: true };
}

// Update markdown preview
function updateMarkdownPreview() {
  if (!elements.markdownPreview || !elements.textInput) return;
  
  const text = elements.textInput.value;
  
  if (markdownPreviewEnabled) {
    elements.textInput.style.display = 'none';
    elements.markdownPreview.style.display = 'block';
    
    if (readAlongEnabled) {
      // Render with chunk wrappers for read-along
      const chunks = splitIntoChunks(text);
      readAlongChunks = chunks;
      
      const html = chunks.map((chunk, i) => {
        const rendered = renderMarkdown(chunk);
        return `<div class="chunk" data-chunk-index="${i}">${rendered}</div>`;
      }).join('');
      
      elements.markdownPreview.innerHTML = html || '<p style="color: var(--text-muted);">Enter text to preview...</p>';
    } else {
      elements.markdownPreview.innerHTML = renderMarkdown(text) || '<p style="color: var(--text-muted);">Enter text to preview...</p>';
    }
  } else {
    elements.textInput.style.display = 'block';
    elements.markdownPreview.style.display = 'none';
  }
}

// Update view toggle button states
function updateViewToggleButtons() {
  if (elements.viewPlainBtn) {
    elements.viewPlainBtn.classList.toggle('active', !markdownPreviewEnabled);
  }
  if (elements.viewMarkdownBtn) {
    elements.viewMarkdownBtn.classList.toggle('active', markdownPreviewEnabled);
  }
}

// Highlight current chunk in read-along
function highlightChunk(index) {
  if (!elements.markdownPreview) return;
  
  // Remove previous highlights
  elements.markdownPreview.querySelectorAll('.chunk.active').forEach(el => {
    el.classList.remove('active');
  });
  
  // Add highlight to current chunk
  if (index >= 0) {
    const chunk = elements.markdownPreview.querySelector(`.chunk[data-chunk-index="${index}"]`);
    if (chunk) {
      chunk.classList.add('active');
      chunk.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  currentChunkIndex = index;
}

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

// Synthesize a single chunk and return audio blob
async function synthesizeChunk(text, voice, lengthScale) {
  const url = `/tts/synthesize/${encodeURIComponent(voice)}?length_scale=${lengthScale}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: text
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Synthesis failed: ${response.status}`);
  }
  
  return await response.blob();
}

// Open read-along panel and start chunk-by-chunk synthesis + playback
async function startReadAlong() {
  const text = elements.textInput.value.trim();
  const voice = elements.voiceSelect.value;
  const lengthScale = elements.rateSlider.value;

  if (!text || !voice) {
    showMessage('Please enter text and select a voice', 'error');
    return;
  }

  // Split into chunks
  const chunks = splitIntoChunks(text);
  
  // Check limits
  const check = checkChunkLimits(chunks);
  if (!check.valid) {
    const proceed = confirm(check.message + '\n\nProceed anyway?');
    if (!proceed) return;
  }
  
  if (chunks.length === 0) {
    showMessage('No text to synthesize', 'error');
    return;
  }

  // Cleanup previous audio
  cleanupReadAlongAudio();
  readAlongChunks = chunks;
  chunkAudioBlobs = [];
  chunkAudioUrls = [];
  currentChunkIndex = -1;
  isReadAlongPlaying = true;
  isReadAlongPaused = false;
  
  // Open read-along panel
  openReadAlongPanel();
  renderReadAlongChunks();
  updateReadAlongProgress(0, chunks.length);
  
  // Start synthesis and playback
  try {
    for (let i = 0; i < chunks.length; i++) {
      if (!isReadAlongPlaying) break; // User stopped
      
      updateReadAlongProgress(i + 1, chunks.length, 'synthesizing');
      
      const blob = await synthesizeChunk(chunks[i], voice, lengthScale);
      chunkAudioBlobs.push(blob);
      const url = URL.createObjectURL(blob);
      chunkAudioUrls.push(url);
      
      // Play this chunk if we're still playing
      if (isReadAlongPlaying && !isReadAlongPaused) {
        // Wait for previous chunk to finish before playing next
        if (i === 0 || (readAlongAudio && readAlongAudio.ended)) {
          await playChunk(i);
        }
      }
    }
    
    // If all chunks synthesized, continue playing remaining
    if (isReadAlongPlaying) {
      await playRemainingChunks();
    }
    
  } catch (err) {
    console.error('Read-along error:', err);
    showMessage(`Read-along failed: ${err.message}`, 'error');
    stopReadAlong();
  }
}

// Play a single chunk
function playChunk(index) {
  return new Promise((resolve, reject) => {
    if (index >= chunkAudioUrls.length) {
      resolve();
      return;
    }
    
    currentChunkIndex = index;
    highlightReadAlongChunk(index);
    updateReadAlongProgress(index + 1, readAlongChunks.length, 'playing');
    
    readAlongAudio = new Audio(chunkAudioUrls[index]);
    
    readAlongAudio.onended = () => {
      markChunkCompleted(index);
      resolve();
    };
    
    readAlongAudio.onerror = (err) => {
      console.error('Audio playback error:', err);
      reject(new Error('Audio playback failed'));
    };
    
    readAlongAudio.play().catch(reject);
  });
}

// Play remaining chunks after synthesis
async function playRemainingChunks() {
  for (let i = currentChunkIndex + 1; i < chunkAudioUrls.length; i++) {
    if (!isReadAlongPlaying) break;
    
    while (isReadAlongPaused && isReadAlongPlaying) {
      await new Promise(r => setTimeout(r, 100));
    }
    
    if (!isReadAlongPlaying) break;
    
    await playChunk(i);
  }
  
  if (isReadAlongPlaying) {
    // Finished all chunks
    updateReadAlongProgress(readAlongChunks.length, readAlongChunks.length, 'complete');
    isReadAlongPlaying = false;
  }
}

// Open read-along panel
function openReadAlongPanel() {
  const panel = document.getElementById('readAlongPanel');
  if (panel) {
    panel.style.display = 'flex';
  }
}

// Close read-along panel
function closeReadAlongPanel() {
  const panel = document.getElementById('readAlongPanel');
  if (panel) {
    panel.style.display = 'none';
  }
}

// Render chunks in read-along panel
function renderReadAlongChunks() {
  const content = document.getElementById('readAlongContent');
  if (!content) return;
  
  content.innerHTML = readAlongChunks.map((chunk, i) => `
    <div class="read-along-chunk" data-chunk="${i}">
      <div class="read-along-chunk-number">Paragraph ${i + 1}</div>
      ${escapeHtml(chunk)}
    </div>
  `).join('');
}

// Highlight current chunk
function highlightReadAlongChunk(index) {
  const content = document.getElementById('readAlongContent');
  if (!content) return;
  
  // Remove active from all
  content.querySelectorAll('.read-along-chunk.active').forEach(el => {
    el.classList.remove('active');
  });
  
  // Add active to current
  const current = content.querySelector(`[data-chunk="${index}"]`);
  if (current) {
    current.classList.add('active');
    current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Mark chunk as completed
function markChunkCompleted(index) {
  const content = document.getElementById('readAlongContent');
  if (!content) return;
  
  const chunk = content.querySelector(`[data-chunk="${index}"]`);
  if (chunk) {
    chunk.classList.add('completed');
    chunk.classList.remove('active');
  }
}

// Update progress display
function updateReadAlongProgress(current, total, status = '') {
  const progress = document.getElementById('readAlongProgress');
  if (progress) {
    let text = `Chunk ${current} / ${total}`;
    if (status === 'synthesizing') text += ' (synthesizing...)';
    else if (status === 'playing') text += ' (playing)';
    else if (status === 'complete') text = 'Complete';
    progress.textContent = text;
  }
}

// Pause read-along
function pauseReadAlong() {
  if (readAlongAudio && !readAlongAudio.paused) {
    readAlongAudio.pause();
    isReadAlongPaused = true;
    updatePauseButton(true);
  } else if (isReadAlongPaused) {
    readAlongAudio?.play();
    isReadAlongPaused = false;
    updatePauseButton(false);
  }
}

// Update pause button text
function updatePauseButton(isPaused) {
  const btn = document.getElementById('readAlongPauseBtn');
  if (btn) {
    btn.textContent = isPaused ? 'Resume' : 'Pause';
  }
}

// Stop read-along
function stopReadAlong() {
  isReadAlongPlaying = false;
  isReadAlongPaused = false;
  
  if (readAlongAudio) {
    readAlongAudio.pause();
    readAlongAudio = null;
  }
  
  currentChunkIndex = -1;
  updatePauseButton(false);
}

// Cleanup read-along audio
function cleanupReadAlongAudio() {
  stopReadAlong();
  chunkAudioUrls.forEach(url => URL.revokeObjectURL(url));
  chunkAudioUrls = [];
  chunkAudioBlobs = [];
  readAlongChunks = [];
}

// Escape HTML for safe display
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Setup read-along panel controls
function setupReadAlongPanelControls() {
  const pauseBtn = document.getElementById('readAlongPauseBtn');
  const stopBtn = document.getElementById('readAlongStopBtn');
  const closeBtn = document.getElementById('readAlongCloseBtn');
  
  pauseBtn?.addEventListener('click', pauseReadAlong);
  stopBtn?.addEventListener('click', () => {
    stopReadAlong();
    closeReadAlongPanel();
  });
  closeBtn?.addEventListener('click', () => {
    stopReadAlong();
    closeReadAlongPanel();
  });
}

// Play read-along chunks sequentially (legacy - kept for compatibility)
function playReadAlong() {
  startReadAlong();
}

// Synthesize text to speech (standard mode)
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
    const audioBlob = await synthesizeChunk(text, voice, lengthScale);

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
  loadSettings();
  
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
    playReadAlongBtn: container.querySelector('#ttsPlayReadAlongBtn'),
    statusDot: container.querySelector('#ttsStatusDot'),
    statusText: container.querySelector('#ttsStatusText'),
    message: container.querySelector('#ttsMessage'),
    markdownPreview: container.querySelector('#ttsMarkdownPreview'),
    viewPlainBtn: container.querySelector('#ttsViewPlain'),
    viewMarkdownBtn: container.querySelector('#ttsViewMarkdown')
  };

  // Load voices
  loadVoices();
  
  // Initialize view toggle buttons
  updateViewToggleButtons();
  
  // Update preview if enabled
  if (markdownPreviewEnabled) {
    updateMarkdownPreview();
  }

  // Text input handlers
  elements.textInput?.addEventListener('input', () => {
    if (elements.charCount) {
      elements.charCount.textContent = elements.textInput.value.length;
    }
    updateSynthesizeButton();
    if (markdownPreviewEnabled) {
      updateMarkdownPreview();
    }
  });

  // View toggle buttons (segmented control)
  elements.viewPlainBtn?.addEventListener('click', () => {
    markdownPreviewEnabled = false;
    ttsSettings.markdownPreview = false;
    saveSettings();
    updateViewToggleButtons();
    updateMarkdownPreview();
  });
  
  elements.viewMarkdownBtn?.addEventListener('click', () => {
    markdownPreviewEnabled = true;
    ttsSettings.markdownPreview = true;
    saveSettings();
    updateViewToggleButtons();
    updateMarkdownPreview();
  });
  
  // Play with Read-Along button
  elements.playReadAlongBtn?.addEventListener('click', () => {
    startReadAlong();
  });
  
  // Setup read-along panel controls
  setupReadAlongPanelControls();

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
        if (markdownPreviewEnabled) {
          updateMarkdownPreview();
        }
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
    updateMarkdownPreview();
    stopReadAlong();
  });

  // Synthesize
  elements.synthesizeBtn?.addEventListener('click', synthesize);

  // Play button
  elements.playBtn?.addEventListener('click', () => {
    if (readAlongEnabled && chunkAudioUrls.length > 0) {
      if (isReadAlongPlaying) {
        stopReadAlong();
      } else {
        playReadAlong();
      }
    } else {
      if (elements.audioPlayer.paused) {
        elements.audioPlayer.play();
      } else {
        elements.audioPlayer.pause();
      }
    }
  });

  // Download
  elements.downloadBtn?.addEventListener('click', downloadAudio);

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    // Only handle if TTS tab is active
    const ttsTab = document.getElementById('tts-tab');
    if (!ttsTab || !ttsTab.classList.contains('active')) return;
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
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
