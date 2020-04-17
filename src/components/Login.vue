<template>
  <div>
    <div id="login-body">
      <b-alert
        :show="dismissCountDown"
        dismissible
        fade
        variant="warning"
        @dismiss-count-down="countDownChanged"
      >
        {{ apiErrorMsg }}
      </b-alert>
      <b-form id="form-signin" @submit.stop.prevent>
        <label for="feedback-email">Email</label>
        <b-form-input
          id="feedback-email"
          v-model="input.email"
          :state="emailValidation"
        ></b-form-input>
        <b-form-invalid-feedback v-if="input.email" :state="emailValidation">{{
          emailValidationErrorMsg
        }}</b-form-invalid-feedback>
        <!-- <b-form-valid-feedback :state="emailValidation">Looks Good.</b-form-valid-feedback> -->

        <label for="feedback-password">Password</label>
        <b-form-input
          id="feedback-password"
          v-model="input.password"
          :state="passwordValidation"
          type="password"
        ></b-form-input>
        <b-form-invalid-feedback v-if="input.password" :state="passwordValidation">{{
          passwordValidationErrorMsg
        }}</b-form-invalid-feedback>
        <!-- <b-form-valid-feedback :state="passwordValidation">Looks Good.</b-form-valid-feedback> -->

        <b-button
          v-if="showSignUp"
          id="button-get-pinata"
          type="submit"
          variant="primary"
          @click="OpenPinata()"
          >Get Pinata</b-button
        >
        <br />

        <label v-if="showSignUp" for="feedback-pinata-api">Pinata API key</label>
        <b-form-input
          v-if="showSignUp"
          id="feedback-pinata-api"
          v-model="input.pinataApi"
          :state="pinataApiValidation"
        ></b-form-input>
        <b-form-invalid-feedback v-if="showSignUp" :state="pinataApiValidation">{{
          pinataApiValidationErrorMsg
        }}</b-form-invalid-feedback>
        <!-- <b-form-valid-feedback v-if="showSignUp" :state="pinataApiValidation">Looks Good.</b-form-valid-feedback> -->

        <label v-if="showSignUp" for="feedback-pinata-secret">Pinata secret API key</label>
        <b-form-input
          v-if="showSignUp"
          id="feedback-pinata-secret"
          v-model="input.pinataSecret"
          :state="pinataSecretValidation"
          type="password"
        ></b-form-input>
        <b-form-invalid-feedback v-if="showSignUp" :state="pinataSecretValidation">{{
          pinataSecretValidationErrorMsg
        }}</b-form-invalid-feedback>
        <!-- <b-form-valid-feedback v-if="showSignUp" :state="pinataSecretValidation">Looks Good.</b-form-valid-feedback> -->

        <span id="login-signup-buttons">
          <b-button
            v-if="showSignUp"
            :disabled="loginButtonDisable"
            type="submit"
            variant="primary"
            @click="SignUp()"
          >
            <font-awesome-icon v-show="loggingIn" icon="spinner" spin />
            Sign up</b-button
          >
          <b-button
            v-else
            :disabled="loginButtonDisable"
            type="submit"
            variant="primary"
            @click="login()"
          >
            <font-awesome-icon v-show="loggingIn" icon="spinner" spin />
            Log in</b-button
          >

          <b-button
            v-if="showSignUp"
            id="sign-up-a"
            type="submit"
            variant="secondary"
            @click="toggleShowSignUp()"
            >Log in</b-button
          >
          <b-button
            v-else
            id="sign-up-a"
            type="submit"
            variant="secondary"
            @click="toggleShowSignUp()"
            >Sign up</b-button
          >
        </span>
      </b-form>
    </div>
  </div>
</template>
<script>
import { BForm, BFormInvalidFeedback, BFormInput, BAlert } from 'bootstrap-vue';
import defaultCollection from '../assets/defaultCollection.json';

