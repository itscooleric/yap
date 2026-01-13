// Yap - Export Module
// Export transcripts to GitLab, GitHub, SFTP, or webhooks
// Supports both direct HTTP and proxy/exporter service modes

import { util } from './util.js';
import { createAddonWindow } from './addons.js';

// Export profiles stored in localStorage
const PROFILES_STORAGE_KEY = 'yap.export.profiles';
const EXPORTER_URL_KEY = 'yap.export.exporterUrl';

// Default exporter URL (local service)
const DEFAULT_EXPORTER_URL = 'http://localhost:8090';

// App version for payloads
const APP_VERSION = '1.0.0';

// HTML escape function to prevent XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Get exporter URL
function getExporterUrl() {
  return util.storage.get(EXPORTER_URL_KEY, DEFAULT_EXPORTER_URL);
}

// Set exporter URL
function setExporterUrl(url) {
  util.storage.set(EXPORTER_URL_KEY, url);
}

// Load export profiles from localStorage
function loadProfiles() {
  try {
    const stored = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.warn('Failed to load export profiles:', err);
  }
  return [];
}

// Save export profiles to localStorage
function saveProfiles(profiles) {
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch (err) {
    console.warn('Failed to save export profiles:', err);
  }
}

// Check exporter health
async function checkExporterHealth() {
  try {
    const url = getExporterUrl();
    const response = await fetch(`${url}/health`, { method: 'GET' });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('Exporter health check failed:', err);
  }
  return null;
}

// Format date placeholders in file path
function formatFilePath(template) {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  const timestamp = `${year}${month}${day}-${hour}${minute}`;
  const date = `${year}-${month}-${day}`;
  
  return template
    .replace(/{year}/g, year)
    .replace(/{month}/g, month)
    .replace(/{day}/g, day)
    .replace(/{timestamp}/g, timestamp)
    .replace(/{date}/g, date);
}

// Build payload based on payload mode
function buildPayload(transcript, clips, payloadMode = 'transcript_only') {
  const now = new Date().toISOString();
  
  if (payloadMode === 'full_session') {
    return {
      source: 'yap',
      created_at: now,
      transcript: transcript,
      clips: clips.map(clip => ({
        id: clip.id,
        created_at: clip.createdAt?.toISOString() || now,
        duration_ms: clip.durationMs || 0,
        text: clip.transcript || ''
      })),
      meta: {
        app_version: APP_VERSION
      }
    };
  }
  
  // Default: transcript_only
  return {
    source: 'yap',
    created_at: now,
    transcript: transcript
  };
}

// Detect CORS errors from fetch responses
function detectCORSError(response, error) {
  // Response status 0 typically indicates CORS blocking
  if (response && response.status === 0) {
    return true;
  }
  // TypeError with 'Failed to fetch' is another CORS indicator
  if (error && error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
    return true;
  }
  return false;
}

// Execute webhook export (direct HTTP)
async function executeWebhookExport(profile, transcript, clips) {
  const payload = buildPayload(transcript, clips, profile.payloadMode || 'transcript_only');
  
  let headers = { 'Content-Type': 'application/json' };
  if (profile.headers) {
    try {
      headers = { ...headers, ...JSON.parse(profile.headers) };
    } catch (e) {
      // Use default headers if parse fails
    }
  }
  
  try {
    const response = await fetch(profile.url, {
      method: profile.method || 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text().catch(() => '');
    
    if (!response.ok) {
      if (detectCORSError(response, null)) {
        throw new Error('Request failed - this may be a CORS issue. Consider using a webhook proxy.');
      }
      throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 200)}`);
    }
    
    return {
      status: response.status,
      response: responseText.substring(0, 500)
    };
  } catch (err) {
    if (detectCORSError(null, err)) {
      throw new Error('Request failed - this may be a CORS issue. Consider using a webhook proxy.');
    }
    throw err;
  }
}

// Execute GitLab commit via direct API
async function executeGitLabDirectCommit(profile, transcript, clips) {
  const payload = buildPayload(transcript, clips, profile.payloadMode || 'transcript_only');
  const filePath = formatFilePath(profile.filePath || 'inbox/yap/{timestamp}.json');
  const fileContent = profile.fileFormat === 'markdown' 
    ? `# YAP Export\n\n${transcript}`
    : JSON.stringify(payload, null, 2);
  
  const commitMessage = profile.commitMessage || `yap export ${new Date().toISOString().replace('T', ' ').substring(0, 16)}`;
  
  // Build GitLab API URL
  const projectId = encodeURIComponent(profile.projectId);
  const apiUrl = `${profile.gitlabUrl || 'https://gitlab.com'}/api/v4/projects/${projectId}/repository/commits`;
  
  const commitPayload = {
    branch: profile.branch || 'main',
    commit_message: commitMessage,
    actions: [
      {
        action: 'create',
        file_path: filePath,
        content: fileContent
      }
    ]
  };
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // Add authentication
  if (profile.token) {
    headers['PRIVATE-TOKEN'] = profile.token;
  }
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(commitPayload)
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      
      if (detectCORSError(response, null)) {
        throw new Error('CORS blocked. GitLab API requires server-side access. Use webhook/proxy mode instead.');
      }
      
      throw new Error(`GitLab API error ${response.status}: ${errorText.substring(0, 200)}`);
    }
    
    const result = await response.json();
    return {
      status: response.status,
      url: result.web_url,
      file_path: filePath
    };
    
  } catch (err) {
    if (detectCORSError(null, err)) {
      throw new Error('Request failed - likely CORS blocked. GitLab API requires server-side access. Use webhook/proxy mode instead.');
    }
    throw err;
  }
}

