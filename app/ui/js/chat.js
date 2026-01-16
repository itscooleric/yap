// Yap - Chat Tab (LLM Integration)
// Voice and text-based conversations with LLMs

import { util } from './util.js';
import { storage } from './storage.js';
import { openExportPanel } from './export.js';

// Import metrics module
function getDataModule() {
  return window.yapState?.data || { recordEvent: async () => {}, isEnabled: () => false };
}

// Chat state
let messages = [];
let currentDraft = null;
let isRecording = false;
let isSending = false;
let isTranscribing = false;
let recordingStartTime = null;
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let audioContext = null;
let analyser = null;
let animationId = null;
let timerInterval = null;

// Settings (loaded from localStorage)
let chatSettings = {
  llmEndpoint: '',
  llmModel: 'gpt-3.5-turbo',
  llmApiKey: '',
  temperature: 0.7,
  maxTokens: 1000,
  systemPrompt: 'You are a helpful assistant.',
  autoSend: false,
  confirmClear: true,
  markdownEnabled: true
};

let inputMode = 'text'; // 'audio' or 'text'

// DOM elements
let elements = {};

// Constants
const BAR_COUNT = 48;
const LLM_API_BASE = '/api/llm';

// Initialize chat tab
export function init() {
  // Get DOM elements
  elements = {
    // Header
    messageCount: document.getElementById('chatMessageCount'),
    clearBtn: document.getElementById('chatClearBtn'),
    exportBtn: document.getElementById('chatExportBtn'),
    
    // Messages
    messagesList: document.getElementById('chatMessagesList'),
    
    // Status
    statusDot: document.getElementById('chatStatusDot'),
    statusText: document.getElementById('chatStatusText'),
    timer: document.getElementById('chatTimer'),
    
    // Mode toggle
    modeAudio: document.getElementById('chatModeAudio'),
    modeText: document.getElementById('chatModeText'),
    
    // Audio mode
    audioMode: document.getElementById('chatAudioMode'),
    waveformContainer: document.querySelector('#chatAudioMode .waveform-container'),
    waveform: document.getElementById('chatWaveform'),
    audioPreview: document.getElementById('chatAudioPreview'),
    audioFilename: document.getElementById('chatAudioFilename'),
    audioDuration: document.getElementById('chatAudioDuration'),
    audioPlayer: document.getElementById('chatAudioPlayer'),
    transcript: document.getElementById('chatTranscript'),
    
    // Text mode
    textMode: document.getElementById('chatTextMode'),
    textInput: document.getElementById('chatTextInput'),
    charCount: document.getElementById('chatCharCount'),
    
    // Controls
    audioControls: document.getElementById('chatAudioControls'),
    recordBtn: document.getElementById('chatRecordBtn'),
    transcribeBtn: document.getElementById('chatTranscribeBtn'),
    rerecordBtn: document.getElementById('chatRerecordBtn'),
    sendBtn: document.getElementById('chatSendBtn'),
    clearInputBtn: document.getElementById('chatClearInputBtn')
  };
  
  // Load settings
  loadSettings();
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize UI state
  updateUI();
  
  console.log('Chat tab initialized');
}

// Load settings from localStorage
function loadSettings() {
  // Load LLM settings (shared with ASR)
  const llmApiEndpoint = storage.get('settings.llm.apiEndpoint', '');
  const llmModelName = storage.get('settings.llm.modelName', 'llama3');
  const llmApiKey = storage.get('settings.llm.apiKey', '');
  const llmTemperature = storage.get('settings.llm.temperature', 0.7);
  const llmMaxTokens = storage.get('settings.llm.maxTokens', 2048);
  
  // Load chat-specific settings
  chatSettings = {
    llmEndpoint: llmApiEndpoint,
    llmModel: llmModelName,
    llmApiKey: llmApiKey,
    temperature: llmTemperature,
    maxTokens: llmMaxTokens,
    systemPrompt: storage.get('settings.chat.systemPrompt', 'You are a helpful assistant.'),
    autoSend: storage.get('settings.chat.autoSend', false),
    confirmClear: storage.get('settings.chat.confirmClear', true),
    markdownEnabled: storage.get('settings.chat.markdownEnabled', true)
  };
}

