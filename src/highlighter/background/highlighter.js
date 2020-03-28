// import { addHighlightError } from './errorManager.js';
// import { highlight, highlightsOrder } from './highlighter.js';
import { clearPageHighlights } from '../called/removeHighlights';
var $ = require('jquery');
//
// HIGHLIGHTER
//

// Pick a combination of characters that should (almost) never occur
var DELIMITERS = {
  start: '~|:;',
  end: ';:~|',
};

var HIGHLIGHT_CLASS = 'highlighter--highlighted';

const highlightsOrder = function() {
  const highlightsInOrder = [];
  $('.' + HIGHLIGHT_CLASS).each(function() {
    // console.log('highlight order this', this);
    highlightsInOrder.push(this.id);
  });
  // console.log('highlightsInOrder', highlightsInOrder);
  return highlightsInOrder;
};

var clickedHighlightId;

const setupContextMenu = function() {
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
      console.log('offsetLeft, offsetHeight, offsetTop', offsetLeft, offsetHeight, offsetTop);
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
        console.log('delete clicked');
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

  $(document).off('click');
  $(document).on('click', repositionAndShowLeftContextMenu);
};

$(document).ready(setupContextMenu);

chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.focusMainWinHighlight) {
    // console.log('focusMainWinHighlight msg', msg);
    focusHighlight(msg.highlightId);
  }
});

const focusHighlight = function(highlightId) {
  $('html, body').animate(
    {
      scrollTop: $('#' + highlightId).offset().top - 200,
    },
    400
  );
};

function getReplacements(color, highlightId) {
  // console.log('get replacements. id', highlightId);
  return {
    // removed style="background-color: ' + color + ';
    // id needs to append some letters, hence the 'h-id-'
    start: `<span id="${highlightId}" class="${HIGHLIGHT_CLASS}">`,
    end: '</span>',
  };
}

var anchor = null;
var focus = null;
var anchorOffset = 0;
var focusOffset = 0;
var selectionString = '';
var selectionLength = 0;

var startFound = false;
var charsHighlighted = 0;

var alreadyHighlighted = true;

function resetVars() {
  anchor = null;
  focus = null;
  anchorOffset = 0;
  focusOffset = 0;
  selectionString = '';
  selectionLength = 0;
  startFound = false;
  charsHighlighted = 0;
  alreadyHighlighted = true;
}

const highlight = function(selString, container, selection, color, highlightId, callback) {
  resetVars();
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

  // Step 1 + 2:
  recursiveWrapper(container);
  //  color = color ? color : 'yellow';
  color = color ? color : 'rgba(248, 103, 13, 0.728)';
  var replacements = getReplacements(color, highlightId);

  // Step 3:
  // Either highlight, or un-highlight the selection

  // Need to take the parent in order to be able to open and close the container's root element (a <span> in the un-highlight case)
  // Also needed for the negative lookahead of the highlight case
  var parent = container.parent();
  var content = parent.html();

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

/** UTILS **/

// Escape Regex special characters
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

//
// STORAGE MANAGER
//

// consider not storing color

// $(document).ready(function() {
//   // chrome.runtime.sendMessage({ pageLoaded: true });
//   loadThisUrlsHighlights(window.location.href);
// });

chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.refresh) loadThisUrlsHighlights(window.location.href);
});

const storeHighlightsOrder = function(url) {
  chrome.storage.local.get(['highlights'], items => {
    const highlights = items.highlights;
    highlights[url].order = highlightsOrder();
    chrome.storage.local.set({ highlights });
  });
};

