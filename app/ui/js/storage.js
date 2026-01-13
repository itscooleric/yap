// Yap - Session Storage Module
// IndexedDB-based persistence for clips and transcripts

const DB_NAME = 'yap-session';
const DB_VERSION = 1;
const STORE_NAME = 'clips';

let db = null;

// Initialize IndexedDB
export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.warn('IndexedDB not available, session persistence disabled');
      resolve(false);
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(true);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Create clips store
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// Save a clip to IndexedDB
export async function saveClip(clip) {
  if (!db) return false;
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Prepare clip data for storage
      // We store the blob as-is (IndexedDB supports Blob storage)
      const clipData = {
        id: clip.id,
        createdAt: clip.createdAt instanceof Date ? clip.createdAt.toISOString() : clip.createdAt,
        durationMs: clip.durationMs,
        mimeType: clip.mimeType,
        blob: clip.blob, // IndexedDB can store Blobs directly
        status: clip.status,
        transcript: clip.transcript
      };
      
      const request = store.put(clipData);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.warn('Failed to save clip:', request.error);
        resolve(false);
      };
    } catch (err) {
      console.warn('Error saving clip:', err);
      resolve(false);
    }
  });
}

// Update clip transcript
export async function updateClipTranscript(clipId, transcript, status) {
  if (!db) return false;
  
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const getRequest = store.get(clipId);
      
      getRequest.onsuccess = () => {
        const clip = getRequest.result;
        if (clip) {
          clip.transcript = transcript;
          clip.status = status;
          store.put(clip);
          resolve(true);
        } else {
          resolve(false);
        }
      };
      
      getRequest.onerror = () => resolve(false);
    } catch (err) {
      console.warn('Error updating clip:', err);
      resolve(false);
    }
  });
}

// Delete a clip from IndexedDB
export async function deleteClip(clipId) {
  if (!db) return false;
  
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.delete(clipId);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (err) {
      console.warn('Error deleting clip:', err);
      resolve(false);
    }
  });
}

// Clear all clips from IndexedDB
export async function clearAllClips() {
  if (!db) return false;
  
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.clear();
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (err) {
      console.warn('Error clearing clips:', err);
      resolve(false);
    }
  });
}

// Load all clips from IndexedDB
export async function loadClips() {
  if (!db) return [];
  
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      
      const request = index.getAll();
      
      request.onsuccess = () => {
        const clips = request.result || [];
        
        // Convert stored data back to usable format
        const restoredClips = clips.map(clip => ({
          id: clip.id,
          createdAt: new Date(clip.createdAt),
          durationMs: clip.durationMs,
          mimeType: clip.mimeType,
          blob: clip.blob,
          objectUrl: clip.blob ? URL.createObjectURL(clip.blob) : null,
          status: clip.status,
          transcript: clip.transcript
        }));
        
        resolve(restoredClips);
      };
      
      request.onerror = () => {
        console.warn('Failed to load clips:', request.error);
        resolve([]);
      };
    } catch (err) {
      console.warn('Error loading clips:', err);
      resolve([]);
    }
  });
}

// Check if there are any saved clips
export async function hasSavedClips() {
  if (!db) return false;
  
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => resolve(false);
    } catch (err) {
      resolve(false);
    }
  });
}

export const storage = {
  initDB,
  saveClip,
  updateClipTranscript,
  deleteClip,
  clearAllClips,
  loadClips,
  hasSavedClips
};
