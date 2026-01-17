// Yap - Chat Tab
// LLM chat interface with ASR integration and export capabilities

import { util } from './util.js';
import { createAddonWindow } from './addons.js';
import { openExportPanel } from './export.js';

// Chat state
let conversation = []; // Array of { id, type: 'user'|'assistant', timestamp, text, audioUrl? }
let isProcessing = false;

// LLM settings (loaded from localStorage)
let llmSettings = {
  apiEndpoint: 'http://localhost:11434/v1/chat/completions',
  modelName: 'llama3',
  apiKey: '',
  temperature: 0.7,
  maxTokens: 2048
};

// Chat UI settings
let chatSettings = {
  autoScroll: true,
  showTimestamps: false,
  exportFormat: 'full' // 'full' or 'selected'
};

// Selection state for export
let selectedMessages = new Set(); // Set of message IDs

// DOM elements
let elements = {};

// Load settings from localStorage
function loadSettings() {
  llmSettings = {
    apiEndpoint: util.storage.get('settings.llm.apiEndpoint', 'http://localhost:11434/v1/chat/completions'),
    modelName: util.storage.get('settings.llm.modelName', 'llama3'),
    apiKey: util.storage.get('settings.llm.apiKey', ''),
    temperature: util.storage.get('settings.llm.temperature', 0.7),
    maxTokens: util.storage.get('settings.llm.maxTokens', 2048)
  };
  
  chatSettings = {
    autoScroll: util.storage.get('settings.chat.autoScroll', true),
    showTimestamps: util.storage.get('settings.chat.showTimestamps', false),
    exportFormat: util.storage.get('settings.chat.exportFormat', 'full')
  };
}

// Save conversation to localStorage
function saveConversation() {
  try {
    // Don't save audio URLs (they're object URLs that won't persist)
    const toSave = conversation.map(msg => ({
      id: msg.id,
      type: msg.type,
      timestamp: msg.timestamp,
      text: msg.text
    }));
    util.storage.set('chat.conversation', toSave);
  } catch (err) {
    console.warn('Failed to save conversation:', err);
  }
}

// Load conversation from localStorage
function loadConversation() {
  try {
    const saved = util.storage.get('chat.conversation', []);
    conversation = saved.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
  } catch (err) {
    console.warn('Failed to load conversation:', err);
    conversation = [];
  }
}

// Show toast notification
function showToast(message, type = '') {
  if (window.yapState?.showGlobalToast) {
    window.yapState.showGlobalToast(message, type);
  }
}

// Generate unique message ID
function generateMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Add message to conversation
function addMessage(type, text, audioUrl = null) {
  const message = {
    id: generateMessageId(),
    type,
    timestamp: new Date(),
    text,
    audioUrl
  };
  
  conversation.push(message);
  saveConversation();
  renderMessages();
  updateExportButton();
  
  if (chatSettings.autoScroll) {
    scrollToBottom();
  }
  
  return message;
}

// Delete message from conversation
function deleteMessage(messageId) {
  conversation = conversation.filter(msg => msg.id !== messageId);
  selectedMessages.delete(messageId);
  saveConversation();
  renderMessages();
  updateExportButton();
}

// Toggle message selection
function toggleMessageSelection(messageId) {
  if (selectedMessages.has(messageId)) {
    selectedMessages.delete(messageId);
  } else {
    selectedMessages.add(messageId);
  }
  renderMessages();
  updateExportButton();
}

// Clear all selections
function clearSelections() {
  selectedMessages.clear();
  renderMessages();
  updateExportButton();
}