// Save settings to localStorage
function saveSettings() {
  // Only save chat-specific settings (LLM settings are managed by ASR)
  storage.set('settings.chat.systemPrompt', chatSettings.systemPrompt);
  storage.set('settings.chat.autoSend', chatSettings.autoSend);
  storage.set('settings.chat.confirmClear', chatSettings.confirmClear);
  storage.set('settings.chat.markdownEnabled', chatSettings.markdownEnabled);
}

// Set up event listeners
function setupEventListeners() {
  // Header buttons
  elements.clearBtn?.addEventListener('click', handleClearChat);
  elements.exportBtn?.addEventListener('click', handleExport);
  
  // Mode toggle
  elements.modeAudio?.addEventListener('click', () => switchInputMode('audio'));
  elements.modeText?.addEventListener('click', () => switchInputMode('text'));
  
  // Audio controls
  elements.recordBtn?.addEventListener('click', handleRecord);
  elements.transcribeBtn?.addEventListener('click', handleTranscribe);
  elements.rerecordBtn?.addEventListener('click', handleRerecord);
  
  // Send and clear
  elements.sendBtn?.addEventListener('click', handleSend);
  elements.clearInputBtn?.addEventListener('click', handleClearInput);
  
  // Text input character count
  elements.textInput?.addEventListener('input', updateCharCount);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

// Handle keyboard shortcuts
function handleKeyboard(e) {
  // Only handle if Chat tab is active
  const chatTab = document.getElementById('chat-tab');
  if (!chatTab || !chatTab.classList.contains('active')) return;
  
  // Ctrl+Enter: Send message
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    if (!elements.sendBtn.disabled) {
      handleSend();
    }
  }
  
  // Escape: Cancel/clear
  if (e.key === 'Escape' && !e.target.closest('input, textarea')) {
    handleClearInput();
  }
}

// Switch input mode
function switchInputMode(mode) {
  inputMode = mode;
  
  // Update toggle buttons
  elements.modeAudio?.classList.toggle('active', mode === 'audio');
  elements.modeText?.classList.toggle('active', mode === 'text');
  
  // Show/hide mode panels
  if (elements.audioMode) elements.audioMode.style.display = mode === 'audio' ? 'block' : 'none';
  if (elements.textMode) elements.textMode.style.display = mode === 'text' ? 'block' : 'none';
  
  // Update controls visibility
  if (elements.audioControls) {
    elements.audioControls.style.display = mode === 'audio' ? 'flex' : 'none';
  }
  
  updateUI();
}

// Handle record button
async function handleRecord() {
  if (isRecording) {
    // Stop recording
    await stopRecording();
  } else {
    // Start recording
    await startRecording();
  }
}

// Start recording
async function startRecording() {
  try {
    // Request microphone access
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Create MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
    mediaRecorder = new MediaRecorder(audioStream, { mimeType });
    
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Save to draft
      currentDraft = {
        audioBlob,
        audioUrl,
        audioFilename: `clip-${Date.now()}.webm`,
        audioDuration: (Date.now() - recordingStartTime) / 1000,
        transcript: ''
      };
      
      // Show audio preview
      showAudioPreview();
      
      // Auto-transcribe if enabled
      if (chatSettings.autoSend) {
        await handleTranscribe();
      }
    };
    
    // Start recording
    mediaRecorder.start();
    isRecording = true;
    recordingStartTime = Date.now();
    
    // Set up waveform visualization
    setupWaveform();
    
    // Start timer
    startTimer();
    
    updateUI();
    
  } catch (error) {
    console.error('Failed to start recording:', error);
    util.showToast('Microphone access denied. Please allow microphone access.', 'error');
  }
}

// Stop recording
async function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    
    // Stop all audio tracks
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }
    
    // Stop waveform
    stopWaveform();
    
    // Stop timer
    stopTimer();
    
    updateUI();
  }
}

