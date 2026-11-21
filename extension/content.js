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

  // Save button click handler
  async function handleSaveClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (saveButton.classList.contains('is-loading')) return;

    const url = window.location.href;
    setButtonState('loading', 'Saving video...');

    chrome.runtime.sendMessage(
      { action: 'SAVE_VIDEO', payload: { url } },
      (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          const errorMsg = response?.error || chrome.runtime.lastError?.message || 'Could not save video';
          setButtonState('ready');

          if (response?.status === 401) {
            showToast(
              'Sign In Required',
              'Please click the ReelVault extension icon in your toolbar to log in first.',
              false,
              'Click to open settings'
            );
          } else if (errorMsg.toLowerCase().includes('already saved')) {
            setButtonState('saved', 'In ReelVault');
            showToast('Already Saved', 'This video is already saved in your collection.', true);
          } else {
            showToast('Save Failed', errorMsg, false, null);
          }
          return;
        }

        const data = response.data;
        const colName = data?.collectionName || 'Quick Save';
        setButtonState('saved', `Saved to ${colName}`);
        showToast(
          'Saved to ReelVault! 🚀',
          `Added to "${colName}". Transcribing and AI tags in progress.`,
          true
        );
      }
    );
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
