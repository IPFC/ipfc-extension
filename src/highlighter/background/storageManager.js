import { addHighlightError } from './errorManager.js';
import { highlight, highlightsOrder } from './highlighter.js';
import { clearPageHighlights } from '../called/removeHighlights';
var $ = require('jquery');
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

export {
  loadThisUrlsHighlights,
  loadHighlight,
  storeHighlight,
  storeHighlightsOrder,
  storeCard,
  deleteAllPageHighlights,
  deleteHighlight,
};
