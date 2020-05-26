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
import { combineMineAndOthersWebsites, filterOutCardCopies } from '../utils/dataProcessing';
// import { createSidebar } from '../utils/sidebarContentScript.js';
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
    chrome.storage.local.get(['highlightsViewMode', 'jwt', 'user_collection'], items => {
      that.selectedView = items.highlightsViewMode;
      that.jwt = items.jwt;
      that.userCollection = items.user_collection;
    });
    chrome.runtime.onMessage.addListener(msg => {
      if (msg.orderRefreshed) {
        chrome.storage.local.get(['highlightsViewMode'], items => {
          that.selectedView = items.highlightsViewMode;
          // console.log('orderRefreshed');
          if (that.selectedView === 'mineAndOthers' && !that.inSidebar) {
            that.loadpageAll();
          }
        });
      }
    });
  },

  methods: {
    selectView(view) {
      const that = this;
      chrome.storage.local.get(['lastActiveTabUrl'], items => {
        chrome.storage.local.set({ highlightsViewMode: view });
        that.selectedView = view;
        chrome.runtime.sendMessage({
          refreshHighlights: true,
          refreshOrder: true,
          url: items.lastActiveTabUrl,
          sender: 'selectView',
        });
      });
    },
    openSidebarWindow() {
      chrome.storage.local.set({ runInNewWindow: true });
      chrome.runtime.sendMessage({ createSidebar: true }, () => {
        window.close();
      });
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
          // sendMessageToAllTabs({ syncing: true, value: false });
        });
      return result;
    },
    async loadpageAll() {
      function getStorage() {
        return new Promise((resolve, reject) => {
          chrome.storage.local.get(
            ['websites', 'mineAndOthersWebsites', 'lastActiveTabUrl', 'highlightsViewMode'],
            function(items) {
              // console.log('    items', items);
              const returnData = {};
              // let localDecksMeta;  // will need for adding cards to certain decks
              returnData.websites = items.websites;
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
      // console.log('storage', storage);
      if (storage.highlightsViewMode !== 'mineAndOthers') {
        chrome.runtime.sendMessage({
          refreshHighlights: true,
          refreshOrder: true,
          url: storage.lastActiveTabUrl,
          sender: 'loadPageAll, store highlights mode',
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
      if (!websites[url]) websites[url] = {};
      const apiGetWebsite = await this.callAPI(getPageData);
      // console.log('apiGetWebsite', apiGetWebsite);
      const apiWebsite = apiGetWebsite.website;
      if (isEmpty(apiWebsite)) {
        this.loadingOthers = false;
        return null;
      }
      // if the number of highlights and numbe rof cards is the same in MineAndothers and in apigetwebstie, were good
      // if mineAndOthersWebsites[url].orderdCards and orderlessCards.length is the same as the API request then we are done
      // otherwise we need to refresh the page and try again
      let apiHighlightCount = 0;
      let apiCardCount = 0;
      let localHighlightCount = 0;
      let localCardCount = 0;
      if (apiWebsite.cards)
        apiCardCount = filterOutCardCopies(apiWebsite.cards, this.userCollection.user_id).length;
      if (apiWebsite.highlights) apiHighlightCount = Object.keys(apiWebsite.highlights).length;
      if (mineAndOthersWebsites[url]) {
        if (mineAndOthersWebsites[url].orderedCards && mineAndOthersWebsites[url].orderlessCards)
          localCardCount =
            mineAndOthersWebsites[url].orderedCards.length +
            mineAndOthersWebsites[url].orderlessCards.length;
        if (mineAndOthersWebsites[url].highlights)
          localHighlightCount = Object.keys(mineAndOthersWebsites[url].highlights).length;
      }
      console.log(
        'apiHighlightCount, localHighlightCount, apiCardCount, localCardCount',
        apiHighlightCount,
        localHighlightCount,
        apiCardCount,
        localCardCount
      );
      if (apiHighlightCount !== localHighlightCount || apiCardCount !== localCardCount) {
        mineAndOthersWebsites[url] = apiWebsite;
        const combinedWebsites = combineMineAndOthersWebsites(websites, mineAndOthersWebsites);
        chrome.storage.local.set({ mineAndOthersWebsites: combinedWebsites });
        chrome.runtime.sendMessage({
          refreshHighlights: true,
          refreshOrder: true,
          url: url,
          sender: 'loadPageAll, card/highlight count unequal',
        });
      } else this.loadingOthers = false;
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
