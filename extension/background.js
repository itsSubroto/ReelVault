// ReelVault Chrome Extension - Background Service Worker (Manifest V3)

const DEFAULT_API_BASE = 'http://localhost:8080';
const DEFAULT_WEB_URL = 'http://localhost:5173';

// Helper to get stored settings
async function getSettings() {
  const result = await chrome.storage.local.get({
    apiUrl: DEFAULT_API_BASE,
    webUrl: DEFAULT_WEB_URL,
    token: null,
    user: null,
    recentSaves: []
  });
  return result;
}

// Check if a URL is a supported YouTube or Instagram video link
function isSupportedUrl(url) {
  if (!url) return false;
  const isYoutube = /(?:youtube\.com\/(?:watch|shorts)|youtu\.be\/)/i.test(url);
  const isInstagram = /(?:instagram\.com\/(?:reel|reels|p)\/)/i.test(url);
  return isYoutube || isInstagram;
}

// Make authenticated API request to ReelVault Spring Boot backend
async function apiRequest(endpoint, options = {}) {
  const settings = await getSettings();
  const url = `${settings.apiUrl.replace(/\/+$/, '')}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (settings.token) {
    headers['Authorization'] = `Bearer ${settings.token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 204) return null;

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `HTTP error ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// Show a Chrome notification
function showNotification(id, title, message) {
  try {
    chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title || 'ReelVault',
      message: message || ''
    });
  } catch (err) {
    console.warn('Notification failed:', err);
  }
}

// Save video to ReelVault
async function saveVideo(videoUrl, collectionId = null) {
  if (!isSupportedUrl(videoUrl)) {
    throw new Error('Unsupported URL. Only YouTube and Instagram videos are supported.');
  }

  const payload = { url: videoUrl };
  if (collectionId) {
    payload.collectionId = collectionId;
  }

  const result = await apiRequest('/api/reels', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  // Record in recent saves
  const settings = await getSettings();
  const recent = settings.recentSaves || [];
  recent.unshift({
    id: result.id,
    url: result.instagramUrl || videoUrl,
    caption: result.caption,
    thumbnailUrl: result.thumbnailUrl,
    collectionName: result.collectionName || 'Quick Save',
    savedAt: new Date().toISOString()
  });

  // Keep last 10
  await chrome.storage.local.set({ recentSaves: recent.slice(0, 10) });

  return result;
}

// Context Menu Setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'reelvault-save-link',
    title: '⚡ Save to ReelVault',
    contexts: ['page', 'link', 'video']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const targetUrl = info.linkUrl || info.srcUrl || info.pageUrl || tab?.url;
  if (!targetUrl || !isSupportedUrl(targetUrl)) {
    showNotification('reelvault-invalid', 'ReelVault', 'Please select a valid YouTube or Instagram video link.');
    return;
  }

  try {
    const saved = await saveVideo(targetUrl);
    showNotification(
      'reelvault-success-' + Date.now(),
      'Saved to ReelVault! 🚀',
      `${saved.caption ? saved.caption.substring(0, 60) + '...' : 'Video saved successfully'} (in ${saved.collectionName})`
    );
  } catch (err) {
    showNotification('reelvault-error-' + Date.now(), 'ReelVault Save Failed', err.message);
  }
});

// Keyboard Shortcut Listener
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick-save-active-tab') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !isSupportedUrl(tab.url)) {
      showNotification('reelvault-shortcut-err', 'ReelVault', 'Active tab is not a supported YouTube or Instagram video.');
      return;
    }

    try {
      const saved = await saveVideo(tab.url);
      showNotification(
        'reelvault-shortcut-success-' + Date.now(),
        'Quick Saved to ReelVault! ⚡',
        `${saved.caption ? saved.caption.substring(0, 50) + '...' : 'Saved to ' + saved.collectionName}`
      );
    } catch (err) {
      showNotification('reelvault-shortcut-fail-' + Date.now(), 'ReelVault Save Failed', err.message);
    }
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, payload } = request;

  (async () => {
    try {
      if (action === 'GET_SETTINGS') {
        const settings = await getSettings();
        sendResponse({ success: true, data: settings });
      } else if (action === 'SAVE_SETTINGS') {
        await chrome.storage.local.set(payload);
        sendResponse({ success: true });
      } else if (action === 'LOGIN') {
        const { usernameOrEmail, password, apiUrl } = payload;
        if (apiUrl) {
          await chrome.storage.local.set({ apiUrl });
        }
        const data = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ usernameOrEmail, password })
        });
        await chrome.storage.local.set({
          token: data.token,
          user: data.user
        });
        sendResponse({ success: true, data });
      } else if (action === 'LOGOUT') {
        await chrome.storage.local.set({ token: null, user: null });
        sendResponse({ success: true });
      } else if (action === 'CHECK_HEALTH') {
        const data = await apiRequest('/api/health', { method: 'GET' });
        sendResponse({ success: true, data });
      } else if (action === 'CHECK_REEL') {
        const data = await apiRequest(`/api/reels/check?url=${encodeURIComponent(payload.url)}`, { method: 'GET' });
        sendResponse({ success: true, data });
      } else if (action === 'GET_COLLECTIONS') {
        const data = await apiRequest('/api/collections', { method: 'GET' });
        sendResponse({ success: true, data });
      } else if (action === 'CREATE_COLLECTION') {
        const data = await apiRequest('/api/collections', {
          method: 'POST',
          body: JSON.stringify({ name: payload.name, description: payload.description || '' })
        });
        sendResponse({ success: true, data });
      } else if (action === 'SAVE_VIDEO') {
        const data = await saveVideo(payload.url, payload.collectionId);
        sendResponse({ success: true, data });
      } else if (action === 'OPEN_WEB') {
        const settings = await getSettings();
        const targetUrl = payload?.path ? `${settings.webUrl}${payload.path}` : settings.webUrl;
        chrome.tabs.create({ url: targetUrl });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Unknown action: ' + action });
      }
    } catch (err) {
      sendResponse({
        success: false,
        error: err.message || 'An unexpected error occurred',
        status: err.status
      });
    }
  })();

  return true; // Keep channel open for async response
});
