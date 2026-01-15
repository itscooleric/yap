# Chat UI Components Specification

## Component Hierarchy

```
ChatTab
├── ChatHeader
│   ├── MessageCountBadge
│   └── ActionButtons (Clear, Export)
├── MessageListContainer
│   ├── EmptyState (conditional)
│   └── MessageList
│       ├── MessageBubble (User) × N
│       │   ├── MessageHeader
│       │   ├── AudioPlayer (optional)
│       │   ├── TranscriptContent
│       │   └── MessageActions
│       └── MessageBubble (Assistant) × N
│           ├── MessageHeader
│           ├── ResponseContent
│           └── MessageActions
└── NewMessagePanel
    ├── StatusBar
    ├── WaveformVisualizer (conditional)
    ├── AudioPreview (conditional)
    ├── TextInput (conditional)
    └── ActionButtons (Record, Send, Clear)
```

## Detailed Component Specs

### 1. ChatTab (Container)

**Purpose**: Main container for the chat interface  
**File**: `app/ui/js/chat.js`  
**HTML ID**: `chat-tab`

```html
<div id="chat-tab" class="tab-content">
  <!-- Chat header -->
  <div class="chat-header panel">...</div>
  
  <!-- Message list -->
  <div class="chat-messages-container panel">...</div>
  
  <!-- New message panel -->
  <div class="chat-input-panel panel">...</div>
</div>
```

**CSS Classes**:
```css
#chat-tab {
  /* Inherits from .tab-content */
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-messages-container {
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.chat-input-panel {
  /* Inherits from .panel */
}
```

---

### 2. ChatHeader

**Purpose**: Display message count and quick actions  
**Location**: Top of chat tab

```html
<div class="panel chat-header">
  <div class="panel-header">
    Chat
    <span class="message-count-badge" id="chatMessageCount">0</span>
  </div>
  <div class="chat-header-actions">
    <button id="chatClearBtn" class="small danger">Clear Chat</button>
    <button id="chatExportBtn" class="small">Export</button>
  </div>
</div>
```

**CSS**:
```css
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.message-count-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  margin-left: 0.5rem;
  background: var(--accent-glow);
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
}

.chat-header-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}
```

**State**:
- Message count updates on add/remove
- Clear button shows confirmation dialog if `confirmClear` enabled
- Export button opens export panel with chat transcript

---

### 3. MessageListContainer

**Purpose**: Scrollable container for all messages  
**Behavior**: Auto-scroll to bottom when new message added

```html
<div class="panel">
  <div class="panel-header">Messages</div>
  <div class="chat-messages" id="chatMessagesList">
    <!-- Empty state or message bubbles -->
  </div>
</div>
```

**CSS**:
```css
.chat-messages {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 1rem;
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Smooth scrolling */
.chat-messages {
  scroll-behavior: smooth;
}

/* Custom scrollbar (matches existing Yap style) */
.chat-messages::-webkit-scrollbar {
  width: 8px;
}

.chat-messages::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

.chat-messages::-webkit-scrollbar-thumb {
  background: var(--border-light);
  border-radius: 4px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
```

**JavaScript**:
```javascript
// Auto-scroll to bottom when new message added
function scrollToBottom() {
  const container = document.getElementById('chatMessagesList');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}
```

---

### 4. EmptyState

**Purpose**: Show helpful message when no messages exist  
**Condition**: Displayed when message count === 0

```html
<div class="chat-empty-state">
  <div class="chat-empty-icon">💬</div>
  <div class="chat-empty-title">No messages yet</div>
  <div class="chat-empty-subtitle">
    Record audio or type a message to start<br>
    a conversation with the LLM
  </div>
</div>
```

**CSS**:
```css
.chat-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-muted);
  min-height: 300px;
}

.chat-empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.chat-empty-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.chat-empty-subtitle {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--text-muted);
}
```

---

### 5. MessageBubble (User)

**Purpose**: Display user's audio message and transcript  
**Type**: Component that can be cloned/templated