// Execute GitLab commit via webhook/proxy
async function executeGitLabWebhookCommit(profile, transcript, clips) {
  const payload = buildPayload(transcript, clips, profile.payloadMode || 'transcript_only');
  const filePath = formatFilePath(profile.filePath || 'inbox/yap/{timestamp}.json');
  
  const commitMessage = profile.commitMessage || `yap export ${new Date().toISOString().replace('T', ' ').substring(0, 16)}`;
  
  // Build webhook payload that a proxy (like n8n) can process
  const webhookPayload = {
    intent: 'gitlab_commit',
    project_id: profile.projectId,
    branch: profile.branch || 'main',
    commit_message: commitMessage,
    file_path: filePath,
    file_format: profile.fileFormat || 'json',
    payload: payload
  };
  
  let headers = { 'Content-Type': 'application/json' };
  if (profile.headers) {
    try {
      headers = { ...headers, ...JSON.parse(profile.headers) };
    } catch (e) {
      // Use default headers
    }
  }
  
  const response = await fetch(profile.webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(webhookPayload)
  });
  
  const responseText = await response.text().catch(() => '');
  
  if (!response.ok) {
    throw new Error(`Webhook error ${response.status}: ${responseText.substring(0, 200)}`);
  }
  
  // Try to parse response as JSON for result info
  try {
    const result = JSON.parse(responseText);
    return {
      status: response.status,
      url: result.web_url || result.url,
      file_path: result.file_path || filePath
    };
  } catch {
    return {
      status: response.status,
      file_path: filePath,
      response: responseText.substring(0, 200)
    };
  }
}