// Format timestamp
function formatTimestamp(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  if (isToday) {
    return timeStr;
  }
  
  const dateStr = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  
  return `${dateStr} ${timeStr}`;
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Render all messages
function renderMessages() {
  const container = elements.messagesContainer;
  if (!container) return;
  
  if (conversation.length === 0) {
    container.innerHTML = '<div class="no-messages">No messages yet. Record or type to start a conversation.</div>';
    return;
  }
  
  let html = '';
  
  conversation.forEach(msg => {
    const isSelected = selectedMessages.has(msg.id);
    const timestamp = chatSettings.showTimestamps ? `<span class="msg-timestamp">${formatTimestamp(msg.timestamp)}</span>` : '';
    
    if (msg.type === 'user') {
      html += `
        <div class="chat-message user-message ${isSelected ? 'selected' : ''}" data-id="${msg.id}">
          <div class="msg-header">
            <span class="msg-label">You</span>
            ${timestamp}
          </div>
          <div class="msg-content">${escapeHtml(msg.text)}</div>
          <div class="msg-actions">
            <button class="msg-btn msg-select" data-action="select" data-id="${msg.id}" title="Select for export" aria-label="${isSelected ? 'Deselect message' : 'Select message'}">
              ${isSelected ? '☑' : '☐'}
            </button>
            <button class="msg-btn msg-copy" data-action="copy" data-id="${msg.id}" title="Copy message" aria-label="Copy message">📋</button>
            <button class="msg-btn msg-delete" data-action="delete" data-id="${msg.id}" title="Delete message" aria-label="Delete message">🗑</button>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="chat-message assistant-message ${isSelected ? 'selected' : ''}" data-id="${msg.id}">
          <div class="msg-header">
            <span class="msg-label">Assistant</span>
            ${timestamp}
          </div>
          <div class="msg-content">${escapeHtml(msg.text)}</div>
          <div class="msg-actions">
            <button class="msg-btn msg-select" data-action="select" data-id="${msg.id}" title="Select for export" aria-label="${isSelected ? 'Deselect message' : 'Select message'}">
              ${isSelected ? '☑' : '☐'}
            </button>
            <button class="msg-btn msg-copy" data-action="copy" data-id="${msg.id}" title="Copy message" aria-label="Copy message">📋</button>
            <button class="msg-btn msg-delete" data-action="delete" data-id="${msg.id}" title="Delete message" aria-label="Delete message">🗑</button>
          </div>
        </div>
      `;
    }
  });
  
  container.innerHTML = html;
  
  // Attach event listeners to message action buttons
  container.querySelectorAll('.msg-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const messageId = btn.dataset.id;
      
      switch (action) {
        case 'select':
          toggleMessageSelection(messageId);
          break;
        case 'copy':
          copyMessage(messageId);
          break;
        case 'delete':
          if (confirm('Delete this message?')) {
            deleteMessage(messageId);
          }
          break;
      }
    });
  });
}

// Scroll messages to bottom
function scrollToBottom() {
  const container = elements.messagesContainer;
  if (container) {
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 100);
  }
}

// Copy message text
function copyMessage(messageId) {
  const message = conversation.find(msg => msg.id === messageId);
  if (!message) return;
  
  navigator.clipboard.writeText(message.text)
    .then(() => showToast('Message copied', 'success'))
    .catch(() => showToast('Failed to copy', 'error'));
}

// Copy entire conversation
function copyConversation() {
  const text = getConversationText();
  if (!text) {
    showToast('No conversation to copy', 'error');
    return;
  }
  
  navigator.clipboard.writeText(text)
    .then(() => showToast('Conversation copied', 'success'))
    .catch(() => showToast('Failed to copy', 'error'));
}

// Get conversation as formatted text
function getConversationText(selectedOnly = false) {
  const messages = selectedOnly 
    ? conversation.filter(msg => selectedMessages.has(msg.id))
    : conversation;
  
  if (messages.length === 0) return '';
  
  return messages.map(msg => {
    const timestamp = formatTimestamp(msg.timestamp);
    const label = msg.type === 'user' ? 'You' : 'Assistant';
    return `[${timestamp}] ${label}: ${msg.text}`;
  }).join('\n\n');
}

// Clear conversation
function clearConversation() {
  if (conversation.length === 0) return;
  
  if (!confirm('Clear all messages?')) return;
  
  conversation = [];
  selectedMessages.clear();
  saveConversation();
  renderMessages();
  updateExportButton();
  showToast('Conversation cleared', 'success');
}

