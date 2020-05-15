// import store from './store';
import { isEqual } from 'lodash/core';
import { isEmpty } from 'lodash';
import { cloudSync, syncStatus } from './utils/cloudSync';
import { sendMessageToAllTabs, sendMessageToActiveTab, SendOutRefresh } from './utils/messaging';
import { login, signup } from './utils/loginLogout';
import { createSidebar } from './utils/sidebarContentScript';
import {
  collectCardAndHighlight,
  storeCard,
  deleteCard,
  putCard,
  postCard,
  postDeck,
  deleteHighlight,
  deleteServerCard,
  collectHighlight,
} from './highlighter/storageManager';
import { cleanedUrl } from './utils/dataProcessing';
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

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
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
    // console.log('msg.highlightSelection, open newcard editor');
    chrome.storage.local.set({ newCardData: msg.newCardData, toEditCardData: null });
    openEditor();
  }
  if (msg.openEditor) {
    // console.log('msg.openEditor');
    chrome.storage.local.set({ toEditCardData: msg.toEditCardData, newCardData: null });
    openEditor();
  }
  if (msg.createSidebar) {
    createSidebar();
  }
  if (msg.newBlankCard) {
    chrome.storage.local.get(['lastActiveTabUrl', 'user_collection'], items => {
      const newCardData = {
        time: new Date().getTime(),
        card_id: uuidv4(),
        user_id: items.user_collection.user_id,
        highlight_url: items.lastActiveTabUrl,
      };
      chrome.storage.local.set({ newCardData: newCardData, toEditCardData: null });
      openEditor();
    });
  }
  if (msg.addNewCardToHighlight) {
    const newCardData = {
      time: new Date().getTime(),
      card_id: uuidv4(),
      user_id: msg.userId,
      highlight_url: msg.url,
      highlight_id: msg.highlightId,
    };
    chrome.storage.local.set({ newCardData: newCardData, toEditCardData: null });
    openEditor();
  }
  if (msg.resizeComplete) {
    // refocus on last active
    chrome.storage.local.get(['lastActiveWindow'], items => {
      chrome.windows.update(items.lastActiveWindow, { focused: msg.refocus });
    });
  }
  if (msg.highlightClicked) {
    // console.log('highlight clicked msg', msg);
    chrome.storage.local.get(['websites', 'mineAndOthersWebsites', 'user_collection'], items => {
      let highlight;
      try {
        highlight = items.mineAndOthersWebsites[msg.highlightUrl].highlights[msg.highlightId];
      } catch {
        try {
          highlight = items.websites[msg.highlightUrl].highlights[msg.highlightId];
        } catch {
          console.log('highlight not found');
          return null;
        }
      }
      // console.log('sending response, highlight', highlight);
      sendResponse({ highlight: highlight, userId: items.user_collection.user_id });
      let associatedCards;
      try {
        associatedCards = items.mineAndOthersWebsites[msg.highlightUrl].cards;
      } catch {
        try {
          associatedCards = items.websites[msg.highlightUrl].cards;
        } catch {
          console.log('no cards found');
          return null;
        }
      }
      for (const card of associatedCards) {
        if (card.highlight_id === msg.highlightId) {
          // will this message reach sidebar in both chrome and firefox?
          console.log('sidebarScrollToCard, card, msg', card, msg);
          chrome.runtime.sendMessage({ sidebarScrollToCard: true, cardId: card.card_id });
        }
      }
      // if couldn't find the card ID, might be because the highlight we clicked doesn't have a card, but a clone of that highlight does
      // therefore we should check for clones of the highlight and see if those have associated cards
      // ...
      // chrome.runtime.sendMessage({ sidebarScrollToCard: true, cardId: card.card_id });
    });
  }
  if (msg.collectCardAndHighlight) {
    collectCardAndHighlight(msg.card, msg.userId);
  }
  if (msg.deleteHighlight) {
    deleteHighlight(msg.url, msg.id, msg.thenDeletecard);
  }
  if (msg.deleteCard) {
    deleteCard(msg.url, msg.card);
  }
  if (msg.deleteServerCard) {
    deleteServerCard(msg.jwt, msg.serverUrl, msg.card, msg.deckId);
  }
  if (msg.storeCard) {
    storeCard(msg.card);
  }
  if (msg.putCard) {
    putCard(msg.jwt, msg.serverUrl, msg.card, msg.deckId);
  }
  if (msg.postCard) {
    console.log('posting card', msg);
    postCard(msg.jwt, msg.serverUrl, msg.card, msg.deckId, msg.deckTitle);
  }
  if (msg.postDeck) {
    postDeck(msg.jwt, msg.serverUrl, msg.card, msg.deck);
  }
  if (msg.collectHighlight) {
    if (msg.cardId) collectHighlight(msg.highlight, msg.url, msg.userId, msg.cardId);
    else collectHighlight(msg.highlight, msg.url, msg.userId);
  }
  // if (msg.highlightDeleted) {
  //   chrome.storage.local.get(['sidebarWinId'], function(items) {
  //     // console.log(items.sidebarWinId);
  //     chrome.tabs.sendMessage(items.sidebarWinId, {
  //       highlightDeleted: true,
  //     });
  //   });
  // }
  if (msg.refreshHighlights) {
    // sending to tabs
    console.log('refresh highlights, sender: \n----- ', msg.sender);
    SendOutRefresh(msg.url, msg.refreshOrder || false, msg.sender, msg.retry || false);
  }
  // if (msg.orderRefreshed) {
  //   // sending to sidebar
  //   chrome.runtime.sendMessage({ orderRefreshed: true });
  // }
  if (msg.focusMainWinHighlight) {
    sendMessageToAllTabs({ focusMainWinHighlight: true, highlightId: msg.highlightId });
  }
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
  // console.log(new Date().getTime());
  cloudSync();
}, 50000);
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
              // console.log(
              //   'unequal cards: oldWebsite, newWebsite',
              //   oldWebsite.cards,
              //   newWebsite.cards
              // );
              checkJwtAndSync();
              return null;
            }
          }
          if (newWebsite.highlights && oldWebsite.highlights)
            if (!isEqual(newWebsite.highlights, oldWebsite.highlights)) {
              // console.log(
              //   'unequal highlights: oldWebsite, newWebsite',
              //   oldWebsite.highlights,
              //   newWebsite.highlights
              // );
              sendMessageToAllTabs({ syncNotUpToDate: true, value: true });
              checkJwtAndSync();
              return null;
            }
          if (newWebsite.deleted && oldWebsite.deleted)
            if (!isEqual(newWebsite.deleted, oldWebsite.deleted)) {
              // console.log(
              //   'unequal deleted: oldWebsite, newWebsite',
              //   oldWebsite.deleted,
              //   newWebsite.deleted
              // );
              sendMessageToAllTabs({ syncNotUpToDate: true, value: true });
              checkJwtAndSync();
              return null;
            }
        }
      }
    }
  } else {
    sendMessageToAllTabs({ syncNotUpToDate: true, value: true });
    checkJwtAndSync();
  }
}
function checkUserCollectionChanged(oldCollection, newCollection) {
  // console.log(oldCollection, newCollection);
  if (oldCollection && newCollection) {
    if (oldCollection.highlight_urls && newCollection.highlight_urls)
      if (!isEqual(oldCollection.highlight_urls.list, newCollection.highlight_urls.list)) {
        sendMessageToAllTabs({ syncNotUpToDate: true, value: true });
        checkJwtAndSync();
        return null;
      }
    if (oldCollection.all_tags_list && newCollection.all_tags_list)
      if (!isEqual(oldCollection.all_tags_list.list, newCollection.all_tags_list.list)) {
        sendMessageToAllTabs({ syncNotUpToDate: true, value: true });
        checkJwtAndSync();
        return null;
      }
  } else {
    sendMessageToAllTabs({ syncNotUpToDate: true, value: true });
    checkJwtAndSync();
  }
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
            // console.log('    user collection after adding highlight urls', userCollection);
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
    const lastActiveTabUrl = cleanedUrl(tabs[0].url);
    let lastActiveWindow;
    chrome.windows.getLastFocused(function(win) {
      // console.log('    win', win);
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
        // console.log('last active tab set', lastActiveTabUrl);
        chrome.runtime.sendMessage({ activeTabChanged: true });
      }
      // this is needed for single page applications which don't reload on url change
      if (refresh) SendOutRefresh(null, 'updateActiveTab', true);
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
    sendMessageToActiveTab({ resizeSidebar: true });
    updateActiveTab();

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
          checkIfHighlightsExist(window.tabs[0].url, () => {
            console.log('refresh highlights, sender: \n\n----- windows.onFocusChanged Listener');
            SendOutRefresh(false, 'windows.onFocusChanged', true);
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
          console.log('refresh highlights, sender: \n\n----- tabs.onUpdated Listener');
          SendOutRefresh(false, 'tabs.onUpdated', true);
        });
      }
    });
  }
});

function openEditor() {
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

//
// CONTEXT MENU
//
chrome.contextMenus.create({
  id: 'makeFlashCard',
  title: 'Make flashcard and highlight',
  onclick: makeFlashcard,
  contexts: ['selection'],
});
// this slows down creation. not sure if people will want just highlight, not card create feature.
// chrome.contextMenus.create({
//   id: 'makeHighlight',
//   title: 'Highlight',
//   onclick: makeHighlight,
//   contexts: ['selection'],
// });

function makeFlashcard() {
  // might need to check if user collection valid as well
  const jwtValid = checkJwt();
  if (jwtValid) {
    sendMessageToAllTabs({ getHighlight: true, makeCard: true });
  } else alert('Please sign in');
}
// function makeHighlight() {
//   // might need to check if user collection valid as well
//   const jwtValid = checkJwt();
//   if (jwtValid) {
//     sendMessageToAllTabs({ getHighlight: true });
//   } else alert('Please sign in');
// }

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
