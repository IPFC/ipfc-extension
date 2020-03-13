import Vue from 'vue';
import Vuex from 'vuex';
// import VuexWebExtensions from 'vuex-webextensions';
import * as getters from './getters';
import mutations from './mutations';
import * as actions from './actions';

Vue.use(Vuex);
/* warning!~ store state changes will all be saved into storage.local 
but different vue instances across the extension (background, popup, sidebar, contentscrips) will
not necearrily recieve those changes. background seems to connect to popup, but not the content scripts.
content scripts will load the storage.local into their stores at runtime, but realtime changes to the storage.local
from other parts of the app will not be updated. For these situations use messages, or watch the storage
 
we could get rid of the store entirely and use all storage calls, but this helps maintain style with the webapp
*/
export default new Vuex.Store({
  // plugins: [
  //   VuexWebExtensions({
  //     persistentStates: ['jwt', 'pinataKeys'],
  //     loggerLevel: 'verbose',
  //   }),
  // ],
  state: {
    // runInNewWindow: false,
    // jwt: null,
    // pinataKeys: null,
    // newCardData: null,
    // user_collection: null,
  },
  getters,
  mutations,
  actions,
});
