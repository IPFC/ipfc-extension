import * as types from './mutation-types';

// export const setFoo = ({ commit }, payload) => {
//   commit(types.UPDATE_FOO, payload);
// };

export const checkJwt = context => {
  const jwt = context.state.jwt;
  if (jwt === null) {
    context.commit(types.toggleJwtValid, false);
  } else if (!jwt || jwt.split('.').length < 3) {
    context.commit(types.toggleJwtValid, false);
  } else {
    const data = JSON.parse(atob(jwt.split('.')[1]));
    const exp = new Date(data.exp * 1000); // JS deals with dates in milliseconds since epoch, python in seconds
    const now = new Date();
    context.commit('toggleJwtValid', now < exp);
  }
};