const storeHighlight = function(
  selection,
  container,
  url,
  color,
  userId,
  cardId,
  highlightId,
  callback
) {
  console.log('storeHighlight called');
  chrome.storage.local.get(['highlights'], items => {
    let highlights = items.highlights;
    if (!highlights) highlights = {};
    console.log('highlights', highlights);
    if (!highlights[url]) highlights[url] = {};
    highlights[url][highlightId] = {
      string: selection.toString(),
      container: getQuery(container),
      anchorNode: getQuery(selection.anchorNode),
      anchorOffset: selection.anchorOffset,
      focusNode: getQuery(selection.focusNode),
      focusOffset: selection.focusOffset,
      color: color,
      highlight_id: highlightId,
      user_id: userId,
      card_id: cardId,
      visibility: 'public',
      editable_by: 'public',
      edited: new Date().getTime(),
      created: new Date().getTime(),
    };
    console.log('highlights[url]', highlights[url]);
    // console.log('thisURLsHighlights', thisURLsHighlights);
    chrome.storage.local.set({ highlights });
    if (callback) callback();
  });
};

const storeCard = function(card, callback) {
  console.log('store card. card', card);
  const url = card.highlight_url;
  chrome.storage.local.get({ highlights: {} }, items => {
    let highlights = items.highlights;
    if (!highlights) highlights = {};
    console.log('store-card, highlights', highlights);
    if (!highlights[url]) highlights[url] = {};
    console.log(highlights[url]);

    if (!highlights[url].cards) highlights[url].cards = [];
    highlights[url].cards.push(card);
    console.log('card stored', highlights[url].cards);
    chrome.storage.local.set({ highlights });
    chrome.runtime.sendMessage({ newCardSaved: true, card: card });
    if (callback) callback();
  });
};

const loadThisUrlsHighlights = function(url, callback) {
  // console.log('loadThisUrlsHighlights');
  chrome.storage.local.get({ highlights: {} }, function(items) {
    // console.log('load highlights items');
    const highlights = items.highlights;
    const thisURLsHighlights = highlights[url];
    console.log('thisURLsHighlights', thisURLsHighlights);
    if (thisURLsHighlights !== undefined) {
      const highlightIds = Object.keys(thisURLsHighlights);
      // console.log('highlightIds', highlightIds);
      for (const key of highlightIds) {
        if (key !== 'cards' && key !== 'order') loadHighlight(thisURLsHighlights[key]);
      }
    }
    if (callback) callback();
  });
};
$(document).ready(loadThisUrlsHighlights(window.location.href));

const loadHighlight = function(highlightVal, noErrorTracking) {
  // noErrorTracking is optional
  // console.log('load highlight called');
  // console.log('highlightVal', highlightVal);
  // console.log('anchor node', highlightVal.anchorNode);
  const selection = {
    anchorNode: elementFromQuery(highlightVal.anchorNode),
    anchorOffset: highlightVal.anchorOffset,
    focusNode: elementFromQuery(highlightVal.focusNode),
    focusOffset: highlightVal.focusOffset,
  };
  // console.log(selection);
  const selectionString = highlightVal.string;
  const container = elementFromQuery(highlightVal.container);
  const color = highlightVal.color;
  if (!selection.anchorNode || !selection.focusNode || !container) {
    if (!noErrorTracking) {
      addHighlightError(highlightVal);
    }
    return false;
  } else {
    const success = highlight(
      selectionString,
      container,
      selection,
      color,
      highlightVal.highlight_id
    );
    if (!noErrorTracking && !success) {
      addHighlightError(highlightVal);
    }
    return success;
  }
};

function elementFromQuery(storedQuery) {
  // console.log('stored query', storedQuery);
  const re = />textNode:nth-of-type\(([0-9]+)\)$/i;
  const items = re.exec(storedQuery);
  // console.log('stored querey regex items', items);
  // console.log('$(storedQuery)[0]', $(storedQuery)[0]);
  if (items) {
    // For text nodes, nth-of-type needs to be handled differently (not a valid CSS selector)
    const textNodeIndex = parseInt(items[1]);
    // console.log('textNodeIndex', textNodeIndex);
    const storedQuery2 = storedQuery.replace(re, '');
    // console.log('storedQuery, replaced', storedQuery2);
    // console.log('element', $(storedQuery2));
    const parent = $(storedQuery2)[0];
    // console.log('parent', parent);
    if (!parent) return undefined;
    return parent.childNodes[textNodeIndex];
  } else return $(storedQuery)[0];
}

