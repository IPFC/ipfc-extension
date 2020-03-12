import store from './store';
global.browser = require('webextension-polyfill');

const setStore = function() {
  chrome.storage.local.get(
    ['jwt', 'runInNewWindow', 'pinataKeys', 'selection', 'user_collection'],
    function(result) {
      for (const stateItem in result) {
        if (stateItem === 'user_collection') {
          store.commit('updateUserCollection', result[stateItem]);
        } else {
          const Capitalized =
            String(stateItem)
              .charAt(0)
              .toUpperCase() + String(stateItem).slice(1);
          // console.log('state.stateItem', result[stateItem]);
          store.commit('update' + Capitalized, result[stateItem]);
        }
      }
      store.dispatch('checkJwt');
    }
  );
};
// this listener might overload the browser runtime.lastError: QUOTA_BYTES_PER_ITEM quota exceeded
const storageListener = function(port) {
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    for (var key in changes) {
      var storageChange = changes[key];
      console.log(
        `Storage key ${key} changed. Old value was ${storageChange.oldValue}, new value is ${storageChange.newValue}`,
        storageChange.newValue
      );
      if (store.state[key]) {
        if (store.state[key] !== storageChange.newValue) {
          if (key === 'user_collection') {
            store.commit('updateUserCollection', storageChange.newValue);
          } else {
            const Capitalized =
              String(key)
                .charAt(0)
                .toUpperCase() + String(key).slice(1);
            // console.log(Capitalized);
            store.commit('update' + Capitalized, storageChange.newValue);
            port.postMessage({
              stateChanged: true,
              stateItem: key,
              value: storageChange.newValue,
            });
          }
        }
      }
    }
  });
};

setStore();

document.addEventListener(
  'DOMContentLoaded',
  function() {
    checkJwt();
    var port = chrome.runtime.connect({ name: 'background' });
    storageListener(port);
  },
  false
);
const checkJwt = function() {
  chrome.storage.local.get(['jwt'], function(result) {
    store.commit('updateJwt', result.jwt);
    store.dispatch('checkJwt');
  });
};
chrome.contextMenus.create({
  id: 'makeFlashCard',
  title: 'Make Flashcard',
  onclick: makeFlashcard,
  contexts: ['selection'],
});

chrome.runtime.onConnect.addListener(function(port) {
  if (port.name === 'editor' || port.name === 'popup') {
    port.onMessage.addListener(function(msg) {
      if (msg.startup) port.postMessage({ startup: true, state: store.state });
    });
  }
});

chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.highlightSelection) {
    // console.log(msg.selection);
    store.commit('updateSelection', msg.selection);
    showEditor();
  }
});
function showEditor() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    // console.log('show editor message sent');
    chrome.tabs.sendMessage(tabs[0].id, { showEditor: true });
  });
}

function makeFlashcard() {
  // console.log('makeFlashcard called');
  chrome.tabs.executeScript({ file: 'highlighter/called/getHighlight.js' });
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
