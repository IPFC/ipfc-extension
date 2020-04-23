// import { isEmpty } from 'lodash';
import {
  storeHighlightsOrder,
  storeHighlight,
  deleteHighlight,
  storeCard,
  deleteCard,
  postCard,
  putCard,
  postDeck,
  loadThisUrlsHighlights,
  // deleteAllPageHighlights,
  clearPageHighlights,
} from './storageManager';
const uuidv4 = require('uuid/v4');
const $ = require('jquery');

const commonAdScripts = [
  'amazon-adsystem.com',
  'eus.rubiconproject.com',
  'openx.net/w',
  'ads.pubmatic.com',
  'acdn.adnxs.com',
  'js-sec.indexww',
  'cdn.connectad',
  'sync-eu.connectad',
  'casalemedia.com/usermatch',
];

// A combination of characters that should (almost) never occur
const DELIMITERS = {
  start: '~|:;',
  end: ';:~|',
};
const HIGHLIGHT_CLASS = 'highlighter--highlighted';

// $(document).on('click', updateActiveTab());
$(document).ready(updateActiveTab()); // is this needed? background.js already has similar listeners...
$(document).ready(setupContextMenu);
$(document).ready(refreshHighlights(window.location.href, true));

chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.getHighlight) {
    getHighlight();
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
  if (msg.postCard) {
    console.log('posting card', msg);
    postCard(msg.jwt, msg.serverUrl, msg.card, msg.deckId);
  }
  if (msg.putCard) {
    putCard(msg.jwt, msg.serverUrl, msg.card, msg.deckId);
  }
  if (msg.postDeck) {
    postDeck(msg.jwt, msg.serverUrl, msg.card, msg.deck);
  }
  if (msg.refreshHighlights) {
    console.log('refresh highlights, msg.url', msg.url);
    if (msg.refreshOrder) refreshHighlights(msg.url, true);
    else refreshHighlights(msg.url, false);
  }
  if (msg.focusMainWinHighlight) {
    // console.log('focusMainWinHighlight msg', msg);
    focusHighlight(msg.highlightId);
  }
});

// var syncing = false;
// chrome.runtime.onMessage.addListener(function(msg) {
//   if (msg.syncing) {
//     console.log('highlighter recieved syncing signal', msg.value);
//     syncing = msg.value;
//   }
// });

function setupContextMenu() {
  let clickedHighlightId;
  var leftContextMenuHtml = `<ul id="left-context-ul">
  <li class="left-context-li" id="delete-highlight">delete highlight</li>
  <li class="left-context-li" id="collect-highlight">collect highlight</li>
</ul>
`;
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
      const id = target[0].id;
      clickedHighlightId = id;
      const offsetTop = Math.round(target.offset().top);
      const offsetHeight = target[0].offsetHeight;
      const offsetLeft = target.offset().left;
      // console.log('offsetLeft, offsetHeight, offsetTop', offsetLeft, offsetHeight, offsetTop);
      chrome.runtime.sendMessage({
        highlightClicked: true,
        highlightId: id,
        highlightUrl: window.location.href,
      });
      $menu.css({
        position: 'absolute',
        top: offsetTop - offsetHeight - 55,
        left: offsetLeft,
      });
      $menu.show();
      togglePopupLeftContextMenu();
    }
  };

  const togglePopupLeftContextMenu = function() {
    const $menu = $('#left-context-menu');
    const callback = function(e) {
      if ($(e.target).is('#delete-highlight')) {
        // console.log('delete clicked');
        deleteHighlight(window.location.href, clickedHighlightId);
        $menu.hide();
        $(document).off('click', callback);
        $(document).on('click', repositionAndShowLeftContextMenu);
      } else if (
        !$(e.target)
          .parents()
          .addBack()
          .is('#left-context-menu')
      ) {
        $menu.hide();
        $(document).off('click', callback);
        $(document).on('click', repositionAndShowLeftContextMenu);
      }
    };
    if ($menu.is(':visible')) {
      $(document).off('click', repositionAndShowLeftContextMenu);
      $(document).on('click', callback);
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
  console.log('refreshHighlights , url', url);
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
      console.log('orderlessCardsCountBefore', orderlessCardsCountBefore);

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
            console.log('orderlessCardsCountAfter', orderlessCardsCountAfter);
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
          console.log('refresh order, url', url);
          loadThisUrlsHighlights(url, () => {
            console.log('storeHighlightsOrder');
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

function getHighlight() {
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
      const cardId = uuidv4();
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
        }
      );
    });
  }
}

