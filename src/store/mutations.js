import * as types from './mutation-types';
const setStorageData = data =>
  new Promise((resolve, reject) =>
    chrome.storage.local.set(data, () =>
      chrome.runtime.lastError ? reject(Error(chrome.runtime.lastError.message)) : resolve()
    )
  );

export default {
  [types.updateJwt](state, newJwt) {
    setStorageData({ jwt: newJwt });
    // console.log('store set jwt');
    // console.log(newJwt);
    state.jwt = newJwt;
  },
  [types.deleteJwt](state) {
    setStorageData({ jwt: null });
    state.jwt = null;
  },
  [types.updatePinataKeys](state, data) {
    setStorageData({ pinataKeys: data });
    state.pinataKeys = data;
  },
  // [types.updateRunInNewWindow](state, data) {
  //   setStorageData({ runInNewWindow: data });
  //   state.runInNewWindow = data;
  // },
  [types.updateNewCardData](state, data) {
    setStorageData({ newCardData: data });
    state.newCardData = data;
  },
  [types.updateUserCollection](state, collection) {
    setStorageData({ user_collection: collection });
    state.user_collection = collection;
    // console.log('updateUserCollection', state.user_collection);
  },
};
