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
        <p v-if="showSignUp" class="mt-1">
          Signing up with IPFC, you will recieve a Pinata.cloud account with 1GB of free storage.
          Check your email for activation.
        </p>
        <span id="login-signup-buttons">
          <b-button
            v-if="showSignUp"
            :disabled="loginButtonDisable"
            type="submit"
            variant="primary"
            @click="signup()"
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
  computed: {
    emailValidation() {
      const email = this.input.email;
      if (email.length <= 5 || email.length >= 64) {
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
      if (email.length <= 5 || email.length >= 64) {
        return 'Email must be 5-64 characters long';
      }
      if (!email.includes('@') || !email.includes('.')) {
        return 'Invalid email';
      } else {
        return null;
      }
    },
    passwordValidation() {
      const password = this.input.password;
      if (password.length < 8 || password.length >= 64) {
        return false;
      } else {
        return true;
      }
    },
    passwordValidationErrorMsg() {
      const password = this.input.password;
      if (password.length < 8 || password.length >= 64) {
        return 'Password must be 8-20 characters long';
      } else {
        return null;
      }
    },
    // pinataApiValidation() {
    //   const pinataApi = this.input.pinataApi;
    //   if (pinataApi.length < 20 || pinataApi.length > 20) {
    //     return false;
    //   } else {
    //     return true;
    //   }
    // },
    // pinataApiValidationErrorMsg() {
    //   const pinataApi = this.input.pinataApi;
    //   if (pinataApi.length < 20 || pinataApi.length > 20) {
    //     return "Invalid pinata api key. In pinata, click the profile icon, then 'account'";
    //   } else {
    //     return null;
    //   }
    // },
    // pinataSecretValidation() {
    //   const pinataSecret = this.input.pinataSecret;
    //   if (pinataSecret.length < 64 || pinataSecret.password > 64) {
    //     return false;
    //   } else {
    //     return true;
    //   }
    // },
    // pinataSecretValidationErrorMsg() {
    //   const pinataSecret = this.input.pinataSecret;
    //   if (pinataSecret.length < 64 || pinataSecret.length > 64) {
    //     return "Invalid pinata api secret key. In pinata, click the profile icon, then 'account'";
    //   } else {
    //     return null;
    //   }
    // },
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
        signup: true,
        username: this.input.email,
        password: this.input.password,
        pinata_api: this.input.pinataApi,
        pinata_key: this.input.pinataSecret,
      });
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