```html
<div class="message-bubble message-user" data-message-id="{uuid}">
  <div class="message-header">
    <div class="message-sender">
      <span class="message-icon">🎤</span>
      <span class="message-sender-label">You</span>
      <span class="message-timestamp">2m ago</span>
    </div>
    <button class="message-delete-btn small" title="Delete message">×</button>
  </div>
  
  <!-- Audio player (if message has audio) -->
  <div class="message-audio" style="display: none;">
    <div class="audio-info">
      <span class="audio-icon">🔊</span>
      <span class="audio-filename">clip-001.webm</span>
      <span class="audio-duration">(0:08)</span>
    </div>
    <div class="audio-player-mini">
      <audio controls></audio>
    </div>
  </div>
  
  <!-- Transcript content -->
  <div class="message-content">
    What is the weather forecast for this weekend in Seattle?
  </div>
  
  <!-- Actions (optional, shown on hover) -->
  <div class="message-actions">
    <button class="message-action-btn small" data-action="copy" title="Copy">
      📋 Copy
    </button>
    <button class="message-action-btn small" data-action="edit" title="Edit">
      ✏️ Edit
    </button>
  </div>
</div>
```

**CSS**:
```css
.message-bubble {
  background: var(--bg-tertiary);
  border-radius: 4px;
  padding: 0.75rem;
  position: relative;
  transition: all 0.2s ease;
}

.message-bubble:hover {
  background: rgba(15, 52, 96, 0.8);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.message-user {
  border-left: 3px solid var(--accent);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.message-sender {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.message-icon {
  font-size: 1rem;
}

.message-sender-label {
  font-weight: 600;
  color: var(--text-primary);
}

.message-timestamp {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.message-delete-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
  padding: 0.2rem 0.5rem;
  font-size: 1rem;
  line-height: 1;
}

.message-bubble:hover .message-delete-btn {
  opacity: 1;
}

.message-audio {
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 3px;
}

.audio-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.audio-filename {
  font-family: 'SF Mono', monospace;
  color: var(--text-primary);
}

.audio-duration {
  color: var(--text-muted);
}

.audio-player-mini audio {
  width: 100%;
  height: 32px;
}

.message-content {
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message-actions {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-light);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-bubble:hover .message-actions {
  opacity: 1;
}

.message-action-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.7rem;
}
```

**Animation** (on add):
```css
@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-bubble {
  animation: messageSlideIn 0.2s ease-out;
}
```

---

### 6. MessageBubble (Assistant)

**Purpose**: Display LLM response  
**Differences from User**: Different border color, icon, and may show loading state

```html
<div class="message-bubble message-assistant" data-message-id="{uuid}">
  <div class="message-header">
    <div class="message-sender">
      <span class="message-icon">🤖</span>
      <span class="message-sender-label">Assistant</span>
      <span class="message-timestamp">just now</span>
    </div>
  </div>
  
  <!-- Loading state (conditional) -->
  <div class="message-loading" style="display: none;">
    <span class="spinner"></span>
    <span>Generating response...</span>
  </div>
  
  <!-- Response content -->
  <div class="message-content">
    I don't have access to real-time weather data. However, I can help you 
    find the forecast. You can check weather.gov or your favorite weather 
    app for the latest Seattle weekend forecast.
  </div>
  
  <!-- Actions -->
  <div class="message-actions">
    <button class="message-action-btn small" data-action="copy" title="Copy">
      📋 Copy
    </button>
    <button class="message-action-btn small" data-action="tts" title="Read aloud">
      🔊 Read
    </button>
  </div>
</div>
```

**CSS**:
```css
.message-assistant {
  border-left: 3px solid var(--accent-secondary);
}

.message-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: 0.8rem;
  padding: 0.5rem 0;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--text-muted);
  border-top-color: var(--accent-secondary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Markdown rendering in assistant messages */
.message-assistant .message-content code {
  background: var(--bg-secondary);
  padding: 0.15rem 0.35rem;
  border-radius: 2px;
  font-family: 'SF Mono', monospace;
  font-size: 0.8rem;
}

.message-assistant .message-content pre {
  background: var(--bg-secondary);
  padding: 0.75rem;
  border-radius: 3px;
  overflow-x: auto;
  margin: 0.75rem 0;
}

.message-assistant .message-content pre code {
  background: transparent;
  padding: 0;
}
```

---

### 7. NewMessagePanel

**Purpose**: Input area for creating new messages  
**Modes**: Audio mode (recording) or Text mode (typing)