// Setup waveform visualization
function setupWaveform() {
  if (!audioStream || !elements.waveform) return;
  
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(audioStream);
  source.connect(analyser);
  
  analyser.fftSize = 128;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  // Show waveform container
  if (elements.waveformContainer) {
    elements.waveformContainer.style.display = 'block';
  }
  
  const canvas = elements.waveform;
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  canvas.width = canvas.offsetWidth || 400;
  canvas.height = canvas.offsetHeight || 60;
  
  const draw = () => {
    if (!isRecording) return;
    
    animationId = requestAnimationFrame(draw);
    
    analyser.getByteFrequencyData(dataArray);
    
    // Clear canvas
    ctx.fillStyle = 'rgba(15, 52, 96, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw bars
    const barWidth = canvas.width / BAR_COUNT;
    let x = 0;
    
    for (let i = 0; i < BAR_COUNT; i++) {
      const index = Math.floor(i * bufferLength / BAR_COUNT);
      const barHeight = (dataArray[index] / 255) * canvas.height * 0.8;
      
      // Use accent color for bars
      ctx.fillStyle = '#ff2975';
      ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
      
      x += barWidth;
    }
  };
  
  draw();
}

// Stop waveform visualization
function stopWaveform() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  // Hide waveform container
  if (elements.waveformContainer) {
    elements.waveformContainer.style.display = 'none';
  }
}

// Show audio preview
function showAudioPreview() {
  if (!currentDraft || !elements.audioPreview) return;
  
  // Show preview panel
  elements.audioPreview.style.display = 'block';
  
  // Update audio info
  if (elements.audioFilename) {
    elements.audioFilename.textContent = currentDraft.audioFilename;
  }
  
  if (elements.audioDuration) {
    const mins = Math.floor(currentDraft.audioDuration / 60);
    const secs = Math.floor(currentDraft.audioDuration % 60);
    elements.audioDuration.textContent = `(${mins}:${secs.toString().padStart(2, '0')})`;
  }
  
  // Set audio player source
  if (elements.audioPlayer) {
    elements.audioPlayer.src = currentDraft.audioUrl;
  }
  
  // Enable transcribe button
  if (elements.transcribeBtn) {
    elements.transcribeBtn.disabled = false;
  }
  
  if (elements.rerecordBtn) {
    elements.rerecordBtn.disabled = false;
  }
}

// Handle transcribe
async function handleTranscribe() {
  if (!currentDraft || !currentDraft.audioBlob) return;
  
  isTranscribing = true;
  updateUI();
  
  try {
    // Use ASR API to transcribe
    const formData = new FormData();
    formData.append('audio_file', currentDraft.audioBlob, currentDraft.audioFilename);
    formData.append('task', 'transcribe');
    formData.append('language', 'en');
    formData.append('output', 'json');
    
    const response = await fetch('/asr', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    currentDraft.transcript = data.text || '';
    
    // Update transcript textarea
    if (elements.transcript) {
      elements.transcript.value = currentDraft.transcript;
    }
    
    // Enable send button
    if (elements.sendBtn) {
      elements.sendBtn.disabled = false;
    }
    
    // Auto-send if enabled
    if (chatSettings.autoSend && currentDraft.transcript.trim()) {
      await handleSend();
    }
    
  } catch (error) {
    console.error('Transcription failed:', error);
    util.showToast('Transcription failed. Please try again.', 'error');
  } finally {
    isTranscribing = false;
    updateUI();
  }
}

// Handle re-record
function handleRerecord() {
  // Clear current draft
  if (currentDraft && currentDraft.audioUrl) {
    URL.revokeObjectURL(currentDraft.audioUrl);
  }
  
  currentDraft = null;
  
  // Hide audio preview
  if (elements.audioPreview) {
    elements.audioPreview.style.display = 'none';
  }
  
  // Clear transcript
  if (elements.transcript) {
    elements.transcript.value = '';
  }
  
  updateUI();
  
  // Start new recording
  handleRecord();
}

// Handle send message
async function handleSend() {
  let content = '';
  
  // Get content based on input mode
  if (inputMode === 'text') {
    content = elements.textInput?.value.trim() || '';
  } else {
    content = elements.transcript?.value.trim() || '';
  }
  
  if (!content) {
    util.showToast('Please enter a message before sending.', 'error');
    return;
  }
  
  // Check if LLM is configured
  if (!chatSettings.llmEndpoint) {
    util.showToast('LLM endpoint not configured. Please configure in Settings.', 'error');
    return;
  }
  
  isSending = true;
  updateUI();
  
  try {
    // Add user message
    const userMessage = {
      id: generateId(),
      type: 'user',
      timestamp: Date.now(),
      content,
      audioBlob: currentDraft?.audioBlob || null,
      audioUrl: currentDraft?.audioUrl || null,
      audioFilename: currentDraft?.audioFilename || null,
      audioDuration: currentDraft?.audioDuration || null
    };
    
    messages.push(userMessage);
    renderMessages();
    
    // Clear input
    handleClearInput();
    
    // Add assistant message placeholder
    const assistantMessage = {
      id: generateId(),
      type: 'assistant',
      timestamp: Date.now(),
      content: '',
      status: 'streaming',
      model: chatSettings.llmModel
    };
    
    messages.push(assistantMessage);
    renderMessages();
    
    // Send request to LLM
    const response = await sendToLLM(content);
    
    // Update assistant message with response
    assistantMessage.content = response.content;
    assistantMessage.status = 'complete';
    assistantMessage.usage = response.usage;
    
    renderMessages();
    scrollToBottom();
    
    // Record metrics
    const dataModule = getDataModule();
    if (dataModule.isEnabled()) {
      await dataModule.recordEvent('chat_message', {
        role: 'user',
        length: content.length
      });
      
      await dataModule.recordEvent('chat_response', {
        role: 'assistant',
        length: response.content.length,
        model: chatSettings.llmModel,
        usage: response.usage
      });
    }
    
  } catch (error) {
    console.error('Failed to send message:', error);
    
    // Update assistant message with error
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.type === 'assistant') {
      lastMessage.status = 'error';
      lastMessage.error = error.message;
      renderMessages();
    }
    
    util.showToast(`Failed to send message: ${error.message}`, 'error');
  } finally {
    isSending = false;
    updateUI();
  }
}