// From an DOM element, get a query to that DOM element
function getQuery(element) {
  // console.log('getQuery', element);
  if (element.id) return '#' + escapeCSSString(element.id);
  if (element.localName === 'html') return 'html';
  const parent = element.parentNode;
  let index;
  const parentSelector = getQuery(parent);
  // The element is a text node
  if (!element.localName) {
    // Find the index of the text node:
    index = Array.prototype.indexOf.call(parent.childNodes, element);
    return parentSelector + '>textNode:nth-of-type(' + index + ')';
  } else {
    const jEl = $(element);
    index = jEl.index(parentSelector + '>' + element.localName) + 1;
    return parentSelector + '>' + element.localName + ':nth-of-type(' + index + ')';
  }
}
// Colons and spaces are accepted in IDs in HTML but not in CSS syntax
// Similar (but much more simplified) to the CSS.escape() working draft
function escapeCSSString(cssString) {
  return cssString.replace(/(:)/g, '\\$1');
}

const deleteAllPageHighlights = function(url) {
  chrome.storage.local.get({ highlights: {} }, items => {
    const highlights = items.highlights;
    delete highlights[url];
    chrome.storage.local.set({ highlights });
  });
};

const deleteHighlight = function(url, id) {
  chrome.storage.local.get({ highlights: {} }, items => {
    const highlights = items.highlights;
    console.log('delete highlights[url] before', highlights[url]);

    console.log('delete id;', id);
    delete highlights[url][id];
    console.log('delete highlights[url] after', highlights[url]);

    const cards = highlights[url].cards;
    // console.log('cards before delete', cards);
    for (const card of cards) {
      if (card.highlight_id === id) {
        cards.splice(cards.indexOf(card), 1);
        break;
      }
    }
    // console.log('cards after', cards);

    chrome.storage.local.set({ highlights });
    chrome.runtime.sendMessage({ highlightDeleted: true });
    // window.location.reload();
    clearPageHighlights(() => {
      loadThisUrlsHighlights(url, () => {
        storeHighlightsOrder(url);
      });
    });
  });
};

//
// ERROR MANAGER
//

var MAX_RETRY_TIME = 5000; // Stop trying to highlight after this time (in ms)
var RETRY_INTERVAL = 500;
// ** later we can have the cards that weren't added at a
// seperate part of the list, and user can reselect location
var highlightErrors = [];

const addHighlightError = function(highlightVal) {
  highlightErrors.push({
    highlight: highlightVal,
    errorTime: Date.now(),
  });
  // if (highlightErrors.length > 0) {
  //   for (const error of highlightErrors) {
  //     console.log('addHighlightError');
  //     console.log(error);
  //   }
  // }
};

setInterval(() => {
  highlightErrors.forEach((highlightError, idx) => {
    if (Date.now() - highlightError.errorTime > MAX_RETRY_TIME) {
      // Stop the search
      // failed, log out
      console.log('error adding highlight: ', highlightError.highlight);
      highlightErrors.splice(idx, 1);
    } else {
      // Keep retrying
      var success = loadHighlight(highlightError.highlight, true);
      if (success) {
        highlightErrors.splice(idx, 1);
      }
    }
  });
}, RETRY_INTERVAL);

//
// GET HIGHLIGHT
//
const uuidv4 = require('uuid/v4');

const getHighlight = function() {
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
      if (!items.user_collection) alert('please log in to IPFC');
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
};
chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.getHighlight) {
    getHighlight();
  }
});

export {
  loadHighlight,
  storeHighlight,
  storeHighlightsOrder,
  storeCard,
  deleteAllPageHighlights,
  deleteHighlight,
};
