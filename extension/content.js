// ReelVault Content Script
// Injected into YouTube and Instagram pages to provide quick saving

(function () {
  'use strict';

  let currentUrl = window.location.href;
  let saveButton = null;
  let toastContainer = null;

  // Check if current page is a video page
  function isVideoPage() {
    const url = window.location.href;
    const isYtWatch = /youtube\.com\/watch\?.*v=/i.test(url);
    const isYtShort = /youtube\.com\/shorts\//i.test(url);
    const isYtuBe = /youtu\.be\//i.test(url);
    const isIgReel = /instagram\.com\/(?:reel|reels|p)\//i.test(url);
    return isYtWatch || isYtShort || isYtuBe || isIgReel;
  }

  // Ensure toast container exists
  function getToastContainer() {
    if (!toastContainer || !document.body.contains(toastContainer)) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'reelvault-toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  // Display a toast message on screen
  function showToast(title, message, isSuccess = true, linkText = 'Open in ReelVault') {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = 'reelvault-toast';

    const iconHtml = isSuccess
      ? `<svg class="reelvault-toast-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`
      : `<svg class="reelvault-toast-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;

    toast.innerHTML = `
      ${iconHtml}
      <div class="reelvault-toast-content">
        <div class="reelvault-toast-title">${title}</div>
        <div class="reelvault-toast-body">${message}</div>
        ${linkText ? `<a class="reelvault-toast-link">${linkText} &rarr;</a>` : ''}
      </div>
      <button class="reelvault-toast-close">&times;</button>
    `;

    // Click handler for link
    const link = toast.querySelector('.reelvault-toast-link');
    if (link) {
      link.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'OPEN_WEB' });
      });
    }

    // Click handler for close
    const closeBtn = toast.querySelector('.reelvault-toast-close');
    closeBtn.addEventListener('click', () => {
      toast.classList.add('is-hiding');
      setTimeout(() => toast.remove(), 300);
    });

    container.appendChild(toast);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.classList.add('is-hiding');
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);
  }

  // Create or update the floating save button
  function renderSaveButton() {
    if (!isVideoPage()) {
      if (saveButton && document.body.contains(saveButton)) {
        saveButton.remove();
        saveButton = null;
      }
      return;
    }

    if (!saveButton || !document.body.contains(saveButton)) {
      saveButton = document.createElement('button');
      saveButton.id = 'reelvault-save-btn';
      saveButton.className = 'reelvault-floating-save-btn';
      saveButton.setAttribute('title', 'Save this video directly to ReelVault (Alt+Shift+S)');
      
      saveButton.addEventListener('click', handleSaveClick);
      document.body.appendChild(saveButton);
    }

    // Set initial loading state and check if already saved
    checkCurrentVideoStatus();
  }

  // Set button state
  function setButtonState(state, customLabel = null) {
    if (!saveButton) return;

    saveButton.classList.remove('is-saved', 'is-loading');

    if (state === 'saved') {
      saveButton.classList.add('is-saved');
      saveButton.innerHTML = `
        <svg class="reelvault-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
        <span>${customLabel || 'In ReelVault'}</span>
      `;
    } else if (state === 'loading') {
      saveButton.classList.add('is-loading');
      saveButton.innerHTML = `
        <div class="reelvault-spinner"></div>
        <span>${customLabel || 'Saving...'}</span>
      `;
    } else {
      saveButton.innerHTML = `
        <svg class="reelvault-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        <span>${customLabel || 'Save to ReelVault'}</span>
      `;
    }
  }

  // Check if current URL is already in ReelVault
  function checkCurrentVideoStatus() {
    setButtonState('ready');

    chrome.runtime.sendMessage(
      { action: 'CHECK_REEL', payload: { url: window.location.href } },
      (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.success && response.data && response.data.saved) {
          const colName = response.data.reel?.collectionName;
          setButtonState('saved', colName ? `In ${colName}` : 'In ReelVault');
        } else {
          setButtonState('ready');
        }
      }
    );
  }

  let floatingPopup = null;

  function closeFloatingPopup() {
    if (floatingPopup && document.body.contains(floatingPopup)) {
      floatingPopup.remove();
    }
    floatingPopup = null;
  }

  function detectPlatform(url) {
    if (!url) return { name: 'Video', type: 'other' };
    if (/youtube\.com\/shorts/i.test(url)) return { name: 'YouTube Short', type: 'youtube' };
    if (/youtube\.com\/watch|youtu\.be/i.test(url)) return { name: 'YouTube Video', type: 'youtube' };
    if (/instagram\.com\/reel/i.test(url)) return { name: 'Instagram Reel', type: 'instagram' };
    if (/instagram\.com\/p/i.test(url)) return { name: 'Instagram Post', type: 'instagram' };
    return { name: 'Video', type: 'other' };
  }

  // Open the Floating Save & Collection Selector Window
  async function openSavePopup() {
    if (floatingPopup) {
      closeFloatingPopup();
      return;
    }

    const currentVideoUrl = window.location.href;
    const platform = detectPlatform(currentVideoUrl);
    const pageTitle = document.title || 'Saved Video';

    floatingPopup = document.createElement('div');
    floatingPopup.className = 'reelvault-floating-popup';
    floatingPopup.addEventListener('click', (e) => e.stopPropagation());

    floatingPopup.innerHTML = `
      <div class="reelvault-popup-header">
        <div class="reelvault-popup-title">
          <svg class="reelvault-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          <span>Save to ReelVault</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="reelvault-popup-platform-badge">${platform.name}</span>
          <button class="reelvault-popup-close-btn" id="rv-popup-close" title="Close">&times;</button>
        </div>
      </div>

      <div class="reelvault-video-preview">
        <div class="reelvault-video-preview-title" title="${pageTitle}">${pageTitle}</div>
        <div class="reelvault-video-preview-url">${currentVideoUrl}</div>
      </div>

      <div id="rv-popup-body">
        <div style="text-align:center;padding:12px;color:#94a3b8;font-size:12px;">
          <div class="reelvault-spinner" style="margin:0 auto 8px auto;"></div>
          Loading your collections...
        </div>
      </div>
    `;

    document.body.appendChild(floatingPopup);

    // Close button
    const closeBtn = floatingPopup.querySelector('#rv-popup-close');
    closeBtn.addEventListener('click', closeFloatingPopup);

    // Escape listener & outside click listener
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeFloatingPopup();
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('pointerdown', onPointerDown);
      }
    };
    const onPointerDown = (e) => {
      if (floatingPopup && !floatingPopup.contains(e.target) && !saveButton?.contains(e.target)) {
        closeFloatingPopup();
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('pointerdown', onPointerDown);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    setTimeout(() => document.addEventListener('pointerdown', onPointerDown), 50);

    // Fetch settings to check authentication
    chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (settingsRes) => {
      if (chrome.runtime.lastError || !settingsRes?.data?.token) {
        renderSignInRequired();
        return;
      }

      // Fetch collections
      chrome.runtime.sendMessage({ action: 'GET_COLLECTIONS' }, (colRes) => {
        const collections = (colRes && colRes.success && Array.isArray(colRes.data)) ? colRes.data : [];
        renderCollectionSelector(collections);
      });
    });

    function renderSignInRequired() {
      const body = floatingPopup.querySelector('#rv-popup-body');
      if (!body) return;
      body.innerHTML = `
        <div class="reelvault-alert reelvault-alert-info">
          <span>🔒 Please sign in to ReelVault to organize and save your reels.</span>
        </div>
        <p style="font-size:12px;color:#94a3b8;margin:8px 0 12px 0;line-height:1.4;">
          Open the ReelVault extension from your Chrome toolbar or visit the web app to log in.
        </p>
        <div class="reelvault-popup-footer">
          <button class="reelvault-btn-cancel" id="rv-btn-dismiss">Dismiss</button>
          <button class="reelvault-btn-save" id="rv-btn-open-app">Open Web App</button>
        </div>
      `;
      body.querySelector('#rv-btn-dismiss')?.addEventListener('click', closeFloatingPopup);
      body.querySelector('#rv-btn-open-app')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'OPEN_WEB' });
        closeFloatingPopup();
      });
    }

    function renderCollectionSelector(collections) {
      const body = floatingPopup.querySelector('#rv-popup-body');
      if (!body) return;

      const optionsHtml = collections.map((c) =>
        `<option value="${c.id}">${c.name} (${c.reelCount || 0})</option>`
      ).join('');

      body.innerHTML = `
        <div id="rv-error-banner" class="reelvault-alert reelvault-alert-error" style="display:none;"></div>

        <div class="reelvault-field-group">
          <div class="reelvault-field-header">
            <span class="reelvault-field-label">Save To Collection</span>
            <button type="button" class="reelvault-btn-link" id="rv-toggle-new-col">+ New Collection</button>
          </div>
          <select class="reelvault-select" id="rv-select-col">
            <option value="">⚡ Quick Save (Default)</option>
            ${optionsHtml}
          </select>
        </div>

        <!-- Inline New Collection Form (hidden initially) -->
        <div id="rv-new-col-box" class="reelvault-create-col-box" style="display:none;">
          <input type="text" id="rv-new-col-name" class="reelvault-input" placeholder="New collection name (e.g. Recipes, Workout)" />
          <input type="text" id="rv-new-col-desc" class="reelvault-input" placeholder="Description (optional)" />
          <div class="reelvault-create-actions">
            <button type="button" class="reelvault-btn-sm reelvault-btn-sm-secondary" id="rv-cancel-new-col">Cancel</button>
            <button type="button" class="reelvault-btn-sm reelvault-btn-sm-primary" id="rv-save-new-col">Create</button>
          </div>
        </div>

        <div class="reelvault-popup-footer">
          <button type="button" class="reelvault-btn-cancel" id="rv-btn-cancel">Cancel</button>
          <button type="button" class="reelvault-btn-save" id="rv-btn-save">
            <svg class="reelvault-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            <span id="rv-save-label">Save Reel</span>
          </button>
        </div>
      `;

      const selectCol = body.querySelector('#rv-select-col');
      const toggleNewBtn = body.querySelector('#rv-toggle-new-col');
      const newColBox = body.querySelector('#rv-new-col-box');
      const newColName = body.querySelector('#rv-new-col-name');
      const newColDesc = body.querySelector('#rv-new-col-desc');
      const cancelNewBtn = body.querySelector('#rv-cancel-new-col');
      const saveNewBtn = body.querySelector('#rv-save-new-col');
      const cancelBtn = body.querySelector('#rv-btn-cancel');
      const saveBtn = body.querySelector('#rv-btn-save');
      const saveLabel = body.querySelector('#rv-save-label');
      const errorBanner = body.querySelector('#rv-error-banner');

      function showError(msg) {
        errorBanner.textContent = msg;
        errorBanner.style.display = 'flex';
      }

      function hideError() {
        errorBanner.style.display = 'none';
        errorBanner.textContent = '';
      }

      toggleNewBtn.addEventListener('click', () => {
        const isHidden = newColBox.style.display === 'none';
        newColBox.style.display = isHidden ? 'flex' : 'none';
        toggleNewBtn.textContent = isHidden ? 'Select Existing' : '+ New Collection';
        if (isHidden) newColName.focus();
      });

      cancelNewBtn.addEventListener('click', () => {
        newColBox.style.display = 'none';
        toggleNewBtn.textContent = '+ New Collection';
        newColName.value = '';
        newColDesc.value = '';
      });

      saveNewBtn.addEventListener('click', () => {
        const name = newColName.value.trim();
        if (!name) {
          showError('Collection name is required');
          return;
        }

        saveNewBtn.disabled = true;
        saveNewBtn.textContent = 'Creating...';
        hideError();

        chrome.runtime.sendMessage(
          { action: 'CREATE_COLLECTION', payload: { name, description: newColDesc.value.trim() } },
          (res) => {
            saveNewBtn.disabled = false;
            saveNewBtn.textContent = 'Create';

            if (chrome.runtime.lastError || !res || !res.success) {
              showError(res?.error || 'Failed to create collection');
              return;
            }

            const created = res.data;
            const newOption = document.createElement('option');
            newOption.value = created.id;
            newOption.textContent = `${created.name} (0)`;
            selectCol.appendChild(newOption);
            selectCol.value = created.id;

            newColBox.style.display = 'none';
            toggleNewBtn.textContent = '+ New Collection';
            newColName.value = '';
            newColDesc.value = '';
          }
        );
      });

      cancelBtn.addEventListener('click', closeFloatingPopup);

      saveBtn.addEventListener('click', () => {
        const selectedCollectionId = selectCol.value || null;
        const selectedColName = selectCol.options[selectCol.selectedIndex]?.text.replace(/\s*\(\d+\)$/, '') || 'Quick Save';

        saveBtn.disabled = true;
        saveLabel.textContent = 'Saving...';
        setButtonState('loading', 'Saving...');
        hideError();

        chrome.runtime.sendMessage(
          { action: 'SAVE_VIDEO', payload: { url: currentVideoUrl, collectionId: selectedCollectionId } },
          (response) => {
            if (chrome.runtime.lastError || !response || !response.success) {
              saveBtn.disabled = false;
              saveLabel.textContent = 'Save Reel';
              setButtonState('ready');

              const errorMsg = response?.error || chrome.runtime.lastError?.message || 'Could not save video';
              if (response?.status === 401) {
                showError('Session expired. Please sign in via the extension.');
              } else if (errorMsg.toLowerCase().includes('already saved')) {
                setButtonState('saved', `In ${selectedColName}`);
                showToast('Already Saved', `This reel is already in "${selectedColName}".`, true);
                closeFloatingPopup();
              } else {
                showError(errorMsg);
              }
              return;
            }

            const data = response.data;
            const finalColName = data?.collectionName || selectedColName || 'Quick Save';

            closeFloatingPopup();
            setButtonState('saved', `Saved to ${finalColName}`);
            showToast(
              'Saved to ReelVault! 🚀',
              `Added to "${finalColName}". Transcribing & AI enrichment in progress.`,
              true
            );
          }
        );
      });
    }
  }

  // Floating save button click handler
  function handleSaveClick(e) {
    e.preventDefault();
    e.stopPropagation();
    openSavePopup();
  }

  // Initialize on page load
  renderSaveButton();

  // Handle SPA navigation events
  window.addEventListener('yt-navigate-finish', () => {
    currentUrl = window.location.href;
    renderSaveButton();
  });

  window.addEventListener('popstate', () => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      renderSaveButton();
    }
  });

  // Polling fallback for dynamic video player changes (e.g. scrolling through YouTube Shorts / Instagram Reels)
  setInterval(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      renderSaveButton();
    }
  }, 1000);
})();
