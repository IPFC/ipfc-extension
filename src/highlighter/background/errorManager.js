import { loadHighlight } from './storageManager.js';

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

export { addHighlightError };
