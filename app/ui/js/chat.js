// Yap - Chat Tab
// Voice-based conversations with LLMs using ASR recording + Ollama

import { util } from './util.js';
import { storage } from './storage.js';
import { openExportPanel } from './export.js';

// Chat State
let messages = [];  // Array of message objects
let currentDraft = null;  // Current message being composed
let isRecording = false;
let isTranscribing = false;
let isSending = false;
let inputMode = 'audio';  // 'audio' or 'text'

// Recording state
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let audioContext = null;
let analyser = null;
let animationId = null;
let startTime = null;
let timerInterval = null;

// DOM elements (set in init)
let elements = {};

// Constants
const BAR_COUNT = 48;
const MAX_MESSAGE_LENGTH = 10000;

// Chat settings (persisted)
let chatSettings = {
  llmEndpoint: '/llm',  // Relative URL through Caddy proxy
  llmModel: 'llama3.2',
  llmApiKey: '',
  temperature: 0.7,
  maxTokens: 1000,
  systemPrompt: 'You are a helpful assistant.',
  autoSend: false,
  confirmClear: true,
  markdownEnabled: true,
  maxContextMessages: 10  // Number of previous messages to include in LLM context
};

// Load settings from localStorage
function loadSettings() {
  chatSettings = {
    llmEndpoint: util.storage.get('settings.chat.llmEndpoint', '/llm'),
    llmModel: util.storage.get('settings.chat.llmModel', 'llama3.2'),
    llmApiKey: util.storage.get('settings.chat.llmApiKey', ''),
    temperature: util.storage.get('settings.chat.temperature', 0.7),
    maxTokens: util.storage.get('settings.chat.maxTokens', 1000),
    systemPrompt: util.storage.get('settings.chat.systemPrompt', 'You are a helpful assistant.'),
    autoSend: util.storage.get('settings.chat.autoSend', false),
    confirmClear: util.storage.get('settings.chat.confirmClear', true),
    markdownEnabled: util.storage.get('settings.chat.markdownEnabled', true),
    maxContextMessages: util.storage.get('settings.chat.maxContextMessages', 10)
  };
}

// Save settings to localStorage
function saveSettings() {
  util.storage.set('settings.chat.llmEndpoint', chatSettings.llmEndpoint);
  util.storage.set('settings.chat.llmModel', chatSettings.llmModel);
  util.storage.set('settings.chat.llmApiKey', chatSettings.llmApiKey);
  util.storage.set('settings.chat.temperature', chatSettings.temperature);
  util.storage.set('settings.chat.maxTokens', chatSettings.maxTokens);
  util.storage.set('settings.chat.systemPrompt', chatSettings.systemPrompt);
  util.storage.set('settings.chat.autoSend', chatSettings.autoSend);
  util.storage.set('settings.chat.confirmClear', chatSettings.confirmClear);
  util.storage.set('settings.chat.markdownEnabled', chatSettings.markdownEnabled);
  util.storage.set('settings.chat.maxContextMessages', chatSettings.maxContextMessages);
}

// Update settings (called from settings panel)
function updateSettings(newSettings) {
  Object.assign(chatSettings, newSettings);
  saveSettings();
}

// Generate unique ID for messages
function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Format timestamp for display
function formatTimestamp(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleString();
}

// Update status display
function updateStatus(text, color = 'idle') {
  if (elements.chatStatusText) {
    elements.chatStatusText.textContent = text;
  }
  if (elements.chatStatusDot) {
    elements.chatStatusDot.className = `status-dot status-${color}`;
  }
}

// Update timer display
function updateTimer(ms) {
  if (elements.chatTimer) {
    elements.chatTimer.textContent = util.formatDuration(ms);
  }
}

// Update message count badge
function updateMessageCount() {
  if (elements.chatMessageCount) {
    elements.chatMessageCount.textContent = messages.length;
  }
}

