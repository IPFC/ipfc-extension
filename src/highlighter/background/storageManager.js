import { addHighlightError } from './errorManager.js';
import { highlight } from './highlight.js';
var $ = require('jquery');
// consider not storing color
const storeHighlight = function(selection, container, url, color, callback) {
  // console.log('storeHighlight called');
  chrome.storage.local.get({ highlights: {} }, result => {
    var highlights = result.highlights;

    if (!highlights[url]) highlights[url] = [];
    //
    // highlights = { 'url': [ { string: '', container: ... }, {...}]}
    highlights[url].push({
      string: selection.toString(),
      container: getQuery(container),
      anchorNode: getQuery(selection.anchorNode),
      anchorOffset: selection.anchorOffset,
      focusNode: getQuery(selection.focusNode),
      focusOffset: selection.focusOffset,
      color: color,
    });
    // console.log('highlights[url]', highlights[url]);
    chrome.storage.local.set({ highlights });
    if (callback) callback();
  });
};

const loadAllHighlights = function(url) {
  // console.log('loadAllHighlights');
  chrome.storage.local.get({ highlights: {} }, function(result) {
    // console.log('load highlights result');
    const highlights = result.highlights[url];
    // console.log(highlights);
    if (result.highlights[url] !== undefined) {
      for (let i = 0; highlights && i < highlights.length; i++) {
        loadHighlight(highlights[i]);
      }
    }
  });
};

const loadHighlight = function(highlightVal, noErrorTracking) {
  // noErrorTracking is optional
  // console.log('load highlight called');
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
    const success = highlight(selectionString, container, selection, color);
    if (!noErrorTracking && !success) {
      addHighlightError(highlightVal);
    }
    return success;
  }
};

function elementFromQuery(storedQuery) {
  // console.log('stored query', storedQuery);
  const re = />textNode:nth-of-type\(([0-9]+)\)$/i;
  const result = re.exec(storedQuery);
  // console.log('stored querey regex result', result);
  // console.log('$(storedQuery)[0]', $(storedQuery)[0]);
  if (result) {
    // For text nodes, nth-of-type needs to be handled differently (not a valid CSS selector)
    const textNodeIndex = parseInt(result[1]);
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

const clearPageHighlights = function(url) {
  chrome.storage.local.get({ highlights: {} }, result => {
    const highlights = result.highlights;
    delete highlights[url];
    chrome.storage.local.set({ highlights });
  });
};

export { loadHighlight, storeHighlight, clearPageHighlights, loadAllHighlights };
