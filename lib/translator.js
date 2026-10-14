// Translation API abstraction layer
// Supports: Google Translate (free), MyMemory, LibreTranslate, Index-Translate (bilibili free API)
// Features: caching, rate limiting, automatic failover

const TRANSLATORS = {
  GOOGLE: 'google',
  MYMEMORY: 'mymemory',
  LIBRETRANSLATE: 'libretranslate',
  YOUDAO: 'youdao',
  INDEX_TRANSLATE: 'index-translate',
  INDEX_TRANSLATE_PROXY: 'index-translate-proxy'
};

// ---- Index-Translate (bilibili) free public API ----
// OpenAI-compatible endpoint, no API key required.
//
// IMPORTANT: the public gateway rejects requests whose Origin is a browser
// extension (HTTP 412), so Index-Translate is never called from the extension
// service worker. Content scripts call it from the page context instead, where
// the request carries the YouTube page origin and is accepted.
// `index-translate-proxy` targets the official local bridge
// (`python inference/llm/call_api.py --serve`) rather than the public gateway.
const INDEX_TRANSLATE = {
  PUBLIC_ENDPOINT: 'https://index-translate.bilibili.com/v1',
  LOCAL_ENDPOINT: 'http://127.0.0.1:8080/v1',
  MODEL: 'Index-Translate-35B-A3B',
  MAX_TOKENS: 512
};

const INDEX_TRANSLATE_APIS = [TRANSLATORS.INDEX_TRANSLATE, TRANSLATORS.INDEX_TRANSLATE_PROXY];

// Extension language code -> language name Index-Translate expects in its prompt.
const INDEX_LANG_NAMES = {
  'zh-CN': '简体中文',
  'zh-TW': '繁体中文',
  'en': '英语',
  'ja': '日语',
  'ko': '韩语',
  'es': '西班牙语',
  'fr': '法语',
  'de': '德语',
  'pt': '葡萄牙语',
  'ru': '俄语',
  'ar': '阿拉伯语',
  'hi': '印地语',
  'th': '泰语',
  'vi': '越南语',
  'id': '印尼语',
  'tr': '土耳其语',
  'it': '意大利语',
  'nl': '荷兰语',
  'pl': '波兰语',
  'uk': '乌克兰语'
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

function isIndexTranslateApi(api) {
  return INDEX_TRANSLATE_APIS.indexOf(api) !== -1;
}

/**
 * Resolve the base URL used for an Index-Translate API selection.
 * @param {string} api - 'index-translate' or 'index-translate-proxy'
 * @param {string} [override] - user supplied base URL; wins whenever it is non-empty
 * @returns {string} base URL without a trailing slash
 */
function resolveIndexEndpoint(api, override) {
  const custom = (override || '').trim();
  if (custom) return custom.replace(/\/+$/, '');
  return api === TRANSLATORS.INDEX_TRANSLATE_PROXY
    ? INDEX_TRANSLATE.LOCAL_ENDPOINT
    : INDEX_TRANSLATE.PUBLIC_ENDPOINT;
}

/**
 * Build the canonical Index-Translate prompt, matching the shape produced by the
 * official inference/llm/call_api.py helper.
 */
function buildIndexTranslatePrompt(text, targetLang) {
  const target = INDEX_LANG_NAMES[targetLang] || targetLang || '中文';
  return '请将以下文本翻译为' + target + '，直接输出翻译结果，不要进行任何解释。\n\n' + text;
}

/**
 * Strip CoT blocks if the model emits any.
 */
function stripThinkBlocks(content) {
  if (!content) return '';
  let out = String(content);
  if (out.indexOf('</think>') !== -1) out = out.split('</think>').pop();
  out = out.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>/g, '');
  return out.trim();
}

/**
 * Translate with the Index-Translate free API.
 *
 * Must run in a page context (content script), never in the service worker:
 * the public gateway answers 412 to the chrome-extension:// origin.
 *
 * @param {string} text - Text to translate
 * @param {string} targetLang - Extension language code, e.g. 'zh-CN'
 * @param {string} [sourceLang] - Accepted for signature parity; Index-Translate auto-detects
 * @param {{api?: string, endpoint?: string, model?: string}} [options]
 * @returns {Promise<{success: boolean, translatedText: string, error?: string}>}
 */
async function indexTranslate(text, targetLang, sourceLang, options) {
  if (!text || !text.trim()) {
    return { success: true, translatedText: text };
  }

  const opts = options || {};
  const endpoint = resolveIndexEndpoint(opts.api, opts.endpoint);
  const model = opts.model || INDEX_TRANSLATE.MODEL;
  const cacheKey = `${text}|${targetLang}|${TRANSLATORS.INDEX_TRANSLATE}|${endpoint}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { success: true, translatedText: cached.translation };
  }

  if (isRateLimited()) {
    await new Promise(r => setTimeout(r, 200));
  }
  markRequest();

  const payload = {
    model: model,
    messages: [{ role: 'user', content: buildIndexTranslatePrompt(text, targetLang) }],
    temperature: 0,
    max_tokens: INDEX_TRANSLATE.MAX_TOKENS,
    stream: false,
    // Keep reasoning off: with thinking enabled the CoT text can replace the
    // translation inside `message.content`.
    chat_template_kwargs: { enable_thinking: false }
  };

  const response = await fetch(endpoint + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 200);
    } catch (e) {
      detail = '';
    }
    const hint = response.status === 412
      ? ' (网关拒绝了扩展来源的请求，请改用本地代理或在页面中调用)'
      : '';
    throw new Error(`Index-Translate HTTP ${response.status}${hint}${detail ? ' ' + detail : ''}`);
  }

  const data = await response.json();
  const message = data && data.choices && data.choices[0] ? data.choices[0].message : null;
  const translatedText = stripThinkBlocks(message ? message.content : '');

  if (!translatedText) {
    throw new Error('Index-Translate returned an empty translation');
  }

  cache.set(cacheKey, { translation: translatedText, timestamp: Date.now() });
  return { success: true, translatedText: translatedText };
}

/**
 * Main translate function with caching, rate limiting, and failover.
 * Used by the service worker; Index-Translate is handled by the content scripts.
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

// Export for service worker (importScripts) and content scripts, which share the
// same global scope inside their isolated world.
if (typeof self !== 'undefined') {
  self.TRANSLATORS = TRANSLATORS;
  self.translate = translate;
  self.indexTranslate = indexTranslate;
  self.isIndexTranslateApi = isIndexTranslateApi;
  self.resolveIndexEndpoint = resolveIndexEndpoint;
  self.INDEX_TRANSLATE = INDEX_TRANSLATE;
}
