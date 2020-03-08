'use strict';
import { storeHighlight } from '../background/storageManager.js';
import { highlight } from '../background/highlight.js';
var selection = window.getSelection();
var selectionString = selection.toString();
// console.log('getHightCalled');

if (selectionString) {
  // If there is text selected
  var container = selection.getRangeAt(0).commonAncestorContainer;
  // Sometimes the element will only be text. Get the parent in that case
  while (!container.innerHTML) {
    container = container.parentNode;
  }
  chrome.storage.sync.get('color', values => {
    var color = values.color;
    // ** change to highlight first, then open card editor,
    // finally call store from there, then do API call, sync to db
    // get rid of color?
    // console.log(selection, container, window.location.href, color);
    storeHighlight(selection, container, window.location.href, color, () => {
      highlight(selectionString, container, selection, color);
    });
  });
}
