// import store from './store';
// const throttle = require('lodash/throttle');
import { isEqual } from 'lodash/core';
import { isEmpty } from 'lodash';
import { cloudSync, syncStatus } from './utils/cloudSync';
import { login, signup } from './utils/loginLogout';
import { createSidebar } from './utils/sidebarContentScript';
const uuidv4 = require('uuid/v4');

const debounce = require('lodash/debounce');
global.browser = require('webextension-polyfill');
// const $ = require('jquery');

chrome.runtime.onInstalled.addListener(function() {
  // production:
  const serverUrl = 'https://ipfc-midware.herokuapp.com';
  // testing:
  // const serverUrl = 'http://127.0.0.1:5000';
  chrome.storage.sync.set({
    serverUrl: serverUrl,
  });
});

chrome.runtime.onMessage.addListener(function(msg, sender) {
  if (msg.login) {
    login(msg.username, msg.password);
  }
  if (msg.signup) {
    signup(msg.username, msg.password, msg.pinataApi, msg.pinataSecret);
  }
  if (msg.cloudSync) {
    cloudSync(true);
  }
  if (msg.debouncedCloudSync) {
    debouncedCloudSync();
  }
  if (msg.sidebarWinId) {
    chrome.storage.local.set({ sidebarWinId: msg.sidebarWinId });
  }
  if (msg.highlightSelection) {
    console.log('msg.highlightSelection, open newcard editor');
    chrome.storage.local.set({ newCardData: msg.newCardData, toEditCardData: null });
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
    console.log('msg.openEditor');
    chrome.storage.local.set({ toEditCardData: msg.toEditCardData, newCardData: null });
    const editorWindow = {
      type: 'popup',
      url: 'cardEditor/cardEditor.html',
      width: 400,
      height: 611,
      left: 0,
      top: 0,
    };
    chrome.windows.create(editorWindow);
  }
  if (msg.createSidebar) {
    createSidebar();
  }
  if (msg.newBlankCard) {
    chrome.storage.local.get(['lastActiveTabUrl', 'user_collection'], items => {
      const newCardData = {
        isNew: true,
        time: new Date().getTime(),
        card_id: uuidv4(),
        user_id: items.user_collection.user_id,
        highlight_url: items.lastActiveTabUrl,
      };
      chrome.storage.local.set({ newCardData: newCardData, toEditCardData: null });
      const editorWindow = {
        type: 'popup',
        url: 'cardEditor/cardEditor.html',
        width: 400,
        height: 611,
        left: 0,
        top: 0,
      };
      chrome.windows.create(editorWindow);
    });
  }
  if (msg.resizeComplete) {
    // refocus on last active
    chrome.storage.local.get(['lastActiveWindow'], items => {
      chrome.windows.update(items.lastActiveWindow, { focused: msg.refocus });
    });
  }
  if (msg.storeCard) {
    sendMesageToAllTabs({ storeCard: true, card: msg.card });
  }
  if (msg.focusMainWinHighlight) {
    sendMesageToAllTabs({ focusMainWinHighlight: true, highlightId: msg.highlightId });
  }
  if (msg.deleteCard) {
    sendMesageToAllTabs({ deleteCard: true, url: msg.url, card: msg.card });
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
    console.log('    refresh highlights message recieved');
    if (msg.refreshOrder) SendOutRefresh(null, true);
    else SendOutRefresh(null, null);
  }
  // if (msg.orderRefreshed) {
  //   chrome.runtime.sendMessage({ orderRefreshed: true });
  // }
  if (msg.updateActiveTab) updateActiveTab();
});

// CHANGE LISTENER. listener might overload the browser runtime.lastError: QUOTA_BYTES_PER_ITEM quota exceeded
chrome.storage.onChanged.addListener(function(changes, namespace) {
  for (var key in changes) {
    var storageChange = changes[key];
    console.log(
      `    Storage key ${key} changed. Old value, new value, oldValue: ${storageChange.oldValue} newValue: ${storageChange.newValue}`
    );
    if (key === 'user_collection') {
      checkUserCollectionChanged(storageChange.oldValue, storageChange.newValue);
    }
    if (key === 'websites') {
      checkWebsitesChanged(storageChange.oldValue, storageChange.newValue);
    }
  }
});

