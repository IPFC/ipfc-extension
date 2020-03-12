import * as types from './mutation-types';

// export const setFoo = ({ commit }, payload) => {
//   commit(types.UPDATE_FOO, payload);
// };
const checkJwt = context => {
  const jwt = context.state.jwt;
  if (jwt === null) {
    context.commit(types.updateJwtValid, false);
  } else if (!jwt || jwt.split('.').length < 3) {
    context.commit(types.updateJwtValid, false);
  } else {
    const data = JSON.parse(atob(jwt.split('.')[1]));
    const exp = new Date(data.exp * 1000); // JS deals with dates in milliseconds since epoch, python in seconds
    const now = new Date();
    context.commit('updateJwtValid', now < exp);
  }
};

const logout = context => {
  context.commit(types.deleteJwt);
  context.commit(types.updateJwtValid, false);
};

export { checkJwt, logout };
