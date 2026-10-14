// YouTube Danmaku Translator - Popup Settings

const LANGUAGES = [
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'en',    name: 'English' },
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

const DEFAULTS = {
  api: 'index-translate',
  indexEndpoint: '',
  targetLang: 'zh-CN',
  enabled: true,
  displayMode: 'inline',
  fontSize: 11,
  panelCollapsed: false,
  panelX: null,
  panelY: null
};

// Base URLs used when the optional endpoint field is left blank.
const INDEX_ENDPOINT_PRESETS = {
  'index-translate': 'https://index-translate.bilibili.com/v1',
  'index-translate-proxy': 'http://127.0.0.1:8080/v1'
};

const INDEX_ENDPOINT_HINTS = {
  'index-translate': 'Calls the free bilibili gateway straight from the page. No setup needed.',
  'index-translate-proxy': 'Requires the local bridge: python inference/llm/call_api.py --serve'
};

function isIndexTranslateApi(api) {
  return api === 'index-translate' || api === 'index-translate-proxy';
}

let currentSettings = { ...DEFAULTS };

document.addEventListener('DOMContentLoaded', () => {
  populateLanguages();
  loadSettings();
  wireEvents();
});

function populateLanguages() {
  const select = document.getElementById('setting-target-lang');
  LANGUAGES.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    select.appendChild(option);
  });
}

function loadSettings() {
  chrome.storage.sync.get(['settings'], (result) => {
    if (result.settings) {
      currentSettings = { ...DEFAULTS, ...result.settings };
    }
    applySettingsToForm();
  });
}

function applySettingsToForm() {
  document.getElementById('setting-enabled').checked = currentSettings.enabled;
  document.getElementById('setting-api').value = currentSettings.api;
  document.getElementById('setting-target-lang').value = currentSettings.targetLang;
  document.getElementById('setting-display-mode').value = currentSettings.displayMode;
  document.getElementById('setting-font-size').value = currentSettings.fontSize;
  document.getElementById('font-size-value').textContent = currentSettings.fontSize + 'px';
  document.getElementById('setting-index-endpoint').value = currentSettings.indexEndpoint || '';
  updateIndexEndpointField();
}

function updateIndexEndpointField() {
  const api = currentSettings.api;
  const active = isIndexTranslateApi(api);
  const input = document.getElementById('setting-index-endpoint');
  const hint = document.getElementById('index-endpoint-hint');

  document.getElementById('index-endpoint-group').hidden = !active;
  if (!active) return;

  input.placeholder = INDEX_ENDPOINT_PRESETS[api] || '';
  hint.textContent = INDEX_ENDPOINT_HINTS[api] || '';
}

function wireEvents() {
  // On change, save immediately
  document.getElementById('setting-enabled').addEventListener('change', function () {
    currentSettings.enabled = this.checked;
    saveSettings();
  });

  document.getElementById('setting-api').addEventListener('change', function () {
    currentSettings.api = this.value;
    updateIndexEndpointField();
    saveSettings();
  });

  document.getElementById('setting-index-endpoint').addEventListener('change', function () {
    currentSettings.indexEndpoint = this.value.trim();
    this.value = currentSettings.indexEndpoint;
    saveSettings();
  });

  document.getElementById('setting-target-lang').addEventListener('change', function () {
    currentSettings.targetLang = this.value;
    saveSettings();
  });

  document.getElementById('setting-display-mode').addEventListener('change', function () {
    currentSettings.displayMode = this.value;
    saveSettings();
  });

  document.getElementById('setting-font-size').addEventListener('input', function () {
    currentSettings.fontSize = parseInt(this.value);
    document.getElementById('font-size-value').textContent = this.value + 'px';
    saveSettings();
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    currentSettings = { ...DEFAULTS };
    applySettingsToForm();
    saveSettings();
    showStatus('Reset to defaults');
  });
}

function saveSettings() {
  chrome.storage.sync.set({ settings: currentSettings }, () => {
    showStatus('Saved');
  });
}

let statusTimer = null;
function showStatus(msg) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    el.classList.remove('visible');
  }, 1500);
}
