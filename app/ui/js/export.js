// Yap - Export Module
// Export transcripts to GitLab, GitHub, or SFTP

import { util } from './util.js';
import { createAddonWindow } from './addons.js';

// Export profiles stored in localStorage
const PROFILES_STORAGE_KEY = 'yap.export.profiles';
const EXPORTER_URL_KEY = 'yap.export.exporterUrl';

// Default exporter URL (local service)
const DEFAULT_EXPORTER_URL = 'http://localhost:8090';

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

// Execute export
async function executeExport(profile, transcript, clips) {
  const url = getExporterUrl();
  
  const payload = {
    timestamp: new Date().toISOString(),
    app_version: '1.0.0',
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
        generate_message: profile.generateMessage || false,
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

// Create default profiles based on what's configured
function createDefaultProfiles(health) {
  const profiles = [];
  
  if (health.gitlab_configured) {
    profiles.push({
      id: 'default-gitlab',
      name: 'GitLab (default)',
      type: 'gitlab',
      projectId: '',
      filePath: 'inbox/{year}/{month}/{timestamp}.md',
      branch: 'main',
      commitMessage: '',
      generateMessage: false
    });
  }
  
  if (health.github_configured) {
    profiles.push({
      id: 'default-github',
      name: 'GitHub (default)',
      type: 'github',
      projectId: '',
      filePath: 'inbox/{year}/{month}/{timestamp}.md',
      branch: 'main',
      commitMessage: '',
      generateMessage: false
    });
  }
  
  if (health.sftp_configured) {
    profiles.push({
      id: 'default-sftp',
      name: 'SFTP (default)',
      type: 'sftp',
      filePath: '/uploads/{timestamp}.md'
    });
  }
  
  return profiles;
}

// Open export panel
export function openExportPanel(getTranscript, getClips) {
  createAddonWindow('Export', async (container) => {
    container.classList.add('export-panel');
    
    let profiles = loadProfiles();
    let selectedProfileId = profiles.length > 0 ? profiles[0].id : null;
    let currentView = 'main'; // 'main' | 'edit' | 'settings'
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
      } else {
        renderMainView();
      }
    }
    
    function renderMainView() {
      const transcript = getTranscript();
      const hasTranscript = transcript && transcript.length > 0;
      
      const healthStatus = exporterHealth 
        ? '<span style="color: var(--success);">● Connected</span>'
        : '<span style="color: var(--error);">● Not connected</span>';
      
      container.innerHTML = `
        <div class="export-status">
          Exporter: ${healthStatus}
          <button class="small" id="exportSettingsBtn" style="margin-left: auto;">⚙</button>
        </div>
        
        <div class="export-section">
          <label>Export to</label>
          <div class="export-destination-row">
            <select id="exportProfileSelect" class="export-select">
              ${profiles.length === 0 ? '<option value="">No profiles configured</option>' : ''}
              ${profiles.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === selectedProfileId ? 'selected' : ''}>${escapeHtml(p.name)} (${escapeHtml(p.type)})</option>`).join('')}
            </select>
            <button class="small" id="exportEditBtn" ${profiles.length === 0 ? 'disabled' : ''}>Edit</button>
            <button class="small" id="exportNewBtn">New</button>
          </div>
        </div>
        
        ${selectedProfileId && profiles.find(p => p.id === selectedProfileId)?.type !== 'sftp' ? `
        <div class="export-section">
          <label>Commit message</label>
          <input type="text" id="exportCommitMessage" placeholder="Auto-generate or enter custom..." value="">
          <div class="export-option">
            <label class="toggle-label-inline">
              <input type="checkbox" id="exportGenerateMessage" ${exporterHealth?.ollama_configured ? '' : 'disabled'}>
              <span>Generate with Ollama ${exporterHealth?.ollama_configured ? '' : '(not configured)'}</span>
            </label>
          </div>
        </div>
        ` : ''}
        
        <div class="export-actions">
          <button class="small primary" id="exportNowBtn" ${!hasTranscript || profiles.length === 0 || !exporterHealth ? 'disabled' : ''}>Export Now</button>
          <button class="small" id="exportPreviewBtn" ${!hasTranscript ? 'disabled' : ''}>Preview</button>
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
        editingProfile = null;
        currentView = 'edit';
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
        const transcript = getTranscript();
        const clips = getClips();
        const outputDiv = container.querySelector('#exportOutput');
        
        const payload = {
          timestamp: new Date().toISOString(),
          transcript: transcript.substring(0, 500) + (transcript.length > 500 ? '...' : ''),
          clips_count: clips.length
        };
        
        outputDiv.innerHTML = `<strong>Preview:</strong>\n<pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
        outputDiv.style.display = 'block';
        container.querySelector('#exportError').style.display = 'none';
      });
      
      container.querySelector('#exportNowBtn')?.addEventListener('click', async () => {
        const profile = profiles.find(p => p.id === selectedProfileId);
        if (!profile) return;
        
        const transcript = getTranscript();
        const clips = getClips();
        const outputDiv = container.querySelector('#exportOutput');
        const errorDiv = container.querySelector('#exportError');
        const btn = container.querySelector('#exportNowBtn');
        
        // Get custom commit message if provided
        const commitMessageInput = container.querySelector('#exportCommitMessage');
        const generateMessage = container.querySelector('#exportGenerateMessage')?.checked || false;
        
        if (commitMessageInput?.value) {
          profile.commitMessage = commitMessageInput.value;
        }
        profile.generateMessage = generateMessage;
        
        btn.disabled = true;
        btn.textContent = 'Exporting...';
        outputDiv.style.display = 'none';
        errorDiv.style.display = 'none';
        
        try {
          const result = await executeExport(profile, transcript, clips);
          
          let successHtml = `<strong>✓ Export successful</strong>\n`;
          if (result.url) {
            successHtml += `<a href="${escapeHtml(result.url)}" target="_blank" style="color: var(--accent-secondary);">View file</a>\n`;
          }
          if (result.file_path) {
            successHtml += `Path: ${escapeHtml(result.file_path)}`;
          }
          
          outputDiv.innerHTML = successHtml;
          outputDiv.style.display = 'block';
          
        } catch (err) {
          errorDiv.textContent = err.message;
          errorDiv.style.display = 'block';
        } finally {
          btn.disabled = false;
          btn.textContent = 'Export Now';
        }
      });
    }
    
    function renderEditView() {
      const isNew = !editingProfile;
      const profile = editingProfile || {
        id: '',
        name: '',
        type: 'github',
        projectId: '',
        filePath: 'inbox/{year}/{month}/{timestamp}.md',
        branch: 'main',
        commitMessage: '',
        generateMessage: false
      };
      
      container.innerHTML = `
        <div class="export-edit-header">
          <span>${isNew ? 'New Export Profile' : 'Edit Profile'}</span>
        </div>
        
        <div class="export-section">
          <label for="exportName">Profile Name</label>
          <input type="text" id="exportName" value="${escapeHtml(profile.name)}" placeholder="My Export">
        </div>
        
        <div class="export-section">
          <label for="exportType">Type</label>
          <select id="exportType">
            <option value="github" ${profile.type === 'github' ? 'selected' : ''}>GitHub</option>
            <option value="gitlab" ${profile.type === 'gitlab' ? 'selected' : ''}>GitLab</option>
            <option value="sftp" ${profile.type === 'sftp' ? 'selected' : ''}>SFTP</option>
          </select>
        </div>
        
        <div class="export-section git-fields" style="${profile.type === 'sftp' ? 'display:none;' : ''}">
          <label for="exportProjectId">Repository (owner/repo)</label>
          <input type="text" id="exportProjectId" value="${escapeHtml(profile.projectId || '')}" placeholder="username/repo">
        </div>
        
        <div class="export-section">
          <label for="exportFilePath">File Path</label>
          <input type="text" id="exportFilePath" value="${escapeHtml(profile.filePath || '')}" placeholder="inbox/{year}/{month}/{timestamp}.md">
          <div class="export-hint">Variables: {year}, {month}, {day}, {timestamp}, {date}</div>
        </div>
        
        <div class="export-section git-fields" style="${profile.type === 'sftp' ? 'display:none;' : ''}">
          <label for="exportBranch">Branch</label>
          <input type="text" id="exportBranch" value="${escapeHtml(profile.branch || 'main')}" placeholder="main">
        </div>
        
        <div class="export-actions">
          <button class="small primary" id="exportSaveBtn">Save</button>
          <button class="small" id="exportCancelBtn">Cancel</button>
          ${!isNew ? '<button class="small danger" id="exportDeleteBtn">Delete</button>' : ''}
        </div>
        
        <div class="export-error" id="exportEditError" style="display: none;"></div>
      `;
      
      // Show/hide git-specific fields based on type
      container.querySelector('#exportType')?.addEventListener('change', (e) => {
        const isSftp = e.target.value === 'sftp';
        container.querySelectorAll('.git-fields').forEach(el => {
          el.style.display = isSftp ? 'none' : '';
        });
      });
      
      container.querySelector('#exportSaveBtn')?.addEventListener('click', () => {
        const name = container.querySelector('#exportName').value.trim();
        const type = container.querySelector('#exportType').value;
        const projectId = container.querySelector('#exportProjectId')?.value.trim() || '';
        const filePath = container.querySelector('#exportFilePath').value.trim();
        const branch = container.querySelector('#exportBranch')?.value.trim() || 'main';
        
        if (!name) {
          container.querySelector('#exportEditError').textContent = 'Name is required';
          container.querySelector('#exportEditError').style.display = 'block';
          return;
        }
        
        if (type !== 'sftp' && !projectId) {
          container.querySelector('#exportEditError').textContent = 'Repository is required';
          container.querySelector('#exportEditError').style.display = 'block';
          return;
        }
        
        if (isNew) {
          const newProfile = {
            id: Date.now().toString(),
            name,
            type,
            projectId,
            filePath: filePath || 'inbox/{year}/{month}/{timestamp}.md',
            branch,
            commitMessage: '',
            generateMessage: false
          };
          profiles.push(newProfile);
          selectedProfileId = newProfile.id;
        } else {
          editingProfile.name = name;
          editingProfile.type = type;
          editingProfile.projectId = projectId;
          editingProfile.filePath = filePath || 'inbox/{year}/{month}/{timestamp}.md';
          editingProfile.branch = branch;
        }
        
        saveProfiles(profiles);
        currentView = 'main';
        render();
      });
      
      container.querySelector('#exportCancelBtn')?.addEventListener('click', () => {
        currentView = 'main';
        render();
      });
      
      container.querySelector('#exportDeleteBtn')?.addEventListener('click', () => {
        if (confirm('Delete this profile?')) {
          profiles = profiles.filter(p => p.id !== editingProfile.id);
          saveProfiles(profiles);
          selectedProfileId = profiles.length > 0 ? profiles[0].id : null;
          currentView = 'main';
          render();
        }
      });
    }
    
    function renderSettingsView() {
      const currentUrl = getExporterUrl();
      
      container.innerHTML = `
        <div class="export-edit-header">
          <span>Export Settings</span>
        </div>
        
        <div class="export-section">
          <label for="exporterUrl">Exporter Service URL</label>
          <input type="url" id="exporterUrl" value="${escapeHtml(currentUrl)}" placeholder="http://localhost:8090">
          <div class="export-hint">The YAP exporter service URL</div>
        </div>
        
        <div class="export-actions">
          <button class="small primary" id="settingsSaveBtn">Save</button>
          <button class="small" id="settingsCancelBtn">Cancel</button>
          <button class="small" id="settingsTestBtn">Test Connection</button>
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
              `SFTP: ${health.sftp_configured ? '✓' : '✗'}\n` +
              `Ollama: ${health.ollama_configured ? '✓' : '✗'}`;
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
  }, { width: 420, height: 480 });
}

export const exportModule = { openExportPanel };
