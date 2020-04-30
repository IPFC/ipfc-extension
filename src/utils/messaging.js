const sendMesageToAllTabs = function(message) {
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

export { sendMesageToAllTabs };
