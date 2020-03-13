import * as types from './mutation-types';

// export const setFoo = ({ commit }, payload) => {
//   commit(types.UPDATE_FOO, payload);
// };

const logout = context => {
  context.commit(types.deleteJwt);
};

export { logout };