const debouncedCloudSync = debounce(async () => {
  console.log('    debounced cloud sync called, syncStatus', syncStatus);
  console.log(new Date().getTime());
  cloudSync();
}, 5000);
function checkJwt() {
  function getJwt() {
    return new Promise(resolve => {
      chrome.storage.local.get(['jwt'], function(items) {
        resolve(items.jwt);
      });
    });
  }
  return getJwt().then(value => {
    const jwt = value;
    // console.log('    jwt', jwt);
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
function checkJwtAndSync() {
  const jwtValid = checkJwt();
  if (jwtValid) {
    debouncedCloudSync();
  }
}
function checkWebsitesChanged(oldWebsites, newWebsites) {
  if (!isEmpty(oldWebsites) && !isEmpty(newWebsites)) {
    for (const url in oldWebsites) {
      const oldWebsite = oldWebsites[url];
      for (const nUrl in newWebsites) {
        const newWebsite = newWebsites[nUrl];
        if (url === nUrl) {
          if (newWebsite.cards && oldWebsite.cards) {
            if (!isEqual(newWebsite.cards, oldWebsite.cards)) {
              console.log(
                'unequal cards: oldWebsite, newWebsite',
                oldWebsite.cards,
                newWebsite.cards
              );
              checkJwtAndSync();
              return null;
            }
          }
          if (newWebsite.highlights && oldWebsite.highlights)
            if (!isEqual(newWebsite.highlights, oldWebsite.highlights)) {
              console.log(
                'unequal highlights: oldWebsite, newWebsite',
                oldWebsite.highlights,
                newWebsite.highlights
              );
              sendMesageToAllTabs({ syncNotUpToDate: true, value: true });
              checkJwtAndSync();
              return null;
            }
          if (newWebsite.deleted && oldWebsite.deleted)
            if (!isEqual(newWebsite.deleted, oldWebsite.deleted)) {
              console.log(
                'unequal deleted: oldWebsite, newWebsite',
                oldWebsite.deleted,
                newWebsite.deleted
              );
              sendMesageToAllTabs({ syncNotUpToDate: true, value: true });
              checkJwtAndSync();
              return null;
            }
        }
      }
    }
  } else {
    sendMesageToAllTabs({ syncNotUpToDate: true, value: true });
    checkJwtAndSync();
  }
}
function checkUserCollectionChanged(oldCollection, newCollection) {
  console.log(oldCollection, newCollection);
  if (oldCollection && newCollection) {
    if (oldCollection.highlight_urls && newCollection.highlight_urls)
      if (!isEqual(oldCollection.highlight_urls.list, newCollection.highlight_urls.list)) {
        sendMesageToAllTabs({ syncNotUpToDate: true, value: true });
        checkJwtAndSync();
        return null;
      }
    if (oldCollection.all_tags_list && newCollection.all_tags_list)
      if (!isEqual(oldCollection.all_tags_list.list, newCollection.all_tags_list.list)) {
        sendMesageToAllTabs({ syncNotUpToDate: true, value: true });
        checkJwtAndSync();
        return null;
      }
  } else {
    sendMesageToAllTabs({ syncNotUpToDate: true, value: true });
    checkJwtAndSync();
  }
}
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
// sending message to sidebar and popup, just use chrome.runtime.sendmessage
function SendOutRefresh(url = null, refreshOrder = null, callback) {
  chrome.storage.local.get(['lastActiveTabUrl'], function(items) {
    const message = { refreshHighlights: true, url: url || items.lastActiveTabUrl };
    if (refreshOrder) {
      message.refreshOrder = true;
    }
    sendMesageToAllTabs(message);
  });
}

function checkIfHighlightsExist(url, callback) {
  chrome.storage.local.get(['websites', 'user_collection'], function(items) {
    let websites = items.websites;
    const userCollection = items.user_collection;
    if (!userCollection) return null;
    if (!websites) websites = {};
    if (!websites[url]) {
      websites[url] = {};
      chrome.storage.local.set({ websites: websites });
    }
    // console.log('    user_collection', userCollection);
    if (!userCollection.highlight_urls.list.includes(url)) {
      if (websites[url].highlights) {
        if (websites[url].highlights.length > 0) {
          if (!userCollection.highlight_urls) {
            userCollection.highlight_urls = {};
            userCollection.highlight_urls.list = [];
          }
          if (!userCollection.highlight_urls.list.includes(url)) {
            userCollection.highlight_urls.list.push(url);
            userCollection.highlight_urls.edited = new Date().getTime();
            console.log('    user collection after adding highlight urls', userCollection);
            chrome.storage.local.set({ user_collection: userCollection });
          }
        }
      }
    }
    if (callback) callback();
  });
}

//
// WINDOW AND TAB REFOCUS AND LOAD
//

function updateActiveTab(refresh) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length === 0) return null;
    const lastActiveTabId = tabs[0].id;
    if (!tabs[0].url) return null;
    const lastActiveTabUrl = tabs[0].url;
    let lastActiveWindow;
    chrome.windows.getLastFocused(function(win) {
      console.log('    win', win);
      lastActiveWindow = win.id;
    });
    chrome.storage.local.get(['lastActiveTabId', 'lastActiveTabUrl', 'sidebarWinId'], function(
      items
    ) {
      // console.log(lastActiveTabUrl, items.lastActiveTabUrl);
      // items.sidebarWinId + 1 is because the tab id is actually the windowID +1
      if (
        items.lastActiveTabId !== lastActiveTabId &&
        lastActiveTabId !== items.sidebarWinId + 1 &&
        !lastActiveTabUrl.startsWith('chrome') &&
        !lastActiveTabUrl.startsWith('about') &&
        !lastActiveTabUrl.startsWith('https://addons') &&
        !lastActiveTabUrl.startsWith('moz-extension')
      ) {
        chrome.storage.local.set({
          lastActiveTabId: lastActiveTabId,
          lastActiveWindow: lastActiveWindow,
        });
      }
      if (
        items.lastActiveTabUrl !== lastActiveTabUrl &&
        !lastActiveTabUrl.startsWith('chrome') &&
        !lastActiveTabUrl.startsWith('about') &&
        !lastActiveTabUrl.startsWith('https://addons') &&
        !lastActiveTabUrl.startsWith('moz-extension')
      ) {
        chrome.storage.local.set({
          lastActiveTabUrl: lastActiveTabUrl,
          lastActiveWindow: lastActiveWindow,
        });
        console.log('last active tab set', lastActiveTabUrl);
        chrome.runtime.sendMessage({ activeTabChanged: true });
      }
      // this is needed for single page applications which don't reload on url change
      if (refresh) SendOutRefresh(null, true);
    });
  });
}
chrome.tabs.onActivated.addListener(function(activeInfo) {
  // console.log('    chrome.tabs.onActivated.');
  // console.log(activeInfo.tabId, activeInfo.windowId);
  updateActiveTab();
});
chrome.windows.onFocusChanged.addListener(function(windowId) {
  // console.log('    chrome.windows.onFocusChanged');
  // console.log('    windowId', windowId);
  if (windowId !== -1) {
    sendMesageToAllTabs({ resizeSidebar: true });

    chrome.windows.get(windowId, { populate: true }, function(window) {
      // console.log(window);
      // console.log(window.tabs);
      if (!window || !window.tabs || !window.tabs[0].url) return null;
      // console.log('    win.tabs[0].url', window.tabs[0].url);
      // Will this be blocking updates we want? && window.tabs[0].url !== lastActiveTabUrl
      chrome.storage.local.get(['lastActiveTabUrl'], items => {
        if (
          !window.tabs[0].url.startsWith('chrome') &&
          !window.tabs[0].url.startsWith('about') &&
          !window.tabs[0].url.startsWith('https://addons') &&
          !window.tabs[0].url.startsWith('moz-extension') &&
          window.tabs[0].url !== items.lastActiveTabUrl
        ) {
          updateActiveTab();
          checkIfHighlightsExist(window.tabs[0].url, () => {
            SendOutRefresh(window.tabs[0].url, true);
          });
        }
      });
    });
  }
});
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.url) {
    // Will this be blocking updates we want? && changeInfo.url !== lastActiveTabUrl
    chrome.storage.local.get(['lastActiveTabUrl'], items => {
      if (
        !changeInfo.url.startsWith('chrome') &&
        !changeInfo.url.startsWith('about') &&
        !changeInfo.url.startsWith('https://addons') &&
        !changeInfo.url.startsWith('moz-extension') &&
        changeInfo.url !== items.lastActiveTabUrl
      ) {
        updateActiveTab(true);
        checkIfHighlightsExist(changeInfo.url, () => {
          SendOutRefresh(changeInfo.url, true);
        });
      }
    });
  }
});

//
// CONTEXT MENU
//
chrome.contextMenus.create({
  id: 'makeFlashCard',
  title: 'Make Flashcard',
  onclick: makeFlashcard,
  contexts: ['selection'],
});

function makeFlashcard() {
  // might need to check if user collection valid as well
  const jwtValid = checkJwt();
  if (jwtValid) {
    sendMesageToAllTabs({ getHighlight: true });
  } else alert('Please sign in');
}

// Get the initial color value
// chrome.storage.local.get('color', values => {
//   var color = values.color ? values.color : 'yellow';
//   changeColor(color);
// });

changeColor();
function changeColor(color) {
  // set this to brand color, but later user can customize, change to color variable
  chrome.storage.local.set({ color: 'rgba(248, 103, 13, 0.728)' });
}

export { sendMesageToAllTabs };