// Render messages list
function renderMessages() {
  if (!elements.chatMessagesList) return;
  
  if (messages.length === 0) {
    elements.chatMessagesList.innerHTML = `
      <div class="chat-empty-state">
        <div class="chat-empty-icon">💬</div>
        <div class="chat-empty-title">No messages yet</div>
        <div class="chat-empty-subtitle">
          Record audio or type a message to start<br>
          a conversation with the LLM
        </div>
      </div>
    `;
    return;
  }
  
  elements.chatMessagesList.innerHTML = '';
  
  messages.forEach(msg => {
    const bubble = createMessageBubble(msg);
    elements.chatMessagesList.appendChild(bubble);
  });
  
  // Auto-scroll to bottom
  scrollToBottom();
}

// Create message bubble element
function createMessageBubble(msg) {
  const bubble = document.createElement('div');
  bubble.className = `message-bubble message-${msg.type}`;
  bubble.dataset.messageId = msg.id;
  
  if (msg.type === 'user') {
    bubble.innerHTML = `
      <div class="message-header">
        <div class="message-sender">
          <span class="message-icon">🎤</span>
          <span class="message-sender-label">You</span>
          <span class="message-timestamp">${formatTimestamp(msg.timestamp)}</span>
        </div>
        <button class="message-delete-btn small" title="Delete message">×</button>
      </div>
      ${msg.audioUrl ? `
        <div class="message-audio">
          <div class="audio-info">
            <span class="audio-icon">🔊</span>
            <span class="audio-filename">${msg.audioFilename || 'audio.webm'}</span>
            <span class="audio-duration">(${util.formatSeconds(msg.audioDuration || 0)})</span>
          </div>
          <audio controls src="${msg.audioUrl}"></audio>
        </div>
      ` : ''}
      <div class="message-content">${escapeHtml(msg.content)}</div>
      <div class="message-actions">
        <button class="message-action-btn small" data-action="copy" title="Copy">📋 Copy</button>
      </div>
    `;
    
    // Add event listeners
    const deleteBtn = bubble.querySelector('.message-delete-btn');
    deleteBtn.addEventListener('click', () => deleteMessage(msg.id));
    
    const copyBtn = bubble.querySelector('[data-action="copy"]');
    copyBtn.addEventListener('click', () => copyMessageContent(msg.id));
    
  } else if (msg.type === 'assistant') {
    const isLoading = msg.status === 'streaming' || msg.status === 'sending';
    
    bubble.innerHTML = `
      <div class="message-header">
        <div class="message-sender">
          <span class="message-icon">🤖</span>
          <span class="message-sender-label">Assistant</span>
          <span class="message-timestamp">${isLoading ? 'thinking...' : formatTimestamp(msg.timestamp)}</span>
        </div>
      </div>
      ${isLoading ? `
        <div class="message-loading">
          <span class="spinner"></span>
          <span>Generating response...</span>
        </div>
      ` : `
        <div class="message-content">${renderMessageContent(msg.content)}</div>
        <div class="message-actions">
          <button class="message-action-btn small" data-action="copy" title="Copy">📋 Copy</button>
        </div>
      `}
    `;
    
    if (!isLoading) {
      const copyBtn = bubble.querySelector('[data-action="copy"]');
      copyBtn.addEventListener('click', () => copyMessageContent(msg.id));
    }
  }
  
  return bubble;
}

// Render message content (with optional markdown)
function renderMessageContent(content) {
  if (!chatSettings.markdownEnabled) {
    return escapeHtml(content);
  }

  // Escape all content first to avoid XSS
  let html = escapeHtml(content);

  // Extract code blocks and inline code into placeholders so that
  // later markdown processing (bold/italic) does not affect code.
  const codeSegments = [];

  // Code blocks: ```...```
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
    const index = codeSegments.length;
    // `code` is already escaped via escapeHtml above.
    codeSegments.push(`<pre><code>${code}</code></pre>`);
    return `__CODE_BLOCK_${index}__`;
  });

  // Inline code: `...`
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const index = codeSegments.length;
    // `code` is already escaped via escapeHtml above.
    codeSegments.push(`<code>${code}</code>`);
    return `__CODE_BLOCK_${index}__`;
  });

  // Bold: **...**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic: *...*
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  // Restore code segments
  html = html.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeSegments[Number(i)] || '');
  return html;
}

