// Yap - Audio Device Management Module
// Handles microphone enumeration, selection, persistence, and hot-plug support

import { util } from './util.js';

// Storage key for persisted device selection
const STORAGE_KEY = 'preferredAudioInputDeviceId';

// Module state
let devices = [];
let selectedDeviceId = null;
let actualActiveDeviceId = null;
let permissionGranted = false;
let listeners = [];

/**
 * Request microphone permission by briefly opening and closing a stream.
 * This is needed to get device labels on some browsers.
 * @returns {Promise<boolean>} True if permission was granted
 */
export async function requestMicPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately stop all tracks - we just needed to trigger permission
    stream.getTracks().forEach(track => track.stop());
    permissionGranted = true;
    // Re-enumerate to get labels
    await enumerateDevices();
    return true;
  } catch (err) {
    console.warn('Failed to request microphone permission:', err);
    permissionGranted = false;
    return false;
  }
}

/**
 * Enumerate available audio input devices.
 * Device labels may be empty if permission hasn't been granted.
 * @returns {Promise<MediaDeviceInfo[]>} Array of audio input devices
 */
export async function enumerateDevices() {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) {
      console.warn('enumerateDevices not supported');
      devices = [];
      notifyListeners();
      return [];
    }

    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = allDevices.filter(d => d.kind === 'audioinput');
    
    // Sort with default device first (deviceId === 'default' or first in list)
    devices = audioInputs.sort((a, b) => {
      if (a.deviceId === 'default') return -1;
      if (b.deviceId === 'default') return 1;
      return 0;
    });
    
    notifyListeners();
    return devices;
  } catch (err) {
    console.error('Failed to enumerate devices:', err);
    devices = [];
    notifyListeners();
    return [];
  }
}

/**
 * Get current list of audio input devices.
 * @returns {MediaDeviceInfo[]} Cached device list
 */
export function getDevices() {
  return devices;
}

/**
 * Check if device labels are available (permission was granted).
 * @returns {boolean} True if labels are available
 */
export function hasLabels() {
  return devices.some(d => d.label && d.label.length > 0);
}

/**
 * Check if multiple devices are available for selection.
 * @returns {boolean} True if user can choose between devices
 */
export function hasMultipleDevices() {
  return devices.length > 1;
}

/**
 * Check if we should show the device selector UI.
 * Hide if only one device or labels unavailable (Safari/iOS fallback).
 * @returns {boolean} True if selector should be shown
 */
export function shouldShowSelector() {
  return hasLabels() && hasMultipleDevices();
}

/**
 * Get the currently selected device ID.
 * @returns {string|null} Selected device ID or null for default
 */
export function getSelectedDeviceId() {
  return selectedDeviceId;
}

/**
 * Get the actual active device ID (from the opened stream).
 * @returns {string|null} Active device ID
 */
export function getActualActiveDeviceId() {
  return actualActiveDeviceId;
}

/**
 * Set the actual active device ID after opening a stream.
 * This should be called with track.getSettings().deviceId after getUserMedia.
 * @param {string|null} deviceId The actual device ID from the track
 */
export function setActualActiveDeviceId(deviceId) {
  actualActiveDeviceId = deviceId;
  notifyListeners();
}

/**
 * Get the label for a device by ID.
 * @param {string|null} deviceId Device ID to look up
 * @returns {string} Device label or fallback text
 */
export function getDeviceLabel(deviceId) {
  if (!deviceId) return 'Default microphone';
  
  const device = devices.find(d => d.deviceId === deviceId);
  if (device && device.label) {
    // Truncate long labels
    const label = device.label;
    return label.length > 40 ? label.substring(0, 37) + '...' : label;
  }
  
  return 'Default microphone';
}

/**
 * Get the label for the currently active microphone.
 * Uses actual active device if available, otherwise selected device.
 * @returns {string} Label for display
 */
export function getActiveMicLabel() {
  // First try the actual active device (from opened stream)
  if (actualActiveDeviceId) {
    return getDeviceLabel(actualActiveDeviceId);
  }
  // Fall back to selected device
  if (selectedDeviceId) {
    return getDeviceLabel(selectedDeviceId);
  }
  // Default fallback
  return 'Default microphone';
}

/**
 * Select a device by ID and persist to localStorage.
 * @param {string|null} deviceId Device ID to select, or null for default
 */
export function selectDevice(deviceId) {
  selectedDeviceId = deviceId;
  
  if (deviceId) {
    util.storage.set(STORAGE_KEY, deviceId);
  } else {
    util.storage.remove(STORAGE_KEY);
  }
  
  notifyListeners();
}

/**
 * Load persisted device selection from localStorage.
 * Validates that the device still exists.
 */
export function loadPersistedSelection() {
  const savedId = util.storage.get(STORAGE_KEY, null);
  if (savedId) {
    // Validate that device still exists
    const deviceExists = devices.some(d => d.deviceId === savedId);
    if (deviceExists) {
      selectedDeviceId = savedId;
    } else {
      // Device no longer exists, clear selection
      selectedDeviceId = null;
      util.storage.remove(STORAGE_KEY);
    }
  } else {
    selectedDeviceId = null;
  }
  notifyListeners();
}

/**
 * Get audio constraints for getUserMedia.
 * Uses selected device if available, with fallback handling.
 * @returns {MediaTrackConstraints|boolean} Audio constraints
 */
export function getAudioConstraints() {
  if (selectedDeviceId) {
    return {
      deviceId: { exact: selectedDeviceId }
    };
  }
  return true;
}

/**
 * Get fallback audio constraints (just true).
 * Used when specific device fails.
 * @returns {boolean} Simple audio constraint
 */
export function getFallbackConstraints() {
  return true;
}

/**
 * Subscribe to device list changes.
 * @param {Function} callback Called when device list or selection changes
 * @returns {Function} Unsubscribe function
 */
export function subscribe(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

/**
 * Notify all listeners of state change.
 */
function notifyListeners() {
  listeners.forEach(cb => {
    try {
      cb({
        devices,
        selectedDeviceId,
        actualActiveDeviceId,
        hasLabels: hasLabels(),
        shouldShowSelector: shouldShowSelector()
      });
    } catch (err) {
      console.error('AudioDevices listener error:', err);
    }
  });
}

/**
 * Setup devicechange event listener for hot-plug support.
 */
export function setupHotPlugListener() {
  if (!navigator.mediaDevices) return;
  
  navigator.mediaDevices.addEventListener('devicechange', async () => {
    console.log('Audio devices changed, re-enumerating...');
    await enumerateDevices();
    loadPersistedSelection(); // Re-validate selection
  });
}

/**
 * Initialize the audio devices module.
 * Enumerates devices, loads persisted selection, and sets up hot-plug.
 * @returns {Promise<void>}
 */
export async function init() {
  await enumerateDevices();
  loadPersistedSelection();
  setupHotPlugListener();
}

// Export as a namespace object for convenient importing
export const audioDevices = {
  init,
  requestMicPermission,
  enumerateDevices,
  getDevices,
  hasLabels,
  hasMultipleDevices,
  shouldShowSelector,
  getSelectedDeviceId,
  getActualActiveDeviceId,
  setActualActiveDeviceId,
  getDeviceLabel,
  getActiveMicLabel,
  selectDevice,
  loadPersistedSelection,
  getAudioConstraints,
  getFallbackConstraints,
  subscribe,
  setupHotPlugListener
};
