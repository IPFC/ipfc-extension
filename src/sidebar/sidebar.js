import Vue from 'vue';
import App from './App';
import store from '../store';

global.browser = require('webextension-polyfill');
Vue.prototype.$browser = global.browser;

// need this for creating app when filling in a content_script
const app = document.createElement('div');
app.id = 'app';
document.body.prepend(app);

/* eslint-disable no-new */
new Vue({
  el: '#app',
  store,

  render: h => h(App),
});