// HTML escape helper
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Scroll to bottom of messages
function scrollToBottom() {
  if (elements.chatMessagesList) {
    elements.chatMessagesList.scrollTop = elements.chatMessagesList.scrollHeight;
  }
}

// Delete message
function deleteMessage(messageId) {
  if (chatSettings.confirmClear && !confirm('Delete this message?')) {
    return;
  }
  
  messages = messages.filter(m => m.id !== messageId);
  renderMessages();
  updateMessageCount();
  
  // Save to localStorage
  saveConversation();
}

// Copy message content
function copyMessageContent(messageId) {
  const msg = messages.find(m => m.id === messageId);
  if (!msg) return;
  
  navigator.clipboard.writeText(msg.content)
    .then(() => {
      if (window.showGlobalToast) {
        window.showGlobalToast('Message copied to clipboard', 'success');
      }
    })
    .catch(err => {
      console.error('Copy failed:', err);
      if (window.showGlobalToast) {
        window.showGlobalToast('Failed to copy message', 'error');
      }
    });
}

// Switch input mode
function switchInputMode(mode) {
  inputMode = mode;
  
  // Update mode toggle buttons
  if (elements.chatModeAudio) {
    elements.chatModeAudio.classList.toggle('active', mode === 'audio');
  }
  if (elements.chatModeText) {
    elements.chatModeText.classList.toggle('active', mode === 'text');
  }
  
  // Show/hide mode-specific UI
  if (elements.chatAudioMode) {
    elements.chatAudioMode.style.display = mode === 'audio' ? 'block' : 'none';
  }
  if (elements.chatTextMode) {
    elements.chatTextMode.style.display = mode === 'text' ? 'block' : 'none';
  }
  if (elements.chatAudioControls) {
    elements.chatAudioControls.style.display = mode === 'audio' ? 'flex' : 'none';
  }
  
  // Update send button state
  updateSendButtonState();
}

// Update send button state
function updateSendButtonState() {
  if (!elements.chatSendBtn) return;
  
  let hasContent = false;
  
  if (inputMode === 'audio') {
    hasContent = currentDraft && currentDraft.content && currentDraft.content.trim();
  } else {
    hasContent = elements.chatTextInput && elements.chatTextInput.value.trim();
  }
  
  elements.chatSendBtn.disabled = !hasContent || isSending;
}

// Start audio recording
async function startRecording() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const mimeType = util.getSupportedMimeType();
    mediaRecorder = new MediaRecorder(audioStream, { mimeType });
    
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: mimeType });
      const duration = (Date.now() - startTime) / 1000;
      
      currentDraft = {
        audioBlob: blob,
        audioUrl: URL.createObjectURL(blob),
        audioFilename: `clip-${Date.now()}.webm`,
        audioDuration: duration,
        content: '',
        status: 'recorded'
      };
      
      // Show audio preview
      showAudioPreview();
      
      // Auto-transcribe if enabled
      if (chatSettings.autoSend) {
        await transcribeAudio();
      }
    };
    
    mediaRecorder.start();
    startTime = Date.now();
    isRecording = true;
    
    // Start waveform visualization
    startWaveform();
    
    // Start timer
    timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      updateTimer(elapsed);
    }, 100);
    
    // Update UI
    updateStatus('Recording', 'recording');
    if (elements.chatRecordBtn) {
      elements.chatRecordBtn.textContent = '⏹ Stop Recording';
      elements.chatRecordBtn.classList.add('danger');
    }
    
  } catch (err) {
    console.error('Recording failed:', err);
    if (window.showGlobalToast) {
      window.showGlobalToast('Microphone access denied. Please allow microphone access in your browser settings.', 'error');
    }
  }
}

