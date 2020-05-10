import {
  storeHighlightsOrder,
  storeHighlight,
  loadThisUrlsHighlights,
  clearPageHighlights,
  // deleteAllPageHighlights,
} from './storageManager';
import { highlight } from './highlighter.js';
import { cleanedUrl } from '../utils/dataProcessing';
import throttle from 'lodash/throttle';
const uuidv4 = require('uuid/v4');
const $ = require('jquery');

// const commonAdScripts = [
//   'amazon-adsystem.com',
//   'eus.rubiconproject.com',
//   'openx.net/w',
//   'ads.pubmatic.com',
//   'acdn.adnxs.com',
//   'js-sec.indexww',
//   'cdn.connectad',
//   'sync-eu.connectad',
//   'casalemedia.com/usermatch',
// ];

chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.getHighlight) {
    if (msg.makeCard) getHighlight(true);
    else getHighlight();
  }
  if (msg.contentRefreshHighlights) {
    // console.log('refresh highlights, msg', msg);
    refreshHighlights(msg.url, msg.refreshOrder, msg.retry);
  }
  if (msg.focusMainWinHighlight) {
    // console.log('focusMainWinHighlight msg', msg);
    focusHighlight(msg.highlightId);
  }
});

function updateActiveTab() {
  chrome.runtime.sendMessage({ updateActiveTab: true });
}
function focusHighlight(highlightId) {
  try {
    $('html, body').animate(
      {
        scrollTop: $('#' + highlightId).offset().top - 200,
      },
      400
    );
  } catch (error) {
    console.log('focus highlight error', error);
  }
  // console.log('scrollto highlight id', highlightId);
}
const refreshHighlights = throttle(function(url, refreshOrder, retry = false) {
  chrome.storage.local.get(
    ['websites', 'mineAndOthersWebsites', 'highlightsViewMode', 'lastActiveTabUrl'],
    items => {
      if (cleanedUrl(window.location.href) !== url) {
        // console.log('not active url, cleanedUrl(window.location.href), url', cleanedUrl(window.location.href), url);
        return null;
      }
      if (url !== items.lastActiveTabUrl) {
        // console.log('not active tab, items.lastActiveTabUrl, url', items.lastActiveTabUrl, url);
        return null;
      }
      console.log('refreshHighlights , url, refreshOrder, retry', url, refreshOrder, retry);

      let websites;
      if (items.highlightsViewMode === 'mineAndOthers') websites = items.mineAndOthersWebsites;
      else websites = items.websites;
      if (!websites) websites = {};
      let website = websites[url];
      if (!website) website = {};
      let orderlessCardsCountBefore = 0;
      if (website.orderlessCards) orderlessCardsCountBefore = website.orderlessCards.length;
      console.log('orderlessCardsCountBefore', orderlessCardsCountBefore);

      const refreshComplete = function(refreshOrder, retry) {
        // if there are more orderless cards after the refresh, there was a glitch. This reloading can be a little jarring, make it optional?
        chrome.storage.local.get(
          ['websites', 'mineAndOthersWebsites', 'highlightsViewMode'],
          items => {
            let websites;
            if (items.highlightsViewMode === 'mineAndOthers')
              websites = items.mineAndOthersWebsites;
            else websites = items.websites;
            if (!websites) websites = {};
            let website = websites[url];
            if (!website) website = {};
            let orderlessCardsCountAfter = 0;
            if (website.orderlessCards) orderlessCardsCountAfter = website.orderlessCards.length;
            console.log('orderlessCardsCountAfter', orderlessCardsCountAfter);
            if (
              orderlessCardsCountAfter === 0 ||
              orderlessCardsCountAfter === orderlessCardsCountBefore
            ) {
              if (refreshOrder) chrome.runtime.sendMessage({ orderRefreshed: true });
              else chrome.runtime.sendMessage({ highlightsRefreshed: true });
            } else {
              if (retry) {
                location.reload();
              } else refreshHighlights(url, refreshOrder, true);
            }
          }
        );
      };
      clearPageHighlights(() => {
        loadThisUrlsHighlights(url, () => {
          if (refreshOrder) {
            storeHighlightsOrder(url, () => {
              refreshComplete(true, retry);
            });
          } else refreshComplete(false, retry);
        });
      });
    }
  );
}, 300);

