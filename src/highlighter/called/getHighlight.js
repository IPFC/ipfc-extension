'use strict';
// import store from '.../store';
import { storeHighlight } from '../background/storageManager.js';
import { highlight } from '../background/highlighter.js';
const uuidv4 = require('uuid/v4');

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

  chrome.storage.local.get(['color', 'user_collection', 'jwtValid'], result => {
    console.log(result.user_collection, result.jwtValid);
    if (!result.user_collection) alert('please log in');
    const userId = result.user_collection.user_id;
    const color = result.color;
    const highlightId = uuidv4();
    const cardId = uuidv4();
    // these are things to be saved in the new card, so they need to be sent to the editor
    chrome.runtime.sendMessage({
      highlightSelection: true,
      newCardData: {
        selection: selectionString,
        card_id: cardId,
        user_id: userId,
        highlight_url: window.location.href,
        highlight_id: highlightId,
      },
    });
    // ** change to highlight first, then open card editor,
    // finally call store from there, then do API call, sync to db
    // get rid of color?
    // console.log(selection, container, window.location.href, color);
    console.log('new ID', highlightId);
    storeHighlight(
      selection,
      container,
      window.location.href,
      color,
      userId,
      cardId,
      highlightId,
      () => {
        highlight(selectionString, container, selection, color, highlightId);
      }
    );
  });
}
