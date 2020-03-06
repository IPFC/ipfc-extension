import * as types from './mutation-types';
const setStorageData = data =>
  new Promise((resolve, reject) =>
    chrome.storage.sync.set(data, () =>
      chrome.runtime.lastError ? reject(Error(chrome.runtime.lastError.message)) : resolve()
    )
  );

export default {
  [types.updateJwt](state, newJwt) {
    setStorageData({ jwt: newJwt });
    console.log('store set jwt');
    console.log(newJwt);
    state.jwt = newJwt;
  },
  [types.deleteJwt](state) {
    state.jwt = null;
  },
  [types.toggleJwtValid](state, bool) {
    state.jwtValid = bool;
  },
  [types.updatePinataKeys](state, data) {
    state.pinataKeys = data;
  },
  [types.updateRunInNewWindow](state, data) {
    state.runInNewWindow = data;
  },
};
