// YouTube Danmaku Translator - Chat Injection Script
// Injected into all YouTube frames (all_frames: true in manifest)
// Detects chat iframe context and translates danmaku messages

(function () {
  'use strict';

  // Guard against missing chrome.runtime (extension not loaded / page not refreshed)
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.warn('[DT] chrome.runtime not available');
    return;
  }

  // Only run in chat iframe context
  const isChatFrame =
    window.location.href.includes('/live_chat') ||
    window.location.href.includes('/live_chat_replay');

  if (!isChatFrame) return;

  // Guard against double injection
  if (window.__dt_chat_loaded) return;
  window.__dt_chat_loaded = true;

  // ---- Configuration (synced from storage) ----
  let settings = {
    api: 'index-translate',
    indexEndpoint: '',
    targetLang: 'zh-CN',
    enabled: true,
    displayMode: 'inline',
    fontSize: 11
  };

  // ---- State ----
  const translatedMessages = new Set();
  const pendingTranslations = new Map(); // text -> Promise
  let observer = null;
  let retryCount = 0;
  const MAX_RETRIES = 5;

  // ---- Message selectors ----
  const MESSAGE_SELECTORS = [
    'yt-live-chat-text-message-renderer',
    'yt-live-chat-paid-message-renderer',
    'yt-live-chat-paid-sticker-renderer',
    'yt-live-chat-membership-item-renderer'
  ];

  const CHAT_CONTAINER_SELECTORS = [
    'yt-live-chat-item-list-renderer #items',
    '#items',
    '#item-list',
    'yt-live-chat-item-list-renderer'
  ];

  // ---- Init ----
  loadSettings().then(() => {
    if (settings.enabled) {
      initDanmakuTranslation();
    }
  });

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.settings) {
      const wasEnabled = settings.enabled;
      settings = { ...settings, ...changes.settings.newValue };
      applySettings();

      if (!wasEnabled && settings.enabled) {
        initDanmakuTranslation();
      } else if (wasEnabled && !settings.enabled) {
        destroyObserver();
      }
    }
  });

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['settings'], (result) => {
        if (result.settings) {
          settings = { ...settings, ...result.settings };
        }
        resolve();
      });
    });
  }

  // ---- Main translation logic ----
  function initDanmakuTranslation() {
    const container = findChatContainer();
    if (!container) {
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(initDanmakuTranslation, 1500);
      }
      return;
    }

    retryCount = 0;

    // Process existing messages
    processExistingMessages(container);

    // Observe new messages
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              processMessageNode(node);
            }
          }
        }
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: false
    });

    console.log('[DT] Danmaku translation active, target:', settings.targetLang);
  }

  function findChatContainer() {
    for (const selector of CHAT_CONTAINER_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function processExistingMessages(container) {
    // Check direct children
    for (const child of container.children) {
      processMessageNode(child);
    }
    // Also query-select for any renderers nested deeper
    for (const selector of MESSAGE_SELECTORS) {
      const elements = container.querySelectorAll(selector);
      for (const el of elements) {
        processMessageNode(el);
      }
    }
  }

  function processMessageNode(node) {
    // Check if this node is a message renderer
    const tagName = node.tagName ? node.tagName.toLowerCase() : '';
    const isMessageRenderer = MESSAGE_SELECTORS.some(s =>
      tagName === s || node.matches?.(s)
    );

    if (!isMessageRenderer && node.querySelectorAll) {
      // Check for nested message renderers
      for (const selector of MESSAGE_SELECTORS) {
        const nested = node.matches?.(selector) ? [node] : node.querySelectorAll(selector);
        for (const msg of nested) {
          translateMessageElement(msg);
        }
      }
      return;
    }

    if (isMessageRenderer) {
      translateMessageElement(node);
    }
  }

  function translateMessageElement(el) {
    // Skip if already processed
    if (el.hasAttribute('data-dt-translated')) return;

    // Find the message text element
    const messageEl = el.querySelector('#message') || el.querySelector('#content');
    if (!messageEl) return;

    const originalText = messageEl.textContent.trim();
    if (!originalText || isOnlyEmojiOrNumbers(originalText)) {
      el.setAttribute('data-dt-translated', 'true');
      return;
    }

    // Mark as processing
    el.setAttribute('data-dt-translated', 'processing');

    // Deduplicate: check pending translations
    if (pendingTranslations.has(originalText)) {
      pendingTranslations.get(originalText).then((translatedText) => {
        appendTranslation(el, messageEl, translatedText);
      });
      return;
    }

    // Send to service worker for translation
    const translationPromise = requestTranslation(originalText);
    pendingTranslations.set(originalText, translationPromise);

    translationPromise.then((result) => {
      appendTranslation(el, messageEl, result);
      // Cleanup old pending entries periodically
      if (pendingTranslations.size > 200) {
        pendingTranslations.clear();
      }
    }).catch(() => {
      el.setAttribute('data-dt-translated', 'true');
    });
  }

  function requestTranslation(text) {
    // Index-Translate is called from the page context on purpose: the free public
    // gateway rejects requests originating from the extension itself
    // (Origin: chrome-extension:// -> HTTP 412).
    if (typeof self.isIndexTranslateApi === 'function' && self.isIndexTranslateApi(settings.api)) {
      return self.indexTranslate(text, settings.targetLang, 'auto', {
        api: settings.api,
        endpoint: settings.indexEndpoint
      }).then((result) => result.translatedText).catch((err) => {
        console.warn('[DT] Index-Translate unavailable, falling back to other APIs:', err.message);
        return requestViaServiceWorker(text);
      });
    }

    return requestViaServiceWorker(text);
  }

  function requestViaServiceWorker(text) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: 'translate',
          text: text,
          sourceLang: 'auto',
          targetLang: settings.targetLang,
          // The service worker has no Index-Translate case: it runs its normal
          // failover chain (Google -> MyMemory -> LibreTranslate -> Youdao).
          api: settings.api
        },
        (response) => {
          if (chrome.runtime.lastError) {
            // Runtime error: resolve with original so it never rejects
            resolve(text);
            return;
          }
          if (response && response.success) {
            resolve(response.translatedText);
          } else {
            // All APIs failed: resolve with original text as fallback
            resolve(text);
          }
        }
      );
    });
  }

  function appendTranslation(messageEl, originalEl, translatedText) {
    messageEl.setAttribute('data-dt-translated', 'true');

    // Remove existing translation if any
    const existing = messageEl.querySelector('.dt-translation');
    if (existing) existing.remove();

    // Create translation element
    const tlDiv = document.createElement('div');
    tlDiv.className = 'dt-translation';

    // Apply display mode class
    if (settings.displayMode === 'tooltip') {
      tlDiv.classList.add('dt-tooltip');
    } else if (settings.displayMode === 'replace') {
      tlDiv.classList.add('dt-replace');
    }

    tlDiv.style.fontSize = settings.fontSize + 'px';
    tlDiv.textContent = translatedText;

    // Insert after the message content
    if (originalEl.parentNode) {
      originalEl.parentNode.insertBefore(tlDiv, originalEl.nextSibling);
    }
  }

  function destroyObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    // Remove all translations
    document.querySelectorAll('.dt-translation').forEach(el => el.remove());
    document.querySelectorAll('[data-dt-translated]').forEach(el => {
      el.removeAttribute('data-dt-translated');
    });
  }

  function applySettings() {
    // Update existing translation elements
    document.querySelectorAll('.dt-translation').forEach(el => {
      el.style.fontSize = settings.fontSize + 'px';
      el.classList.remove('dt-tooltip', 'dt-replace');
      if (settings.displayMode === 'tooltip') {
        el.classList.add('dt-tooltip');
      } else if (settings.displayMode === 'replace') {
        el.classList.add('dt-replace');
      }
    });
  }

  // ---- Utility ----
  function isOnlyEmojiOrNumbers(text) {
    if (!text || !text.trim()) return true;
    const stripped = text.replace(/[\s\d\p{P}\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
    return stripped.length === 0;
  }

  console.log('[DT] Chat inject script loaded');
})();
