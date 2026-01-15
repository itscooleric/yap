# Chat UI/UX Design for Yap

## Overview

This document defines the look, behavior, and user experience of the new Chat tab in Yap. The Chat feature enables users to have voice-based conversations with LLMs by recording audio, transcribing it, sending it to an LLM, and displaying responses in a message-based interface.

## Design Goals

1. **Seamless Integration**: Reuse existing ASR recording components and maintain consistency with Yap's design language
2. **Clarity**: Clear visual distinction between user messages (audio/transcript) and LLM responses
3. **Efficiency**: Minimize clicks needed for common workflows (record → transcribe → send)
4. **Dark Terminal Theme**: Match Yap's existing aesthetic with high contrast text and minimal clutter
5. **Responsive**: Work equally well on mobile and desktop devices

## Core Workflows

### Workflow 1: Voice Message to LLM
1. User clicks "Record" button
2. User speaks their message
3. User clicks "Stop" to end recording
4. Audio is automatically transcribed (or manual trigger if auto-transcribe is off)
5. User reviews transcript and clicks "Send to LLM"
6. LLM response appears as a new message bubble
7. User can continue conversation or export

### Workflow 2: Text Message to LLM
1. User types message in text input box
2. User clicks "Send to LLM"
3. LLM response appears as a new message bubble

### Workflow 3: Export Conversation
1. User clicks "Export" button
2. Export panel opens (reusing existing export UI)
3. User selects destination (GitLab/GitHub/SFTP/Webhook)
4. Conversation is exported as formatted markdown

## Wireframes

### 1. Initial Empty State

```
┌─────────────────────────────────────────────────────────┐
│ > yap                                                 ⚙  │
│   local speech tools                                     │
│                                                           │
│  [ASR] [TTS] [CHAT] [Data] [Apps]                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  # Chat                                                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                   │    │
│  │                                                   │    │
│  │         No messages yet                          │    │
│  │                                                   │    │
│  │     Record audio or type a message to start     │    │
│  │          a conversation with the LLM             │    │
│  │                                                   │    │
│  │                                                   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  # New Message                                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │ ● Idle                              00:00         │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  [🎤 Record]  [⌨ Type Message]                          │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Type your message here...                        │    │
│  │                                                   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  [Send to LLM] [Export]                                  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 2. Recording Audio Message

```
┌─────────────────────────────────────────────────────────┐
│ > yap      🔴 Recording 00:05                        ⚙  │
│   local speech tools                                     │
│                                                           │
│  [ASR] [TTS] [CHAT] [Data] [Apps]                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  # Chat                                                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Messages (0)                                      │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  # New Message                                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🔴 Recording                            00:05     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ ▂▅█▅▂▃▆▅▃▂▅█▅▂▃▆▅▃▂▅█▅▂▃▆▅▃▂▅█▅▂▃▆▅▃ (waveform) │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  [⏹ Stop Recording]                                      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 3. Message with Transcript (Before Sending)

```
┌─────────────────────────────────────────────────────────┐
│ > yap                                                 ⚙  │
│   local speech tools                                     │
│                                                           │
│  [ASR] [TTS] [CHAT] [Data] [Apps]                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  # Chat                                                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Messages (2)                                      │    │
│  ├─────────────────────────────────────────────────┤    │
│  │ 🎤 You · 2m ago                            [×]   │    │
│  │ ┌─────────────────────────────────────────────┐ │    │
│  │ │ 🔊 clip-001.webm (0:08)                     │ │    │
│  │ │ ────────────────────────────────────         │ │    │
│  │ │                                              │ │    │
│  │ │ "What is the weather forecast for this      │ │    │
│  │ │  weekend in Seattle?"                       │ │    │
│  │ └─────────────────────────────────────────────┘ │    │
│  │                                                   │    │
│  │ 🤖 Assistant · 2m ago                          │    │
│  │ ┌─────────────────────────────────────────────┐ │    │
│  │ │ I don't have access to real-time weather    │ │    │
│  │ │ data. However, I can help you find the      │ │    │
│  │ │ forecast. You can check weather.gov or      │ │    │
│  │ │ your favorite weather app for the latest    │ │    │
│  │ │ Seattle weekend forecast.                   │ │    │
│  │ └─────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  # New Message                                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │ ● Ready                                 00:00     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🔊 clip-002.webm (0:03)                          │    │
│  │ ────────────────────────────────────              │    │
│  │                                                   │    │
│  │ "Tell me a joke about programming"               │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  [🎤 Re-record] [✏️ Edit] [🚀 Send to LLM]              │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 4. Waiting for LLM Response

```
┌─────────────────────────────────────────────────────────┐
│ > yap                                                 ⚙  │
│   local speech tools                                     │
│                                                           │
│  [ASR] [TTS] [CHAT] [Data] [Apps]                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  # Chat                                                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Messages (3)                                      │    │
│  ├─────────────────────────────────────────────────┤    │
│  │ ... (previous messages scrolled up) ...          │    │
│  │                                                   │    │
│  │ 🎤 You · just now                          [×]   │    │
│  │ ┌─────────────────────────────────────────────┐ │    │
│  │ │ 🔊 clip-002.webm (0:03)                     │ │    │
│  │ │ ────────────────────────────────────         │ │    │
│  │ │                                              │ │    │
│  │ │ "Tell me a joke about programming"          │ │    │
│  │ └─────────────────────────────────────────────┘ │    │
│  │                                                   │    │
│  │ 🤖 Assistant · thinking...                       │    │
│  │ ┌─────────────────────────────────────────────┐ │    │
│  │ │ ⟳ Generating response...                    │ │    │
│  │ └─────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 5. Mobile View (Responsive)