// Send message to LLM
async function sendToLLM(userMessage) {
  if (!llmSettings.apiEndpoint) {
    showToast('LLM endpoint not configured. Check Settings.', 'error');
    return;
  }
  
  isProcessing = true;
  setUIProcessing(true);
  
  try {
    // Build conversation history for context
    const messages = conversation.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));
    
    // Add current message
    messages.push({
      role: 'user',
      content: userMessage
    });
    
    // Prepare request payload
    const payload = {
      model: llmSettings.modelName,
      messages: messages,
      temperature: llmSettings.temperature,
      max_tokens: llmSettings.maxTokens
    };
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (llmSettings.apiKey) {
      headers['Authorization'] = `Bearer ${llmSettings.apiKey}`;
    }
    
    // Make API request
    const response = await fetch(llmSettings.apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      // Sanitize error message to avoid exposing sensitive information
      const sanitizedError = errorText.length > 100 ? 'Request failed' : errorText.replace(/[<>]/g, '');
      throw new Error(`LLM API error ${response.status}: ${sanitizedError}`);
    }
    
    const result = await response.json();
    
    // Extract response text
    let responseText = '';
    if (result.choices && result.choices.length > 0) {
      responseText = result.choices[0].message?.content || '';
    } else if (result.response) {
      // Some APIs use 'response' field
      responseText = result.response;
    } else {
      throw new Error('Unexpected API response format');
    }
    
    if (!responseText) {
      throw new Error('Empty response from LLM');
    }
    
    // Add assistant response to conversation
    addMessage('assistant', responseText);
    showToast('Response received', 'success');
    
  } catch (err) {
    console.error('LLM request failed:', err);
    showToast(`Failed: ${err.message}`, 'error');
    
    // Add error message to conversation for context
    addMessage('assistant', `[Error: ${err.message}]`);
    
  } finally {
    isProcessing = false;
    setUIProcessing(false);
  }
}

// Update UI processing state
function setUIProcessing(processing) {
  if (elements.sendBtn) {
    elements.sendBtn.disabled = processing;
    elements.sendBtn.textContent = processing ? 'Sending...' : 'Send';
  }
  
  if (elements.recordBtn) {
    elements.recordBtn.disabled = processing;
  }
  
  if (elements.textInput) {
    elements.textInput.disabled = processing;
  }
  
  if (elements.statusDot && elements.statusText) {
    if (processing) {
      elements.statusDot.className = 'status-dot working';
      elements.statusText.textContent = 'Processing...';
    } else {
      elements.statusDot.className = 'status-dot';
      elements.statusText.textContent = 'Ready';
    }
  }
}

// Update export button state
function updateExportButton() {
  if (!elements.exportBtn) return;
  
  const hasMessages = conversation.length > 0;
  const hasSelection = selectedMessages.size > 0;
  
  elements.exportBtn.disabled = !hasMessages;
  
  // Update copy and clear buttons too
  if (elements.copyBtn) {
    elements.copyBtn.disabled = !hasMessages;
  }
  
  if (elements.clearBtn) {
    elements.clearBtn.disabled = !hasMessages;
  }
  
  // Update button text based on selection
  if (hasSelection && chatSettings.exportFormat === 'selected') {
    elements.exportBtn.textContent = `Export (${selectedMessages.size})`;
  } else {
    elements.exportBtn.textContent = 'Export';
  }
}

// Handle export button click
function handleExport() {
  if (conversation.length === 0) {
    showToast('No conversation to export', 'error');
    return;
  }
  
  // Determine what to export based on settings and selection
  const shouldExportSelected = chatSettings.exportFormat === 'selected' && selectedMessages.size > 0;
  
  openExportPanel(
    () => getConversationText(shouldExportSelected),
    () => [] // Chat doesn't use clips - only text-based conversation
  );
}

// Handle text input send
function handleTextSend() {
  const text = elements.textInput?.value.trim();
  if (!text) return;
  
  // Add user message
  addMessage('user', text);
  
  // Clear input
  elements.textInput.value = '';
  updateSendButton();
  
  // Send to LLM
  sendToLLM(text);
}

// Update send button state based on input
function updateSendButton() {
  if (!elements.sendBtn || !elements.textInput) return;
  
  const hasText = elements.textInput.value.trim().length > 0;
  elements.sendBtn.disabled = !hasText || isProcessing;
}

// Open recording interface (simulated for now - will integrate with ASR later)
function handleRecord() {
  showToast('ASR recording integration coming soon', 'info');
  // TODO: Integrate with ASR module to record audio and transcribe
  // For now, we'll focus on text input and export functionality
}

