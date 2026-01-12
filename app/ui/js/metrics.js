// Yap - Metrics Module
// Local metrics tracking for ASR and TTS usage

import { util } from './util.js';

// Metrics settings
let metricsEnabled = false;
const MAX_EVENTS = 5000;
const RETENTION_DAYS = 30;

// Load metrics settings
function loadMetricsSettings() {
  metricsEnabled = util.storage.get('settings.metrics.enabled', false);
  return metricsEnabled;
}

// Save metrics settings
function saveMetricsSettings() {
  util.storage.set('settings.metrics.enabled', metricsEnabled);
}

// Get all metrics events from localStorage
function getMetricsEvents() {
  const events = util.storage.get('metrics.events', []);
  return Array.isArray(events) ? events : [];
}

// Save metrics events to localStorage
function saveMetricsEvents(events) {
  util.storage.set('metrics.events', events);
}

// Clean old events based on retention policy
function cleanOldEvents(events) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  
  // Filter by date and enforce max events
  let filtered = events.filter(e => new Date(e.timestamp) > cutoffDate);
  
  // If still over max, keep only the most recent
  if (filtered.length > MAX_EVENTS) {
    filtered = filtered.slice(-MAX_EVENTS);
  }
  
  return filtered;
}

// Record a metrics event
function recordEvent(type, data) {
  if (!metricsEnabled) return;
  
  const event = {
    id: util.generateId(),
    timestamp: new Date().toISOString(),
    type: type, // 'asr_record', 'asr_transcribe', 'tts_synthesize'
    duration_in_sec: data.duration_in_sec || 0,
    duration_out_sec: data.duration_out_sec || 0,
    chars_in: data.chars_in || 0,
    chars_out: data.chars_out || 0,
    status: data.status || 'success'
  };
  
  const events = getMetricsEvents();
  events.push(event);
  
  // Clean and save
  const cleaned = cleanOldEvents(events);
  saveMetricsEvents(cleaned);
}

// Get summary statistics
function getSummary(range = 'today') {
  const events = getMetricsEvents();
  const now = new Date();
  let cutoffDate;
  
  if (range === 'today') {
    cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === '7d') {
    cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - 7);
  } else if (range === '30d') {
    cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - 30);
  } else {
    cutoffDate = new Date(0); // All time
  }
  
  const filtered = events.filter(e => new Date(e.timestamp) >= cutoffDate);
  
  // Calculate totals
  const asrRecorded = filtered
    .filter(e => e.type === 'asr_record')
    .reduce((sum, e) => sum + (e.duration_in_sec || 0), 0);
  
  const asrTranscribed = filtered
    .filter(e => e.type === 'asr_transcribe')
    .reduce((sum, e) => sum + (e.duration_in_sec || 0), 0);
  
  const ttsGenerated = filtered
    .filter(e => e.type === 'tts_synthesize')
    .reduce((sum, e) => sum + (e.duration_out_sec || 0), 0);
  
  const charsIn = filtered.reduce((sum, e) => sum + (e.chars_in || 0), 0);
  const charsOut = filtered.reduce((sum, e) => sum + (e.chars_out || 0), 0);
  
  return {
    asrRecordedMinutes: Math.round(asrRecorded / 60),
    asrTranscribedMinutes: Math.round(asrTranscribed / 60),
    ttsGeneratedMinutes: Math.round(ttsGenerated / 60),
    totalCharsIn: charsIn,
    totalCharsOut: charsOut,
    totalChars: charsIn + charsOut,
    eventCount: filtered.length
  };
}

// Get history (paginated)
function getHistory(limit = 100, offset = 0) {
  const events = getMetricsEvents();
  // Most recent first
  const sorted = events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const paginated = sorted.slice(offset, offset + limit);
  
  return {
    events: paginated,
    total: events.length,
    hasMore: offset + limit < events.length
  };
}

// Clear all history
function clearHistory() {
  saveMetricsEvents([]);
}