// Execute export via exporter service (legacy)
async function executeExporterServiceExport(profile, transcript, clips) {
  const url = getExporterUrl();
  
  const payload = {
    timestamp: new Date().toISOString(),
    app_version: APP_VERSION,
    transcript: transcript,
    raw_transcript: transcript,
    clips: clips.map(clip => ({
      id: clip.id,
      duration_ms: clip.durationMs,
      transcript: clip.transcript || '',
      created_at: clip.createdAt?.toISOString() || new Date().toISOString()
    }))
  };
  
  let endpoint;
  if (profile.type === 'gitlab') {
    endpoint = `${url}/v1/export/gitlab/commit`;
  } else if (profile.type === 'github') {
    endpoint = `${url}/v1/export/github/commit`;
  } else if (profile.type === 'sftp') {
    endpoint = `${url}/v1/export/sftp/upload`;
  } else {
    throw new Error(`Unknown export type: ${profile.type}`);
  }
  
  const body = profile.type === 'sftp' 
    ? {
        remote_path: profile.filePath,
        payload
      }
    : {
        project_id: profile.projectId,
        file_path: profile.filePath,
        branch: profile.branch || 'main',
        commit_message: profile.commitMessage || null,
        payload
      };
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Export failed: ${response.status}`);
  }
  
  return await response.json();
}

// Main export execution dispatcher
async function executeExport(profile, transcript, clips) {
  switch (profile.type) {
    case 'webhook':
      return executeWebhookExport(profile, transcript, clips);
    case 'gitlab_commit':
      if (profile.mode === 'direct') {
        return executeGitLabDirectCommit(profile, transcript, clips);
      } else {
        return executeGitLabWebhookCommit(profile, transcript, clips);
      }
    case 'gitlab':
    case 'github':
    case 'sftp':
      return executeExporterServiceExport(profile, transcript, clips);
    default:
      throw new Error(`Unknown export type: ${profile.type}`);
  }
}

// Create default profiles based on what's configured
function createDefaultProfiles(health) {
  const profiles = [];
  
  if (health.gitlab_configured) {
    profiles.push({
      id: 'default-gitlab',
      name: 'GitLab (via exporter)',
      type: 'gitlab',
      projectId: '',
      filePath: 'inbox/{year}/{month}/{timestamp}.md',
      branch: 'main',
      commitMessage: ''
    });
  }
  
  if (health.github_configured) {
    profiles.push({
      id: 'default-github',
      name: 'GitHub (via exporter)',
      type: 'github',
      projectId: '',
      filePath: 'inbox/{year}/{month}/{timestamp}.md',
      branch: 'main',
      commitMessage: ''
    });
  }
  
  if (health.sftp_configured) {
    profiles.push({
      id: 'default-sftp',
      name: 'SFTP (via exporter)',
      type: 'sftp',
      filePath: '/uploads/{timestamp}.md'
    });
  }
  
  return profiles;
}

// Create template profiles
function createWebhookTemplate() {
  return {
    id: 'webhook-' + Date.now(),
    name: 'Webhook (template)',
    type: 'webhook',
    url: 'http://localhost:5678/webhook/yap',
    method: 'POST',
    headers: '{"Content-Type": "application/json"}',
    payloadMode: 'transcript_only'
  };
}

function createGitLabWebhookTemplate() {
  return {
    id: 'gitlab-webhook-' + Date.now(),
    name: 'GitLab via Webhook (template)',
    type: 'gitlab_commit',
    mode: 'webhook',
    webhookUrl: 'http://localhost:5678/webhook/gitlab-commit',
    projectId: '',
    branch: 'main',
    filePath: 'inbox/yap/{timestamp}.json',
    fileFormat: 'json',
    commitMessage: '',
    payloadMode: 'transcript_only',
    headers: '{}'
  };
}

function createGitLabDirectTemplate() {
  return {
    id: 'gitlab-direct-' + Date.now(),
    name: 'GitLab Direct API (template)',
    type: 'gitlab_commit',
    mode: 'direct',
    gitlabUrl: 'https://gitlab.com',
    projectId: '',
    branch: 'main',
    filePath: 'inbox/yap/{timestamp}.json',
    fileFormat: 'json',
    commitMessage: '',
    token: '',
    payloadMode: 'transcript_only'
  };
}

// Open export panel
export function openExportPanel(getTranscript, getClips) {
  createAddonWindow('Export', async (container) => {
    container.classList.add('export-panel');
    
    let profiles = loadProfiles();
    let selectedProfileId = profiles.length > 0 ? profiles[0].id : null;
    let currentView = 'main'; // 'main' | 'edit' | 'settings' | 'templates'
    let editingProfile = null;
    let exporterHealth = null;
    
    // Check exporter health
    exporterHealth = await checkExporterHealth();
    
    // If no profiles and exporter is healthy, create defaults
    if (profiles.length === 0 && exporterHealth) {
      profiles = createDefaultProfiles(exporterHealth);
      if (profiles.length > 0) {
        saveProfiles(profiles);
        selectedProfileId = profiles[0].id;
      }
    }
    
    function render() {
      if (currentView === 'edit') {
        renderEditView();
      } else if (currentView === 'settings') {
        renderSettingsView();
      } else if (currentView === 'templates') {
        renderTemplatesView();
      } else {
        renderMainView();
      }
    }
    
    function renderMainView() {
      const transcript = getTranscript();
      const hasTranscript = transcript && transcript.length > 0;
      
      const healthStatus = exporterHealth 
        ? '<span style="color: var(--success);">● Connected</span>'
        : '<span style="color: var(--text-muted);">● Not connected</span>';
      
      container.innerHTML = `
        <div class="export-status">
          Exporter: ${healthStatus}
          <button class="small" id="exportSettingsBtn" style="margin-left: auto;" title="Exporter settings">⚙</button>
        </div>
        
        <div class="export-section">
          <label>Export target</label>
          <div class="export-destination-row">
            <select id="exportProfileSelect" class="export-select">
              ${profiles.length === 0 ? '<option value="">No targets configured</option>' : ''}
              ${profiles.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === selectedProfileId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
            </select>
            <button class="small" id="exportEditBtn" ${profiles.length === 0 ? 'disabled' : ''}>Edit</button>
            <button class="small" id="exportNewBtn">New</button>
          </div>
        </div>
        
        <div class="export-actions">
          <button class="small primary" id="exportSendBtn" ${!hasTranscript || profiles.length === 0 ? 'disabled' : ''}>Send</button>
          <button class="small" id="exportPreviewBtn" ${!hasTranscript || profiles.length === 0 ? 'disabled' : ''}>Preview Payload</button>
        </div>
        
        <div class="export-output" id="exportOutput" style="display: none;"></div>
        <div class="export-error" id="exportError" style="display: none;"></div>
      `;
      
      // Event handlers
      container.querySelector('#exportProfileSelect')?.addEventListener('change', (e) => {
        selectedProfileId = e.target.value;
      });
      
      container.querySelector('#exportSettingsBtn')?.addEventListener('click', () => {
        currentView = 'settings';
        render();
      });
      
      container.querySelector('#exportNewBtn')?.addEventListener('click', () => {
        currentView = 'templates';
        render();
      });
      
      container.querySelector('#exportEditBtn')?.addEventListener('click', () => {
        editingProfile = profiles.find(p => p.id === selectedProfileId) || null;
        if (editingProfile) {
          currentView = 'edit';
          render();
        }
      });
      
      container.querySelector('#exportPreviewBtn')?.addEventListener('click', () => {
        const profile = profiles.find(p => p.id === selectedProfileId);
        if (!profile) return;
        
        const transcript = getTranscript();
        const clips = getClips();
        const outputDiv = container.querySelector('#exportOutput');
        const errorDiv = container.querySelector('#exportError');
        
        const payload = buildPayload(transcript, clips, profile.payloadMode || 'transcript_only');
        
        outputDiv.innerHTML = `<strong>Payload preview:</strong>\n<pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
        outputDiv.style.display = 'block';
        errorDiv.style.display = 'none';
      });
      
      container.querySelector('#exportSendBtn')?.addEventListener('click', async () => {
        const profile = profiles.find(p => p.id === selectedProfileId);
        if (!profile) return;
        
        const transcript = getTranscript();
        const clips = getClips();
        const outputDiv = container.querySelector('#exportOutput');
        const errorDiv = container.querySelector('#exportError');
        const btn = container.querySelector('#exportSendBtn');
        
        btn.disabled = true;
        btn.textContent = 'Sending...';
        outputDiv.style.display = 'none';
        errorDiv.style.display = 'none';
        
        try {
          const result = await executeExport(profile, transcript, clips);
          
          let successHtml = `<strong>✓ Export successful</strong>\n`;
          successHtml += `Status: ${result.status || 'OK'}\n`;
          if (result.url) {
            successHtml += `<a href="${escapeHtml(result.url)}" target="_blank" rel="noopener" style="color: var(--accent-secondary);">View file</a>\n`;
          }
          if (result.file_path) {
            successHtml += `Path: ${escapeHtml(result.file_path)}\n`;
          }
          if (result.response) {
            successHtml += `Response: ${escapeHtml(result.response.substring(0, 100))}${result.response.length > 100 ? '...' : ''}`;
          }
          
          outputDiv.innerHTML = successHtml;
          outputDiv.style.display = 'block';
          
        } catch (err) {
          errorDiv.textContent = err.message;
          errorDiv.style.display = 'block';
        } finally {
          btn.disabled = false;
          btn.textContent = 'Send';
        }
      });
    }
    
    function renderTemplatesView() {
      container.innerHTML = `
        <div class="export-edit-header">
          <span>Choose Export Target Type</span>
        </div>
        
        <div class="export-section">
          <button class="small" id="tplWebhook" style="width: 100%; margin-bottom: 0.5rem;">Generic Webhook</button>
          <div class="export-hint">Send to any HTTP endpoint (n8n, Zapier, custom server)</div>
        </div>
        
        <div class="export-section">
          <button class="small" id="tplGitLabWebhook" style="width: 100%; margin-bottom: 0.5rem;">GitLab Commit via Webhook</button>
          <div class="export-hint">Commit to GitLab via a proxy webhook (recommended - avoids CORS)</div>
        </div>
        
        <div class="export-section">
          <button class="small" id="tplGitLabDirect" style="width: 100%; margin-bottom: 0.5rem;">GitLab Commit Direct</button>
          <div class="export-hint">Commit directly to GitLab API (may be CORS blocked)</div>
          <div class="export-hint" style="color: var(--warning);">⚠️ Token stored in browser - use with caution</div>
        </div>
        
        ${exporterHealth ? `
        <div class="export-section" style="margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid var(--border-light);">
          <div class="export-hint" style="margin-bottom: 0.5rem;">Or use the exporter service:</div>
          <button class="small" id="tplExporterGitLab" style="width: 100%; margin-bottom: 0.5rem;">GitLab (via exporter)</button>
          <button class="small" id="tplExporterGitHub" style="width: 100%; margin-bottom: 0.5rem;">GitHub (via exporter)</button>
        </div>
        ` : ''}
        
        <div class="export-actions" style="margin-top: 1rem;">
          <button class="small" id="tplCancelBtn">Cancel</button>
        </div>
      `;
      
      container.querySelector('#tplWebhook')?.addEventListener('click', () => {
        editingProfile = createWebhookTemplate();
        currentView = 'edit';
        render();
      });
      
      container.querySelector('#tplGitLabWebhook')?.addEventListener('click', () => {
        editingProfile = createGitLabWebhookTemplate();
        currentView = 'edit';
        render();
      });
      
      container.querySelector('#tplGitLabDirect')?.addEventListener('click', () => {
        editingProfile = createGitLabDirectTemplate();
        currentView = 'edit';
        render();
      });
      
      container.querySelector('#tplExporterGitLab')?.addEventListener('click', () => {
        editingProfile = {
          id: 'gitlab-' + Date.now(),
          name: 'GitLab (via exporter)',
          type: 'gitlab',
          projectId: '',
          filePath: 'inbox/{year}/{month}/{timestamp}.md',
          branch: 'main',
          commitMessage: ''
        };
        currentView = 'edit';
        render();
      });
      
      container.querySelector('#tplExporterGitHub')?.addEventListener('click', () => {
        editingProfile = {
          id: 'github-' + Date.now(),
          name: 'GitHub (via exporter)',
          type: 'github',
          projectId: '',
          filePath: 'inbox/{year}/{month}/{timestamp}.md',
          branch: 'main',
          commitMessage: ''
        };
        currentView = 'edit';
        render();
      });
      
      container.querySelector('#tplCancelBtn')?.addEventListener('click', () => {
        currentView = 'main';
        render();
      });
    }
    
    function renderEditView() {
      const isNew = !profiles.find(p => p.id === editingProfile?.id);
      const profile = editingProfile || {};
      const type = profile.type || 'webhook';
      
      let fieldsHtml = '';
      
      if (type === 'webhook') {
        fieldsHtml = `
          <div class="export-section">
            <label for="exportUrl">Webhook URL</label>
            <input type="url" id="exportUrl" value="${escapeHtml(profile.url || '')}" placeholder="https://...">
          </div>
          
          <div class="export-section">
            <label for="exportMethod">Method</label>
            <select id="exportMethod">
              <option value="POST" ${profile.method === 'POST' ? 'selected' : ''}>POST</option>
              <option value="PUT" ${profile.method === 'PUT' ? 'selected' : ''}>PUT</option>
            </select>
          </div>
          
          <div class="export-section">
            <label for="exportHeaders">Headers (JSON)</label>
            <input type="text" id="exportHeaders" value="${escapeHtml(profile.headers || '{}')}" placeholder='{"Authorization": "Bearer ..."}'>
            <div class="export-hint" style="color: var(--warning);">⚠️ May contain auth tokens</div>
          </div>
          
          <div class="export-section">
            <label for="exportPayloadMode">Payload format</label>
            <select id="exportPayloadMode">
              <option value="transcript_only" ${profile.payloadMode === 'transcript_only' ? 'selected' : ''}>Transcript only</option>
              <option value="full_session" ${profile.payloadMode === 'full_session' ? 'selected' : ''}>Full session (with clips)</option>
            </select>
          </div>
        `;
      } else if (type === 'gitlab_commit') {
        if (profile.mode === 'direct') {
          fieldsHtml = `
            <div class="export-section">
              <label for="exportGitLabUrl">GitLab URL</label>
              <input type="url" id="exportGitLabUrl" value="${escapeHtml(profile.gitlabUrl || 'https://gitlab.com')}" placeholder="https://gitlab.com">
            </div>
            
            <div class="export-section">
              <label for="exportProjectId">Project ID or Path</label>
              <input type="text" id="exportProjectId" value="${escapeHtml(profile.projectId || '')}" placeholder="username/repo or 12345">
              <div class="export-hint">Use project ID (number) or URL-encoded path</div>
            </div>
            
            <div class="export-section">
              <label for="exportToken">Private Token</label>
              <input type="password" id="exportToken" value="${escapeHtml(profile.token || '')}" placeholder="glpat-...">
              <div class="export-hint" style="color: var(--warning);">⚠️ Stored in localStorage - not recommended for shared computers</div>
            </div>
            
            <div class="export-section">
              <label for="exportBranch">Branch</label>
              <input type="text" id="exportBranch" value="${escapeHtml(profile.branch || 'main')}" placeholder="main">
            </div>
            
            <div class="export-section">
              <label for="exportFilePath">File Path</label>
              <input type="text" id="exportFilePath" value="${escapeHtml(profile.filePath || '')}" placeholder="inbox/yap/{timestamp}.json">
              <div class="export-hint">Variables: {year}, {month}, {day}, {timestamp}</div>
            </div>
            
            <div class="export-section">
              <label for="exportFileFormat">File Format</label>
              <select id="exportFileFormat">
                <option value="json" ${profile.fileFormat === 'json' ? 'selected' : ''}>JSON</option>
                <option value="markdown" ${profile.fileFormat === 'markdown' ? 'selected' : ''}>Markdown</option>
              </select>
            </div>
            
            <div class="export-section">
              <label for="exportCommitMessage">Commit Message</label>
              <input type="text" id="exportCommitMessage" value="${escapeHtml(profile.commitMessage || '')}" placeholder="yap export {timestamp}">
            </div>
          `;
        } else {
          // webhook mode
          fieldsHtml = `
            <div class="export-section">
              <label for="exportWebhookUrl">Webhook/Proxy URL</label>
              <input type="url" id="exportWebhookUrl" value="${escapeHtml(profile.webhookUrl || '')}" placeholder="http://localhost:5678/webhook/gitlab-commit">
              <div class="export-hint">Your proxy (n8n, custom server) that calls GitLab API</div>
            </div>
            
            <div class="export-section">
              <label for="exportHeaders">Headers (JSON)</label>
              <input type="text" id="exportHeaders" value="${escapeHtml(profile.headers || '{}')}" placeholder='{}'>
            </div>
            
            <div class="export-section">
              <label for="exportProjectId">Project ID or Path</label>
              <input type="text" id="exportProjectId" value="${escapeHtml(profile.projectId || '')}" placeholder="username/repo">
            </div>
            
            <div class="export-section">
              <label for="exportBranch">Branch</label>
              <input type="text" id="exportBranch" value="${escapeHtml(profile.branch || 'main')}" placeholder="main">
            </div>
            
            <div class="export-section">
              <label for="exportFilePath">File Path</label>
              <input type="text" id="exportFilePath" value="${escapeHtml(profile.filePath || '')}" placeholder="inbox/yap/{timestamp}.json">
            </div>
            
            <div class="export-section">
              <label for="exportFileFormat">File Format</label>
              <select id="exportFileFormat">
                <option value="json" ${profile.fileFormat === 'json' ? 'selected' : ''}>JSON</option>
                <option value="markdown" ${profile.fileFormat === 'markdown' ? 'selected' : ''}>Markdown</option>
              </select>
            </div>
          `;
        }
      } else {
        // Legacy types: gitlab, github, sftp (via exporter)
        const isSftp = type === 'sftp';
        fieldsHtml = `
          <div class="export-section git-fields" style="${isSftp ? 'display:none;' : ''}">
            <label for="exportProjectId">Repository (owner/repo)</label>
            <input type="text" id="exportProjectId" value="${escapeHtml(profile.projectId || '')}" placeholder="username/repo">
          </div>
          
          <div class="export-section">
            <label for="exportFilePath">File Path</label>
            <input type="text" id="exportFilePath" value="${escapeHtml(profile.filePath || '')}" placeholder="inbox/{year}/{month}/{timestamp}.md">
            <div class="export-hint">Variables: {year}, {month}, {day}, {timestamp}</div>
          </div>
          
          <div class="export-section git-fields" style="${isSftp ? 'display:none;' : ''}">
            <label for="exportBranch">Branch</label>
            <input type="text" id="exportBranch" value="${escapeHtml(profile.branch || 'main')}" placeholder="main">
          </div>
        `;
      }
      
      container.innerHTML = `
        <div class="export-edit-header">
          <span>${isNew ? 'New Export Target' : 'Edit Target'}</span>
        </div>
        
        <div class="export-section">
          <label for="exportName">Name</label>
          <input type="text" id="exportName" value="${escapeHtml(profile.name || '')}" placeholder="My Export">
        </div>
        
        <div class="export-section">
          <label>Type</label>
          <input type="text" value="${escapeHtml(type)}${profile.mode ? ' (' + profile.mode + ')' : ''}" disabled style="opacity: 0.7;">
        </div>
        
        ${fieldsHtml}
        
        <div class="export-actions">
          <button class="small primary" id="exportSaveBtn">Save</button>
          <button class="small" id="exportCancelBtn">Cancel</button>
          ${!isNew ? '<button class="small danger" id="exportDeleteBtn">Delete</button>' : ''}
        </div>
        
        <div class="export-error" id="exportEditError" style="display: none;"></div>
      `;
      
      container.querySelector('#exportSaveBtn')?.addEventListener('click', () => {
        const name = container.querySelector('#exportName')?.value.trim();
        
        if (!name) {
          container.querySelector('#exportEditError').textContent = 'Name is required';
          container.querySelector('#exportEditError').style.display = 'block';
          return;
        }
        
        // Update profile fields
        editingProfile.name = name;
        
        if (type === 'webhook') {
          editingProfile.url = container.querySelector('#exportUrl')?.value.trim();
          editingProfile.method = container.querySelector('#exportMethod')?.value;
          editingProfile.headers = container.querySelector('#exportHeaders')?.value.trim() || '{}';
          editingProfile.payloadMode = container.querySelector('#exportPayloadMode')?.value;
          
          if (!editingProfile.url) {
            container.querySelector('#exportEditError').textContent = 'URL is required';
            container.querySelector('#exportEditError').style.display = 'block';
            return;
          }
        } else if (type === 'gitlab_commit') {
          if (editingProfile.mode === 'direct') {
            editingProfile.gitlabUrl = container.querySelector('#exportGitLabUrl')?.value.trim() || 'https://gitlab.com';
            editingProfile.projectId = container.querySelector('#exportProjectId')?.value.trim();
            editingProfile.token = container.querySelector('#exportToken')?.value;
            editingProfile.branch = container.querySelector('#exportBranch')?.value.trim() || 'main';
            editingProfile.filePath = container.querySelector('#exportFilePath')?.value.trim() || 'inbox/yap/{timestamp}.json';
            editingProfile.fileFormat = container.querySelector('#exportFileFormat')?.value;
            editingProfile.commitMessage = container.querySelector('#exportCommitMessage')?.value.trim();
            
            if (!editingProfile.projectId) {
              container.querySelector('#exportEditError').textContent = 'Project ID is required';
              container.querySelector('#exportEditError').style.display = 'block';
              return;
            }
          } else {
            editingProfile.webhookUrl = container.querySelector('#exportWebhookUrl')?.value.trim();
            editingProfile.headers = container.querySelector('#exportHeaders')?.value.trim() || '{}';
            editingProfile.projectId = container.querySelector('#exportProjectId')?.value.trim();
            editingProfile.branch = container.querySelector('#exportBranch')?.value.trim() || 'main';
            editingProfile.filePath = container.querySelector('#exportFilePath')?.value.trim() || 'inbox/yap/{timestamp}.json';
            editingProfile.fileFormat = container.querySelector('#exportFileFormat')?.value;
            
            if (!editingProfile.webhookUrl) {
              container.querySelector('#exportEditError').textContent = 'Webhook URL is required';
              container.querySelector('#exportEditError').style.display = 'block';
              return;
            }
          }
        } else {
          // Legacy types
          editingProfile.projectId = container.querySelector('#exportProjectId')?.value.trim();
          editingProfile.filePath = container.querySelector('#exportFilePath')?.value.trim() || 'inbox/{year}/{month}/{timestamp}.md';
          editingProfile.branch = container.querySelector('#exportBranch')?.value.trim() || 'main';
          
          if (type !== 'sftp' && !editingProfile.projectId) {
            container.querySelector('#exportEditError').textContent = 'Repository is required';
            container.querySelector('#exportEditError').style.display = 'block';
            return;
          }
        }
        
        // Add or update profile
        if (isNew) {
          profiles.push(editingProfile);
          selectedProfileId = editingProfile.id;
        }
        
        saveProfiles(profiles);
        editingProfile = null;
        currentView = 'main';
        render();
      });
      
      container.querySelector('#exportCancelBtn')?.addEventListener('click', () => {
        editingProfile = null;
        currentView = 'main';
        render();
      });
      
      container.querySelector('#exportDeleteBtn')?.addEventListener('click', () => {
        if (confirm('Delete this export target?')) {
          profiles = profiles.filter(p => p.id !== editingProfile.id);
          saveProfiles(profiles);
          selectedProfileId = profiles.length > 0 ? profiles[0].id : null;
          editingProfile = null;
          currentView = 'main';
          render();
        }
      });
    }
    
    function renderSettingsView() {
      const currentUrl = getExporterUrl();
      
      container.innerHTML = `
        <div class="export-edit-header">
          <span>Exporter Service Settings</span>
        </div>
        
        <div class="export-section">
          <label for="exporterUrl">Exporter Service URL</label>
          <input type="url" id="exporterUrl" value="${escapeHtml(currentUrl)}" placeholder="http://localhost:8090">
          <div class="export-hint">The YAP exporter service for Git/SFTP exports</div>
        </div>
        
        <div class="export-actions">
          <button class="small primary" id="settingsSaveBtn">Save</button>
          <button class="small" id="settingsCancelBtn">Cancel</button>
          <button class="small" id="settingsTestBtn">Test</button>
        </div>
        
        <div class="export-output" id="settingsOutput" style="display: none;"></div>
        <div class="export-error" id="settingsError" style="display: none;"></div>
      `;
      
      container.querySelector('#settingsSaveBtn')?.addEventListener('click', () => {
        const url = container.querySelector('#exporterUrl').value.trim();
        if (url) {
          setExporterUrl(url);
        }
        currentView = 'main';
        render();
      });
      
      container.querySelector('#settingsCancelBtn')?.addEventListener('click', () => {
        currentView = 'main';
        render();
      });
      
      container.querySelector('#settingsTestBtn')?.addEventListener('click', async () => {
        const url = container.querySelector('#exporterUrl').value.trim();
        const outputDiv = container.querySelector('#settingsOutput');
        const errorDiv = container.querySelector('#settingsError');
        
        outputDiv.style.display = 'none';
        errorDiv.style.display = 'none';
        
        try {
          const response = await fetch(`${url}/health`);
          if (response.ok) {
            const health = await response.json();
            outputDiv.innerHTML = `<strong>✓ Connected</strong>\n` +
              `GitLab: ${health.gitlab_configured ? '✓' : '✗'}\n` +
              `GitHub: ${health.github_configured ? '✓' : '✗'}\n` +
              `SFTP: ${health.sftp_configured ? '✓' : '✗'}`;
            outputDiv.style.display = 'block';
          } else {
            errorDiv.textContent = `Connection failed: ${response.status}`;
            errorDiv.style.display = 'block';
          }
        } catch (err) {
          errorDiv.textContent = `Connection failed: ${err.message}`;
          errorDiv.style.display = 'block';
        }
      });
    }
    
    render();
  }, { width: 440, height: 520 });
}

export const exportModule = { openExportPanel };
