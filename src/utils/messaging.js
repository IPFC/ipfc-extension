const sendMessageToAllTabs = function(message) {
  chrome.tabs.query({}, function(tabs) {
    for (let i = 0; i < tabs.length; ++i) {
      chrome.tabs.get(tabs[i].id, function(tab) {
        if (
          !tab.url.startsWith('chrome') &&
          !tab.url.startsWith('about') &&
          !tab.url.startsWith('https://addons') &&
          !tab.url.startsWith('moz-extension')
        ) {
          // console.log(tab.url);
          chrome.tabs.sendMessage(tabs[i].id, message, function() {
            if (chrome.runtime.lastError) {
              // console.log(chrome.runtime.lastError.message);
              // console.log(tab.url);
            }
          });
        }
      });
    }
  });
};

const sendMessageToActiveTab = function(message) {
  chrome.storage.local.get(['lastActiveTabUrl'], items => {
    chrome.tabs.query({}, function(tabs) {
      for (let i = 0; i < tabs.length; ++i) {
        chrome.tabs.get(tabs[i].id, function(tab) {
          if (tab.url === items.lastActiveTabUrl) {
            // console.log(tab.url);
            chrome.tabs.sendMessage(tabs[i].id, message, function() {
              if (chrome.runtime.lastError) {
                // console.log(chrome.runtime.lastError.message);
                // console.log(tab.url);
              }
            });
            return null;
          }
        });
      }
    });
  });

  // chrome.storage.local.get(['lastActiveTabId'], items => {
  //   chrome.tabs.sendMessage(items.lastActiveTabId, message, function() {
  //     if (chrome.runtime.lastError) {
  //       console.log(chrome.runtime.lastError.message);
  //       // console.log(tab.url);
  //     }
  //   });
  // });
};

// sending message to sidebar and popup, just use chrome.runtime.sendmessage
function SendOutRefresh(url = null, refreshOrder = false, sender = null, retry = false) {
  sendMessageToAllTabs({
    contentRefreshHighlights: true,
    refreshOrder: refreshOrder,
    sender: sender,
    retry: retry,
  });
}
export { sendMessageToAllTabs, sendMessageToActiveTab, SendOutRefresh };
