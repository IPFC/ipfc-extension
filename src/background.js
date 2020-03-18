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

// const onPageLoad = function() {
//   checkJwt();
// };

// chrome.runtime.onMessage.addListener(function(msg) {
//   if (msg.pageLoaded) {
//     onPageLoad();
//   }
// });

const sidebarResize = function(msg) {
  chrome.storage.local.get(['sidebarWinId'], function(items) {
    chrome.tabs.sendMessage(items.sidebarWinId, {
      sidebarResize: true,
      updateData: msg.sidebarResize,
    });
  });
};

chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.popupWinId) {
    chrome.storage.local.set({ popupWinId: msg.popupWinId });
  }
  if (msg.sidebarWinId) {
    chrome.storage.local.set({ sidebarWinId: msg.sidebarWinId });
  }
  if (msg.sidebarResize) {
    sidebarResize(msg);
  }
  if (msg.highlightClickedFromHighlighter) {
    console.log('highlightClicked recieved, msg', msg);
    highlightClicked(msg.highlightId, msg.highlightUrl);
  }
  if (msg.newCardSaved) {
    chrome.storage.local.get(['sidebarWinId'], function(items) {
      console.log(items.sidebarWinId);
      chrome.tabs.sendMessage(items.sidebarWinId, {
        newCardSaved: true,
        card: msg.card,
      });
    });
  }
  if (msg.focusMainWinHighlight) {
    console.log('focusMainWinHighlight recieved msg', msg);
    // send to all tabs. might be easier than trying to figure out which tab is the main window, when the sidebar is focused
    chrome.tabs.query({}, function(tabs) {
      var message = { focusMainWinHighlight: true, highlightId: msg.highlightId };
      for (var i = 0; i < tabs.length; ++i) {
        chrome.tabs.sendMessage(tabs[i].id, message);
      }
    });
  }
});

const highlightClicked = function(id, url) {};

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
    console.log('jwt', jwt);
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

// this is needed for single page applications which don't reload on url change
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.url) {
    console.log('tab url changed');
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { refresh: true });
    });
  }
});

chrome.contextMenus.create({
  id: 'makeFlashCard',
  title: 'Make Flashcard',
  onclick: makeFlashcard,
  contexts: ['selection'],
});

chrome.runtime.onMessage.addListener(function(msg) {
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
});

function makeFlashcard() {
  // console.log('makeFlashcard called');
  // might need to check if user collection valid as well
  const jwtValid = checkJwt();
  console.log('valid', jwtValid);
  if (jwtValid) {
    chrome.tabs.executeScript({
      file: 'highlighter/called/getHighlight.js',
    });
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
