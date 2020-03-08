import { clearPageHighlights } from '../background/storageManager.js';
var $ = require('jquery');
// Remove Highlights
$('.highlighter--highlighted').css('background-color', 'inherit');
clearPageHighlights(window.location.href);