function getHighlight(makeCard = false) {
  // if (syncing) {
  //   alert('syncing, please wait');
  //   return null;
  // }
  const selection = window.getSelection();
  const selectionString = selection.toString();
  // console.log('getHightCalled');
  if (selectionString) {
    // If there is text selected
    var container = selection.getRangeAt(0).commonAncestorContainer;
    // Sometimes the element will only be text. Get the parent in that case
    while (!container.innerHTML) {
      container = container.parentNode;
    }

    chrome.storage.local.get(['color', 'user_collection'], items => {
      // console.log(items.user_collection);
      if (!items.user_collection) {
        alert('please log in to IPFC');
        return null;
      }
      const userId = items.user_collection.user_id;
      const color = items.color;
      const highlightId = 'h-id-' + uuidv4(); // need letters in front for valid html id. Can't start with numbers
      const cardId = makeCard ? uuidv4() : null;
      const url = cleanedUrl(window.location.href);
      // these are things to be saved in the new card, so they need to be sent to the editor

      const newCardOpenEditor = function(
        selectionString,
        cardId,
        userId,
        highlightUrl,
        highlightId,
        callback
      ) {
        chrome.runtime.sendMessage({
          highlightSelection: true,
          newCardData: {
            time: new Date().getTime(),
            selection: selectionString,
            card_id: cardId,
            user_id: userId,
            highlight_url: highlightUrl,
            highlight_id: highlightId,
          },
        });
        if (callback) callback();
      };
      // ** change to highlight first, then open card editor,
      // finally call store from there, then do API call, sync to db
      // get rid of color?
      // console.log(selection, container, cleanedUrl(window.location.href), color);
      // console.log('new ID', highlightId);
      storeHighlight(selection, container, url, color, userId, cardId, highlightId, () => {
        if (makeCard) {
          newCardOpenEditor(selectionString, cardId, userId, url, highlightId, () => {
            highlight(selectionString, container, selection, color, highlightId, () => {
              chrome.runtime.sendMessage({
                refreshHighlight: true,
                refreshOrder: true,
                url: url,
                sender: 'getHighlight, make card',
              });
              // refreshHighlights(url, true);
            });
          });
        } else {
          highlight(selectionString, container, selection, color, highlightId, () => {
            chrome.runtime.sendMessage({
              refreshHighlight: true,
              url: url,
              sender: 'getHighlight',
            });
            // refreshHighlights(url);
          });
        }
      });
    });
  }
}

// A combination of characters that should (almost) never occur

const HIGHLIGHT_CLASS = 'highlighter--highlighted';

// $(document).on('click', updateActiveTab());
$(document).ready(updateActiveTab()); // is this needed? background.js already has similar listeners...
$(document).ready(setupContextMenu);
$(document).ready(refreshHighlights(cleanedUrl(window.location.href), true));