```
┌───────────────────────┐
│ > yap              ⚙  │
│   local speech tools   │
│                        │
│ [ASR][TTS][CHAT][Data]│
├────────────────────────┤
│                        │
│ # Chat                 │
│ ┌────────────────────┐ │
│ │ Messages (2)       │ │
│ ├────────────────────┤ │
│ │ 🎤 You · 2m    [×] │ │
│ │ ┌────────────────┐ │ │
│ │ │ 🔊 clip-001    │ │ │
│ │ │ "What is the   │ │ │
│ │ │ weather..."    │ │ │
│ │ └────────────────┘ │ │
│ │                    │ │
│ │ 🤖 Assistant       │ │
│ │ ┌────────────────┐ │ │
│ │ │ I don't have   │ │ │
│ │ │ access to...   │ │ │
│ │ └────────────────┘ │ │
│ └────────────────────┘ │
│                        │
│ # New Message          │
│ ┌────────────────────┐ │
│ │ ● Ready     00:00  │ │
│ └────────────────────┘ │
│                        │
│ [🎤 Record]            │
│                        │
│ ┌────────────────────┐ │
│ │ Type message...    │ │
│ └────────────────────┘ │
│                        │
│ [Send] [Export]        │
│                        │
└────────────────────────┘
```

## UI Components Specification

### 1. Chat Header
- **Location**: Top of chat tab content
- **Elements**:
  - Panel header: "# Chat" with message count badge
  - Quick actions: Clear chat button (with confirmation), Export button
- **Styling**: 
  - Uses existing `.panel-header` class
  - Badge shows message count in `var(--accent)` color

### 2. Message List Container
- **Container**: Scrollable area with all messages
- **Height**: Flexible, takes available space (~60% of viewport)
- **Scroll behavior**: Auto-scroll to bottom on new message
- **Empty state**: Centered text with instructions
- **Styling**:
  ```css
  .chat-messages {
    background: var(--bg-secondary);
    border: 1px solid var(--border-light);
    border-radius: 4px;
    padding: 1rem;
    min-height: 300px;
    max-height: 500px;
    overflow-y: auto;
  }
  ```

### 3. Message Bubble (User)
- **Structure**:
  - Header: Icon (🎤), label "You", timestamp, delete button [×]
  - Audio player (if from recording): Shows filename, duration, playback controls
  - Transcript text: Multi-line text in monospace font
  - Actions: Edit transcript, Re-record, Copy
- **Color scheme**:
  - Background: `var(--bg-tertiary)`
  - Border-left: `3px solid var(--accent)` (pink accent)
  - Text: `var(--text-primary)`
- **Styling**:
  ```css
  .message-bubble.user {
    background: var(--bg-tertiary);
    border-left: 3px solid var(--accent);
    border-radius: 4px;
    padding: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .message-bubble-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .message-bubble-content {
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--text-primary);
    white-space: pre-wrap;
  }
  ```

### 4. Message Bubble (Assistant/LLM)
- **Structure**:
  - Header: Icon (🤖), label "Assistant", timestamp
  - Response text: Multi-line text with markdown rendering support
  - Actions: Copy response, Read aloud (TTS integration), Insert into reply
- **Color scheme**:
  - Background: `var(--bg-tertiary)`
  - Border-left: `3px solid var(--accent-secondary)` (cyan accent)
  - Text: `var(--text-primary)`
- **Loading state**: Shows spinner with "Generating response..." text
- **Styling**:
  ```css
  .message-bubble.assistant {
    background: var(--bg-tertiary);
    border-left: 3px solid var(--accent-secondary);
    border-radius: 4px;
    padding: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .message-bubble.assistant .loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
  }
  ```

