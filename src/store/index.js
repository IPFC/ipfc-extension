import Vue from 'vue';
import Vuex from 'vuex';
import VuexWebExtensions from 'vuex-webextensions';
import * as getters from './getters';
import mutations from './mutations';
import * as actions from './actions';

Vue.use(Vuex);

export default new Vuex.Store({
  plugins: [
    VuexWebExtensions({
      persistentStates: ['jwt', 'pinataKeys'],
      loggerLevel: 'verbose',
    }),
  ],
  state: {
    jwt: null,
    jwtValid: false,
    pinataKeys: null,
  },
  getters,
  mutations,
  actions,
});
