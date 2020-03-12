<template>
  <div id="popup-body">
    <login v-if="!loggedIn" @loginSuccess="setLoggedIn" />
    <p v-if="loggedIn" @click="openSidebarWindow">
      Click to open sidebar in a new window
    </p>
    <hr v-if="loggedIn" />
    <p v-if="loggedIn" @click="openInThisWindow">
      Click to open sidebar this window
    </p>
    <p v-if="loggedIn" @click="logout">
      Click to log out
    </p>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import login from '../components/Login.vue';
export default {
  components: { login },
  data() {
    return {
      loggedIn: false,
      runInThisWindow: false,
      runInNewWindow: false,
    };
  },
  computed: {
    ...mapState(['jwt', 'jwtValid']),
  },
  created() {
    this.startUpStoreSync('popup');
  },
  mounted() {},
  methods: {
    startUpStoreSync(name) {
      const that = this;
      var port = chrome.runtime.connect({ name: name });
      port.postMessage({ startup: true });
      port.onMessage.addListener(function(msg) {
        if (msg.startup) {
          const state = JSON.parse(JSON.stringify(msg.state));
          // console.log(state);
          for (const stateItem in state) {
            if (stateItem === 'user_collection') {
              that.$store.commit('updateUserCollection', state[stateItem]);
            } else if (stateItem !== 'jwtValid') {
              const Capitalized =
                String(stateItem)
                  .charAt(0)
                  .toUpperCase() + String(stateItem).slice(1);
              // console.log('state.stateItem', state[stateItem]);
              that.$store.commit('update' + Capitalized, state[stateItem]);
              if (stateItem === 'jwt') {
                that.checkJwt();
              }
            }
          }
        }
      });
      this.storeChangeListener();
    },
    storeChangeListener() {
      const that = this;
      chrome.runtime.onConnect.addListener(function(port) {
        if (port.name === 'background') {
          port.onMessage.addListener(function(msg) {
            if (msg.stateChanged) {
              if (msg.stateItem === 'user_collection') {
                that.$store.commt('updateUserCollection', msg.value);
              } else {
                const Capitalized =
                  String(msg.stateItem)
                    .charAt(0)
                    .toUpperCase() + String(msg.stateItem).slice(1);
                that.$store.commit('update' + Capitalized, msg.value);
              }
            }
          });
        }
      });
    },
    setLoggedIn() {
      // console.log('setLoggedIn');
      this.loggedIn = true;
    },
    logout() {
      this.$store.dispatch('logout');
      window.close();
    },
    openInThisWindow() {
      chrome.tabs.executeScript({
        file: 'sidebar/sidebar.js',
      });
      this.$store.commit('updateRunInNewWindow', false);
    },
    openSidebarWindow() {
      this.$store.commit('updateRunInNewWindow', true);
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
    async checkJwt() {
      await this.$store.dispatch('checkJwt');
      if (this.$store.state.jwtValid) {
        this.loggedIn = true;
      }
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
