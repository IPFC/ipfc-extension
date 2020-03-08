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
    };
  },
  computed: {
    ...mapState(['runInNewWindow']),
  },
  methods: {
    log(...message) {
      chrome.extension.getBackgroundPage().console.log(String(message));
    },
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
      console.log(this.sidebarStyle);
    } else {
      this.windowSetting = 'in-other-window';
    }
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
