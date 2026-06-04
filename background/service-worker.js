// Service worker: routes translation requests from content scripts to translator APIs
// Uses importScripts to load translator and utils modules

importScripts('../lib/utils.js', '../lib/translator.js');

// DEFAULT_SETTINGS is already declared in utils.js (imported above)

// Initialize settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['settings'], (result) => {
    if (!result.settings) {
      chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    }
  });
});

// Listen for translation requests from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    handleTranslate(message, sendResponse);
    return true; // Keep the message channel open for async response
  }

  if (message.action === 'getSettings') {
    chrome.storage.sync.get(['settings'], (result) => {
      sendResponse({ settings: result.settings || DEFAULT_SETTINGS });
    });
    return true;
  }
});

async function handleTranslate(message, sendResponse) {
  const { text, sourceLang, targetLang, api } = message;

  try {
    const result = await self.translate(
      text,
      targetLang || 'zh-CN',
      api || 'google',
      sourceLang || 'auto'
    );
    sendResponse(result);
  } catch (err) {
    sendResponse({
      success: false,
      translatedText: text,
      error: err.message
    });
  }
}