// Stop audio recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  stopWaveform();
  
  isRecording = false;
  
  // Update UI
  updateStatus('Ready', 'ready');
  if (elements.chatRecordBtn) {
    elements.chatRecordBtn.textContent = '🎤 Re-record';
    elements.chatRecordBtn.classList.remove('danger');
  }
}

// Show audio preview
function showAudioPreview() {
  if (!currentDraft || !elements.chatAudioPreview) return;
  
  // Hide waveform, show preview
  if (elements.waveformContainer) {
    elements.waveformContainer.style.display = 'none';
  }
  elements.chatAudioPreview.style.display = 'block';
  
  // Set audio player source
  if (elements.chatAudioPlayer) {
    elements.chatAudioPlayer.src = currentDraft.audioUrl;
  }
  
  // Update filename and duration
  if (elements.chatAudioFilename) {
    elements.chatAudioFilename.textContent = currentDraft.audioFilename;
  }
  if (elements.chatAudioDuration) {
    elements.chatAudioDuration.textContent = `(${util.formatSeconds(currentDraft.audioDuration)})`;
  }
  
  // Enable transcribe button
  if (elements.chatTranscribeBtn) {
    elements.chatTranscribeBtn.disabled = false;
  }
}

// Start waveform visualization
function startWaveform() {
  if (!audioStream || !elements.chatWaveform) return;
  
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(audioStream);
  source.connect(analyser);
  analyser.fftSize = 128;
  
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  const canvas = elements.chatWaveform;
  const canvasCtx = canvas.getContext('2d');
  
  // Set canvas size
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  
  // Get CSS color variables
  const bgTertiary = getComputedStyle(document.documentElement).getPropertyValue('--bg-tertiary').trim();
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  
  function draw() {
    if (!isRecording) return;
    
    animationId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    
    canvasCtx.fillStyle = bgTertiary;
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = canvas.width / BAR_COUNT;
    
    for (let i = 0; i < BAR_COUNT; i++) {
      const value = dataArray[Math.floor(i * bufferLength / BAR_COUNT)];
      const barHeight = (value / 255) * canvas.height * 0.8;
      const x = i * barWidth;
      const y = canvas.height - barHeight;
      
      // Parse RGB from accent color or use fallback
      const alpha = 0.5 + value / 510;
      canvasCtx.fillStyle = accentColor.startsWith('#') 
        ? `${accentColor}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
        : `rgba(255, 41, 117, ${alpha})`;
      canvasCtx.fillRect(x, y, barWidth - 2, barHeight);
    }
  }
  
  // Show waveform container
  if (elements.waveformContainer) {
    elements.waveformContainer.style.display = 'block';
  }
  
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
}

// Transcribe audio
async function transcribeAudio() {
  if (!currentDraft || !currentDraft.audioBlob) return;
  
  isTranscribing = true;
  updateStatus('Transcribing...', 'working');
  
  if (elements.chatTranscribeBtn) {
    elements.chatTranscribeBtn.disabled = true;
  }
  
  try {
    // Create FormData with audio blob
    const formData = new FormData();
    formData.append('audio', currentDraft.audioBlob, currentDraft.audioFilename);
    
    // Call ASR service
    const response = await fetch('/asr/transcribe', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    currentDraft.content = data.text || '';
    currentDraft.status = 'transcribed';
    
    // Update transcript textarea
    if (elements.chatTranscript) {
      elements.chatTranscript.value = currentDraft.content;
    }
    
    // Update UI
    updateStatus('Ready', 'ready');
    updateSendButtonState();
    
    // Auto-send if enabled
    if (chatSettings.autoSend && currentDraft.content.trim()) {
      await sendMessage();
    }
    
  } catch (err) {
    console.error('Transcription error:', err);
    if (window.showGlobalToast) {
      window.showGlobalToast('Transcription failed. Please try recording again.', 'error');
    }
    updateStatus('Error', 'error');
  } finally {
    isTranscribing = false;
    if (elements.chatTranscribeBtn) {
      elements.chatTranscribeBtn.disabled = false;
    }
  }
}

// Send message to LLM
async function sendMessage() {
  let messageContent = '';
  
  // Get message content based on input mode
  if (inputMode === 'audio') {
    if (!currentDraft || !currentDraft.content) {
      if (window.showGlobalToast) {
        window.showGlobalToast('Please record and transcribe a message first', 'error');
      }
      return;
    }
    messageContent = currentDraft.content.trim();
  } else {
    messageContent = elements.chatTextInput.value.trim();
  }
  
  if (!messageContent) {
    if (window.showGlobalToast) {
      window.showGlobalToast('Please enter a message', 'error');
    }
    return;
  }
  
  if (messageContent.length > MAX_MESSAGE_LENGTH) {
    if (window.showGlobalToast) {
      window.showGlobalToast(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`, 'error');
    }
    return;
  }
  
  isSending = true;
  updateStatus('Sending...', 'working');
  updateSendButtonState();
  
  // Create user message
  const userMessage = {
    id: generateId(),
    type: 'user',
    timestamp: Date.now(),
    content: messageContent,
    audioBlob: currentDraft?.audioBlob || null,
    audioUrl: currentDraft?.audioUrl || null,
    audioFilename: currentDraft?.audioFilename || null,
    audioDuration: currentDraft?.audioDuration || null,
    status: 'sent'
  };
  
  // Create assistant message placeholder
  const assistantMessage = {
    id: generateId(),
    type: 'assistant',
    timestamp: Date.now(),
    content: '',
    status: 'sending',
    model: chatSettings.llmModel
  };
  
  // Add messages to conversation
  messages.push(userMessage, assistantMessage);
  renderMessages();
  updateMessageCount();
  
  // Clear input
  clearInput();
  
  try {
    // Build conversation history for context
    const conversationHistory = messages
      .slice(0, -1)  // Exclude the placeholder assistant message
      .filter(m => m.status !== 'sending' && m.status !== 'error')
      .map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content
      }));
    
    // Call LLM proxy - use last N messages for context
    const contextMessages = conversationHistory.slice(-chatSettings.maxContextMessages);
    
    const response = await fetch(`${chatSettings.llmEndpoint}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(chatSettings.llmApiKey && { 'Authorization': `Bearer ${chatSettings.llmApiKey}` })
      },
      body: JSON.stringify({
        message: messageContent,
        conversationHistory: contextMessages,
        model: chatSettings.llmModel,
        temperature: chatSettings.temperature,
        systemPrompt: chatSettings.systemPrompt
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Update assistant message
    assistantMessage.content = data.response;
    assistantMessage.status = 'complete';
    assistantMessage.timestamp = Date.now();
    
    // Re-render to show response
    renderMessages();
    
    // Save conversation
    saveConversation();
    
    // Update status
    updateStatus('Idle', 'idle');
    
  } catch (err) {
    console.error('LLM request error:', err);
    
    // Update assistant message with error
    assistantMessage.content = `Error: ${err.message}`;
    assistantMessage.status = 'error';
    
    // Re-render to show error
    renderMessages();
    
    // Show toast
    if (window.showGlobalToast) {
      window.showGlobalToast(`Failed to send message: ${err.message}`, 'error');
    }
    
    updateStatus('Error', 'error');
  } finally {
    isSending = false;
    updateSendButtonState();
  }
}

// Clear input
function clearInput() {
  // Clear audio draft
  if (currentDraft) {
    if (currentDraft.audioUrl) {
      URL.revokeObjectURL(currentDraft.audioUrl);
    }
    currentDraft = null;
  }
  
  // Clear text input
  if (elements.chatTextInput) {
    elements.chatTextInput.value = '';
    updateCharCount();
  }
  
  // Clear audio preview
  if (elements.chatAudioPreview) {
    elements.chatAudioPreview.style.display = 'none';
  }
  if (elements.waveformContainer) {
    elements.waveformContainer.style.display = 'none';
  }
  if (elements.chatAudioPlayer) {
    elements.chatAudioPlayer.src = '';
  }
  if (elements.chatTranscript) {
    elements.chatTranscript.value = '';
  }
  
  // Reset buttons
  if (elements.chatRecordBtn) {
    elements.chatRecordBtn.textContent = '🎤 Record';
    elements.chatRecordBtn.classList.remove('danger');
  }
  if (elements.chatTranscribeBtn) {
    elements.chatTranscribeBtn.disabled = true;
  }
  if (elements.chatRerecordBtn) {
    elements.chatRerecordBtn.disabled = true;
  }
  
  // Update timer
  updateTimer(0);
  updateStatus('Idle', 'idle');
  updateSendButtonState();
}

// Clear all messages
function clearChat() {
  if (chatSettings.confirmClear && !confirm('Clear all messages? This cannot be undone.')) {
    return;
  }
  
  messages = [];
  renderMessages();
  updateMessageCount();
  clearInput();
  
  // Clear saved conversation
  util.storage.remove('chat.conversation');
  
  if (window.showGlobalToast) {
    window.showGlobalToast('Chat cleared', 'success');
  }
}

// Export conversation
function exportConversation() {
  if (messages.length === 0) {
    if (window.showGlobalToast) {
      window.showGlobalToast('No messages to export', 'info');
    }
    return;
  }
  
  // Format conversation as markdown
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];
  
  let markdown = `# Chat Transcript\n`;
  markdown += `**Date**: ${dateStr} ${timeStr}\n`;
  markdown += `**Model**: ${chatSettings.llmModel}\n`;
  markdown += `**Messages**: ${messages.length}\n\n`;
  markdown += `---\n\n`;
  
  messages.forEach(msg => {
    const time = new Date(msg.timestamp).toTimeString().split(' ')[0];
    const sender = msg.type === 'user' ? 'You' : 'Assistant';
    
    markdown += `## ${sender} (${time})\n\n`;
    
    if (msg.audioFilename) {
      markdown += `📎 Audio: ${msg.audioFilename} (${util.formatSeconds(msg.audioDuration)})\n\n`;
    }
    
    markdown += `${msg.content}\n\n`;
    markdown += `---\n\n`;
  });
  
  markdown += `*Exported from Yap Chat*\n`;
  
  // Open export panel with pre-filled content
  openExportPanel(markdown);
}

