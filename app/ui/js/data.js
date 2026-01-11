// Yap - Metrics/Data Tab
// Local-only metrics and history display

import { util } from './util.js';

// State
let metricsEnabled = false;
let currentRange = '7d';
let currentPage = 1;
let totalPages = 1;
const PAGE_SIZE = 50;

// DOM elements
let elements = {};

// Check if metrics service is available
async function checkMetricsStatus() {
  try {
    const response = await fetch('/api/metrics/config');
    if (response.ok) {
      const config = await response.json();
      return config;
    }
  } catch (err) {
    console.warn('Metrics service not available:', err);
  }
  return null;
}

// Initialize data tab
export async function init(container) {
  elements = {
    dataTabBtn: document.getElementById('dataTabBtn'),
    disabledNotice: container.querySelector('#metricsDisabledNotice'),
    summaryPanel: container.querySelector('#metricsSummary'),
    historyPanel: container.querySelector('#metricsHistoryPanel'),
    rangeButtons: container.querySelectorAll('.range-btn'),
    metricAsrRecorded: container.querySelector('#metricAsrRecorded'),
    metricAsrTranscribed: container.querySelector('#metricAsrTranscribed'),
    metricTtsGenerated: container.querySelector('#metricTtsGenerated'),
    metricTotalEvents: container.querySelector('#metricTotalEvents'),
    historyTableBody: container.querySelector('#historyTableBody'),
    exportHistoryBtn: container.querySelector('#exportHistoryBtn'),
    clearHistoryBtn: container.querySelector('#clearHistoryBtn'),
    historyPrevBtn: container.querySelector('#historyPrevBtn'),
    historyNextBtn: container.querySelector('#historyNextBtn'),
    historyPageInfo: container.querySelector('#historyPageInfo'),
    message: container.querySelector('#dataMessage')
  };

  // Check metrics status
  const config = await checkMetricsStatus();
  metricsEnabled = config?.enabled ?? false;

  if (metricsEnabled) {
    // Show Data tab button
    if (elements.dataTabBtn) {
      elements.dataTabBtn.style.display = '';
    }
    
    // Show UI
    elements.disabledNotice.style.display = 'none';
    elements.summaryPanel.style.display = 'block';
    elements.historyPanel.style.display = 'block';
    
    // Load initial data
    await loadSummary();
    await loadHistory();
    
    // Setup event handlers
    setupEventHandlers();
  } else {
    // Hide Data tab button if metrics disabled
    if (elements.dataTabBtn) {
      elements.dataTabBtn.style.display = 'none';
    }
    elements.disabledNotice.style.display = 'block';
  }
}

// Setup event handlers
function setupEventHandlers() {
  // Range buttons
  elements.rangeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      elements.rangeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.dataset.range;
      await loadSummary();
    });
  });

  // Export history
  elements.exportHistoryBtn?.addEventListener('click', exportHistory);

  // Clear history
  elements.clearHistoryBtn?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      await clearHistory();
    }
  });

  // Pagination
  elements.historyPrevBtn?.addEventListener('click', async () => {
    if (currentPage > 1) {
      currentPage--;
      await loadHistory();
    }
  });

  elements.historyNextBtn?.addEventListener('click', async () => {
    if (currentPage < totalPages) {
      currentPage++;
      await loadHistory();
    }
  });
}

// Load summary statistics
async function loadSummary() {
  try {
    const response = await fetch(`/api/metrics/summary?range=${currentRange}`);
    if (!response.ok) throw new Error('Failed to load summary');
    
    const data = await response.json();
    
    // Update metric cards
    elements.metricAsrRecorded.textContent = formatMinutes(data.asr_seconds_recorded);
    elements.metricAsrTranscribed.textContent = formatMinutes(data.asr_seconds_transcribed);
    elements.metricTtsGenerated.textContent = formatMinutes(data.tts_seconds_generated);
    elements.metricTotalEvents.textContent = data.total_events;
    
  } catch (err) {
    console.error('Failed to load metrics summary:', err);
    showMessage('Failed to load metrics', 'error');
  }
}

