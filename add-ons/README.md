# Yap Add-ons

This directory contains documentation and examples for Yap add-ons.

## What are Add-ons?

Add-ons are modular extensions to Yap that provide additional functionality. They appear as draggable, resizable windows that can be opened from the add-ons menu in the main application.

## Built-in Add-ons

### Ollama Summarize

The Ollama Summarize add-on integrates with [Ollama](https://ollama.ai/) to provide AI-powered text summarization of transcripts from the ASR tab.

**Features:**
- Summarize ASR transcripts using local LLM models
- Configurable Ollama URL and model selection
- Replace transcript with summarized version
- Customizable prompts

**Setup:**

1. Install and run Ollama locally:
   ```bash
   # See https://ollama.ai/ for installation instructions
   ollama pull llama3
   ollama serve
   ```

2. Configure the add-on in Yap:
   - Click the "Add-ons" button in the Yap header
   - Open the Settings (gear icon)
   - Configure Ollama URL (default: `http://localhost:11434`)
   - Set your preferred model (default: `llama3`)

3. Use the add-on:
   - Record and transcribe audio in the ASR tab
   - Click "Add-ons" → "Ollama Summarize"
   - Optionally modify the prompt
   - Click "Summarize"
   - Review the summary and optionally replace the transcript

**Security Note:** By default, the add-on only allows connections to `localhost` URLs. To use a remote Ollama instance, enable "Allow non-localhost URLs" in the settings.

See [`ollama-summarize/README.md`](ollama-summarize/README.md) for more details.

## Creating Custom Add-ons

Add-ons are defined in `/app/ui/js/addons.js` and integrated directly into the application. To create a new add-on:

### 1. Define the Add-on

Add your add-on to the `addons` array in `addons.js`:

```javascript
{
  id: 'my-addon',
  name: 'My Add-on',
  description: 'Description of what it does',
  render: renderMyAddon,
  context: 'asr', // or 'tts', or omit for global
  settingsTitle: 'My Add-on Settings',
  settingsSchema: [
    {
      key: 'myConfig',
      label: 'Configuration Option',
      type: 'string', // or 'url', 'boolean'
      default: 'default value',
      localOnly: true, // for URL types, restrict to localhost
      hint: 'Optional hint text'
    }
  ]
}
```

### 2. Implement the Renderer

Create a renderer function that builds the add-on UI:

```javascript
function renderMyAddon(container, ctx) {
  // ctx provides access to app state:
  // - ctx.getTranscript() - get ASR transcript
  // - ctx.setTranscript(text) - set ASR transcript
  // - ctx.getTtsText() - get TTS input text
  // - ctx.showMessage(text, type) - show notification
  // - ctx.getConfig(key) - get configuration value
  // - ctx.setConfig(key, value) - set configuration value

  container.innerHTML = `
    <div class="addon-content">
      <button id="myButton">Click Me</button>
      <div id="output"></div>
    </div>
  `;

  const button = container.querySelector('#myButton');
  const output = container.querySelector('#output');

  button.addEventListener('click', async () => {
    const transcript = ctx.getTranscript();
    const config = ctx.getConfig('myConfig');
    
    // Do something with the data
    output.textContent = `Transcript length: ${transcript.length}`;
  });
}
```

### 3. Add Styling (Optional)

Add CSS for your add-on in `/app/ui/css/styles.css`:

```css
.my-addon {
  /* Custom styles for your add-on */
}
```

## Add-on Best Practices

1. **Error Handling**: Always handle errors gracefully and show user-friendly messages
2. **Loading States**: Disable buttons and show loading indicators during async operations
3. **Configuration**: Use the settings schema for user-configurable options
4. **Security**: For URL-based add-ons, validate URLs and consider localhost-only by default
5. **Context Awareness**: Only access relevant context (ASR for transcript add-ons, etc.)
6. **User Feedback**: Use `ctx.showMessage()` to provide feedback on operations

## Add-on API Reference

### Context Methods

The `ctx` object passed to your renderer provides these methods:

#### ASR Context
- `getTranscript()` - Returns current transcript text (string)
- `setTranscript(text)` - Sets transcript text
- `getClips()` - Returns array of recorded clips with metadata

#### TTS Context
- `getTtsText()` - Returns current TTS input text
- `getGeneratedAudio()` - Returns generated audio Blob (if available)

#### Configuration
- `getConfig(key)` - Get configuration value (returns stored value or default)
- `setConfig(key, value)` - Save configuration value to localStorage

#### Utilities
- `showMessage(text, type)` - Show toast notification (type: 'success', 'error', or '')
- `validateUrl(url, requireLocalhost)` - Validate URL format and localhost requirement

## Examples

See the `ollama-summarize` directory for a complete example of an add-on that:
- Integrates with an external service (Ollama)
- Has configurable settings
- Validates input
- Shows loading states
- Handles errors gracefully

## Contributing

To contribute a new add-on:

1. Create a directory in `add-ons/` with your add-on name
2. Add a README.md describing your add-on
3. Add the add-on definition to `/app/ui/js/addons.js`
4. Test your add-on thoroughly
5. Submit a pull request

Make sure your add-on:
- Works without breaking existing functionality
- Has clear documentation
- Handles errors gracefully
- Follows the existing code style
- Respects user privacy and security