// Save conversation to localStorage
function saveConversation() {
  try {
    // Save without audio blobs (too large for localStorage)
    const conversationData = messages.map(msg => ({
      id: msg.id,
      type: msg.type,
      timestamp: msg.timestamp,
      content: msg.content,
      status: msg.status,
      model: msg.model,
      audioFilename: msg.audioFilename,
      audioDuration: msg.audioDuration
      // Omit audioBlob and audioUrl
    }));
    
    util.storage.set('chat.conversation', conversationData);
  } catch (err) {
    console.warn('Failed to save conversation:', err);
  }
}

// Load conversation from localStorage
function loadConversation() {
  try {
    const conversationData = util.storage.get('chat.conversation', []);
    messages = conversationData.filter(msg => 
      msg.status !== 'sending' && msg.status !== 'error'
    );
    renderMessages();
    updateMessageCount();
  } catch (err) {
    console.warn('Failed to load conversation:', err);
  }
}

// Update character count for text input
function updateCharCount() {
  if (elements.chatTextInput && elements.chatCharCount) {
    const count = elements.chatTextInput.value.length;
    elements.chatCharCount.textContent = count;
    
    // Warn if approaching limit
    if (count > MAX_MESSAGE_LENGTH * 0.9) {
      elements.chatCharCount.style.color = 'var(--error)';
    } else {
      elements.chatCharCount.style.color = '';
    }
  }
}

