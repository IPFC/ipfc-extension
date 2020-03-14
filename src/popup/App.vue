<template>
  <div id="popup-body">
    <login v-if="!loggedIn" @loginSuccess="setLoggedIn" />
    <p v-if="loggedIn" @click="openSidebarWindow">
      Open sidebar in a new window
    </p>
    <hr v-if="loggedIn" />
    <p v-if="loggedIn" @click="openInThisWindow">
      Open sidebar this window
    </p>
    <hr v-if="loggedIn" />
    <p v-if="loggedIn" @click="logout">
      Log out
    </p>
  </div>
</template>

<script>
import login from '../components/Login.vue';
import { createSidebar } from '../utils/sidebarContentScript.js';
export default {
  components: { login },
  data() {
    return {
      loggedIn: false,
      runInNewWindow: false,
      jwt: null,
    };
  },
  created() {
    chrome.windows.getCurrent(function(win) {
      chrome.runtime.sendMessage({ popupWinId: win.id });
    });
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
    logout() {
      chrome.storage.local.set({ jwt: null, user_collection: null, highlights: null });
      window.close();
    },
    openInThisWindow() {
      chrome.storage.local.set({ runInNewWindow: false });
      chrome.tabs.executeScript({
        file: 'sidebar/sidebar.js',
      });
      window.close();
    },
    openSidebarWindow() {
      chrome.storage.local.set({ runInNewWindow: true });
      createSidebar();
      window.close();
    },
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