const axios = require('axios');
export default {
  name: 'Login',
  components: { BForm, BFormInvalidFeedback, BFormInput, BAlert },
  data() {
    return {
      input: {
        email: '',
        password: '',
        pinataApi: '',
        pinataSecret: '',
      },
      apiErrorMsg: '',
      failedLogin: false,
      dismissSecs: 5,
      dismissCountDown: 0,
      loggingIn: false,
      showSignUp: false,
    };
  },
  mounted() {
    const that = this;
    chrome.runtime.onMessage.addListener(function(msg) {
      if (msg.failedLogin) {
        console.log('failed login');
        that.loggingIn = false;
        that.failedLogin = true;
        that.apiErrorMsg = msg.apiErrorMsg;
      }
      if (msg.loginSuccess) {
        console.log('loginSuccess');
        that.loggingIn = false;
        that.$emit('loginSuccess');
      }
    });
  },
  computed: {
    emailValidation() {
      const email = this.input.email;
      if (email.length < 4 || email.length > 25) {
        return false;
      }
      if (!email.includes('@') || !email.includes('.')) {
        return false;
      } else {
        return true;
      }
    },
    emailValidationErrorMsg() {
      const email = this.input.email;
      if (email.length < 4 || email.length > 25) {
        return 'Email must be 5-25 characters long';
      }
      if (!email.includes('@') || !email.includes('.')) {
        return 'Invalid email';
      } else {
        return null;
      }
    },
    passwordValidation() {
      const password = this.input.password;
      if (password.length < 8 || password.length > 20) {
        return false;
      } else {
        return true;
      }
    },
    passwordValidationErrorMsg() {
      const password = this.input.password;
      if (password.length < 8 || password.length > 20) {
        return 'Password must be 8-20 characters long';
      } else {
        return null;
      }
    },
    pinataApiValidation() {
      const pinataApi = this.input.pinataApi;
      if (pinataApi.length < 20 || pinataApi.length > 20) {
        return false;
      } else {
        return true;
      }
    },
    pinataApiValidationErrorMsg() {
      const pinataApi = this.input.pinataApi;
      if (pinataApi.length < 20 || pinataApi.length > 20) {
        return "Invalid pinata api key. In pinata, click the profile icon, then 'account'";
      } else {
        return null;
      }
    },
    pinataSecretValidation() {
      const pinataSecret = this.input.pinataSecret;
      if (pinataSecret.length < 64 || pinataSecret.password > 64) {
        return false;
      } else {
        return true;
      }
    },
    pinataSecretValidationErrorMsg() {
      const pinataSecret = this.input.pinataSecret;
      if (pinataSecret.length < 64 || pinataSecret.length > 64) {
        return "Invalid pinata api secret key. In pinata, click the profile icon, then 'account'";
      } else {
        return null;
      }
    },
    invalidSignUp() {
      if (
        !this.emailValidation ||
        !this.passwordValidation ||
        !this.pinataApiValidation ||
        !this.pinataSecretValidation
      ) {
        return true;
      } else {
        return false;
      }
    },
    invalidLogin() {
      if (!this.emailValidation || !this.passwordValidation) {
        return true;
      } else {
        return false;
      }
    },
    loginButtonDisable() {
      if (!this.emailValidation || !this.passwordValidation || this.loggingIn) {
        return true;
      } else {
        return false;
      }
    },
  },
  watch: {
    failedLogin: function() {
      if (this.failedLogin === true) {
        this.showAlert();
      }
    },
  },
  methods: {
    login() {
      this.loggingIn = true;
      this.failedLogin = false;
      chrome.runtime.sendMessage({
        login: true,
        username: this.input.email,
        password: this.input.password,
      });
    },
    signup() {
      this.loggingIn = true;
      this.failedLogin = false;
      chrome.runtime.sendMessage({
        login: true,
        username: this.input.email,
        password: this.input.password,
        pinata_api: this.input.pinataApi,
        pinata_key: this.input.pinataSecret,
      });
    },
    OcallAPI(url, headers, method, data = null, callback = null) {
      const that = this;
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
          // console.log('data', data);
          if (callback !== null) {
            callback(data, that);
            return data;
          } else return data;
        })
        .catch(function(err) {
          that.failedLogin = true;
          that.apiErrorMsg = err;
        });
    },
    Ologin() {
      this.loggingIn = true;
      this.failedLogin = false;
      const loginURL = this.serverUrl + '/login';
      const username = this.input.email;
      const password = this.input.password;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + btoa(username + ':' + password),
      };
      const loginCallback = function(data, that) {
        if (!data.token) {
          that.failedLogin = true;
          that.apiErrorMsg = data.error;
        } else {
          chrome.storage.local.set({ jwt: data.token });
          chrome.storage.local.set({ pinata_keys: data.pinata_keys });
          that.getMeta(data.token, that);
        }
      };
      this.callAPI(loginURL, headers, 'GET', null, loginCallback);
    },
    OgetMeta(token, that) {
      console.log('token', token);
      const getMetaHeaders = {
        'Content-Type': 'application/json',
        'x-access-token': token,
      };
      const getMetaURL = that.serverUrl + '/get_decks_meta_and_collection';
      const getMetaCallback = function(data) {
        chrome.storage.local.set({
          user_collection: data.user_collection,
          decks_meta: data.decks_meta,
        });
        that.loggingIn = false;
        that.$emit('loginSuccess');
        chrome.runtime.sendMessage({ cloudSync: true });
      };
      this.callAPI(getMetaURL, getMetaHeaders, 'GET', null, getMetaCallback);
    },
    OSignUp() {
      this.loggingIn = true;
      this.failedLogin = false;
      const signupURL = this.serverUrl + '/sign_up';
      const data = {
        email: this.input.email,
        password: this.input.password,
        pinata_api: this.input.pinataApi,
        pinata_key: this.input.pinataSecret,
        user_collection: defaultCollection.user_collection,
      };
      const headers = { 'Content-Type': 'application/json' };
      const signupCallback = function(data, that) {
        if (!data.message) {
          that.failedLogin = true;
          that.apiErrorMsg = data.error;
        } else {
          that.login();
        }
      };
      this.callAPI(signupURL, headers, 'POST', data, signupCallback);
    },
    toggleShowSignUp() {
      this.showSignUp = !this.showSignUp;
    },
    OpenPinata() {
      window.open('https://pinata.cloud/signup', '_blank');
    },
    countDownChanged(dismissCountDown) {
      this.dismissCountDown = dismissCountDown;
    },
    showAlert() {
      this.dismissCountDown = this.dismissSecs;
    },
  },
};
</script>

<style scoped>
#login-body {
  align-items: center;
  margin: auto;
  width: 250px;
  padding: 20px;
  overflow-y: auto;
}
h1 {
  text-align: center;
}
#form-signin {
  max-width: 330px;
}
#sign-up-a {
  margin: 10px;
}
#login-signup-buttons {
  margin-top: 10px;
}
#button-get-pinata {
  margin-top: 10px;
}
label {
  margin-top: 5px;
}
</style>
