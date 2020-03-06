import store from './store';
global.browser = require('webextension-polyfill');

store.dispatch('checkJwt');

chrome.storage.onChanged.addListener(function(changes, namespace) {
  for (var key in changes) {
    var storageChange = changes[key];
    console.log(
      'Storage key "%s" in namespace "%s" changed. ' + 'Old value was "%s", new value is "%s".',
      key,
      namespace,
      storageChange.oldValue,
      storageChange.newValue
    );
  }
});