```html
<div class="panel chat-input-panel">
  <div class="panel-header">New Message</div>
  
  <!-- Status bar -->
  <div class="status-bar">
    <div class="status">
      <span class="status-dot" id="chatStatusDot"></span>
      <span id="chatStatusText">Idle</span>
    </div>
    <div class="timer" id="chatTimer">00:00</div>
  </div>
  
  <!-- Mode toggle -->
  <div class="chat-input-mode-toggle">
    <button class="mode-toggle-btn active" data-mode="audio" id="chatModeAudio">
      🎤 Audio
    </button>
    <button class="mode-toggle-btn" data-mode="text" id="chatModeText">
      ⌨ Text
    </button>
  </div>
  
  <!-- Audio mode content -->
  <div class="chat-audio-mode" id="chatAudioMode">
    <!-- Waveform (during recording) -->
    <div class="waveform-container" style="display: none;">
      <canvas id="chatWaveform"></canvas>
    </div>
    
    <!-- Audio preview (after recording) -->
    <div class="chat-audio-preview" id="chatAudioPreview" style="display: none;">
      <div class="audio-info">
        <span class="audio-icon">🔊</span>
        <span class="audio-filename" id="chatAudioFilename">-</span>
        <span class="audio-duration" id="chatAudioDuration">-</span>
      </div>
      <audio id="chatAudioPlayer" controls></audio>
      
      <!-- Transcript -->
      <div class="chat-transcript-box">
        <textarea id="chatTranscript" class="transcript-area" 
                  placeholder="Transcript will appear here..."></textarea>
      </div>
    </div>
  </div>
  
  <!-- Text mode content -->
  <div class="chat-text-mode" id="chatTextMode" style="display: none;">
    <textarea id="chatTextInput" class="text-input" 
              placeholder="Type your message here..."></textarea>
    <div class="char-count">
      <span id="chatCharCount">0</span> / 10000 characters
    </div>
  </div>
  
  <!-- Action buttons -->
  <div class="controls chat-input-controls">
    <!-- Audio mode buttons -->
    <div class="audio-controls" id="chatAudioControls">
      <button id="chatRecordBtn" class="primary">🎤 Record</button>
      <button id="chatTranscribeBtn" disabled>Transcribe</button>
      <button id="chatRerecordBtn" disabled>Re-record</button>
    </div>
    
    <!-- Common buttons -->
    <button id="chatSendBtn" class="primary" disabled>🚀 Send to LLM</button>
    <button id="chatClearInputBtn">Clear</button>
  </div>
</div>
```

**CSS**:
```css
.chat-input-mode-toggle {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  overflow: hidden;
  width: fit-content;
}

.mode-toggle-btn {
  padding: 0.4rem 1rem;
  font-size: 0.8rem;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: none;
  border-right: 1px solid var(--border-light);
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-toggle-btn:last-child {
  border-right: none;
}

.mode-toggle-btn:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.mode-toggle-btn.active {
  background: var(--accent-dim);
  color: #fff;
  box-shadow: inset 0 0 8px var(--accent-glow);
}

.chat-audio-mode,
.chat-text-mode {
  margin-bottom: 1rem;
}

.chat-audio-preview {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 0.75rem;
}

.chat-audio-preview .audio-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
}

.chat-audio-preview audio {
  width: 100%;
  margin-bottom: 0.75rem;
}

.chat-transcript-box {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-light);
}

.chat-transcript-box .transcript-area {
  min-height: 80px;
}

.chat-input-controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.audio-controls {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}

@media (max-width: 600px) {
  .chat-input-controls {
    flex-direction: column;
  }
  
  .chat-input-controls button {
    width: 100%;
  }
  
  .audio-controls {
    flex-direction: column;
  }
}
```

---

### 8. Settings Panel Integration

**Purpose**: Add LLM configuration to existing settings  
**Location**: Extends existing settings panel in `asr.js`