// Load history
async function loadHistory() {
  try {
    const offset = (currentPage - 1) * PAGE_SIZE;
    const response = await fetch(`/api/metrics/history?limit=${PAGE_SIZE}&offset=${offset}`);
    if (!response.ok) throw new Error('Failed to load history');
    
    const data = await response.json();
    
    // Calculate pagination
    totalPages = Math.ceil(data.total / PAGE_SIZE) || 1;
    
    // Update pagination controls
    elements.historyPrevBtn.disabled = currentPage <= 1;
    elements.historyNextBtn.disabled = currentPage >= totalPages;
    elements.historyPageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    // Render table
    renderHistoryTable(data.events);
    
  } catch (err) {
    console.error('Failed to load history:', err);
    showMessage('Failed to load history', 'error');
  }
}

// Render history table
function renderHistoryTable(events) {
  if (!events || events.length === 0) {
    elements.historyTableBody.innerHTML = '<tr><td colspan="5" class="no-data">No events recorded</td></tr>';
    return;
  }
  
  elements.historyTableBody.innerHTML = events.map(event => {
    const time = formatTimestamp(event.timestamp);
    const type = formatEventType(event.event_type);
    const duration = event.duration_seconds > 0 ? `${event.duration_seconds.toFixed(1)}s` : '-';
    const chars = event.output_chars > 0 ? event.output_chars : '-';
    const statusClass = event.status === 'success' ? 'status-success' : 'status-error';
    
    return `
      <tr>
        <td>${escapeHtml(time)}</td>
        <td><span class="event-type-badge ${event.event_type.split('_')[0]}">${escapeHtml(type)}</span></td>
        <td>${duration}</td>
        <td>${chars}</td>
        <td><span class="${statusClass}">${event.status}</span></td>
      </tr>
    `;
  }).join('');
}

// Export history as JSON
async function exportHistory() {
  try {
    const response = await fetch('/api/metrics/export');
    if (!response.ok) throw new Error('Failed to export');
    
    const data = await response.json();
    
    // Create download
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yap-metrics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showMessage('History exported', 'success');
    
  } catch (err) {
    console.error('Failed to export history:', err);
    showMessage('Failed to export history', 'error');
  }
}

// Clear history
async function clearHistory() {
  try {
    const response = await fetch('/api/metrics/history', { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to clear');
    
    // Reload data
    currentPage = 1;
    await loadSummary();
    await loadHistory();
    
    showMessage('History cleared', 'success');
    
  } catch (err) {
    console.error('Failed to clear history:', err);
    showMessage('Failed to clear history', 'error');
  }
}

// Record an event (called by ASR/TTS modules)
export async function recordEvent(eventType, data = {}) {
  if (!metricsEnabled) return;
  
  try {
    await fetch('/api/metrics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: eventType,
        duration_seconds: data.duration || 0,
        input_chars: data.inputChars || 0,
        output_chars: data.outputChars || 0,
        status: data.status || 'success',
        text_content: data.text || null,
        metadata: data.metadata || null
      })
    });
  } catch (err) {
    console.warn('Failed to record metric event:', err);
  }
}

// Check if metrics are enabled
export function isEnabled() {
  return metricsEnabled;
}

// Format seconds to minutes
function formatMinutes(seconds) {
  if (!seconds || seconds <= 0) return '0';
  return (seconds / 60).toFixed(1);
}

// Format timestamp
function formatTimestamp(iso) {
  const date = new Date(iso);
  const now = new Date();
  const today = now.toDateString();
  const dateStr = date.toDateString();
  
  if (today === dateStr) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
         date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Format event type
function formatEventType(type) {
  const labels = {
    'asr_record': 'Record',
    'asr_transcribe': 'Transcribe',
    'tts_synthesize': 'Synthesize',
    'tts_play': 'Play'
  };
  return labels[type] || type;
}

// HTML escape
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Show message
function showMessage(text, type = '') {
  if (!elements.message) return;
  elements.message.textContent = text;
  elements.message.className = 'message ' + type;
  elements.message.style.display = 'block';
  setTimeout(() => {
    elements.message.style.display = 'none';
  }, 3000);
}
