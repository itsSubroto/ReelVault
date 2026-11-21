// ReelVault Extension Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const alertBanner = document.getElementById('alert-banner');
  const alertMessage = document.getElementById('alert-message');

  // Views
  const viewLogin = document.getElementById('view-login');
  const viewMain = document.getElementById('view-main');
  const viewSettings = document.getElementById('view-settings');

  // Buttons
  const btnToggleSettings = document.getElementById('btn-toggle-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSave = document.getElementById('btn-save');
  const btnSaveLabel = document.getElementById('btn-save-label');
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');
  const btnLogout = document.getElementById('btn-logout');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const linkOpenRegister = document.getElementById('link-open-register');

  // Video Card Elements
  const platformBadge = document.getElementById('platform-badge');
  const platformName = document.getElementById('platform-name');
  const saveStatusBadge = document.getElementById('save-status-badge');
  const videoTitle = document.getElementById('video-title');
  const videoUrlInput = document.getElementById('video-url-input');

  // Collections Elements
  const selectCollection = document.getElementById('select-collection');
  const btnNewCollection = document.getElementById('btn-new-collection');
  const inlineCreateCol = document.getElementById('inline-create-col');
  const newColNameInput = document.getElementById('new-col-name');
  const btnSaveNewCol = document.getElementById('btn-save-new-col');
  const btnCancelNewCol = document.getElementById('btn-cancel-new-col');

  // Recent Saves
  const recentSavesList = document.getElementById('recent-saves-list');

  // Forms & Settings Inputs
  const formLogin = document.getElementById('form-login');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const loginApiUrl = document.getElementById('login-api-url');
  const settingsApiUrl = document.getElementById('settings-api-url');
  const settingsWebUrl = document.getElementById('settings-web-url');
  const profileName = document.getElementById('profile-name');
  const profileUsername = document.getElementById('profile-username');
  const avatarInitial = document.getElementById('avatar-initial');

  let state = {
    settings: null,
    activeTab: null,
    collections: [],
    isSaved: false
  };

  // Helper to send message to background.js
  function sendMessage(action, payload = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, payload }, (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!response) {
          return reject(new Error('No response from background script'));
        }
        resolve(response);
      });
    });
  }

  // Show banner alert
  function showAlert(msg, type = 'info', duration = 4000) {
    alertMessage.textContent = msg;
    alertBanner.className = `alert-banner ${type}`;
    alertBanner.classList.remove('hidden');

    if (duration > 0) {
      setTimeout(() => {
        alertBanner.classList.add('hidden');
      }, duration);
    }
  }

  function hideAlert() {
    alertBanner.classList.add('hidden');
  }

  // Platform Detection
  function detectPlatform(url) {
    if (!url) return { name: 'Unknown', type: 'other' };
    if (/youtube\.com\/shorts/i.test(url)) return { name: 'YouTube Short', type: 'youtube' };
    if (/youtube\.com\/watch|youtu\.be/i.test(url)) return { name: 'YouTube Video', type: 'youtube' };
    if (/instagram\.com\/reel/i.test(url)) return { name: 'Instagram Reel', type: 'instagram' };
    if (/instagram\.com\/p/i.test(url)) return { name: 'Instagram Post', type: 'instagram' };
    return { name: 'External Link', type: 'other' };
  }

  // Check backend server health
  async function checkServerHealth() {
    try {
      const res = await sendMessage('CHECK_HEALTH');
      if (res && res.success) {
        statusBadge.className = 'status-badge online';
        statusText.textContent = 'API Online';
        return true;
      }
    } catch {
      // offline
    }
    statusBadge.className = 'status-badge offline';
    statusText.textContent = 'API Offline';
    return false;
  }

  // Render Recent Saves
  function renderRecentSaves(recent) {
    if (!recent || recent.length === 0) {
      recentSavesList.innerHTML = '<div class="recent-empty">No recent saves yet</div>';
      return;
    }

    recentSavesList.innerHTML = recent.slice(0, 5).map(item => `
      <div class="recent-item">
        <span class="recent-item-title" title="${item.caption || item.url}">
          ${item.caption ? (item.caption.length > 36 ? item.caption.substring(0, 36) + '...' : item.caption) : item.url}
        </span>
        <span class="recent-item-col">${item.collectionName || 'Quick Save'}</span>
      </div>
    `).join('');
  }

  // Load collections into dropdown
  async function loadCollections() {
    try {
      const res = await sendMessage('GET_COLLECTIONS');
      if (res && res.success && Array.isArray(res.data)) {
        state.collections = res.data;
        const currentSelected = selectCollection.value;

        selectCollection.innerHTML = '<option value="">⚡ Quick Save (Default)</option>';
        res.data.forEach(col => {
          const opt = document.createElement('option');
          opt.value = col.id;
          opt.textContent = `${col.name} (${col.reelCount || 0})`;
          selectCollection.appendChild(opt);
        });

        if (currentSelected) {
          selectCollection.value = currentSelected;
        }
      }
    } catch (err) {
      console.warn('Failed to load collections:', err);
    }
  }

  // Update Active Tab Details
  async function inspectActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        videoTitle.textContent = 'No active tab detected';
        videoUrlInput.value = '';
        return;
      }

      state.activeTab = tab;
      const url = tab.url;
      const title = tab.title || 'Untitled Video';

      const platform = detectPlatform(url);
      platformName.textContent = platform.name;
      platformBadge.className = `platform-badge badge-${platform.type}`;

      videoTitle.textContent = title;
      videoUrlInput.value = url;

      // Check if already saved in ReelVault
      if (platform.type !== 'other' && state.settings.token) {
        try {
          const checkRes = await sendMessage('CHECK_REEL', { url });
          if (checkRes && checkRes.success && checkRes.data && checkRes.data.saved) {
            state.isSaved = true;
            const reel = checkRes.data.reel;
            saveStatusBadge.classList.remove('hidden');
            saveStatusBadge.textContent = `✓ In ${reel?.collectionName || 'Vault'}`;
            btnSave.classList.add('btn-secondary');
            btnSave.classList.remove('btn-primary');
            btnSaveLabel.textContent = 'Save Again';
          } else {
            state.isSaved = false;
            saveStatusBadge.classList.add('hidden');
            btnSave.classList.add('btn-primary');
            btnSave.classList.remove('btn-secondary');
            btnSaveLabel.textContent = 'Save to ReelVault';
          }
        } catch {
          // ignore check errors
        }
      }
    } catch (err) {
      console.warn('Failed to inspect tab:', err);
    }
  }

  // Switch Views
  function showView(viewName) {
    viewLogin.classList.add('hidden');
    viewMain.classList.add('hidden');
    viewSettings.classList.add('hidden');

    if (viewName === 'login') {
      viewLogin.classList.remove('hidden');
    } else if (viewName === 'settings') {
      viewSettings.classList.remove('hidden');
    } else {
      viewMain.classList.remove('hidden');
    }
  }

  // Update Profile Info
  function updateProfileUI(user) {
    if (!user) return;
    const displayName = user.name || user.username || 'User';
    profileName.textContent = displayName;
    profileUsername.textContent = `@${user.username || 'user'}`;
    avatarInitial.textContent = displayName.charAt(0).toUpperCase();
  }

  // Initialize Extension
  async function init() {
    try {
      const res = await sendMessage('GET_SETTINGS');
      state.settings = res?.data || {};

      // Fill settings form values
      if (state.settings.apiUrl) {
        loginApiUrl.value = state.settings.apiUrl;
        settingsApiUrl.value = state.settings.apiUrl;
      }
      if (state.settings.webUrl) {
        settingsWebUrl.value = state.settings.webUrl;
      }

      renderRecentSaves(state.settings.recentSaves);
      checkServerHealth();

      if (!state.settings.token) {
        showView('login');
      } else {
        updateProfileUI(state.settings.user);
        showView('main');
        await loadCollections();
        await inspectActiveTab();
      }
    } catch (err) {
      showAlert('Initialization error: ' + err.message, 'error');
    }
  }

  // Event Listeners

  // Toggle Settings View
  btnToggleSettings.addEventListener('click', () => {
    if (viewSettings.classList.contains('hidden')) {
      showView('settings');
    } else {
      showView(state.settings?.token ? 'main' : 'login');
    }
  });

  btnCloseSettings.addEventListener('click', () => {
    showView(state.settings?.token ? 'main' : 'login');
  });

  // Login Form Submit
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const usernameOrEmail = loginUsername.value.trim();
    const password = loginPassword.value;
    const apiUrl = loginApiUrl.value.trim();

    const submitBtn = document.getElementById('btn-login-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const res = await sendMessage('LOGIN', { usernameOrEmail, password, apiUrl });
      if (res && res.success) {
        state.settings.token = res.data.token;
        state.settings.user = res.data.user;
        updateProfileUI(res.data.user);
        showAlert('Signed in successfully!', 'success');
        showView('main');
        await checkServerHealth();
        await loadCollections();
        await inspectActiveTab();
      } else {
        showAlert(res.error || 'Login failed', 'error');
      }
    } catch (err) {
      showAlert(err.message || 'Login request failed. Ensure ReelVault backend is running.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In to ReelVault';
    }
  });

  // Save Settings
  btnSaveSettings.addEventListener('click', async () => {
    const apiUrl = settingsApiUrl.value.trim();
    const webUrl = settingsWebUrl.value.trim();

    try {
      await sendMessage('SAVE_SETTINGS', { apiUrl, webUrl });
      state.settings.apiUrl = apiUrl;
      state.settings.webUrl = webUrl;
      showAlert('Settings updated!', 'success');
      await checkServerHealth();
    } catch (err) {
      showAlert('Failed to save settings: ' + err.message, 'error');
    }
  });

  // Logout
  btnLogout.addEventListener('click', async () => {
    try {
      await sendMessage('LOGOUT');
      state.settings.token = null;
      state.settings.user = null;
      showAlert('Logged out', 'info');
      showView('login');
    } catch (err) {
      showAlert('Logout error: ' + err.message, 'error');
    }
  });

  // Open Web App
  btnOpenDashboard.addEventListener('click', () => {
    sendMessage('OPEN_WEB');
  });

  linkOpenRegister.addEventListener('click', (e) => {
    e.preventDefault();
    sendMessage('OPEN_WEB');
  });

  // Inline Create Collection
  btnNewCollection.addEventListener('click', () => {
    inlineCreateCol.classList.remove('hidden');
    newColNameInput.focus();
  });

  btnCancelNewCol.addEventListener('click', () => {
    inlineCreateCol.classList.add('hidden');
    newColNameInput.value = '';
  });

  btnSaveNewCol.addEventListener('click', async () => {
    const name = newColNameInput.value.trim();
    if (!name) return;

    btnSaveNewCol.disabled = true;
    try {
      const res = await sendMessage('CREATE_COLLECTION', { name });
      if (res && res.success) {
        inlineCreateCol.classList.add('hidden');
        newColNameInput.value = '';
        await loadCollections();
        selectCollection.value = res.data.id;
        showAlert(`Collection "${name}" created!`, 'success');
      } else {
        showAlert(res.error || 'Failed to create collection', 'error');
      }
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      btnSaveNewCol.disabled = false;
    }
  });

  // Save Video Button
  btnSave.addEventListener('click', async () => {
    const url = videoUrlInput.value.trim();
    if (!url) {
      showAlert('Please enter or navigate to a video URL', 'error');
      return;
    }

    const collectionId = selectCollection.value || null;

    btnSave.disabled = true;
    btnSaveLabel.textContent = 'Saving to Vault...';

    try {
      const res = await sendMessage('SAVE_VIDEO', { url, collectionId });
      if (res && res.success) {
        const reel = res.data;
        const colName = reel.collectionName || 'Quick Save';

        btnSaveLabel.textContent = `✓ Saved to ${colName}`;
        btnSave.classList.remove('btn-primary');
        btnSave.classList.add('btn-secondary');

        saveStatusBadge.classList.remove('hidden');
        saveStatusBadge.textContent = `✓ In ${colName}`;

        showAlert(`Video saved to "${colName}"! Transcribing in background 🚀`, 'success', 5000);

        // Refresh settings to get updated recent saves
        const sRes = await sendMessage('GET_SETTINGS');
        if (sRes?.data?.recentSaves) {
          renderRecentSaves(sRes.data.recentSaves);
        }
      } else {
        if (res.status === 401) {
          showAlert('Session expired. Please log in again.', 'error');
          showView('login');
        } else if (res.error && res.error.toLowerCase().includes('already saved')) {
          showAlert('This video is already in this collection! ✓', 'info');
        } else {
          showAlert(res.error || 'Could not save video', 'error');
        }
      }
    } catch (err) {
      showAlert(err.message || 'Save request failed', 'error');
    } finally {
      btnSave.disabled = false;
    }
  });

  // URL Input Change (Re-check status if user types a URL)
  let urlDebounce = null;
  videoUrlInput.addEventListener('input', () => {
    clearTimeout(urlDebounce);
    urlDebounce = setTimeout(async () => {
      const url = videoUrlInput.value.trim();
      const platform = detectPlatform(url);
      platformName.textContent = platform.name;
      platformBadge.className = `platform-badge badge-${platform.type}`;

      if (platform.type !== 'other' && state.settings?.token) {
        try {
          const checkRes = await sendMessage('CHECK_REEL', { url });
          if (checkRes?.data?.saved) {
            saveStatusBadge.classList.remove('hidden');
            saveStatusBadge.textContent = `✓ In ${checkRes.data.reel?.collectionName || 'Vault'}`;
          } else {
            saveStatusBadge.classList.add('hidden');
          }
        } catch {
          // ignore
        }
      }
    }, 500);
  });

  // Start initialization
  init();
});
