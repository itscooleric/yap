# Ollama Summarize Add-on

AI-powered transcript summarization using [Ollama](https://ollama.ai/).

## Overview

The Ollama Summarize add-on allows you to summarize transcripts from the ASR tab using a local Large Language Model (LLM) via Ollama. This keeps your data private and enables offline AI processing.

## Features

- **Local AI Processing**: All summarization happens on your machine
- **Customizable Prompts**: Modify the prompt to get different types of summaries
- **Multiple Models**: Use any Ollama model (llama3, mistral, etc.)
- **Transcript Replacement**: Optionally replace the transcript with the summary
- **Configurable Settings**: Change Ollama URL and model via settings panel

## Prerequisites

1. **Install Ollama**: Download from [ollama.ai](https://ollama.ai/)

2. **Pull a model**: 
   ```bash
   ollama pull llama3
   # Or use another model:
   # ollama pull mistral
   # ollama pull codellama
   ```

3. **Start Ollama server**:
   ```bash
   ollama serve
   ```
   
   By default, Ollama runs on `http://localhost:11434`

## Usage

### 1. Enable the Add-on

The Ollama Summarize add-on is enabled by default. If disabled:

1. Click the "Add-ons" button in the Yap header
2. Find "Ollama Summarize" in the list
3. Toggle it on (green)

### 2. Configure Settings (Optional)

1. Click the Settings (gear) icon in the add-ons panel
2. Under "Ollama" section:
   - **Ollama URL**: Set the URL where Ollama is running (default: `http://localhost:11434`)
   - **Model**: Set the model name (default: `llama3`)
   - **Allow non-localhost URLs**: Enable to use remote Ollama instances (disabled by default for security)
3. Click "Save"

### 3. Summarize a Transcript

1. Record and transcribe audio in the ASR tab
2. Click "Add-ons" → "Ollama Summarize"
3. A draggable window opens with:
   - **Current configuration** displayed at the top
   - **Prompt field** (default: "Summarize the following transcript:")
   - **Summarize button** to generate the summary
4. Modify the prompt if desired (e.g., "Create bullet points from:", "Extract key insights:")
5. Click "Summarize"
6. Wait for the model to process (may take several seconds)
7. Review the summary in the output area
8. Optionally click "Replace transcript" to substitute the original with the summary

## Configuration

### Settings Schema

The add-on uses these configuration options:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `ollamaUrl` | URL | `http://localhost:11434` | Ollama server endpoint |
| `ollamaModel` | String | `llama3` | Model name to use for summarization |
| `allowNonLocalhost` | Boolean | `false` | Allow remote Ollama URLs |

### Changing the Model

To use a different model:

1. Pull the model: `ollama pull mistral`
2. Open Yap settings
3. Change "Model" to `mistral`
4. Save settings

### Using a Remote Ollama Instance

⚠️ **Security Warning**: Only enable remote URLs if you trust the remote server.

1. Open Yap settings
2. Enable "Allow non-localhost URLs"
3. Set "Ollama URL" to your remote instance (e.g., `http://192.168.1.100:11434`)
4. Save settings

## Prompt Examples

Try different prompts for different results:

- `Summarize the following transcript in 2-3 sentences:`
- `Extract the main points as bullet points:`
- `Create a title and summary for:`
- `What are the key takeaways from:`
- `Translate the following to Spanish and summarize:`

## Troubleshooting

### "Could not connect to Ollama"

**Problem**: The add-on cannot reach the Ollama server.

**Solutions**:
1. Verify Ollama is running: `ollama list`
2. Check the URL in settings matches where Ollama is running
3. For remote instances, ensure firewall allows connections
4. Check browser console (F12) for detailed error messages

### "No transcript to summarize"

**Problem**: No text available in the ASR tab.

**Solution**: Record and transcribe audio first in the ASR tab.

### Slow summarization

**Problem**: Summarization takes a long time.

**Solutions**:
1. Use a smaller/faster model (e.g., `llama3` instead of `llama3:70b`)
2. Ensure your system meets Ollama's hardware requirements
3. For long transcripts, consider summarizing in chunks

### "Transcript too long" error

**Problem**: Transcript exceeds the 50,000 character limit.

**Solutions**:
1. Manually edit the transcript to be shorter before summarizing
2. Copy sections to TTS tab or external editor, then summarize in parts

## Technical Details

### Implementation

The add-on is implemented in `/app/ui/js/addons.js`:

- **Function**: `renderOllamaSummarize(container, ctx)`
- **API Endpoint**: `POST {ollamaUrl}/api/generate`
- **Request Format**:
  ```json
  {
    "model": "llama3",
    "prompt": "Summarize: <transcript>",
    "stream": false
  }
  ```

### Security

- **Localhost-only by default**: Prevents accidental data leakage to remote servers
- **URL validation**: Ensures valid URL format
- **Opt-in remote**: User must explicitly enable non-localhost URLs
- **No credentials stored**: No API keys or passwords required

### Performance

- **Model size**: Larger models provide better quality but are slower
- **Hardware**: Runs best on systems with GPU support
- **Transcript length**: Longer transcripts take proportionally more time
- **Streaming disabled**: Full response returned at once for simplicity

## See Also

- [Ollama Documentation](https://github.com/ollama/ollama/tree/main/docs)
- [Available Ollama Models](https://ollama.ai/library)
- [Yap Add-ons Guide](../README.md)
