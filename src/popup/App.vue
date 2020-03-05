<template>
  <div id="popup-body">
    <login v-if="!loggedIn" @loginSuccess="setLoggedIn" />
    <p v-if="loggedIn" @click="resizeInitialWindow">Click to open sidebar</p>
  </div>
</template>

<script>
import login from '../components/Login.vue';
export default {
  name: 'sidebar',
  data() {
    return {
      loggedIn: false,
    };
  },
  components: { login },
  methods: {
    setLoggedIn() {
      this.log('  set login to true')
      this.loggedIn = true;
    },
    log(message) {
      chrome.extension.getBackgroundPage().console.log(message);
    },
    resizeInitialWindow() {
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

<style lang="scss" scoped>
p {
  font-size: 20px;
  color: orange;
  padding: 10px;
}
</style>