// Export history as JSON
function exportHistory() {
  const events = getMetricsEvents();
  const data = {
    exported_at: new Date().toISOString(),
    event_count: events.length,
    retention_days: RETENTION_DAYS,
    max_events: MAX_EVENTS,
    events: events
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yap-metrics-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Update Data tab UI
function updateDataUI() {
  // Update summary
  const todaySummary = getSummary('today');
  const week7Summary = getSummary('7d');
  
  // Today stats
  document.getElementById('todayRecorded').textContent = `${todaySummary.asrRecordedMinutes} min`;
  document.getElementById('todayTranscribed').textContent = `${todaySummary.asrTranscribedMinutes} min`;
  document.getElementById('todayTTS').textContent = `${todaySummary.ttsGeneratedMinutes} min`;
  document.getElementById('todayChars').textContent = todaySummary.totalChars.toLocaleString();
  
  // Last 7 days stats
  document.getElementById('week7Recorded').textContent = `${week7Summary.asrRecordedMinutes} min`;
  document.getElementById('week7Transcribed').textContent = `${week7Summary.asrTranscribedMinutes} min`;
  document.getElementById('week7TTS').textContent = `${week7Summary.ttsGeneratedMinutes} min`;
  document.getElementById('week7Chars').textContent = week7Summary.totalChars.toLocaleString();
  
  // Update history table
  const history = getHistory(100, 0);
  const tbody = document.getElementById('historyTableBody');
  
  if (history.events.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">No history available. Record or synthesize to see data.</td></tr>';
  } else {
    tbody.innerHTML = history.events.map(event => {
      const date = new Date(event.timestamp);
      const timeStr = date.toLocaleString();
      
      let typeLabel = event.type;
      if (event.type === 'asr_record') typeLabel = 'ASR Record';
      else if (event.type === 'asr_transcribe') typeLabel = 'ASR Transcribe';
      else if (event.type === 'tts_synthesize') typeLabel = 'TTS Synthesize';
      
      const duration = event.duration_in_sec || event.duration_out_sec || 0;
      const durationStr = duration > 0 ? `${Math.round(duration)}s` : '-';
      
      const chars = (event.chars_in || 0) + (event.chars_out || 0);
      const charsStr = chars > 0 ? chars.toLocaleString() : '-';
      
      const statusClass = `status-${event.status}`;
      
      return `
        <tr>
          <td>${timeStr}</td>
          <td>${typeLabel}</td>
          <td>${durationStr}</td>
          <td>${charsStr}</td>
          <td class="${statusClass}">${event.status}</td>
        </tr>
      `;
    }).join('');
  }
}

// Initialize Data tab
function initDataTab() {
  loadMetricsSettings();
  
  // Show/hide Data button based on metrics enabled
  const dataBtn = document.getElementById('dataBtn');
  if (dataBtn) {
    dataBtn.style.display = metricsEnabled ? 'inline-block' : 'none';
  }
  
  // Export history button
  const exportBtn = document.getElementById('exportHistoryBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportHistory();
    });
  }
  
  // Clear history button
  const clearBtn = document.getElementById('clearHistoryBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all metrics history? This cannot be undone.')) {
        clearHistory();
        updateDataUI();
      }
    });
  }
  
  // Update UI when tab is shown
  const dataTab = document.getElementById('data-tab');
  if (dataTab) {
    // Use MutationObserver to detect when tab becomes visible
    const observer = new MutationObserver(() => {
      if (dataTab.classList.contains('active')) {
        updateDataUI();
      }
    });
    observer.observe(dataTab, { attributes: true, attributeFilter: ['class'] });
  }
}

// Enable/disable metrics
function setMetricsEnabled(enabled) {
  metricsEnabled = enabled;
  saveMetricsSettings();
  
  // Show/hide Data button
  const dataBtn = document.getElementById('dataBtn');
  if (dataBtn) {
    dataBtn.style.display = enabled ? 'inline-block' : 'none';
  }
}

// Export public API
export const metrics = {
  init: initDataTab,
  recordEvent,
  getSummary,
  getHistory,
  clearHistory,
  exportHistory,
  updateUI: updateDataUI,
  isEnabled: () => metricsEnabled,
  setEnabled: setMetricsEnabled,
  loadSettings: loadMetricsSettings
};
