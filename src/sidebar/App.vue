<template>
  <div id="sidebar-content-body" :class="windowSetting" :style="sidebarStyle">
    <p>
      I'm a budding young sidebar
    </p>
  </div>
</template>

<script>
import { mapState } from 'vuex';
export default {
  data() {
    return {
      windowSetting: '',
      sidebarStyle: {},
      runInNewWindow: false,
    };
  },
  computed: {
    ...mapState(['runInNewWindow']),
  },
  created() {
    const that = this;
    chrome.storage.local.get(['runInNewWindow'], function(items) {
      that.runInNewWindow = items.runInNewWindow;
    });
  },
  mounted() {
    if (!this.runInNewWindow) {
      this.windowSetting = 'in-this-window';
      let sidebarWidth = Math.round(window.innerWidth / 4);
      if (sidebarWidth > 450) {
        sidebarWidth = 450;
      } else if (sidebarWidth < 250) {
        sidebarWidth = 250;
      }
      // console.log(sidebarWidth);
      // console.log(document.body.style);

      document.body.style.width = `${window.innerWidth - sidebarWidth}px`;
      // console.log(document.body.style);

      this.sidebarStyle = {
        width: `${sidebarWidth}px`,
        left: `${window.innerWidth - sidebarWidth}px`,
        height: '100%',
        position: 'fixed',
        zIndex: 99999999,
      };
      // console.log(this.sidebarStyle);
    } else {
      this.windowSetting = 'in-other-window';
    }
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
  },
};
</script>

<style scoped>
#sidebar-content-body {
  height: 100%;
  background-color: rgb(232, 232, 232);
  overflow-y: auto;
}
.in-new-window {
}
.in-this-window {
}
</style>
