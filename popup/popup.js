// YouTube Danmaku Translator - Popup Settings

const LANGUAGES = [
  { code: 'en',    name: 'English' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
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
  api: 'google',
  targetLang: 'en',
  enabled: true,
  displayMode: 'inline',
  fontSize: 11,
  panelCollapsed: false,
  panelX: null,
  panelY: null
};

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
}

function wireEvents() {
  // On change, save immediately
  document.getElementById('setting-enabled').addEventListener('change', function () {
    currentSettings.enabled = this.checked;
    saveSettings();
  });

  document.getElementById('setting-api').addEventListener('change', function () {
    currentSettings.api = this.value;
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