### 5. New Message Panel
- **Status bar**:
  - Status indicator dot (colored based on state: idle, recording, transcribing)
  - Status text: "Idle" / "Recording" / "Transcribing" / "Ready"
  - Timer: Shows recording duration (MM:SS format)
- **Waveform visualizer** (during recording):
  - Reuses existing ASR waveform component
  - Canvas with animated bars showing audio levels
- **Audio preview** (after recording):
  - Shows clip filename and duration
  - Mini audio player with play/pause
  - Transcript text area (editable)
- **Text input** (alternative to recording):
  - Multi-line textarea with placeholder "Type your message here..."
  - Character count indicator
- **Action buttons**:
  - Record/Stop recording button (primary, toggles state)
  - Type message toggle (switches between audio and text mode)
  - Send to LLM button (primary action, disabled until message ready)
  - Clear/Reset button
- **Styling**: Uses existing `.panel` and `.status-bar` classes

### 6. Action Buttons
- **Primary**: "Send to LLM", "Record" (uses `.primary` class)
- **Secondary**: "Export", "Clear Chat", "Type Message"
- **Tertiary**: "Edit", "Copy", "Delete", "Re-record"
- **Icon buttons**: Delete [×], Settings [⚙]
- **States**: Normal, hover, active, disabled
- **Styling**: Follows existing button classes in styles.css

### 7. Settings Integration
Add new section in Settings panel:
- **Section header**: "Chat / LLM Provider"
- **Fields**:
  - LLM API Endpoint URL (text input with validation)
  - Model Name (text input)
  - API Key/Token (password input, optional)
  - Temperature (slider, 0.0 - 2.0)
  - Max tokens (number input)
  - System prompt (textarea)
  - Enable/disable chat feature toggle
- **Validation**: 
  - URL format check for endpoint
  - Show error messages inline below fields
  - Test connection button to verify settings

### 8. Export Integration
- **Button location**: Below message list, next to other actions
- **Behavior**: 
  - Opens existing export panel (reuse `openExportPanel()` function)
  - Pre-fills textarea with formatted conversation transcript
  - Format: Markdown with message headers, timestamps, and content
  - Example format:
    ```markdown
    # Chat Transcript - 2024-01-14 14:30
    
    ## You (14:30:05)
    Audio: clip-001.webm (0:08)
    
    What is the weather forecast for this weekend in Seattle?
    
    ## Assistant (14:30:12)
    I don't have access to real-time weather data...
    ```

## Interaction Flows

### Flow 1: Audio Recording → Transcription → Send

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Click   │      │  Audio   │      │  Stop &  │      │  Review  │      │   Send   │
│  Record  │ ───> │Recording │ ───> │Transcribe│ ───> │Transcript│ ───> │  to LLM  │
└──────────┘      └──────────┘      └──────────┘      └──────────┘      └──────────┘
                        │                  │                  │                  │
                        ▼                  ▼                  ▼                  ▼
                   Show timer         Show working      Show editable       Show loading
                   & waveform          indicator        transcript box      spinner
                                                                            
                                                                                 │
                                                                                 ▼
                                                                          ┌──────────┐
                                                                          │ Display  │
                                                                          │ Response │
                                                                          └──────────┘
```

### Flow 2: Text Input → Send

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│   Type   │      │  Click   │      │ Display  │
│ Message  │ ───> │   Send   │ ───> │ Response │
└──────────┘      └──────────┘      └──────────┘
```

### Flow 3: Export Conversation

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Click   │      │  Select  │      │Configure │      │  Confirm │
│  Export  │ ───> │Destination ───> │ Options  │ ───> │ & Export │
└──────────┘      └──────────┘      └──────────┘      └──────────┘
                        │
                        ├─> GitLab
                        ├─> GitHub
                        ├─> SFTP
                        └─> Webhook
