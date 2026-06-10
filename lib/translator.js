// Translation API abstraction layer
// Supports: Google Translate (free), MyMemory, LibreTranslate
// Features: caching, rate limiting, automatic failover

const TRANSLATORS = {
  GOOGLE: 'google',
  MYMEMORY: 'mymemory',
  LIBRETRANSLATE: 'libretranslate',
  YOUDAO: 'youdao'
};

// In-memory cache: key = "text|source|target|api", value = { translation, timestamp }
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Rate limiting: max requests per second
let requestTimestamps = [];
const MAX_RPS = 5;

function isRateLimited() {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(t => now - t < 1000);
  return requestTimestamps.length >= MAX_RPS;
}

function markRequest() {
  requestTimestamps.push(Date.now());
}

/**
 * Main translate function with caching, rate limiting, and failover.
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @param {string} api - Which API to use
 * @param {string} sourceLang - Source language (default 'auto')
 * @returns {Promise<{success: boolean, translatedText: string, detectedLang?: string, error?: string}>}
 */
async function translate(text, targetLang, api, sourceLang = 'auto') {
  if (!text || !text.trim()) {
    return { success: true, translatedText: text };
  }

  // Check cache
  const cacheKey = `${text}|${sourceLang}|${targetLang}|${api}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { success: true, translatedText: cached.translation, detectedLang: cached.detectedLang };
  }

  // Rate limit check
  if (isRateLimited()) {
    // Queue and wait
    await new Promise(r => setTimeout(r, 200));
  }
  markRequest();

  let result;
  try {
    switch (api) {
      case TRANSLATORS.GOOGLE:
        result = await googleTranslate(text, targetLang, sourceLang);
        break;
      case TRANSLATORS.MYMEMORY:
        result = await myMemoryTranslate(text, targetLang, sourceLang);
        break;
      case TRANSLATORS.LIBRETRANSLATE:
        result = await libreTranslate(text, targetLang, sourceLang);
        break;
      case TRANSLATORS.YOUDAO:
        result = await youdaoTranslate(text, targetLang, sourceLang);
        break;
      default:
        result = await googleTranslate(text, targetLang, sourceLang);
    }
  } catch (err) {
    console.warn(`[DT] Translator ${api} failed:`, err.message);
    result = await fallbackTranslate(text, targetLang, sourceLang, api);
  }

  if (result.success) {
    cache.set(cacheKey, {
      translation: result.translatedText,
      detectedLang: result.detectedLang,
      timestamp: Date.now()
    });
  }

  return result;
}

/**
 * Google Translate (unofficial free endpoint)
 */
async function googleTranslate(text, targetLang, sourceLang = 'auto') {
  const url = 'https://translate.googleapis.com/translate_a/single' +
    '?client=gtx' +
    '&sl=' + encodeURIComponent(sourceLang) +
    '&tl=' + encodeURIComponent(targetLang) +
    '&dt=t' +
    '&dj=1' +
    '&q=' + encodeURIComponent(text);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();

  // dj=1 returns { sentences: [{ trans: "..." }], src: "auto-detected" }
  if (data.sentences && data.sentences.length > 0) {
    const translated = data.sentences.map(s => s.trans || '').join('');
    return { success: true, translatedText: translated, detectedLang: data.src };
  }

  // Legacy format: [[["..."]]]
  if (Array.isArray(data) && data[0]) {
    const translated = data[0].map(segment => segment[0] || '').join('');
    return { success: true, translatedText: translated };
  }

  throw new Error('Unexpected response format');
}

/**
 * MyMemory translation API (free tier, 500 char limit)
 */
async function myMemoryTranslate(text, targetLang, sourceLang = 'auto') {
  // MyMemory has a 500 byte limit per request
  const truncated = text.length > 400 ? text.substring(0, 400) + '...' : text;
  const src = sourceLang === 'auto' ? '' : sourceLang;
  const langpair = src ? `${src}|${targetLang}` : `${targetLang}`;

  const url = 'https://api.mymemory.translated.net/get' +
    '?q=' + encodeURIComponent(truncated) +
    '&langpair=' + encodeURIComponent(langpair) +
    '&mt=1';

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();

  if (data.responseStatus === 200 && data.responseData) {
    return {
      success: true,
      translatedText: data.responseData.translatedText || text,
      detectedLang: data.responseData.match ? data.responseData.match.source : undefined
    };
  }

  if (data.responseStatus === 403 || (data.responseDetails && data.responseDetails.includes('QUOTA'))) {
    throw new Error('MyMemory quota exceeded');
  }

  throw new Error(data.responseDetails || 'MyMemory translation failed');
}

/**
 * LibreTranslate (public instances)
 */
async function libreTranslate(text, targetLang, sourceLang = 'auto') {
  // Use a public LibreTranslate mirror
  const url = 'https://libretranslate.com/translate';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: sourceLang === 'auto' ? 'auto' : sourceLang,
      target: targetLang,
      format: 'text'
    })
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  return {
    success: true,
    translatedText: data.translatedText || text,
    detectedLang: data.detectedLanguage?.language
  };
}

/**
 * Youdao Translate via 360 browser endpoint (no key required)
 * Note: always translates to Chinese (Simplified)
 */
async function youdaoTranslate(text, targetLang, sourceLang = 'auto') {
  // 360 endpoint only supports to-Chinese translation
  const url = 'http://elephant.browser.360.cn/' +
    '?t=translate' +
    '&i=' + encodeURIComponent(text) +
    '&type=AUTO' +
    '&doctype=json' +
    '&keyfrom=360se' +
    '&m=youdao';

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();

  if (data.errorCode === 0 && data.result) {
    return { success: true, translatedText: data.result };
  }

  throw new Error(data.errorMessage || 'Youdao translation failed');
}

/**
 * Fallback: try other APIs in order
 */
async function fallbackTranslate(text, targetLang, sourceLang, failedApi) {
  const order = [TRANSLATORS.GOOGLE, TRANSLATORS.MYMEMORY, TRANSLATORS.LIBRETRANSLATE, TRANSLATORS.YOUDAO];
  const remaining = order.filter(a => a !== failedApi);

  for (const api of remaining) {
    try {
      console.log(`[DT] Falling back to ${api}...`);
      let result;
      switch (api) {
        case TRANSLATORS.GOOGLE:
          result = await googleTranslate(text, targetLang, sourceLang);
          break;
        case TRANSLATORS.MYMEMORY:
          result = await myMemoryTranslate(text, targetLang, sourceLang);
          break;
        case TRANSLATORS.LIBRETRANSLATE:
          result = await libreTranslate(text, targetLang, sourceLang);
          break;
        case TRANSLATORS.YOUDAO:
          result = await youdaoTranslate(text, targetLang, sourceLang);
          break;
      }
      if (result.success) return result;
    } catch (e) {
      console.warn(`[DT] Fallback ${api} also failed:`, e.message);
    }
  }

  return { success: false, translatedText: `[TL Failed] ${text}`, error: 'All APIs failed' };
}

// Export for service worker via importScripts
if (typeof self !== 'undefined') {
  self.TRANSLATORS = TRANSLATORS;
  self.translate = translate;
}