// Send message to LLM
async function sendToLLM(content) {
  const payload = {
    messages: [
      { role: 'system', content: chatSettings.systemPrompt },
      ...messages
        .filter(m => m.type !== 'assistant' || m.status === 'complete')
        .map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
    ],
    model: chatSettings.llmModel,
    temperature: chatSettings.temperature,
    max_tokens: chatSettings.maxTokens
  };
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (chatSettings.llmApiKey) {
    headers['Authorization'] = `Bearer ${chatSettings.llmApiKey}`;
  }
  
  const response = await fetch(`${LLM_API_BASE}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  return {
    content: data.choices[0]?.message?.content || '',
    usage: data.usage || null
  };
}

// Clear input
function handleClearInput() {
  // Clear draft
  if (currentDraft && currentDraft.audioUrl) {
    URL.revokeObjectURL(currentDraft.audioUrl);
  }
  currentDraft = null;
  
  // Clear text input
  if (elements.textInput) {
    elements.textInput.value = '';
  }
  
  // Clear transcript
  if (elements.transcript) {
    elements.transcript.value = '';
  }
  
  // Hide audio preview
  if (elements.audioPreview) {
    elements.audioPreview.style.display = 'none';
  }
  
  // Reset audio player
  if (elements.audioPlayer) {
    elements.audioPlayer.src = '';
  }
  
  updateUI();
}

// Clear chat
function handleClearChat() {
  if (chatSettings.confirmClear) {
    if (!confirm('Clear all messages? This cannot be undone.')) {
      return;
    }
  }
  
  // Revoke all audio URLs
  messages.forEach(msg => {
    if (msg.audioUrl) {
      URL.revokeObjectURL(msg.audioUrl);
    }
  });
  
  messages = [];
  renderMessages();
  updateUI();
  
  util.showToast('Chat cleared', 'success');
}

// Export conversation
function handleExport() {
  if (messages.length === 0) {
    util.showToast('No messages to export', 'error');
    return;
  }
  
  // Format conversation as markdown
  const markdown = formatConversationAsMarkdown();
  
  // Open export panel with pre-filled content
  openExportPanel(markdown);
}

// Format conversation as markdown
function formatConversationAsMarkdown() {
  const timestamp = new Date().toISOString().split('T')[0];
  let markdown = `# Chat Transcript\n`;
  markdown += `**Date**: ${timestamp}\n`;
  markdown += `**Model**: ${chatSettings.llmModel}\n`;
  markdown += `**Messages**: ${messages.length}\n\n`;
  markdown += `---\n\n`;
  
  messages.forEach(msg => {
    const time = new Date(msg.timestamp).toLocaleTimeString();
    const role = msg.type === 'user' ? 'You' : 'Assistant';
    
    markdown += `## ${role} (${time})\n\n`;
    
    if (msg.audioFilename) {
      markdown += `📎 Audio: ${msg.audioFilename}`;
      if (msg.audioDuration) {
        const mins = Math.floor(msg.audioDuration / 60);
        const secs = Math.floor(msg.audioDuration % 60);
        markdown += ` (${mins}:${secs.toString().padStart(2, '0')})`;
      }
      markdown += `\n\n`;
    }
    
    markdown += `${msg.content}\n\n`;
    markdown += `---\n\n`;
  });
  
  markdown += `*Exported from Yap Chat*\n`;
  
  return markdown;
}

// Render messages
function renderMessages() {
  if (!elements.messagesList) return;
  
  if (messages.length === 0) {
    // Show empty state
    elements.messagesList.innerHTML = `
      <div class="chat-empty-state">
        <div class="chat-empty-icon">💬</div>
        <div class="chat-empty-title">No messages yet</div>
        <div class="chat-empty-subtitle">
          Record audio or type a message to start<br>
          a conversation with the LLM
        </div>
      </div>
    `;
  } else {
    // Render message bubbles
    elements.messagesList.innerHTML = messages.map(msg => renderMessage(msg)).join('');
    
    // Add event listeners to message actions
    addMessageEventListeners();
  }
  
  // Update message count
  if (elements.messageCount) {
    elements.messageCount.textContent = messages.length;
  }
  
  scrollToBottom();
}

// Render single message
function renderMessage(msg) {
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isUser = msg.type === 'user';
  const icon = isUser ? '🎤' : '🤖';
  const label = isUser ? 'You' : 'Assistant';
  const borderClass = isUser ? 'message-user' : 'message-assistant';
  
  let html = `
    <div class="message-bubble ${borderClass}" data-message-id="${msg.id}">
      <div class="message-header">
        <div class="message-sender">
          <span class="message-icon">${icon}</span>
          <span class="message-sender-label">${label}</span>
          <span class="message-timestamp">${time}</span>
        </div>
        ${isUser ? `<button class="message-delete-btn small" data-action="delete" title="Delete message">×</button>` : ''}
      </div>
  `;
  
  // Audio player for user messages
  if (isUser && msg.audioUrl) {
    html += `
      <div class="message-audio">
        <div class="audio-info">
          <span class="audio-icon">🔊</span>
          <span class="audio-filename">${msg.audioFilename || 'audio.webm'}</span>
          <span class="audio-duration">(${formatDuration(msg.audioDuration)})</span>
        </div>
        <div class="audio-player-mini">
          <audio controls src="${msg.audioUrl}"></audio>
        </div>
      </div>
    `;
  }
  
  // Loading state for assistant
  if (!isUser && msg.status === 'streaming') {
    html += `
      <div class="message-loading">
        <span class="spinner"></span>
        <span>Generating response...</span>
      </div>
    `;
  }
  
  // Error state
  if (msg.status === 'error') {
    html += `
      <div class="message-error">
        <span>❌ Failed to get response</span>
        <p>${msg.error || 'Unknown error'}</p>
      </div>
    `;
  }
  
  // Message content
  if (msg.content) {
    const content = chatSettings.markdownEnabled && !isUser
      ? renderMarkdown(msg.content)
      : escapeHtml(msg.content);
    
    html += `<div class="message-content">${content}</div>`;
  }
  
  // Actions
  html += `
    <div class="message-actions">
      <button class="message-action-btn small" data-action="copy" title="Copy">
        📋 Copy
      </button>
      ${!isUser ? `
        <button class="message-action-btn small" data-action="tts" title="Read aloud">
          🔊 Read
        </button>
      ` : ''}
    </div>
  `;
  
  html += `</div>`;
  
  return html;
}

// Add event listeners to message actions
function addMessageEventListeners() {
  document.querySelectorAll('.message-bubble').forEach(bubble => {
    const messageId = bubble.dataset.messageId;
    const message = messages.find(m => m.id === messageId);
    
    if (!message) return;
    
    // Copy button
    const copyBtn = bubble.querySelector('[data-action="copy"]');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(message.content).then(() => {
          util.showToast('Copied to clipboard', 'success');
        });
      });
    }
    
    // Delete button
    const deleteBtn = bubble.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => handleDeleteMessage(messageId));
    }
    
    // TTS button
    const ttsBtn = bubble.querySelector('[data-action="tts"]');
    if (ttsBtn) {
      ttsBtn.addEventListener('click', () => handleReadAloud(message.content));
    }
  });
}

