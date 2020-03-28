'use strict';
// import store from '.../store';
import { storeHighlight, storeHighlightsOrder } from '../background/storageManager.js';
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
