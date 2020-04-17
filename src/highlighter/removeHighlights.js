var $ = require('jquery');
const clearPageHighlights = callback => {
  $('.highlighter--highlighted').css('background-color', 'inherit');
  $('.highlighter--highlighted').removeClass();
  if (callback) callback();
};

// deleteAllPageHighlights(window.location.href);
export { clearPageHighlights };