```html
<!-- Add to settings panel -->
<div class="settings-section">
  <div class="settings-section-title">Chat / LLM Provider</div>
  
  <div class="settings-row">
    <label for="settingChatLlmEndpoint">LLM API Endpoint</label>
    <input type="url" id="settingChatLlmEndpoint" 
           placeholder="https://api.example.com/v1/chat">
    <div class="settings-hint">
      URL to your LLM provider API (OpenWebUI, Ollama, OpenAI, etc.)
    </div>
    <div class="settings-field-error" id="errorChatLlmEndpoint"></div>
  </div>
  
  <div class="settings-row">
    <label for="settingChatLlmModel">Model Name</label>
    <input type="text" id="settingChatLlmModel" 
           placeholder="gpt-3.5-turbo">
    <div class="settings-hint">
      Model identifier (e.g., gpt-3.5-turbo, llama2, mistral)
    </div>
  </div>
  
  <div class="settings-row">
    <label for="settingChatLlmApiKey">API Key (optional)</label>
    <input type="password" id="settingChatLlmApiKey" 
           placeholder="sk-...">
    <div class="settings-hint">
      Leave empty if no authentication required
    </div>
  </div>
  
  <div class="settings-row">
    <label for="settingChatTemperature">Temperature</label>
    <div class="slider-container">
      <span style="font-size: 0.8rem; color: var(--text-secondary);">0.0</span>
      <input type="range" id="settingChatTemperature" 
             min="0" max="2" step="0.1" value="0.7">
      <span style="font-size: 0.8rem; color: var(--text-secondary);">2.0</span>
      <span class="slider-value" id="chatTemperatureValue">0.7</span>
    </div>
    <div class="settings-hint">
      Lower = more focused, Higher = more creative
    </div>
  </div>
  
  <div class="settings-row">
    <label for="settingChatMaxTokens">Max Response Tokens</label>
    <input type="number" id="settingChatMaxTokens" 
           min="100" max="4000" value="1000">
    <div class="settings-hint">
      Maximum length of LLM responses (100-4000)
    </div>
  </div>
  
  <div class="settings-row">
    <label for="settingChatSystemPrompt">System Prompt</label>
    <textarea id="settingChatSystemPrompt" 
              style="min-height: 80px; width: 100%;">You are a helpful assistant.</textarea>
    <div class="settings-hint">
      Instructions for the LLM's behavior
    </div>
  </div>
  
  <div class="settings-row">
    <label class="settings-toggle-label">
      <input type="checkbox" id="settingChatAutoSend">
      Auto-send after transcription
    </label>
  </div>
  
  <div class="settings-row">
    <label class="settings-toggle-label">
      <input type="checkbox" id="settingChatConfirmClear" checked>
      Confirm before clearing chat
    </label>
  </div>
  
  <div class="settings-row">
    <label class="settings-toggle-label">
      <input type="checkbox" id="settingChatMarkdown" checked>
      Render markdown in responses
    </label>
  </div>
  
  <div class="settings-actions">
    <button id="chatTestConnectionBtn" class="small">Test Connection</button>
  </div>
</div>
```

---

### 9. Mobile FAB (Floating Action Button)

**Purpose**: Quick actions on mobile devices  
**Behavior**: Replaces desktop buttons with floating buttons when on Chat tab

```html
<!-- Extends existing #mobileToolbar -->
<div id="mobileToolbar" class="mobile-fab-cluster">
  <!-- Chat-specific FAB buttons (shown when Chat tab active) -->
  <button id="mobileChatRecordBtn" class="fab-btn fab-primary" 
          title="Record" data-mode="chat" style="display: none;">
    <svg class="fab-icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="6"/>
    </svg>
  </button>
  
  <button id="mobileChatSendBtn" class="fab-btn" 
          disabled title="Send" data-mode="chat" style="display: none;">
    <svg class="fab-icon" viewBox="0 0 24 24">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
    </svg>
  </button>
  
  <button id="mobileChatExportBtn" class="fab-btn" 
          title="Export" data-mode="chat" style="display: none;">
    <svg class="fab-icon" viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  </button>
  
  <!-- Status indicator -->
  <div class="fab-status" id="mobileChatStatus" style="display: none;">
    <span class="fab-status-dot" id="mobileChatStatusDot"></span>
    <span id="mobileChatStatusText">Idle</span>
  </div>
</div>
```

**JavaScript** (update FAB on tab switch):
```javascript
function updateFabMode(tabName) {
  // Hide all mode-specific buttons
  document.querySelectorAll('#mobileToolbar [data-mode]').forEach(btn => {
    btn.style.display = 'none';
  });
  
  // Show buttons for active tab
  if (tabName === 'chat') {
    document.querySelectorAll('#mobileToolbar [data-mode="chat"]').forEach(btn => {
      btn.style.display = 'flex';
    });
  }
  // ... other tabs
}
```

---

## Component Communication

### Event System

Use custom events for component communication:

