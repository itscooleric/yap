// Yap - Utility functions
// Helpers: fetch wrapper, formatting, storage

export const util = {
  // Format duration in mm:ss
  formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const secs = (totalSec % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  },

  // Format seconds to mm:ss
  formatSeconds(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  },

  // Fetch wrapper with error handling
  async fetchJson(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`Fetch error for ${url}:`, err);
      throw err;
    }
  },

  // Fetch with text response
  async fetchText(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      return await response.text();
    } catch (err) {
      console.error(`Fetch error for ${url}:`, err);
      throw err;
    }
  },

  // Fetch blob (for audio)
  async fetchBlob(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      return await response.blob();
    } catch (err) {
      console.error(`Fetch error for ${url}:`, err);
      throw err;
    }
  },

  // Storage helpers
  storage: {
    get(key, defaultValue = null) {
      try {
        const value = localStorage.getItem(`yap-${key}`);
        return value !== null ? JSON.parse(value) : defaultValue;
      } catch {
        return defaultValue;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(`yap-${key}`, JSON.stringify(value));
      } catch (err) {
        console.warn('Storage error:', err);
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(`yap-${key}`);
      } catch (err) {
        console.warn('Storage error:', err);
      }
    }
  },

  // Get supported MIME type for audio recording
  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/webm',
      'audio/ogg',
      ''
    ];
    for (const type of types) {
      if (type === '' || MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  },

  // Get file extension from MIME type
  getExtensionFromMimeType(mimeType) {
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('mp3')) return 'mp3';
    return 'webm';
  },

  // Download helper
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Download text file
  downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    this.downloadBlob(blob, filename);
  },

  // Copy to clipboard
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
      return false;
    }
  },

  // Clean up text with line break options
  cleanupText(text, cleanLineBreaks = false, lineBreakMode = 'paragraphs') {
    if (!cleanLineBreaks) return text;

    // Normalize CRLF to LF
    let result = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    if (lineBreakMode === 'paragraphs') {
      // Collapse 3+ newlines to 2 (keep paragraph breaks)
      result = result.replace(/\n{3,}/g, '\n\n');
    } else if (lineBreakMode === 'single') {
      // Replace all newline runs with single space
      result = result.replace(/\n+/g, ' ');
      // Collapse multiple spaces
      result = result.replace(/ {2,}/g, ' ');
    }

    return result.trim();
  },

  // Generate unique ID
  generateId() {
    return Date.now() + Math.random().toString(36).substring(2, 11);
  }
};
