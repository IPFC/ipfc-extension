// import store from './store';
// const throttle = require('lodash/throttle');
global.browser = require('webextension-polyfill');
// var $ = require('jquery');

// this listener might overload the browser runtime.lastError: QUOTA_BYTES_PER_ITEM quota exceeded
chrome.storage.onChanged.addListener(function(changes, namespace) {
  for (var key in changes) {
    var storageChange = changes[key];
    console.log(
      `Storage key ${key} changed. Old value was ${storageChange.oldValue}, new value is ${storageChange.newValue}`,
      storageChange.newValue
    );
  }
});

var lastActiveWindow;
var lastActiveTabId;
var lastActiveTabUrl;
const sidebarResize = function(msg) {
  chrome.windows.getLastFocused(function(win) {
    // console.log('win', win);
    lastActiveWindow = win.id;
  });
  chrome.storage.local.get(['sidebarWinId'], function(items) {
    chrome.tabs.sendMessage(items.sidebarWinId, {
      sidebarResize: true,
      updateData: msg.sidebarResize,
    });
  });
};

const SendOutRefresh = function(url, callback) {
  const message = { refreshHighlights: true, url: url, refreshOrder: true };
  chrome.tabs.query({}, function(tabs) {
    for (var i = 0; i < tabs.length; ++i) {
      // console.log(message);
      chrome.tabs.sendMessage(tabs[i].id, message);
      if (i === tabs.length + 1) {
        if (callback) callback();
      }
    }
  });
};

const checkIfHighlightsExist = function(url, callback) {
  chrome.storage.local.get(['highlights'], function(items) {
    let highlights = items.highlights;
    if (!highlights) highlights = {};
    if (!highlights[url])
      highlights[url] = {
        cards: [],
      };
    chrome.storage.local.set({ highlights: highlights });
    if (callback) callback();
  });
};

chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.popupWinId) {
    chrome.storage.local.set({ popupWinId: msg.popupWinId });
  }
  if (msg.sidebarWinId) {
    chrome.storage.local.set({ sidebarWinId: msg.sidebarWinId });
  }
  if (msg.highlightSelection) {
    // console.log('recieved new card data', msg.newCardData);
    chrome.storage.local.set({ newCardData: msg.newCardData });
    const editorWindow = {
      type: 'popup',
      url: 'cardEditor/cardEditor.html',
      width: 400,
      height: 600,
      left: 0,
      top: 0,
    };
    chrome.windows.create(editorWindow);
  }
  if (msg.openEditor) {
    chrome.storage.local.set({ toEditCardData: msg.toEditCardData });
    const editorWindow = {
      type: 'popup',
      url: 'cardEditor/cardEditor.html',
      width: 400,
      height: 600,
      left: 0,
      top: 0,
    };
    chrome.windows.create(editorWindow);
  }
  if (msg.sidebarResize) {
    sidebarResize(msg);
  }
  if (msg.resizeComplete) {
    // refocus on last active
    chrome.windows.update(lastActiveWindow, { focused: true });
  }
  if (msg.newCardSaved) {
    chrome.storage.local.get(['sidebarWinId'], function(items) {
      // console.log(items.sidebarWinId);
      chrome.tabs.sendMessage(items.sidebarWinId, {
        newCardSaved: true,
        card: msg.card,
      });
    });
  }
  if (msg.focusMainWinHighlight) {
    // console.log('focusMainWinHighlight recieved msg', msg);
    // send to all tabs. might be easier than trying to figure out which tab is the main window, when the sidebar is focused
    chrome.tabs.query({}, function(tabs) {
      var message = { focusMainWinHighlight: true, highlightId: msg.highlightId };
      for (var i = 0; i < tabs.length; ++i) {
        chrome.tabs.sendMessage(tabs[i].id, message);
      }
    });
  }
  if (msg.highlightDeleted) {
    chrome.storage.local.get(['sidebarWinId'], function(items) {
      // console.log(items.sidebarWinId);
      chrome.tabs.sendMessage(items.sidebarWinId, {
        highlightDeleted: true,
      });
    });
  }
  if (msg.refreshHighlights) {
    // console.log('refresh highlights');
    chrome.storage.local.get(['lastActiveTabUrl'], function(items) {
      var message = { refreshHighlights: true, url: items.lastActiveTabUrl };
      if (msg.refreshOrder) {
        message.refreshOrder = true;
      }
      chrome.tabs.query({}, function(tabs) {
        for (var i = 0; i < tabs.length; ++i) {
          // console.log(message);
          chrome.tabs.sendMessage(tabs[i].id, message);
        }
      });
    });
  }
  if (msg.orderRefreshed) {
    chrome.storage.local.get(['sidebarWinId'], function(items) {
      // console.log('orderRefreshed');
      chrome.tabs.sendMessage(items.sidebarWinId, {
        orderRefreshed: true,
      });
    });
  }
  if (msg.updateActiveTab) updateActiveTab();
});

