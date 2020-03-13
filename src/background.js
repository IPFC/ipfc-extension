import store from './store';
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
      // console.log('show editor message sent');
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
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      // console.log('show editor message sent');
      chrome.tabs.sendMessage(tabs[0].id, { showEditor: true });
    });
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
