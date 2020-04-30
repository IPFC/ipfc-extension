import defaultCollection from '../assets/defaultCollection.json';

const axios = require('axios');

const callAPI = function(url, headers, method, data = null, callback = null) {
  const options = {
    url: url,
    headers: headers,
    method: method,
  };
  if (data !== null) {
    options.data = data;
  }
  // console.log('options', options);
  axios(options)
    .then(response => {
      data = response.data;
      console.log('APICall data', data);
      if (callback !== null) {
        callback(data);
        return data;
      } else return data;
    })
    .catch(function(err) {
      console.log(err.response);
      // this is runtime.sendMessage not tabs.send message because the popup.js is part of the extension
      chrome.runtime.sendMessage({
        failedLogin: true,
        apiErrorMsg: err.response.data.error || err.response,
      });
    });
};
const login = function(username, password) {
  chrome.storage.sync.get(['serverUrl'], items => {
    const loginUrl = items.serverUrl + '/login';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + btoa(username + ':' + password),
    };
    const loginCallback = function(data) {
      if (!data.token) {
        chrome.runtime.sendMessage({ failedLogin: true, apiErrorMsg: data.error });
      } else {
        chrome.storage.local.set({ jwt: data.token }, () => {
          chrome.storage.local.set({ pinata_keys: data.pinata_keys }, () => {
            getMeta(items.serverUrl, data.token);
          });
        });
      }
    };
    callAPI(loginUrl, headers, 'GET', null, loginCallback);
  });
};
function getMeta(serverUrl, token) {
  const getMetaHeaders = {
    'Content-Type': 'application/json',
    'x-access-token': token,
  };
  const getMetaURL = serverUrl + '/get_decks_meta_and_collection';
  const getMetaCallback = function(data) {
    chrome.storage.local.set(
      {
        user_collection: data.user_collection,
        decks_meta: data.decks_meta,
      },
      () => {
        chrome.runtime.sendMessage({ loginSuccess: true });
        chrome.runtime.sendMessage({ cloudSync: true });
      }
    );
  };
  callAPI(getMetaURL, getMetaHeaders, 'GET', null, getMetaCallback);
}
const signup = function(email, password) {
  chrome.storage.local.get(['serverUrl'], items => {
    const pinataSignupEndpoint = 'https://api.pinata.cloud/users/signUpNewUser';
    const pinataSignupData = {
      username: email,
      password: password,
    };
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);
    let data;
    axios
      .post(pinataSignupEndpoint, params)
      .then(response => {
        data = response.data;
        console.log('APICall data', data);
        return data;
      })
      .catch(function(err) {
        console.log(err.response);
        // this is runtime.sendMessage not tabs.send message because the popup.js is part of the extension
        chrome.runtime.sendMessage({
          failedLogin: true,
          apiErrorMsg: err.response.data.error || err.response,
        });
      });
    const pinataHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    const pinataSignupCallback = function(result) {
      const signupUrl = items.serverUrl + '/sign_up';
      const data = {
        email: email,
        password: password,
        user_collection: defaultCollection.user_collection,
        pinata_api: result.userInformation.api_key,
        pinata_key: result.userInformation.api_secret,
      };
      const headers = { 'Content-Type': 'application/json' };
      const signupCallback = function(data) {
        if (!data.message) {
          chrome.runtime.sendMessage({ failedLogin: true, apiErrorMsg: data.error });
        } else {
          login(email, password);
        }
      };
      callAPI(signupUrl, headers, 'POST', data, signupCallback);
    };
    callAPI(pinataSignupEndpoint, pinataHeaders, 'POST', pinataSignupData, pinataSignupCallback);
  });
};
export { login, signup };
