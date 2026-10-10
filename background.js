chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "JOB_EXPLORER_SCAN_RESULT") {
    chrome.storage.local.set({ lastScan: message.jobs || [], lastScanUrl: message.url || "" })
      .then(() => sendResponse({ ok: true }));
    return true;
  }
});