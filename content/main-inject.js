// YouTube Danmaku Translator - Main Page Injection Script
// Creates the floating panel for user danmaku input and translation
// Only runs on the top-level YouTube page (all_frames: false)

(function () {
  'use strict';

  // Guard against double injection
  if (window.__dt_panel_loaded) return;
  window.__dt_panel_loaded = true;

  // ---- Settings ----
  let settings = {
    api: 'google',
    targetLang: 'en',
    enabled: true,
    panelCollapsed: false,
    panelX: null,
    panelY: null
  };

  // ---- State ----
  let panel = null;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panelStartLeft = 0;
  let panelStartTop = 0;

  // ---- Init ----
  loadSettings().then(() => {
    createFloatingPanel();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.settings) {
      settings = { ...settings, ...changes.settings.newValue };
      // Update panel UI if needed
      updatePanelState();
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

  // ---- Panel Creation ----
  function createFloatingPanel() {
    // Don't create panel if it exists
    if (document.getElementById('dt-floating-panel')) return;

    panel = document.createElement('div');
    panel.id = 'dt-floating-panel';
    panel.innerHTML = `
      <div id="dt-panel-header">
        <span>Danmaku Translator</span>
        <div class="dt-header-buttons">
          <button class="dt-header-btn" id="dt-minimize-btn" title="Minimize">_</button>
          <button class="dt-header-btn" id="dt-close-btn" title="Close">X</button>
        </div>
      </div>
      <div id="dt-panel-body">
        <textarea id="dt-input" placeholder="Type your danmaku here..." rows="3"></textarea>
        <div id="dt-controls">
          <select id="dt-target-lang"></select>
          <button id="dt-translate-btn">Translate</button>
        </div>
        <div id="dt-translation-output"></div>
        <button id="dt-send-btn" disabled>Send to Chat</button>
      </div>
    `;

    document.body.appendChild(panel);

    // Populate language selector
    populateLanguageSelector();

    // Restore saved position
    restorePosition();

    // Apply collapsed state
    if (settings.panelCollapsed) {
      togglePanel(true);
    }

    // Wire up events
    wirePanelEvents();
  }

  function populateLanguageSelector() {
    const select = document.getElementById('dt-target-lang');
    if (!select) return;

    const langs = [
      { code: 'en',    name: 'English' },
      { code: 'zh-CN', name: 'Chinese (Simp.)' },
      { code: 'zh-TW', name: 'Chinese (Trad.)' },
      { code: 'ja',    name: 'Japanese' },
      { code: 'ko',    name: 'Korean' },
      { code: 'es',    name: 'Spanish' },
      { code: 'fr',    name: 'French' },
      { code: 'de',    name: 'German' },
      { code: 'pt',    name: 'Portuguese' },
      { code: 'ru',    name: 'Russian' },
      { code: 'ar',    name: 'Arabic' },
      { code: 'hi',    name: 'Hindi' },
      { code: 'th',    name: 'Thai' },
      { code: 'vi',    name: 'Vietnamese' },
      { code: 'id',    name: 'Indonesian' },
      { code: 'tr',    name: 'Turkish' },
      { code: 'it',    name: 'Italian' },
      { code: 'nl',    name: 'Dutch' },
      { code: 'pl',    name: 'Polish' },
      { code: 'uk',    name: 'Ukrainian' }
    ];

    langs.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.name;
      if (lang.code === settings.targetLang) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  // ---- Event Wiring ----
  function wirePanelEvents() {
    // Dragging
    const header = document.getElementById('dt-panel-header');
    header.addEventListener('mousedown', onDragStart);

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);

    // Buttons
    document.getElementById('dt-minimize-btn').addEventListener('click', () => togglePanel());
    document.getElementById('dt-close-btn').addEventListener('click', hidePanel);
    document.getElementById('dt-translate-btn').addEventListener('click', translateUserInput);
    document.getElementById('dt-send-btn').addEventListener('click', sendToChat);

    // Enter key in textarea for quick translate
    document.getElementById('dt-input').addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        translateUserInput();
      }
    });

    // Language selector change
    document.getElementById('dt-target-lang').addEventListener('change', function () {
      settings.targetLang = this.value;
      // Clear previous translation
      const output = document.getElementById('dt-translation-output');
      output.classList.remove('dt-visible');
      document.getElementById('dt-send-btn').disabled = true;
    });
  }

  // ---- Drag Logic ----
  function onDragStart(e) {
    if (e.target.tagName === 'BUTTON') return; // Don't drag on buttons
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = panel.getBoundingClientRect();
    panelStartLeft = rect.left;
    panelStartTop = rect.top;

    panel.style.transition = 'none';
    panel.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function onDragMove(e) {
    if (!isDragging) return;

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    let left = panelStartLeft + dx;
    let top = panelStartTop + dy;

    // Clamp to viewport
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;

    left = clamp(left, 0, window.innerWidth - panelWidth);
    top = clamp(top, 0, window.innerHeight - panelHeight);

    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    panel.style.cursor = '';
    panel.style.transition = '';

    // Save position
    const rect = panel.getBoundingClientRect();
    savePanelPosition(rect.left, rect.top);
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // ---- Panel Position Persistence ----
  function restorePosition() {
    // Use saved position or CSS default (bottom:100px, right:20px)
    if (settings.panelX !== null && settings.panelY !== null) {
      panel.style.left = settings.panelX + 'px';
      panel.style.top = settings.panelY + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    }
  }

  function savePanelPosition(x, y) {
    settings.panelX = x;
    settings.panelY = y;
    chrome.storage.sync.get(['settings'], (result) => {
      const current = result.settings || {};
      current.panelX = x;
      current.panelY = y;
      chrome.storage.sync.set({ settings: current });
    });
  }

  // ---- Panel Visibility ----
  function togglePanel(forceCollapse) {
    const body = document.getElementById('dt-panel-body');
    const btn = document.getElementById('dt-minimize-btn');
    const collapsed = forceCollapse !== undefined ? forceCollapse : !body.classList.contains('dt-collapsed');

    if (collapsed) {
      body.classList.add('dt-collapsed');
      btn.textContent = '+';
      panel.style.width = 'auto';
    } else {
      body.classList.remove('dt-collapsed');
      btn.textContent = '_';
      panel.style.width = '280px';
    }

    // Save state
    chrome.storage.sync.get(['settings'], (result) => {
      const current = result.settings || {};
      current.panelCollapsed = collapsed;
      chrome.storage.sync.set({ settings: current });
    });
  }

  function hidePanel() {
    panel.style.display = 'none';
    // Show a small restore button
    let restoreBtn = document.getElementById('dt-restore-btn');
    if (!restoreBtn) {
      restoreBtn = document.createElement('button');
      restoreBtn.id = 'dt-restore-btn';
      restoreBtn.textContent = 'DT';
      restoreBtn.title = 'Show Danmaku Translator';
      restoreBtn.style.cssText = `
        position: fixed; z-index: 99999; bottom: 20px; right: 20px;
        width: 40px; height: 40px; border-radius: 50%;
        background: #4a90d9; color: #fff; border: none;
        font-weight: bold; font-size: 12px; cursor: pointer;
        box-shadow: 0 2px 12px rgba(0,0,0,0.5);
      `;
      restoreBtn.addEventListener('click', showPanel);
      document.body.appendChild(restoreBtn);
    }
    restoreBtn.style.display = 'block';
  }

  function showPanel() {
    panel.style.display = '';
    const restoreBtn = document.getElementById('dt-restore-btn');
    if (restoreBtn) restoreBtn.style.display = 'none';
  }

  function updatePanelState() {
    const langSelect = document.getElementById('dt-target-lang');
    if (langSelect && langSelect.value !== settings.targetLang) {
      langSelect.value = settings.targetLang;
    }
  }

  // ---- Translation ----
  function translateUserInput() {
    const input = document.getElementById('dt-input');
    const output = document.getElementById('dt-translation-output');
    const sendBtn = document.getElementById('dt-send-btn');
    const translateBtn = document.getElementById('dt-translate-btn');
    const text = input.value.trim();

    if (!text) return;

    const targetLang = document.getElementById('dt-target-lang').value;

    // Show loading state
    translateBtn.disabled = true;
    translateBtn.textContent = '...';
    output.classList.add('dt-visible');
    output.textContent = 'Translating...';
    output.classList.remove('dt-error');

    chrome.runtime.sendMessage(
      {
        action: 'translate',
        text: text,
        sourceLang: 'auto',
        targetLang: targetLang,
        api: settings.api
      },
      (response) => {
        translateBtn.disabled = false;
        translateBtn.textContent = 'Translate';

        if (chrome.runtime.lastError) {
          output.textContent = 'Error: ' + chrome.runtime.lastError.message;
          output.classList.add('dt-error');
          return;
        }

        if (response && response.success) {
          output.textContent = response.translatedText;
          output.classList.remove('dt-error');
          sendBtn.disabled = false;

          // Store translated text for sending
          output.setAttribute('data-translated-text', response.translatedText);
        } else {
          output.textContent = 'Translation failed: ' + (response?.error || 'Unknown error');
          output.classList.add('dt-error');
          sendBtn.disabled = true;
        }
      }
    );
  }

  // ---- Send to YouTube Chat ----
  function sendToChat() {
    const output = document.getElementById('dt-translation-output');
    const translatedText = output.getAttribute('data-translated-text');

    if (!translatedText) return;

    // Try to find the YouTube chat input
    // YouTube chat input is a contenteditable div inside various containers
    const inputSelectors = [
      '#input-panel #input',
      'yt-live-chat-message-input-renderer #input',
      '#input.yt-live-chat-message-input-renderer',
      'div#input[contenteditable]',
      'yt-live-chat-message-input-renderer div#input',
      '#chat-input',
      '#input-panel yt-live-chat-message-input-renderer #input'
    ];

    let chatInput = null;
    for (const selector of inputSelectors) {
      chatInput = document.querySelector(selector);
      if (chatInput) break;
    }

    if (!chatInput) {
      // Try finding by contenteditable attribute
      const editables = document.querySelectorAll('[contenteditable="true"]');
      for (const el of editables) {
        if (el.closest('#input-panel') || el.closest('yt-live-chat-message-input-renderer')) {
          chatInput = el;
          break;
        }
      }
    }

    if (!chatInput) {
      alert('Cannot find YouTube chat input. Make sure the chat panel is open.');
      return;
    }

    // Set text (YouTube uses contenteditable div)
    chatInput.focus();
    chatInput.textContent = translatedText;

    // Dispatch input event (YouTube/React listens for this)
    chatInput.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: translatedText
    }));

    // Find and click send button
    setTimeout(() => {
      const sendSelectors = [
        '#send-button button',
        'yt-live-chat-message-input-renderer #send-button button',
        '#send-button yt-icon-button',
        '#send-button',
        'button[aria-label="Send"]',
        'yt-live-chat-message-input-renderer yt-icon-button#send-button'
      ];

      let sendBtn = null;
      for (const selector of sendSelectors) {
        sendBtn = document.querySelector(selector);
        if (sendBtn) break;
      }

      if (!sendBtn) {
        // Try finding by common send button patterns
        const buttons = document.querySelectorAll('#input-panel button, yt-live-chat-message-input-renderer button');
        for (const btn of buttons) {
          if (btn.getAttribute('aria-label')?.toLowerCase().includes('send')) {
            sendBtn = btn;
            break;
          }
        }
      }

      if (sendBtn) {
        sendBtn.click();
      }

      // Clear input
      document.getElementById('dt-input').value = '';
      document.getElementById('dt-translation-output').classList.remove('dt-visible');
      document.getElementById('dt-send-btn').disabled = true;
    }, 100);
  }

  console.log('[DT] Main inject script loaded');
})();
