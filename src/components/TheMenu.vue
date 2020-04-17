<template>
  <b-container id="popup-menu-body">
    <b-list-group>
      <b-button v-if="!inSidebar" class="list-item" @click="openSidebarWindow">
        Open sidebar
      </b-button>
      <b-button class="list-item mb-3" @click="logout">
        Log out
      </b-button>
      <b-row v-if="!inSidebar" class="show-highlights-label">
        <p class="show-highlights-label">show highlights:</p>
      </b-row>
      <b-row v-if="!inSidebar" id="tabs-row" class="mt-auto mb-0 d-flex">
        <div
          id="mine-all"
          class="tab-div"
          :class="selectedView === 'mine' ? 'selected' : 'not-selected'"
          @click="selectView('mine')"
        >
          <p class="tab-title">Just mine</p>
        </div>
        <b-row
          id="page-all"
          class="tab-div"
          :class="selectedView === 'mineAndOthers' ? 'selected' : 'not-selected'"
          @click="selectView('mineAndOthers')"
        >
          <p class="tab-title">Mine and others</p>
          <font-awesome-icon
            v-if="loadingOthers && selectedView === 'mineAndOthers'"
            id="load-others-spinner"
            icon="spinner"
            spin
            class="align-bottom"
          ></font-awesome-icon>
        </b-row>
      </b-row>
    </b-list-group>
  </b-container>
</template>

<script>
import {
  BListGroup,
  // BListGroupItem,
  // BFormInput,
  // BForm,
  // BFormSelect,
  // BFormSelectOption,
  // BFormGroup,
} from 'bootstrap-vue';
import { createSidebar } from '../utils/sidebarContentScript.js';
import { isEmpty } from 'lodash';
const axios = require('axios');
export default {
  name: 'PopupMenu',
  components: {
    BListGroup,
    // BListGroupItem,
    // BFormInput,
    // BForm,
    // BFormSelect,
    // BFormSelectOption,
    // BFormGroup,
  },
  props: {
    inSidebar: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      selectedView: '',
      loadingOthers: false,
      jwt: '',
    };
  },
  mounted() {
    const that = this;
    chrome.storage.local.get(['highlightsViewMode', 'jwt'], items => {
      that.selectedView = items.highlightsViewMode;
      that.jwt = items.jwt;
    });
    chrome.runtime.onMessage.addListener(msg => {
      if (msg.orderRefreshed) {
        // console.log('orderRefreshed');
        if (that.selectedView === 'mineAndOthers') {
          that.loadpageAll();
        }
      }
    });
  },

  methods: {
    selectView(view) {
      chrome.storage.local.get(['lastActiveTabUrl'], items => {
        this.selectedView = view;
        chrome.runtime.sendMessage({
          refreshHighlights: true,
          refreshOrder: true,
          url: items.lastActiveTabUrl,
        });
        chrome.storage.local.set({ highlightsViewMode: view });
      });
    },
    openSidebarWindow() {
      chrome.storage.local.set({ runInNewWindow: true });
      createSidebar();
      window.close();
    },
    logout() {
      chrome.storage.local.clear(() => {
        window.close();
      });
    },
    async callAPI(data) {
      let result = null;
      const options = {
        url: data.url,
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': data.jwt,
        },
        method: data.method,
      };
      if (data.data) {
        options.data = data.data;
      }
      await axios(options)
        .then(response => {
          result = response.data;
          // console.log(result);
        })
        .catch(function(err) {
          console.log(err);
          throw new Error(err);
          // sendMesageToAllTabs({ syncing: true, value: false });
        });
      return result;
    },
    async loadpageAll() {
      function getStorage() {
        return new Promise((resolve, reject) => {
          chrome.storage.local.get(
            [
              'websites',
              'othersWebsites',
              'mineAndOthersWebsites',
              'lastActiveTabUrl',
              'highlightsViewMode',
            ],
            function(items) {
              console.log('    items', items);
              const returnData = {};
              // let localDecksMeta;  // will need for adding cards to certain decks
              returnData.websites = items.websites;
              returnData.othersWebsites = items.othersWebsites;
              returnData.mineAndOthersWebsites = items.mineAndOthersWebsites;
              returnData.lastActiveTabUrl = items.lastActiveTabUrl;
              returnData.highlightsViewMode = items.highlightsViewMode;
              if (items.lastActiveTabUrl !== undefined) {
                resolve(returnData);
              } else {
                reject(new Error('Unable to retrieve local storage'));
              }
            }
          );
        });
      }
      this.loadingOthers = true;
      const that = this;
      chrome.storage.sync.get(['serverUrl'], items => {
        that.serverUrl = items.serverUrl;
      });
      const storage = await getStorage();
      console.log('storage', storage);
      if (storage.highlightsViewMode !== 'mineAndOthers') {
        chrome.runtime.sendMessage({
          refreshHighlights: true,
          refreshOrder: true,
          url: storage.lastActiveTabUrl,
        });
        chrome.storage.local.set({ highlightsViewMode: 'mineAndOthers' });
        return null;
      }

      const url = storage.lastActiveTabUrl;
      const websites = storage.websites;
      const getPageData = {
        url: this.serverUrl + '/get_website',
        jwt: this.jwt,
        method: 'POST',
        data: { url: url },
      };
      // if mineAndOthersWebsites exists, load that, set small spinner
      // otherwise load local and set small spinner
      const mineAndOthersWebsites = storage.mineAndOthersWebsites;
      // then make API call
      let othersWebsites = storage.othersWebsites;
      if (!othersWebsites) othersWebsites = {};
      if (!websites[url]) websites[url] = {};
      const apiGetWebsite = await this.callAPI(getPageData);
      console.log('apiGetWebsite', apiGetWebsite);
      othersWebsites[url] = apiGetWebsite.website;
      chrome.storage.local.set({ othersWebsites: othersWebsites });
      // if mineAndOthersWebsites[url].cards.length is the same as others + websites, then we are done
      // otherwise we need to refresh the page and try again
      let combinedCardIds;
      if (mineAndOthersWebsites)
        if (mineAndOthersWebsites[url])
          if (mineAndOthersWebsites[url].cards) {
            combinedCardIds = [];
            if (!isEmpty(websites[url].cards))
              for (const card of websites[url].cards) combinedCardIds.push(card.card_id);
            if (!isEmpty(othersWebsites[url].cards))
              for (const card of othersWebsites[url].cards)
                if (!combinedCardIds.includes(card.card_id)) combinedCardIds.push(card.card_id);
            if (mineAndOthersWebsites[url].cards.length === combinedCardIds.length) {
              this.loadingOthers = false;
              return null;
            }
          }
      chrome.runtime.sendMessage({ refreshHighlights: true, refreshOrder: true, url: url });
      return null;
    },
  },
};
</script>

<style scoped>
#popup-menu-body {
  background: #323234;
  z-index: 50;
}
.list-item {
  background: #555555;

  margin: 7px 0;
}
.show-highlights-label {
  text-align: center;
  color: white;
  margin: 0 auto;
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
  border-radius: 5px;
  margin: 5px;
  padding: 0px 5px;
  flex-grow: 1;
  text-align: center;
}
.selected {
  background: #555555;
  color: white;
}
.not-selected {
  background: #323234;
  color: white;
}
#page-all {
  justify-content: center;
}
#load-others-spinner {
  align-self: center;
  margin-left: 8px;
}
</style>
