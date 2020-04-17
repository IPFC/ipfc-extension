<template>
  <div id="popup-body">
    <the-navbar v-if="loggedIn"></the-navbar>
    <the-menu v-if="loggedIn"></the-menu>

    <login v-if="!loggedIn" @loginSuccess="setLoggedIn" />
  </div>
</template>

<script>
import Login from '../components/Login.vue';
import TheNavbar from '../components/TheNavbar.vue';
import TheMenu from '../components/TheMenu.vue';
export default {
  components: { Login, TheNavbar, TheMenu },
  data() {
    return {
      loggedIn: false,
      runInNewWindow: false,
      jwt: null,
    };
  },
  mounted() {
    // console.log(this.checkJwt());
    this.checkJwt().then(value => {
      // console.log(value);
      if (value) this.loggedIn = true;
      else this.loggedIn = false;
    });
  },
  methods: {
    async checkJwt() {
      const getJwt = function() {
        return new Promise(resolve => {
          chrome.storage.local.get(['jwt'], function(items) {
            resolve(items.jwt);
          });
        });
      };
      const jwt = await getJwt();
      // console.log('jwt', jwt);
      if (jwt === null) {
        return false;
      } else if (!jwt || jwt.split('.').length < 3) {
        return false;
      } else {
        const data = JSON.parse(atob(jwt.split('.')[1]));
        const exp = new Date(data.exp * 1000); // JS deals with dates in milliseconds since epoch, python in seconds
        const now = new Date();
        if (now < exp) {
          return true;
        }
      }
    },
    setLoggedIn() {
      // console.log('setLoggedIn');
      this.loggedIn = true;
    },
    // openInThisWindow() {
    //   chrome.storage.local.set({ runInNewWindow: false });
    //   chrome.tabs.executeScript({
    //     file: 'sidebar/sidebar.js',
    //   });
    //   window.close();
    // },
  },
};
</script>

<style scoped>
#popup-body {
  min-width: 300px;
  background-color: #f6f6f6;
  padding: 0;
}
p {
  font-size: 20px;
  color: orange;
  padding: 10px;
}
</style>
