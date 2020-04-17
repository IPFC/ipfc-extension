import Vue from 'vue';
import App from './App';
// import store from '../store';
import '../assets/_custom.scss';
import { LayoutPlugin, BButton } from 'bootstrap-vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  // faMinusCircle,
  // faToggleOn,
  // faToggleOff,
  // faEllipsisH,
  faPlusCircle,
  // faStepForward,
  // faStepBackward,
  faEdit,
  // faUndo,
  faTrashAlt,
  faSearch,
  faCloud,
  faCheck,
  // faTimes,
  faSync,
  faSpinner,
  faExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon, FontAwesomeLayers } from '@fortawesome/vue-fontawesome';

library.add(
  // faMinusCircle,
  // faToggleOn,
  // faToggleOff,
  // faEllipsisH,
  faPlusCircle,
  // faStepForward,
  // faStepBackward,
  faEdit,
  // faUndo,
  faTrashAlt,
  faSearch,
  faCloud,
  faCheck,
  // faTimes,
  faSync,
  faSpinner,
  faExclamation
);

Vue.component('font-awesome-icon', FontAwesomeIcon);
Vue.component('font-awesome-layers', FontAwesomeLayers);

Vue.use(LayoutPlugin);
Vue.component('b-button', BButton);

global.browser = require('webextension-polyfill');
Vue.prototype.$browser = global.browser;

// need this for creating app when filling in a content_script
// chrome.storage.local.get(['runInNewWindow'], function(items) {
//   if (!items.runInNewWindow) {
//     const app = document.createElement('div');
//     app.id = 'app';
//     document.body.prepend(app);
//     /* eslint-disable no-new */
//     new Vue({
//       el: '#app',
//       // store,
//       render: h => h(App),
//     });
//   } else {
//     /* eslint-disable no-new */
//     new Vue({
//       el: '#app',
//       // store,
//       render: h => h(App),
//     });
//   }
// });

/* eslint-disable no-new */
new Vue({
  el: '#app',
  // store,
  render: h => h(App),
});