// Open chat settings
function openChatSettings() {
  createAddonWindow('Chat Settings', (container) => {
    container.classList.add('chat-settings-panel');
    
    container.innerHTML = `
      <div class="export-section">
        <label>
          <input type="checkbox" id="chatAutoScroll" ${chatSettings.autoScroll ? 'checked' : ''}>
          Auto-scroll to new messages
        </label>
      </div>
      
      <div class="export-section">
        <label>
          <input type="checkbox" id="chatShowTimestamps" ${chatSettings.showTimestamps ? 'checked' : ''}>
          Show message timestamps
        </label>
      </div>
      
      <div class="export-section">
        <label for="chatExportFormat">Export format:</label>
        <select id="chatExportFormat">
          <option value="full" ${chatSettings.exportFormat === 'full' ? 'selected' : ''}>Full conversation</option>
          <option value="selected" ${chatSettings.exportFormat === 'selected' ? 'selected' : ''}>Selected messages only</option>
        </select>
      </div>
      
      <div class="export-actions">
        <button class="small primary" id="chatSettingsSave">Save</button>
        <button class="small" id="chatSettingsCancel">Cancel</button>
      </div>
    `;
    
    container.querySelector('#chatSettingsSave')?.addEventListener('click', () => {
      chatSettings.autoScroll = container.querySelector('#chatAutoScroll')?.checked || false;
      chatSettings.showTimestamps = container.querySelector('#chatShowTimestamps')?.checked || false;
      chatSettings.exportFormat = container.querySelector('#chatExportFormat')?.value || 'full';
      
      // Save to localStorage
      util.storage.set('settings.chat.autoScroll', chatSettings.autoScroll);
      util.storage.set('settings.chat.showTimestamps', chatSettings.showTimestamps);
      util.storage.set('settings.chat.exportFormat', chatSettings.exportFormat);
      
      renderMessages();
      updateExportButton();
      showToast('Settings saved', 'success');
      
      // Close window
      const closeBtn = container.closest('.addon-window')?.querySelector('.addon-window-close');
      if (closeBtn) closeBtn.click();
    });
    
    container.querySelector('#chatSettingsCancel')?.addEventListener('click', () => {
      const closeBtn = container.closest('.addon-window')?.querySelector('.addon-window-close');
      if (closeBtn) closeBtn.click();
    });
    
  }, { width: 400, height: 300 });
}

// Initialize chat tab
async function init(container) {
  if (!container) return;
  
  // Load settings and conversation
  loadSettings();
  loadConversation();
  
  // Cache DOM elements
  elements = {
    messagesContainer: container.querySelector('#chatMessagesContainer'),
    textInput: container.querySelector('#chatTextInput'),
    sendBtn: container.querySelector('#chatSendBtn'),
    recordBtn: container.querySelector('#chatRecordBtn'),
    exportBtn: container.querySelector('#chatExportBtn'),
    copyBtn: container.querySelector('#chatCopyBtn'),
    clearBtn: container.querySelector('#chatClearBtn'),
    settingsBtn: container.querySelector('#chatSettingsBtn'),
    statusDot: container.querySelector('#chatStatusDot'),
    statusText: container.querySelector('#chatStatusText'),
    selectAllBtn: container.querySelector('#chatSelectAllBtn'),
    clearSelectBtn: container.querySelector('#chatClearSelectBtn')
  };
  
  // Setup event listeners
  elements.sendBtn?.addEventListener('click', handleTextSend);
  
  elements.textInput?.addEventListener('input', updateSendButton);
  elements.textInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSend();
    }
  });
  
  elements.recordBtn?.addEventListener('click', handleRecord);
  elements.exportBtn?.addEventListener('click', handleExport);
  elements.copyBtn?.addEventListener('click', copyConversation);
  elements.clearBtn?.addEventListener('click', clearConversation);
  elements.settingsBtn?.addEventListener('click', openChatSettings);
  
  elements.selectAllBtn?.addEventListener('click', () => {
    conversation.forEach(msg => selectedMessages.add(msg.id));
    renderMessages();
    updateExportButton();
  });
  
  elements.clearSelectBtn?.addEventListener('click', () => {
    clearSelections();
  });
  
  // Initial render
  renderMessages();
  updateSendButton();
  updateExportButton();
  
  console.log('Chat module initialized');
}

// Export public API
export const chat = {
  init
};