```

## State Management

### Application States

1. **Idle**: No recording, no pending messages
   - Record button: enabled, shows "Record"
   - Send button: disabled
   - Status: "Idle"

2. **Recording**: Audio being captured
   - Record button: enabled, shows "Stop Recording"
   - Send button: disabled
   - Status: "Recording" with timer
   - Shows waveform visualization

3. **Transcribing**: Processing audio to text
   - Record button: disabled
   - Send button: disabled
   - Status: "Transcribing..."
   - Shows spinner

4. **Ready**: Transcript available but not sent
   - Record button: enabled, shows "Re-record"
   - Send button: enabled
   - Edit button: enabled
   - Status: "Ready"

5. **Sending**: Request to LLM in progress
   - All buttons: disabled
   - Shows loading indicator in assistant message bubble
   - Status: "Sending..."

6. **Error**: Something went wrong
   - Shows error message in toast notification
   - Resets to Idle or Ready state depending on context
   - Status: "Error"

### Message States

- **Draft**: User message being composed (not yet sent)
- **Sent**: User message sent to LLM
- **Streaming**: Assistant response being received (for streaming LLMs)
- **Complete**: Assistant response fully received
- **Error**: Message failed to send or receive

## Responsive Design

### Desktop (>900px width)
- Two-column layout possible (messages left, settings/controls right)
- Larger message bubbles with more padding
- Full-size buttons with text labels
- Waveform: full width
- Message list: max-height 500px

### Tablet (600px - 900px width)
- Single-column layout
- Message bubbles stack vertically
- Slightly smaller padding
- Buttons may wrap to multiple rows
- Message list: max-height 400px

### Mobile (<600px width)
- Single-column, full-width layout
- Compact message bubbles
- Icon-only buttons in some cases
- Floating Action Button (FAB) cluster for record/send
- Message list: max-height 300px
- Text size adjusted for readability
- Larger touch targets (min 44x44px)

### Mobile Toolbar Integration
Reuse existing mobile FAB cluster from ASR tab:
- Replace ASR-specific buttons with Chat buttons when on Chat tab
- Primary FAB: Record button (large, pink)
- Secondary FABs: Send, Export, Clear
- Status indicator: Shows "Idle", "Recording", "Sending" states

## Accessibility

### Keyboard Navigation
- **Tab**: Navigate between interactive elements
- **Ctrl+Enter**: Send message (from text input)
- **Space**: Start/stop recording (when record button focused)
- **Escape**: Cancel current operation
- **Ctrl+C**: Copy selected message (when message focused)
- **Delete**: Delete selected message (with confirmation)

### Screen Reader Support
- ARIA labels on all buttons and inputs
- ARIA live regions for status updates
- Semantic HTML structure (header, main, section, article)
- Alt text for icons
- Focus management (return focus after modal close)

### Visual Accessibility
- High contrast colors (WCAG AA compliant)
- Focus indicators on all interactive elements
- Text size adjustable without breaking layout
- Color not used as only indicator (icons + text labels)
- Status indicators use both color and icon

## Animation & Transitions

### Subtle Animations
- Message bubbles: Fade in and slide up when added (0.2s ease-out)
- Status dot: Pulse animation when recording or sending
- Buttons: Scale slightly on hover (1.05x), smooth transition (0.15s)
- Scroll: Smooth scroll when new message added
- Loading spinner: Rotating animation (0.8s linear infinite)

### No Animations
- Page transitions (tabs switch instantly)
- Text rendering (instant)
- Layout changes (instant, no reflow animation)

## Error Handling

### User-Facing Errors

1. **Recording Errors**
   - Message: "Microphone access denied. Please allow microphone access in your browser settings."
   - Action: Show toast notification, reset to idle state

2. **Transcription Errors**
   - Message: "Transcription failed. Please try recording again."
   - Action: Show toast notification, keep audio clip for retry

3. **LLM Request Errors**
   - Message: "Failed to send message. Check your LLM settings and try again."
   - Action: Show toast notification, keep message in draft state
   - Details: Show error details in console for debugging

4. **Network Errors**
   - Message: "Network error. Please check your connection."
   - Action: Show toast notification, allow retry

5. **Validation Errors**
   - Message: "Please record or type a message before sending."
   - Action: Show inline error below input

### Error States in UI
- Toast notifications for critical errors (red border, error icon)
- Inline validation messages below inputs (red text)
- Error boundary for fatal errors (prevent app crash)
- Retry buttons where applicable

## Settings & Configuration

### User Settings (localStorage)
- `settings.chat.llmEndpoint`: API endpoint URL
- `settings.chat.llmModel`: Model name
- `settings.chat.llmApiKey`: API key (encrypted)
- `settings.chat.temperature`: Temperature value (0.0-2.0)
- `settings.chat.maxTokens`: Max response tokens
- `settings.chat.systemPrompt`: System/instructions prompt
- `settings.chat.autoSend`: Auto-send after transcription (boolean)
- `settings.chat.confirmClear`: Confirm before clearing chat (boolean)
- `settings.chat.markdownEnabled`: Render markdown in responses (boolean)

### Default Values
```javascript
{
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
```

## Export Format

### Markdown Export Template
```markdown
# Chat Transcript
**Date**: {ISO-8601-timestamp}
**Model**: {model-name}
**Messages**: {message-count}

---

{for each message}

## {user|Assistant} ({HH:MM:SS})

{if user message with audio}
📎 Audio: {filename} ({duration})
{endif}

{message-content}

---

{endfor}

---
*Exported from Yap Chat*
```

## Performance Considerations

### Optimization Strategies
1. **Lazy Load**: Messages list virtualized if >100 messages
2. **Debounce**: Text input events debounced (300ms)
3. **Audio Compression**: Use WebM/Opus format for recordings
4. **Caching**: Cache LLM responses in sessionStorage
5. **Pagination**: Load messages in chunks (latest 50 first)

### Resource Limits
- Max audio recording: 5 minutes
- Max message length: 10,000 characters
- Max conversation history: 500 messages
- Max file size for export: 10MB

## Future Enhancements (Out of Scope for MVP)

- Voice activity detection (auto-stop recording)
- Multi-turn conversation context management
- Conversation branching (fork conversations)
- Message search/filter
- Favorite messages
- Share individual messages
- Speech-to-text language selection
- LLM streaming responses (type writer effect)
- Message reactions/annotations
- Conversation templates
- Import conversations
- Audio message playback speed control

## Visual Design Tokens

### Colors
Based on existing Yap theme:
```css
--bg-primary: #1a1a2e;      /* Main background */
--bg-secondary: #16213e;     /* Panel background */
--bg-tertiary: #0f3460;      /* Input/tertiary background */
--text-primary: #e0e0ff;     /* Main text */
--text-secondary: #b4a7d6;   /* Secondary text */
--text-muted: #7b6fa6;       /* Muted text */
--accent: #ff2975;           /* Primary accent (user messages) */
--accent-secondary: #00fff9; /* Secondary accent (assistant) */
--border: #ff297540;         /* Border color */
--success: #39ff14;          /* Success state */
--error: #ff3860;            /* Error state */
```

### Typography
```css
font-family: 'SF Mono', 'Consolas', 'Monaco', 'Courier New', monospace;
font-size-base: 14px;
line-height: 1.6;

/* Sizes */
.text-xs:   0.7rem   (11px)
.text-sm:   0.75rem  (12px)
.text-base: 0.85rem  (13.6px)
.text-lg:   1rem     (16px)
.text-xl:   1.25rem  (20px)
```

### Spacing
```css
--spacing-xs:  0.25rem (4px)
--spacing-sm:  0.5rem  (8px)
--spacing-md:  0.75rem (12px)
--spacing-lg:  1rem    (16px)
--spacing-xl:  1.5rem  (24px)
```

### Border Radius
```css
--radius-sm: 3px   /* Buttons, inputs */
--radius-md: 4px   /* Panels, cards */
--radius-lg: 8px   /* Modals */
```

## Implementation Notes

### Component Reuse
1. **Recording Component**: Reuse from ASR tab
   - Waveform visualization
   - Timer display
   - Recording controls
   - Audio clip management

2. **Export Panel**: Reuse export.js
   - Destination selection
   - Configuration forms
   - Export logic

3. **Settings Panel**: Extend existing settings
   - Add Chat section
   - Reuse validation patterns
   - Persist to localStorage

4. **Toast Notifications**: Use global toast system
   - Success/error messages
   - Auto-dismiss
   - Queue multiple toasts

### New Components to Build
1. **Message Bubble Component** (chat-message.js)
2. **Message List Component** (chat-messages.js)
3. **Chat State Manager** (chat-state.js)
4. **LLM Proxy Client** (chat-llm.js)
5. **Chat Main Module** (chat.js)

### Backend Requirements
1. **LLM Proxy Service** (Python/FastAPI)
   - Endpoint: POST /api/chat
   - Request body: { message, model, temperature, max_tokens }
   - Response: { response, model, usage }
   - Error handling with status codes
   - Configurable timeout
   - Support multiple providers

2. **Metrics Integration**
   - Track chat message count
   - Track LLM response times
   - Track token usage
   - Add to Data tab

## Acceptance Criteria Checklist

- [x] Wireframes show initial state, recording, sending, and response
- [x] All UI components are specified with structure and styling
- [x] Interaction flows are documented with state transitions
- [x] Design matches dark terminal theme (colors, fonts, spacing)
- [x] Responsive layout specified for mobile, tablet, and desktop
- [x] Accessibility requirements defined (keyboard nav, screen readers)
- [x] Error handling patterns documented
- [x] Settings integration specified
- [x] Export integration specified
- [x] Component reuse identified
- [x] Performance considerations addressed
- [x] Visual design tokens defined

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-14  
**Author**: GitHub Copilot  
**Status**: Ready for Review