// Initialize chat tab
function init() {
  // Load settings
  loadSettings();
  
  // Cache DOM elements
  elements = {
    // Containers
    chatTab: document.getElementById('chat-tab'),
    chatMessagesList: document.getElementById('chatMessagesList'),
    chatHeader: document.querySelector('#chat-tab .chat-header'),
    
    // Status and controls
    chatStatusDot: document.getElementById('chatStatusDot'),
    chatStatusText: document.getElementById('chatStatusText'),
    chatTimer: document.getElementById('chatTimer'),
    chatMessageCount: document.getElementById('chatMessageCount'),
    
    // Mode toggle
    chatModeAudio: document.getElementById('chatModeAudio'),
    chatModeText: document.getElementById('chatModeText'),
    
    // Audio mode elements
    chatAudioMode: document.getElementById('chatAudioMode'),
    waveformContainer: document.querySelector('#chat-tab .waveform-container'),
    chatWaveform: document.getElementById('chatWaveform'),
    chatAudioPreview: document.getElementById('chatAudioPreview'),
    chatAudioPlayer: document.getElementById('chatAudioPlayer'),
    chatAudioFilename: document.getElementById('chatAudioFilename'),
    chatAudioDuration: document.getElementById('chatAudioDuration'),
    chatTranscript: document.getElementById('chatTranscript'),
    
    // Text mode elements
    chatTextMode: document.getElementById('chatTextMode'),
    chatTextInput: document.getElementById('chatTextInput'),
    chatCharCount: document.getElementById('chatCharCount'),
    
    // Buttons
    chatRecordBtn: document.getElementById('chatRecordBtn'),
    chatTranscribeBtn: document.getElementById('chatTranscribeBtn'),
    chatRerecordBtn: document.getElementById('chatRerecordBtn'),
    chatSendBtn: document.getElementById('chatSendBtn'),
    chatClearInputBtn: document.getElementById('chatClearInputBtn'),
    chatClearBtn: document.getElementById('chatClearBtn'),
    chatExportBtn: document.getElementById('chatExportBtn'),
    
    // Audio controls group
    chatAudioControls: document.getElementById('chatAudioControls')
  };
  
  // Set up event listeners
  if (elements.chatModeAudio) {
    elements.chatModeAudio.addEventListener('click', () => switchInputMode('audio'));
  }
  if (elements.chatModeText) {
    elements.chatModeText.addEventListener('click', () => switchInputMode('text'));
  }
  
  if (elements.chatRecordBtn) {
    elements.chatRecordBtn.addEventListener('click', () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    });
  }
  
  if (elements.chatTranscribeBtn) {
    elements.chatTranscribeBtn.addEventListener('click', () => transcribeAudio());
  }
  
  if (elements.chatRerecordBtn) {
    elements.chatRerecordBtn.addEventListener('click', () => {
      clearInput();
      startRecording();
    });
  }
  
  if (elements.chatSendBtn) {
    elements.chatSendBtn.addEventListener('click', () => sendMessage());
  }
  
  if (elements.chatClearInputBtn) {
    elements.chatClearInputBtn.addEventListener('click', () => clearInput());
  }
  
  if (elements.chatClearBtn) {
    elements.chatClearBtn.addEventListener('click', () => clearChat());
  }
  
  if (elements.chatExportBtn) {
    elements.chatExportBtn.addEventListener('click', () => exportConversation());
  }
  
  if (elements.chatTextInput) {
    elements.chatTextInput.addEventListener('input', () => {
      updateCharCount();
      updateSendButtonState();
    });
    
    // Ctrl+Enter to send
    elements.chatTextInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter' && !isSending) {
        sendMessage();
      }
    });
  }
  
  if (elements.chatTranscript) {
    elements.chatTranscript.addEventListener('input', () => {
      if (currentDraft) {
        currentDraft.content = elements.chatTranscript.value;
        updateSendButtonState();
      }
    });
  }
  
  // Initialize UI
  switchInputMode('audio');
  updateStatus('Idle', 'idle');
  updateMessageCount();
  
  // Load saved conversation
  loadConversation();
  
  console.log('[Chat] Initialized');
}

// Export module
export const chat = {
  init,
  updateSettings,
  clearChat,
  exportConversation,
  // Expose for testing
  _state: () => ({ messages, chatSettings })
};

// Make available globally
window.chat = chat;
