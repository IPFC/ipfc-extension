// import store from './store';
global.browser = require('webextension-polyfill');
// this listener will overload the browser runtime.lastError: QUOTA_BYTES_PER_ITEM quota exceeded
// chrome.storage.onChanged.addListener(function(changes, namespace) {
//   for (var key in changes) {
//     var storageChange = changes[key];
//     console.log(
//       'Storage key "%s" in namespace "%s" changed. ' + 'Old value was "%s", new value is "%s".',
//       key,
//       namespace,
//       storageChange.oldValue,
//       storageChange.newValue
//     );
//   }
// });

chrome.contextMenus.create({
  id: 'makeFlashCard',
  title: 'Make Flashcard',
  onclick: makeFlashcard,
  contexts: ['selection'],
});

function makeFlashcard() {
  console.log('makeFlashcard called');
  chrome.tabs.executeScript({ file: 'highlighter/called/getHighlight.js' });
}

// Get the initial color value
// chrome.storage.sync.get('color', values => {
//   var color = values.color ? values.color : 'yellow';
//   changeColor(color);
// });

changeColor();
function changeColor(color) {
  chrome.storage.sync.set({ color: '#F8690D' });
}

// can use from popup to optionally remove all highlights
// removeHighlightsBtn.addEventListener('click', removeHighlights);
const removeHighlights = function() {
  chrome.tabs.executeScript({ file: 'highlighter/called/removeHighlights.js' });
};
export { removeHighlights };
