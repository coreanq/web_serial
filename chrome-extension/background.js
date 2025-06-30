// Handle extension icon click to open full screen tab
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('popup.html')
  });
});