```javascript
// Event names
const CHAT_EVENTS = {
  MESSAGE_ADDED: 'chat:message-added',
  MESSAGE_DELETED: 'chat:message-deleted',
  MESSAGE_UPDATED: 'chat:message-updated',
  RECORDING_START: 'chat:recording-start',
  RECORDING_STOP: 'chat:recording-stop',
  TRANSCRIPTION_START: 'chat:transcription-start',
  TRANSCRIPTION_COMPLETE: 'chat:transcription-complete',
  SEND_START: 'chat:send-start',
  SEND_COMPLETE: 'chat:send-complete',
  SEND_ERROR: 'chat:send-error',
  CLEAR_CHAT: 'chat:clear',
  EXPORT_START: 'chat:export-start'
};

// Dispatch event
function dispatchChatEvent(eventName, detail = {}) {
  const event = new CustomEvent(eventName, { detail });
  document.dispatchEvent(event);
}

// Listen to event
document.addEventListener(CHAT_EVENTS.MESSAGE_ADDED, (e) => {
  console.log('Message added:', e.detail);
  updateMessageCount();
  scrollToBottom();
});
```

---

## State Management

### Chat State Object

```javascript
const chatState = {
  // Messages
  messages: [],  // Array of message objects
  currentDraft: null,  // Current message being composed
  
  // Recording state
  isRecording: false,
  recordingStartTime: null,
  audioBlob: null,
  audioUrl: null,
  
  // Transcription state
  isTranscribing: false,
  transcript: '',
  
  // LLM state
  isSending: false,
  lastRequestId: null,
  
  // UI state
  inputMode: 'audio',  // 'audio' or 'text'
  
  // Settings (loaded from localStorage)
  settings: {
    llmEndpoint: '',
    llmModel: 'gpt-3.5-turbo',
    llmApiKey: '',
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt: 'You are a helpful assistant.',
    autoSend: false,
    confirmClear: true,
    markdownEnabled: true
  }
};
```

### Message Object Schema

```javascript
{
  id: 'msg_uuid_here',
  type: 'user' | 'assistant',
  timestamp: 1234567890,  // Unix timestamp
  
  // User message fields
  audioBlob: Blob | null,
  audioUrl: 'blob:...' | null,
  audioFilename: 'clip-001.webm',
  audioDuration: 8.5,  // seconds
  
  // Content
  content: 'Message text here',
  
  // Assistant message fields
  model: 'gpt-3.5-turbo',
  usage: { prompt_tokens: 20, completion_tokens: 50, total_tokens: 70 },
  
  // Status
  status: 'draft' | 'sent' | 'streaming' | 'complete' | 'error',
  error: null | 'Error message'
}
```

---

## Testing Checklist

### Visual Regression Tests
- [ ] Empty state renders correctly
- [ ] User message bubble displays with audio player
- [ ] Assistant message bubble displays with loading state
- [ ] Message actions appear on hover
- [ ] Mobile FAB cluster shows correct buttons for Chat tab
- [ ] Settings panel includes Chat section
- [ ] Waveform visualizer animates during recording
- [ ] Toast notifications appear and dismiss correctly

### Interaction Tests
- [ ] Click Record button starts recording
- [ ] Click Stop button ends recording and shows audio preview
- [ ] Click Transcribe button transcribes audio
- [ ] Click Send button sends message to LLM
- [ ] Click Delete button removes message (with confirmation)
- [ ] Click Export button opens export panel with chat transcript
- [ ] Click Clear Chat button clears all messages (with confirmation)
- [ ] Mode toggle switches between audio and text input
- [ ] Settings save and persist to localStorage
- [ ] Test Connection button validates LLM endpoint

### Responsive Tests
- [ ] Layout works on desktop (>900px)
- [ ] Layout works on tablet (600-900px)
- [ ] Layout works on mobile (<600px)
- [ ] FAB cluster appears on mobile only
- [ ] Message bubbles stack properly on narrow screens
- [ ] Touch targets meet minimum size (44x44px)

### Accessibility Tests
- [ ] All buttons have proper labels
- [ ] Keyboard navigation works (Tab, Enter, Space, Escape)
- [ ] Screen reader announces status changes
- [ ] Focus indicators visible on all interactive elements
- [ ] Color contrast meets WCAG AA standards
- [ ] Skip links work for screen reader users

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-14  
**Status**: Ready for Implementation