// Handle delete message
function handleDeleteMessage(messageId) {
  if (confirm('Delete this message?')) {
    const index = messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      const msg = messages[index];
      
      // Revoke audio URL if present
      if (msg.audioUrl) {
        URL.revokeObjectURL(msg.audioUrl);
      }
      
      messages.splice(index, 1);
      renderMessages();
      util.showToast('Message deleted', 'success');
    }
  }
}

// Handle read aloud (integrate with TTS)
function handleReadAloud(text) {
  // Dispatch event to TTS module
  const event = new CustomEvent('tts:synthesize', {
    detail: { text }
  });
  document.dispatchEvent(event);
  
  // Switch to TTS tab
  const ttsTabBtn = document.querySelector('[data-tab="tts"]');
  if (ttsTabBtn) {
    ttsTabBtn.click();
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Simple markdown rendering (bold, italic, code) - safely escapes HTML first
function renderMarkdown(text) {
  // First escape any HTML to prevent XSS
  let html = escapeHtml(text);
  
  // Code blocks (must be done before inline code)
  html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// Format duration
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update character count
function updateCharCount() {
  if (elements.textInput && elements.charCount) {
    const count = elements.textInput.value.length;
    elements.charCount.textContent = count;
    
    // Enable/disable send button
    if (elements.sendBtn) {
      elements.sendBtn.disabled = count === 0 || isSending;
    }
  }
}

// Start timer
function startTimer() {
  if (timerInterval) return;
  
  timerInterval = setInterval(() => {
    if (!isRecording || !recordingStartTime) return;
    
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    
    if (elements.timer) {
      elements.timer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

// Stop timer
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  if (elements.timer && recordingStartTime) {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    elements.timer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// Reset timer
function resetTimer() {
  if (elements.timer) {
    elements.timer.textContent = '00:00';
  }
}

// Scroll to bottom
function scrollToBottom() {
  if (elements.messagesList) {
    elements.messagesList.scrollTop = elements.messagesList.scrollHeight;
  }
}

// Update UI based on current state
function updateUI() {
  // Update status
  let status = 'Idle';
  let statusClass = '';
  
  if (isRecording) {
    status = 'Recording';
    statusClass = 'recording';
  } else if (isTranscribing) {
    status = 'Transcribing...';
    statusClass = 'working';
  } else if (isSending) {
    status = 'Sending...';
    statusClass = 'working';
  } else if (currentDraft && currentDraft.transcript) {
    status = 'Ready';
    statusClass = 'ready';
  }
  
  if (elements.statusText) {
    elements.statusText.textContent = status;
  }
  
  if (elements.statusDot) {
    elements.statusDot.className = 'status-dot ' + statusClass;
  }
  
  // Update buttons
  if (elements.recordBtn) {
    elements.recordBtn.textContent = isRecording ? '⏹ Stop Recording' : '🎤 Record';
    elements.recordBtn.disabled = isTranscribing || isSending;
  }
  
  if (elements.transcribeBtn) {
    elements.transcribeBtn.disabled = !currentDraft || !currentDraft.audioBlob || isRecording || isTranscribing;
  }
  
  if (elements.rerecordBtn) {
    elements.rerecordBtn.disabled = !currentDraft || isRecording || isTranscribing;
  }
  
  if (elements.sendBtn) {
    const hasContent = inputMode === 'text'
      ? elements.textInput?.value.trim().length > 0
      : currentDraft && currentDraft.transcript?.trim().length > 0;
    
    elements.sendBtn.disabled = !hasContent || isSending || isTranscribing;
  }
  
  if (elements.clearInputBtn) {
    elements.clearInputBtn.disabled = isRecording || isTranscribing || isSending;
  }
  
  // Update header buttons
  if (elements.clearBtn) {
    elements.clearBtn.disabled = messages.length === 0;
  }
  
  if (elements.exportBtn) {
    elements.exportBtn.disabled = messages.length === 0;
  }
}

// Generate unique ID
function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Public API
export const chat = {
  init,
  loadSettings,
  saveSettings,
  getSettings: () => chatSettings,
  updateSettings: (newSettings) => {
    Object.assign(chatSettings, newSettings);
    saveSettings();
    updateUI();
  },
  clearChat: handleClearChat,
  exportChat: handleExport
};
