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
export default {
  components: { login },
  data() {
    return {
      loggedIn: false,
      runInNewWindow: false,
      jwt: null,
    };
  },
  created() {},
  mounted() {
    console.log(this.checkJwt());
    this.checkJwt().then(value => {
      console.log(value);
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
      console.log('jwt', jwt);
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
      chrome.storage.local.set({ updateRunInNewWindow: false });
      chrome.tabs.executeScript({
        file: 'sidebar/sidebar.js',
      });
    },
    openSidebarWindow() {
      chrome.storage.local.set({ updateRunInNewWindow: true });
      chrome.windows.getCurrent(function(win) {
        const sidebar = {
          type: 'popup',
          url: 'sidebar/sidebar.html',
        };
        sidebar.height = win.height;
        sidebar.top = win.top;
        sidebar.width = Math.round(win.width * 0.25);
        if (sidebar.width > 450) {
          sidebar.width = 450;
        } else if (sidebar.width < 250) {
          sidebar.width = 250;
        }
        let updatedWinLeft = win.left;
        let updatedWinWidth = win.width - sidebar.width;
        if (updatedWinWidth < 500) {
          updatedWinWidth = 500;
        }
        // if it won't fit on the left, put it on the right
        if (win.left + updatedWinWidth + sidebar.width > window.screen.availWidth) {
          updatedWinLeft += win.width - updatedWinWidth;
          sidebar.left = updatedWinLeft - sidebar.width;
        } else {
          sidebar.left = win.left + updatedWinWidth;
        }
        chrome.windows.update(win.id, { width: updatedWinWidth, left: updatedWinLeft });
        chrome.windows.create(sidebar);
      });
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
