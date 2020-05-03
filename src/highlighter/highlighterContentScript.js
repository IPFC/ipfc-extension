import {
  storeHighlightsOrder,
  storeHighlight,
  deleteHighlight,
  storeCard,
  addNewCardToHighlight,
  deleteCard,
  // postCard,
  putCard,
  postDeck,
  loadThisUrlsHighlights,
  // deleteAllPageHighlights,
  clearPageHighlights,
  collectHighlight,
} from './storageManager';
import { highlight } from './highlighter.js';
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

// A combination of characters that should (almost) never occur

const HIGHLIGHT_CLASS = 'highlighter--highlighted';

// $(document).on('click', updateActiveTab());
$(document).ready(updateActiveTab()); // is this needed? background.js already has similar listeners...
$(document).ready(setupContextMenu);
$(document).ready(refreshHighlights(window.location.href, true));

chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.getHighlight) {
    if (msg.makeCard) getHighlight(true);
    else getHighlight();
  }
  if (msg.deleteHighlight) {
    deleteHighlight(msg.url, msg.id);
  }
  if (msg.deleteCard) {
    deleteCard(msg.url, msg.card);
  }
  if (msg.storeCard) {
    storeCard(msg.card);
  }
  if (msg.putCard) {
    putCard(msg.jwt, msg.serverUrl, msg.card, msg.deckId);
  }
  if (msg.postDeck) {
    postDeck(msg.jwt, msg.serverUrl, msg.card, msg.deck);
  }
  if (msg.refreshHighlights) {
    // console.log('refresh highlights, msg.url', msg.url);
    if (msg.refreshOrder) refreshHighlights(msg.url, true);
    else refreshHighlights(msg.url, false);
  }
  if (msg.focusMainWinHighlight) {
    // console.log('focusMainWinHighlight msg', msg);
    focusHighlight(msg.highlightId);
  }
});

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
          highlightUrl: window.location.href,
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
        deleteHighlight(window.location.href, clickedHighlightId, false);
        afterMenuItemClick();
      }
      if ($(e.target).is('#delete-highlight-and-card')) {
        deleteHighlight(window.location.href, clickedHighlightId, true);
        afterMenuItemClick();
      }
      if ($(e.target).is('#add-card-to-highlight')) {
        addNewCardToHighlight(clickedHighlightId, window.location.href, userId);
        afterMenuItemClick();
      }
      if ($(e.target).is('#collect-highlight')) {
        collectHighlight(highlight, window.location.href, userId);
        afterMenuItemClick();
      }
      if ($(e.target).is('#collect-highlight-and-card')) {
        collectHighlight(highlight, window.location.href, userId, highlight.card_id);
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
function refreshHighlights(url, refreshOrder) {
  // console.log('refreshHighlights , url', url);
  chrome.storage.local.get(
    ['websites', 'mineAndOthersWebsites', 'highlightsViewMode', 'lastActiveTabUrl'],
    items => {
      if (window.location.href !== url) return null;
      if (url !== items.lastActiveTabUrl) {
        // console.log('not active tab');
        return null;
      }
      let websites;
      if (items.highlightsViewMode === 'mineAndOthers') websites = items.mineAndOthersWebsites;
      else websites = items.websites;
      if (!websites) websites = {};
      let website = websites[url];
      if (!website) website = {};
      let orderlessCardsCountBefore = 0;
      if (website.orderlessCards) orderlessCardsCountBefore = website.orderlessCards.length;
      // console.log('orderlessCardsCountBefore', orderlessCardsCountBefore);

      const refreshComplete = function(refreshOrder) {
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
            // console.log('orderlessCardsCountAfter', orderlessCardsCountAfter);
            if (
              orderlessCardsCountAfter === 0 ||
              orderlessCardsCountAfter === orderlessCardsCountBefore
            ) {
              if (refreshOrder) chrome.runtime.sendMessage({ orderRefreshed: true });
              else chrome.runtime.sendMessage({ highlightsRefreshed: true });
            } else {
              location.reload();
            }
          }
        );
      };
      if (refreshOrder) {
        clearPageHighlights(() => {
          // console.log('refresh order, url', url);
          loadThisUrlsHighlights(url, () => {
            // console.log('storeHighlightsOrder');
            storeHighlightsOrder(url, () => {
              refreshComplete(true);
            });
          });
        });
      } else {
        clearPageHighlights(() => {
          loadThisUrlsHighlights(url, () => {
            refreshComplete();
          });
        });
      }
    }
  );
}

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
      // console.log(selection, container, window.location.href, color);
      // console.log('new ID', highlightId);
      storeHighlight(
        selection,
        container,
        window.location.href,
        color,
        userId,
        cardId,
        highlightId,
        () => {
          if (makeCard) {
            newCardOpenEditor(
              selectionString,
              cardId,
              userId,
              window.location.href,
              highlightId,
              () => {
                highlight(selectionString, container, selection, color, highlightId, () => {
                  storeHighlightsOrder(window.location.href);
                });
              }
            );
          } else {
            highlight(selectionString, container, selection, color, highlightId);
          }
        }
      );
    });
  }
}
