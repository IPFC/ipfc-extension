// https://eslint.org/docs/user-guide/configuring
// File taken from https://github.com/vuejs-templates/webpack/blob/1.3.1/template/.eslintrc.js, thanks.

module.exports = {
  root: true,
  parserOptions: {
    parser: 'babel-eslint',
  },
  parser: 'vue-eslint-parser',
  env: {
    browser: true,
    webextensions: true,
  },
  extends: [
    'plugin:vue/recommended',
    'standard',
    'eslint:recommended',
    'plugin:prettier/recommended',
    'prettier/vue',
  ],
  // required to lint *.vue files
  plugins: ['vue'],
  // add your custom rules here
  rules: {
    // allow async-await
    'generator-star-spacing': 'off',
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
  },
};
