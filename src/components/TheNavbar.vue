<template>
  <div id="the-navbar">
    <b-container>
      <b-row id="nav-row">
        <b-col :class="inSidebar ? 'd-flex p-0' : 'd-flex py-0 px-1'">
          <img
            v-if="inSidebar"
            src="/icons/hamburger.svg"
            alt="menu"
            class="nav-itm m-2"
            @click="toggleMenu()"
          />
          <!-- <img src="/icons/search.svg" alt="search" class="nav-itm m-2" /> -->
          <img
            src="/icons/add-card-icon.svg"
            alt="add card"
            class="nav-itm m-2"
            @click="addNewBlankCard()"
          />
          <b-link id="sync-link" aria-label="sync status" @click="callSync()">
            <font-awesome-layers id="sync-layers" class="fa-lg">
              <font-awesome-icon id="cloud" style="color: white;" class="fa-lg" icon="cloud" />
              <font-awesome-icon
                v-if="syncing"
                id="sync-spinner"
                class="fa-xs cloud-inner-icon"
                spin
                icon="sync"
              />
              <font-awesome-icon
                v-else-if="syncNotUpToDate"
                id="exclamation"
                class="fa-xs cloud-inner-icon"
                icon="exclamation"
              />
              <font-awesome-icon
                v-else
                id="checkmark"
                class="fa-xs cloud-inner-icon"
                icon="check"
              />
            </font-awesome-layers>
          </b-link>

          <div class="d-flex ml-auto mt-1" @click="openWebapp()">
            <img class="nav-itm ml-auto" src="/icons/IPFC-and-logo.svg" alt="IPFC" />
          </div>
        </b-col>
      </b-row>
      <b-row v-if="menuOpen">
        <the-menu :in-sidebar="inSidebar"></the-menu>
      </b-row>
      <b-row v-else-if="inSidebar" id="tabs-row" class="mt-auto mb-0">
        <div
          id="mine-all"
          class="tab-div"
          :class="selectedTab === 'mine-all' ? 'selected' : 'not-selected'"
          @click="selectTab('mine-all')"
        >
          <p class="tab-title">Mine: all</p>
        </div>
        <div
          id="page-all"
          class="tab-div"
          :class="selectedTab === 'page-all' ? 'selected' : 'not-selected'"
          @click="selectTab('page-all')"
        >
          <p class="tab-title">Page: all</p>
        </div>
        <div
          id="page-mine"
          class="tab-div"
          :class="selectedTab === 'page-mine' ? 'selected' : 'not-selected'"
          @click="selectTab('page-mine')"
        >
          <p class="tab-title">Page: mine</p>
        </div>
      </b-row>
    </b-container>
  </div>
</template>
<script>
import { BLink } from 'bootstrap-vue';
import TheMenu from '../components/TheMenu.vue';
export default {
  name: 'TheNavbar',
  components: { BLink, TheMenu },
  props: {
    inSidebar: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      selectedTab: 'page-mine',
      syncing: false,
      syncNotUpToDate: false,
      menuOpen: false,
    };
  },
  mounted() {
    chrome.runtime.onMessage.addListener(msg => {
      if (msg.syncing) {
        // console.log('msg', msg);
        if (msg.value) this.syncing = true;
        if (!msg.value) this.syncing = false;
      }
      if (msg.syncNotUpToDate) {
        // console.log('msg', msg);
        if (msg.value) this.syncNotUpToDate = true;
        if (!msg.value) this.syncNotUpToDate = false;
      }
    });
  },
  methods: {
    selectTab(tab) {
      this.selectedTab = tab;
      this.$emit('tabSelected', tab);
    },
    callSync() {
      chrome.runtime.sendMessage({ cloudSync: true });
    },
    toggleMenu() {
      this.menuOpen = !this.menuOpen;
    },
    openWebapp() {
      chrome.tabs.create({ url: 'https://ipfc.tech' });
    },
    addNewBlankCard() {
      chrome.runtime.sendMessage({ newBlankCard: true });
    },
  },
};
</script>
<style scoped>
#the-navbar {
  width: 100%;
  background-color: #323234;
}
.nav-itm:hover {
  cursor: pointer;
}
#tabs-row {
  justify-content: space-evenly;
}
.tab-title {
  margin-top: 5px;
  margin-bottom: 8px;
}
.tab-title:hover {
  cursor: pointer;
}
.tab-div {
  border-radius: 5px 5px 0px 0px;
  margin: 5px 0px 0px 0px;
  padding: 0px 5px;
  flex-grow: 1;
  text-align: center;
}
.selected {
  background: #f6f6f6;
  color: black;
}
.not-selected {
  background: #323234;
  color: white;
}
#sync-link {
  display: flex;
  margin-left: 3px;
}
#sync-layers {
  align-self: center;
}
.cloud-inner-icon {
  color: #323234;
}
#cloud {
  width: 33px;
}
#exclamation {
  margin: 3px 0px 0px 12px;
  -webkit-animation: pulsate 1s ease-out;
  animation: pulsate 1s ease-out;
  -webkit-animation-iteration-count: infinite;
  animation-iteration-count: infinite;
  opacity: 0;
}
#sync-spinner {
  margin: 4px 0px 0px 8px;
}
#checkmark {
  margin: 5px 0px 0px 8px;
}
@-webkit-keyframes pulsate {
  0% {
    -webkit-transform: scale(1, 1);
    opacity: 1;
  }
  50% {
    -webkit-transform: scale(1.2, 1.2);
    opacity: 1;
  }
  100% {
    -webkit-transform: scale(1, 1);
    opacity: 1;
  }
}
@keyframes pulsate {
  0% {
    -webkit-transform: scale(1, 1);
    opacity: 1;
  }
  50% {
    -webkit-transform: scale(1.2, 1.2);
    opacity: 1;
  }
  100% {
    -webkit-transform: scale(1, 1);
    opacity: 1;
  }
}
</style>
