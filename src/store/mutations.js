import * as types from './mutation-types';

export default {
  [types.updateJwt](state, newJwt) {
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
};