const highlight = function(selString, container, selection, color, highlightId, callback) {
  var anchor = null;
  var focus = null;
  var anchorOffset = 0;
  var focusOffset = 0;
  var selectionString = '';
  var selectionLength = 0;
  var startFound = false;
  var charsHighlighted = 0;
  var alreadyHighlighted = true;
  // console.log('highlight called');
  // console.log(selString, container, selection, color, highlightId);
  selectionString = selString;
  selectionLength = selectionString.length;

  container = $(container);
  anchor = $(selection.anchorNode);
  anchorOffset = selection.anchorOffset;
  focus = $(selection.focusNode);
  focusOffset = selection.focusOffset;

  /**
   * STEPS:
   * 1 - Use the offset of the anchor/focus to find the start of the selected text in the anchor/focus element
   *     - Use the first of the anchor of the focus elements to appear
   * 2 - From there, go through the elements and find all Text Nodes until the selected text is all found.
   *     - Wrap all the text nodes (or parts of them) in special characters
   * 3 - Replace the special characters by span tags with a yellow background color in the container html
   * 4 - Deselect text
   */
  function recursiveWrapper(container) {
    container.contents().each(function(index, element) {
      if (element.nodeType === Node.TEXT_NODE) {
        var startIndex = 0;
        // Step 1:
        // The first element to appear could be the anchor OR the focus node,
        // since you can highlight from left to right or right to left
        if (!startFound) {
          if (anchor.is(element)) {
            startFound = true;
            startIndex = anchorOffset;
          }
          if (focus.is(element)) {
            if (startFound)
              // If the anchor and the focus elements are the same, use the smallest index
              startIndex = Math.min(anchorOffset, focusOffset);
            else {
              startFound = true;
              startIndex = focusOffset;
            }
          }
        }
        // Step 2:
        if (startFound && charsHighlighted < selectionLength) {
          var nodeValueLength = element.nodeValue.length;
          var newText = '';
          // If one of the textElement is not wrapped in a .highlighter--highlighted span,
          // the selection is not already highlighted
          var parent = element.parentElement;
          if (parent.nodeName !== 'SPAN' || parent.className !== HIGHLIGHT_CLASS)
            alreadyHighlighted = false;
          // Go over all characters to see if they match the selection.
          // This is done because the selection text and node text contents differ.
          for (var i = 0; i < nodeValueLength; i++) {
            if (i === startIndex) newText += DELIMITERS.start;
            if (charsHighlighted === selectionLength) {
              newText += DELIMITERS.end;
              newText += element.nodeValue.substr(i);
              break;
            }
            newText += element.nodeValue[i];
            if (i >= startIndex && charsHighlighted < selectionLength) {
              // Skip whitespaces as they often cause trouble (differences between selection and actual text)
              while (
                charsHighlighted < selectionLength &&
                selectionString[charsHighlighted].match(/\s/)
              )
                charsHighlighted++;

              if (selectionString[charsHighlighted] === element.nodeValue[i]) charsHighlighted++;
            }
            if (i === nodeValueLength - 1) newText += DELIMITERS.end;
          }
          element.nodeValue = newText;
        }
      } else recursiveWrapper($(element));
    });
  }
  // Step 1 + 2:
  recursiveWrapper(container);
  //  color = color ? color : 'yellow';
  color = color || 'rgba(248, 103, 13, 0.728)';
  function getReplacements(color, highlightId) {
    // console.log('get replacements. id', highlightId);
    return {
      // removed style="background-color: ' + color + ';
      // id needs to append some letters, hence the 'h-id-'
      start: `<span id="${highlightId}" class="${HIGHLIGHT_CLASS}">`,
      end: '</span>',
    };
  }
  var replacements = getReplacements(color, highlightId);

  // Step 3:
  // Either highlight, or un-highlight the selection

  // Need to take the parent in order to be able to open and close the container's root element (a <span> in the un-highlight case)
  // Also needed for the negative lookahead of the highlight case
  var parent = container.parent();
  var content = parent.html();
  // Escape Regex special characters
  function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }
  var startRe, endRe, sanitizeRe;
  if (!alreadyHighlighted) {
    startRe = new RegExp(escapeRegex(DELIMITERS.start), 'g');
    endRe = new RegExp(escapeRegex(DELIMITERS.end), 'g');
    content = content.replace(startRe, replacements.start).replace(endRe, replacements.end);

    // Make sure to not highlight the same thing twice, as it breaks the un-highlighting
    sanitizeRe = new RegExp(
      escapeRegex(replacements.start + replacements.start) +
        '(.*?)' +
        escapeRegex(replacements.end + replacements.end),
      'g'
    );
    parent.html(content.replace(sanitizeRe, replacements.start + '$1' + replacements.end));
  } else {
    startRe = new RegExp(escapeRegex(DELIMITERS.start), 'g');
    endRe = new RegExp(escapeRegex(DELIMITERS.end), 'g');
    // The trick here is to replace the start with the end and vice-versa which will remove the selected text from the highlight
    content = content.replace(startRe, replacements.end).replace(endRe, replacements.start);

    // Clean-up by removing empty spans
    sanitizeRe = new RegExp(escapeRegex(replacements.start + replacements.end), 'g');
    parent.html(content.replace(sanitizeRe, ''));
  }

  // Step 4:
  if (selection.removeAllRanges) selection.removeAllRanges();
  if (callback) callback();
  return true; // No errors. 'undefined' is returned by default if any error occurs during this method's execution, like if 'content.replace' fails by 'content' being 'undefined'
};

export { highlight };
