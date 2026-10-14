// Shared utilities for YouTube Danmaku Translator

const SUPPORTED_LANGUAGES = [
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

const DEFAULT_SETTINGS = {
  // Index-Translate is the default; it falls back to the other free APIs when unreachable.
  api: 'index-translate',
  // Optional custom base URL, e.g. 'http://127.0.0.1:8080/v1'. Empty = API preset.
  indexEndpoint: '',
  targetLang: 'zh-CN',
  enabled: true,
  displayMode: 'inline',
  fontSize: 11,
  panelCollapsed: false,
  panelX: null,
  panelY: null
};

/**
 * Check if text is only emoji, whitespace, or numbers
 */
function isOnlyEmojiOrNumbers(text) {
  if (!text || !text.trim()) return true;
  // Strip all whitespace, numbers, punctuation, and emoji
  const stripped = text.replace(/[\s\d\p{P}\p{Emoji}]/gu, '');
  return stripped.length === 0;
}

/**
 * Simple debounce function
 */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Clamp a value between min and max
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Export for service worker (ES module context not used; we rely on global scope
// for content scripts and importScripts for service worker)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SUPPORTED_LANGUAGES, DEFAULT_SETTINGS, isOnlyEmojiOrNumbers, debounce, clamp };
}
