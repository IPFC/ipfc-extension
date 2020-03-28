import { loadThisUrlsHighlights } from './storageManager.js';
var $ = require('jquery');
$(document).ready(function() {
  loadThisUrlsHighlights(window.location.href);
});
