// import { deleteAllPageHighlights } from '../background/storageManager.js';
var $ = require('jquery');
// Remove Highlights
const clearPageHighlights = callback => {
  $('.highlighter--highlighted').css('background-color', 'inherit');
  $('.highlighter--highlighted').removeClass();
  if (callback) callback();
};

// deleteAllPageHighlights(window.location.href);
export { clearPageHighlights };