function checkJwt() {
  const getJwt = function() {
    return new Promise(resolve => {
      chrome.storage.local.get(['jwt'], function(items) {
        resolve(items.jwt);
      });
    });
  };
  return getJwt().then(value => {
    const jwt = value;
    // console.log('jwt', jwt);
    if (jwt === null) {
      return false;
    } else if (!jwt || jwt.split('.').length < 3) {
      return false;
    } else {
      const data = JSON.parse(atob(jwt.split('.')[1]));
      const exp = new Date(data.exp * 1000); // JS deals with dates in milliseconds since epoch, python in seconds
      const now = new Date();
      if (now < exp) {
        return true;
      }
    }
  });
}

const updateActiveTab = function(refresh) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length === 0) return null;
    lastActiveTabId = tabs[0].id;
    if (!tabs[0].url) return null;
    lastActiveTabUrl = tabs[0].url;
    chrome.storage.local.get(['lastActiveTabId', 'lastActiveTabUrl', 'sidebarWinId'], function(
      items
    ) {
      // console.log(lastActiveTabUrl, items.lastActiveTabUrl);
      // items.sidebarWinId + 1 is because the tab id is actually the windowID +1
      if (
        items.lastActiveTabId !== lastActiveTabId &&
        lastActiveTabId !== items.sidebarWinId + 1 &&
        !lastActiveTabUrl.includes('chrome')
      ) {
        chrome.storage.local.set({
          // this is where it all goes wrong.....
          lastActiveTabId: lastActiveTabId,
        });
      }
      if (items.lastActiveTabUrl !== lastActiveTabUrl && !lastActiveTabUrl.includes('chrome')) {
        chrome.storage.local.set({
          lastActiveTabUrl: lastActiveTabUrl,
        });
      }
      // this is needed for single page applications which don't reload on url change
      if (refresh)
        chrome.tabs.sendMessage(tabs[0].id, {
          refresh: true,
        });
    });
  });
};

chrome.tabs.onActivated.addListener(function(activeInfo) {
  // console.log('chrome.tabs.onActivated.');
  // console.log(activeInfo.tabId, activeInfo.windowId);
  updateActiveTab();
});
chrome.windows.onFocusChanged.addListener(function(windowId) {
  // console.log('chrome.windows.onFocusChanged');
  // console.log('windowId', windowId);sidebarWinId
  if (windowId !== -1) {
    chrome.windows.get(windowId, { populate: true }, function(window) {
      // console.log(window);
      // console.log(window.tabs);
      if (!window || !window.tabs || !window.tabs[0].url) return null;
      // console.log('win.tabs[0].url', window.tabs[0].url);
      // Will this be blocking updates we want? && window.tabs[0].url !== lastActiveTabUrl
      if (!window.tabs[0].url.includes('chrome') && window.tabs[0].url !== lastActiveTabUrl) {
        updateActiveTab();
        checkIfHighlightsExist(window.tabs[0].url, () => {
          SendOutRefresh(window.tabs[0].url);
        });
      }
    });
  }
});
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.url) {
    // Will this be blocking updates we want? && changeInfo.url !== lastActiveTabUrl

    if (!changeInfo.url.includes('chrome') && changeInfo.url !== lastActiveTabUrl) {
      updateActiveTab(true);
      checkIfHighlightsExist(changeInfo.url, () => {
        SendOutRefresh(changeInfo.url);
      });
    }
  }
});

chrome.contextMenus.create({
  id: 'makeFlashCard',
  title: 'Make Flashcard',
  onclick: makeFlashcard,
  contexts: ['selection'],
});

function makeFlashcard() {
  // console.log('makeFlashcard called');
  // might need to check if user collection valid as well
  const jwtValid = checkJwt();
  // console.log('valid', jwtValid);
  if (jwtValid) {
    chrome.tabs.query({}, function(tabs) {
      var message = { getHighlight: true };
      for (var i = 0; i < tabs.length; ++i) {
        chrome.tabs.sendMessage(tabs[i].id, message);
      }
    });
    // chrome.tabs.executeScript({
    //  file: 'highlighter/called/getHighlight.js',
    // });
  } else alert('Please sign in');
}

// Get the initial color value
// chrome.storage.local.get('color', values => {
//   var color = values.color ? values.color : 'yellow';
//   changeColor(color);
// });

changeColor();
function changeColor(color) {
  // set this to brad color, but later user can customize, change to color variable
  chrome.storage.local.set({ color: 'rgba(248, 103, 13, 0.728)' });
}

// can use from popup to optionally remove all highlights
// removeHighlightsBtn.addEventListener('click', removeHighlights);
const removeHighlights = function() {
  chrome.tabs.executeScript({ file: 'highlighter/called/removeHighlights.js' });
};
export { removeHighlights };