function setupContextMenu() {
  let clickedHighlightId;
  let userId;
  var leftContextMenuHtml = `<ul id="left-context-ul">
    <li class="left-context-li" id="delete-highlight">Delete highlight</li>
    <li class="left-context-li" id="delete-highlight-and-card">Delete highlight and card</li>
    <li class="left-context-li" id="add-card-to-highlight">Add a new card to this highlight</li>
    <li class="left-context-li" id="collect-highlight">Collect highlight</li>
    <li class="left-context-li" id="collect-highlight-and-card">Collect highlight and card</li>
  </ul>`;
  if ($('#left-context-menu').length === 0) {
    const leftContextMenu = document.createElement('div');
    leftContextMenu.id = 'left-context-menu';
    document.body.append(leftContextMenu);
    $('#left-context-menu').html(leftContextMenuHtml);
  }
  const $menu = $('#left-context-menu');
  $menu.hide();
  const repositionAndShowLeftContextMenu = function(e) {
    // console.log('repositionAndShowLeftContextMenu e', e);
    if (
      !$(e.target)
        .parents()
        .addBack()
        .is('#left-context-menu') &&
      $(e.target)
        .parents()
        .addBack()
        .is('.' + HIGHLIGHT_CLASS)
    ) {
      const target = $(e.target);
      // console.log(target);
      clickedHighlightId = target[0].id;
      const offsetTop = Math.round(target.offset().top);
      const offsetHeight = target[0].offsetHeight;
      const offsetLeft = target.offset().left;
      // console.log('offsetLeft, offsetHeight, offsetTop', offsetLeft, offsetHeight, offsetTop);
      chrome.runtime.sendMessage(
        {
          highlightClicked: true,
          highlightId: clickedHighlightId,
          highlightUrl: cleanedUrl(window.location.href),
        },
        function(response) {
          // console.log(response, 'response');
          userId = response.userId;
          $menu.css({
            position: 'absolute',
            top: offsetTop - offsetHeight - 55,
            left: offsetLeft,
          });
          $menu.show();
          togglePopupLeftContextMenu(response.highlight);
        }
      );
    }
  };

  const togglePopupLeftContextMenu = function(highlight) {
    // console.log('highlight, userId', highlight, userId);
    const $menu = $('#left-context-menu');
    const $deleteHighlight = $('#delete-highlight');
    const $deleteHighlightAndCard = $('#delete-highlight-and-card');
    // const $addCardToHighlight = $('add-card-to-highlight');
    const $collectHighlight = $('#collect-highlight');
    const $collectHighlightAndCard = $('#collect-highlight-and-card');
    if (highlight.user_id === userId) {
      $collectHighlight.hide();
      $collectHighlightAndCard.hide();
      $deleteHighlight.show();
      $deleteHighlightAndCard.show();
    } else {
      $deleteHighlight.hide();
      $deleteHighlightAndCard.hide();
      $collectHighlight.show();
      $collectHighlightAndCard.show();
    }
    const clickCallback = function(e) {
      function afterMenuItemClick() {
        $menu.hide();
        $(document).off('click', clickCallback);
        $(document).on('click', repositionAndShowLeftContextMenu);
      }
      if ($(e.target).is('#delete-highlight')) {
        chrome.runtime.sendMessage({
          deleteHighlight: true,
          url: cleanedUrl(window.location.href),
          id: clickedHighlightId,
          thenDeleteCard: false,
        });
        afterMenuItemClick();
      }
      if ($(e.target).is('#delete-highlight-and-card')) {
        chrome.runtime.sendMessage({
          deleteHighlight: true,
          url: cleanedUrl(window.location.href),
          id: clickedHighlightId,
          thenDeleteCard: true,
        });
        afterMenuItemClick();
      }
      if ($(e.target).is('#add-card-to-highlight')) {
        chrome.runtime.sendMessage({
          addNewCardToHighlight: true,
          url: cleanedUrl(window.location.href),
          highlightId: clickedHighlightId,
          userId: userId,
        });
        afterMenuItemClick();
      }
      if ($(e.target).is('#collect-highlight')) {
        chrome.runtime.sendMessage({
          collectHighlight: true,
          highlight: highlight,
          url: cleanedUrl(window.location.href),
          userId: userId,
        });
        afterMenuItemClick();
      }
      if ($(e.target).is('#collect-highlight-and-card')) {
        chrome.runtime.sendMessage({
          collectHighlight: true,
          highlight: highlight,
          url: cleanedUrl(window.location.href),
          userId: userId,
          cardId: highlight.card_id,
        });
        afterMenuItemClick();
      } else if (
        !$(e.target)
          .parents()
          .addBack()
          .is('#left-context-menu')
      ) {
        $menu.hide();
        $(document).off('click', clickCallback);
        $(document).on('click', repositionAndShowLeftContextMenu);
      }
    };
    if ($menu.is(':visible')) {
      $(document).off('click', repositionAndShowLeftContextMenu);
      $(document).on('click', clickCallback);
    }
    return false;
  };

  // $(document).off('click');
  $(document).on('click', repositionAndShowLeftContextMenu);
}
