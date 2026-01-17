# Chat Settings Integration TODO

## Status
The chat module is fully functional with settings storage implemented in `chat.js`. However, the Settings Panel UI in `asr.js` needs to be extended to expose these settings to users.

## What Works Now
- Settings are stored in localStorage under `settings.chat.*` keys
- Settings are loaded on chat module initialization
- Default values are used if no settings exist
- The `updateSettings()` function can be called programmatically

## What Needs to be Added
The Settings panel in `asr.js` (around line 1500+) needs a new section:

```html
<div class="settings-section">
  <div class="settings-section-title">Chat / LLM Provider</div>
  
  <div class="settings-row">
    <label for="settingChatLlmEndpoint">LLM API Endpoint</label>
    <input type="url" id="settingChatLlmEndpoint" placeholder="/llm">
    <div class="settings-hint">URL to LLM proxy service (default: /llm)</div>
  </div>
  
  <div class="settings-row">
    <label for="settingChatLlmModel">Model Name</label>
    <input type="text" id="settingChatLlmModel" placeholder="llama3.2">
    <div class="settings-hint">Ollama model to use</div>
  </div>
  
  <div class="settings-row">
    <label for="settingChatTemperature">Temperature</label>
    <input type="range" id="settingChatTemperature" min="0" max="2" step="0.1" value="0.7">
    <span class="slider-value" id="chatTemperatureValue">0.7</span>
  </div>
  
  <div class="settings-row">
    <label for="settingChatMaxTokens">Max Response Tokens</label>
    <input type="number" id="settingChatMaxTokens" min="100" max="4000" value="1000">
  </div>
  
  <div class="settings-row">
    <label for="settingChatSystemPrompt">System Prompt</label>
    <textarea id="settingChatSystemPrompt">You are a helpful assistant.</textarea>
  </div>
  
  <div class="settings-row">
    <label for="settingChatMaxContextMessages">Max Context Messages</label>
    <input type="number" id="settingChatMaxContextMessages" min="1" max="50" value="10">
    <div class="settings-hint">Number of previous messages to include in LLM context</div>
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
</div>
```

## JavaScript Additions Needed

In `asr.js`, within the `loadSettingsFromStorage()` function:
```javascript
// Chat settings
document.getElementById('settingChatLlmEndpoint').value = 
  util.storage.get('settings.chat.llmEndpoint', '/llm');
document.getElementById('settingChatLlmModel').value = 
  util.storage.get('settings.chat.llmModel', 'llama3.2');
// ... etc for all fields
```

In `asr.js`, within the `saveSettings()` function:
```javascript
// Chat settings
const chatSettings = {
  llmEndpoint: document.getElementById('settingChatLlmEndpoint').value,
  llmModel: document.getElementById('settingChatLlmModel').value,
  temperature: parseFloat(document.getElementById('settingChatTemperature').value),
  maxTokens: parseInt(document.getElementById('settingChatMaxTokens').value),
  systemPrompt: document.getElementById('settingChatSystemPrompt').value,
  maxContextMessages: parseInt(document.getElementById('settingChatMaxContextMessages').value),
  autoSend: document.getElementById('settingChatAutoSend').checked,
  confirmClear: document.getElementById('settingChatConfirmClear').checked,
  markdownEnabled: document.getElementById('settingChatMarkdown').checked
};

// Update chat module settings
if (window.chat && window.chat.updateSettings) {
  window.chat.updateSettings(chatSettings);
}
```

## Workaround for Now
Users can modify settings via browser console:
```javascript
// Set custom model
localStorage.setItem('yap-settings.chat.llmModel', JSON.stringify('gemma3'));

// Increase context window
localStorage.setItem('yap-settings.chat.maxContextMessages', JSON.stringify(20));

// Change temperature
localStorage.setItem('yap-settings.chat.temperature', JSON.stringify(0.9));

// Reload page for changes to take effect
location.reload();
```

## Priority
**Low** - The feature works without the UI panel. Users who need different settings can:
1. Use browser console workaround above
2. Modify default values in `chat.js`
3. Wait for Settings UI to be added in future PR

## Estimated Effort
**1-2 hours** - Straightforward addition following existing settings panel patterns.
