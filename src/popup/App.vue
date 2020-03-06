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
  </div>
</template>

<script>
import { mapState } from 'vuex';
import login from '../components/Login.vue';
export default {
  data() {
    return {
      loggedIn: false,
      runInThisWindow: false,
      runInNewWindow: false,
      jwt: null,
    };
  },
  computed: {
    ...mapState(['jwt', 'jwtValid']),
  },
  components: { login },
  methods: {
    setLoggedIn() {
      this.loggedIn = true;
    },
    log(...message) {
      chrome.extension.getBackgroundPage().console.log(String(message));
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
      // this.log(['check jwt', this.$store.state.jwt]);
      // this.log(['checking jwt before', this.$store.state.jwtValid]);
      await this.$store.dispatch('checkJwt');
      // this.log(['checking jwt after', this.$store.state.jwtValid]);
      if (this.$store.state.jwtValid) {
        this.loggedIn = true;
      }
    },
  },
  mounted() {
    const that = this;
    chrome.storage.sync.get(['jwt'], function(result) {
      that.$store.commit('updateJwt', result.jwt);
      that.checkJwt();
    });

    // if(this.jwt !== null) {
    //    this.checkJwt();
    // }
  },
};
</script>

<style scoped>
#popup-body {
  min-width: 300px;
}
p {
  font-size: 20px;
  color: orange;
  padding: 10px;
}
</style>
