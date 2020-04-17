<template>
  <div id="sidebar-body" :class="windowSetting" class="scroller" :style="sidebarStyle">
    <the-navbar ref="theNavbar" :in-sidebar="true" @tabSelected="switchTab" />
    <b-container v-if="loaded" class="sidebar-content-main">
      <b-row
        v-if="loadingOthers && selectedTab === 'page-all'"
        class="d-flex align-items-center justify-content-center text-center mt-2"
        ><font-awesome-icon icon="spinner" spin size="1x" class="align-bottom"></font-awesome-icon>
        <p class="mt-3 ml-3">Getting decks from the cloud</p></b-row
      >
      <b-row v-for="deck of decks" :key="deck.title" class="deck-row">
        <!-- v-if="deck.title && deck.cards > 0 && !refreshingDeck"  -->
        <b-col class="deck-col">
          <b-row class="title-row">
            <b-col class="title-text-col">
              <p class="text title">
                {{ formatTitle(deck.title) }}
              </p>
              <p class="text card-count">
                {{ deck.cards.length }} card{{ cardOrCards(deck.cards.length) }}
              </p>
              <div class="underline"></div>
            </b-col>
          </b-row>
          <b-row class="cards-row m-0">
            <b-col class="cards-col" cols="12" style="padding: 0;">
              <!-- id's need to start with letters -->
              <b-card
                v-for="card in deck.cards"
                :id="'card-id' + card.card_id"
                :key="card.card_id"
                class="card"
                :class="card.card_id === clickedCardId ? 'card-focused' : 'card-unfocused'"
                @click="focusMainWinHighlight(card.card_id, card.highlight_id)"
              >
                <b-container style="padding: 0;">
                  <b-row>
                    <b-col v-if="card.front_image" class="card-content-col scroller" cols="5">
                      <b-img-lazy v-if="card.front_image" :src="card.front_image"></b-img-lazy>
                    </b-col>
                    <b-col
                      class="card-content-col scroller"
                      :class="
                        card.card_id === clickedCardId
                          ? 'card-content-col-focused'
                          : 'card-content-col-unfocused'
                      "
                    >
                      <b-card-text class="font-weight-bold">{{ card.front_text }}</b-card-text>
                    </b-col>
                    <b-col cols="1">
                      <font-awesome-icon
                        icon="edit"
                        class="edit"
                        @click="
                          editCard(card);
                          $emit('edit-clicked');
                        "
                      />
                    </b-col>
                  </b-row>
                  <hr class="divider" />
                  <b-row>
                    <b-col v-if="card.back_image" class="card-content-col scroller">
                      <b-img-lazy :src="card.back_image"></b-img-lazy>
                    </b-col>
                    <b-col
                      class="card-content-col scroller"
                      :class="
                        card.card_id === clickedCardId
                          ? 'card-content-col-focused'
                          : 'card-content-col-unfocused'
                      "
                    >
                      <b-card-text> {{ card.back_text }} </b-card-text>
                    </b-col>
                  </b-row>
                </b-container>
              </b-card>
            </b-col>
          </b-row>
        </b-col>
      </b-row>
    </b-container>
    <div v-else class="spinner-div">
      <font-awesome-icon icon="spinner" spin size="3x" class="align-middle"></font-awesome-icon>
    </div>
  </div>
</template>

<script>
import { BCard, BImgLazy, BCardText } from 'bootstrap-vue';
// import throttle from 'lodash/throttle';
// import { isEqual } from 'lodash/core';
import { isEmpty } from 'lodash';
import TheNavbar from '../components/TheNavbar.vue';
const axios = require('axios');
const VueScrollTo = require('vue-scrollto');
const ScrollToOptions = {
  container: '#sidebar-body',
  easing: 'ease-in',
  offset: -200,
  force: true,
  cancelable: true,
  x: false,
  y: true,
};
const decksDefault = [
  {
    title: 'no highlights found',
    cards: [],
  },
];
export default {
  components: { BCard, BImgLazy, BCardText, TheNavbar },
  data() {
    return {
      windowSetting: '',
      selectedTab: 'page-mine',
      sidebarStyle: {},
      loaded: false,
      loadingOthers: false,
      makingApiCall: false,
      refreshingDeck: false,
      syncing: false,
      decks: decksDefault,
      clickedCardId: '',
      jwt: '',
      serverUrl: '',
    };
  },
  computed: {},
  created() {
    const that = this;
    chrome.windows.getCurrent(function(win) {
      chrome.runtime.sendMessage({ sidebarWinId: win.id });
      that.sidebarWinId = win.id;
    });
    chrome.runtime.onMessage.addListener(function(msg) {
      // resize function
      if (msg.sidebarResize) {
        const updateData = msg.updateData;
        that.resizeSidebarWindow(that.sidebarWinId, updateData);
      }
      // scroll to function
      if (msg.highlightClicked) {
        // console.log('highlight clicked msg', msg);
        let cardId;
        chrome.storage.local.get(['websites'], function(items) {
          const associatedCards = items.websites[msg.highlightUrl].cards;
          for (const card of associatedCards) {
            if (card.highlight_id === msg.highlightId) {
              cardId = card.card_id;
            }
          }
          VueScrollTo.scrollTo('#card-id' + cardId, 300, ScrollToOptions);
          that.clickedCardId = cardId;
        });
      }
      if (msg.activeTabChanged) {
        if (that.selectedTab === 'page-mine') {
          that.loadPageMine();
        } else if (that.selectedTab === 'page-all') {
          that.loadpageAll();
        }
      }
      if (msg.orderRefreshed) {
        // console.log('orderRefreshed');
        if (that.selectedTab === 'page-mine') {
          that.loadPageMine();
        } else if (that.selectedTab === 'mine-all') {
          that.loadMineAll();
        } else if (that.selectedTab === 'page-all') {
          that.loadpageAll();
        }
      }
      if (msg.syncing) {
        this.syncing = msg.value;
      }
    });
  },
  mounted() {
    const that = this;
    chrome.storage.local.get(['runInNewWindow', 'user_collection', 'jwt'], items => {
      chrome.storage.sync.get(['serverUrl'], items => {
        that.serverUrl = items.serverUrl;
      });
      that.jwt = items.jwt;
      if (!that.checkJwt) alert('Please log in');
      else {
        if (!items.runInNewWindow) {
          // console.log('running in this window');
          that.resizeInThisWindow();
        } else {
          // console.log('running in new window');
          that.windowSetting = 'in-other-window';
        }
        that.userCollection = items.user_collection;
        if (that.selectedTab === 'mine-all') {
          that.loadMineAll();
        } else if (that.selectedTab === 'page-mine') {
          that.loadPageMine();
        } else if (that.selectedTab === 'page-all') {
          that.loadpageAll();
        }
      }
    });
    console.log('navbar ref', this.$refs.theNavbar);
  },
  methods: {
    loadMineAll() {
      const that = this;
      chrome.storage.local.get(['websites', 'highlightsViewMode', 'lastActiveTabUrl'], items => {
        if (items.highlightsViewMode !== 'mine') {
          chrome.storage.local.set({ highlightsViewMode: 'mine' });
          chrome.runtime.sendMessage({
            refreshHighlights: true,
            refreshOrder: true,
            url: items.lastActiveTabUrl,
          });
        }

        const websites = items.websites;
        console.log('loadMineAll , websites', websites);
        if (isEmpty(websites)) {
          that.decks = decksDefault;
          that.loaded = true;
          return null;
        } else {
          const decks = [];
          for (const url of Object.keys(websites)) {
            if (!isEmpty(websites[url].cards)) {
              decks.push({
                title: url,
                cards: websites[url].cards,
              });
            }
          }
          if (decks.length === 0) {
            that.decks = decksDefault;
          } else that.decks = decks;
          that.loaded = true;
        }
      });
    },
    loadPageMine() {
      // console.log('loadPageMine called');
      const setDecks = function(website, url, that) {
        that.decks = [{ title: url, cards: website.orderedCards }];
        if (website.orderlessCards.length > 0)
          that.decks.push({ title: 'Cards without a highlight', cards: website.orderlessCards });
        that.loaded = true;
      };
      const getWebsite = function(that) {
        that.loaded = false;
        chrome.storage.local.get(['websites', 'lastActiveTabUrl', 'highlightsViewMode'], items => {
          if (items.highlightsViewMode !== 'mine') {
            chrome.storage.local.set({ highlightsViewMode: 'mine' });
            chrome.runtime.sendMessage({
              refreshHighlights: true,
              refreshOrder: true,
              url: items.lastActiveTabUrl,
            });
          }
          const websites = items.websites;
          const url = items.lastActiveTabUrl;
          that.lastActiveTabUrl = url;
          if (!websites || !websites[url] || isEmpty(websites[url].cards)) {
            that.decks = decksDefault;
            that.loaded = true;
            return null;
          }
          that.websites = websites;
          const website = websites[url];
          if (!website.order || !website.orderedCards || !website.orderlessCards) {
            chrome.runtime.sendMessage({ refreshHighlights: true, refreshOrder: true, url: url });
            return null;
          } else setDecks(website, url, that);
        });
      };
      getWebsite(this);
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
      this.loaded = false;
      this.loadingOthers = true;

      const storage = await getStorage();
      // console.log('storage', storage);
      if (storage.highlightsViewMode !== 'mineAndOthers') {
        chrome.runtime.sendMessage({
          refreshHighlights: true,
          refreshOrder: true,
          url: storage.lastActiveTabUrl,
        });
        chrome.storage.local.set({ highlightsViewMode: 'mineAndOthers' });
        return null;
      }

      this.decks = decksDefault;
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
      if (!isEmpty(mineAndOthersWebsites)) {
        this.decks = [{ title: url, cards: mineAndOthersWebsites[url].orderedCards }];
        if (mineAndOthersWebsites[url].orderlessCards.length > 0)
          this.decks.push({
            title: 'Cards without a highlight',
            cards: mineAndOthersWebsites[url].orderlessCards,
          });
        this.loaded = true;
      } else if (!isEmpty(websites)) {
        if (websites[url])
          if (websites[url].orderedCards) {
            this.decks = [{ title: url, cards: websites[url].orderedCards }];
            if (websites[url].orderlessCards.length > 0)
              this.decks.push({
                title: 'Cards without a highlight',
                cards: websites[url].orderlessCards,
              });
            this.loaded = true;
          }
      }
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
      if (mineAndOthersWebsites)
        if (mineAndOthersWebsites[url])
          if (mineAndOthersWebsites[url].cards) {
            const combinedCardIds = [];
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
    generateRandomHslaColor() {
      // round to an interval of 20, 0-360
      const hue = Math.round((Math.random() * 360) / 20) * 20;
      const color = `hsla(${hue}, 100%, 50%, 1)`;
      return color;
    },
    async switchTab(tab) {
      this.selectedTab = tab;
      if (tab === 'mine-all') {
        this.loadMineAll();
      }
      if (tab === 'page-mine') {
        this.loadPageMine();
      }
      if (tab === 'page-all') {
        this.loadpageAll();
      }
    },
    refreshDeck() {
      this.refreshingDeck = true;
      if (this.selectedTab === 'mine-all') {
        this.loadMineAll();
      } else if (this.selectedTab === 'page-mine') {
        this.loadPageMine();
      } else if (this.selectedTab === 'page-all') {
        this.loadpageAll();
      }
      this.refreshingDeck = false;
    },
    editCard(card) {
      chrome.runtime.sendMessage({
        openEditor: true,
        toEditCardData: {
          time: new Date().getTime(),
          card: card,
        },
      });
    },
    cardOrCards(deckLength) {
      if (deckLength === 1) {
        return '';
      } else {
        return 's';
      }
    },
    formatTitle(title) {
      if (title.includes('http://')) {
        return title.replace('http://', '');
      } else if (title.includes('https://')) {
        return title.replace('https://', '');
      } else return title;
    },
    resizeSidebarWindow(winId, updateData) {
      // if was on the left of the main window
      console.log('document.hidden', document.hidden);

      if (!updateData && document.hidden) {
        const windowUpdate = {
          focused: true,
        };
        chrome.windows.update(winId, windowUpdate);
        chrome.runtime.sendMessage({ resizeComplete: true, refocus: true });
      }
      updateData.width = Math.round((updateData.mainWinWidth + window.outerWidth) * 0.25);
      if (updateData.width > 450) {
        updateData.width = 450;
      } else if (updateData.width < 250) {
        updateData.width = 250;
      }
      // console.log('update.width', updateData.width);
      if (window.screenLeft <= updateData.mainWinLeft) {
        updateData.left = updateData.mainWinLeft - updateData.width;
      } else {
        updateData.left = updateData.mainWinLeft + updateData.mainWinWidth;
      }
      const windowUpdate = {
        height: updateData.height,
        width: updateData.width,
        top: updateData.top,
        left: updateData.left,
        focused: false,
      };
      if (document.hidden) windowUpdate.focused = true;
      chrome.windows.update(winId, windowUpdate);
      chrome.runtime.sendMessage({ resizeComplete: true, refocus: document.hidden });
    },
    resizeInThisWindow() {
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
    },
    focusMainWinHighlight(cardId, highlightId) {
      // console.log('highlightId', highlightId);
      VueScrollTo.scrollTo('#card-id' + cardId, 300, ScrollToOptions);
      this.clickedCardId = cardId;
      chrome.runtime.sendMessage({ focusMainWinHighlight: true, highlightId: highlightId });
    },
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
  },
};
</script>

<style scoped>
#sidebar-body {
  display: flex;
  flex-direction: column;
  /* position: fixed;
  width: 100%;
  height: 100%; */
  background-color: #f6f6f6;
  /* overflow-y: auto; */
  padding: 0;
}
.in-other-window {
}
.in-this-window {
}
.spinner-div {
  height: calc(100vh - 85px);
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-unfocused {
  box-shadow: 0px 0px 15px 5px rgba(0, 0, 0, 0.1);
  -webkit-transform: scale(1, 1);
  transform: scale(1, 1);
  transition: transform 0.15s ease-in-out;
  margin: 10px 10px;
  cursor: pointer;
}
.card-focused {
  box-shadow: 0px 0px 20px 10px rgba(0, 0, 0, 0.3);
  -webkit-transform: scale(1.05, 1);
  transform: scale(1.05, 1);
  transition: transform 0.15s ease-in-out;
  margin: 0px 10px;
}
.card {
  /* margin: 10px 10px; */
  /* box-shadow: 0px 0px 15px 5px rgba(0, 0, 0, 0.1); */
}
.card .card-body {
  padding: 8px 20px 8px 10px;
}
.card-content-col-focused {
  max-height: none;
  overflow: auto;
  transition: max-height 0.15s ease-in-out;
}
.card-content-col-unfocused {
  max-height: 5em;
  overflow: auto;
  transition: max-height 0.15s ease-in-out;
}

.scroller::-webkit-scrollbar {
  width: 5px;
  padding-right: 5px;
  background-color: transparent;
}
.scroller::-webkit-scrollbar-thumb {
  background-color: rgba(162, 162, 162, 0.5);
  border-radius: 10px;
}
.edit {
  color: gray;
}
.edit:hover {
  cursor: pointer;
  color: black;
}
.sidebar-content-main {
  position: absolute;
  top: 87px;
  left: 0;
  width: 100%;
  height: calc(100% - 87px);
  margin: 0;
  overflow: auto;
  padding: 0px 0px 100px 0px;
  background-color: #f6f6f6;
}
.sidebar-content-main::-webkit-scrollbar {
  width: 0.4em;
  background-color: #f0f0f0;
}
.sidebar-content-main::-webkit-scrollbar-thumb {
  background-color: rgba(162, 162, 162, 0.5);
}
.deck-row {
  margin: 0;
}
.deck-col {
  margin: auto;
  max-width: 600px;
  padding: 0px;
}
.title-row {
  width: 100%;
  margin: 0;
}
.title-text-col {
  padding: 10px;
  margin: 0;
  overflow-wrap: break-word;
}
.underline {
  position: absolute;
  bottom: 0px;
  left: 20px;
  height: 1px;
  width: 75%;
  background-color: rgba(0, 0, 0, 0.5);
}
.edit-col {
  padding: 0;
  margin: auto;
  width: 10px;
}
.text {
  padding: 0;
  margin: 0;
}
.text:hover {
  cursor: pointer;
}
.card-count {
  font-size: 0.8em;
  color: dimgray;
}
.title {
  font-size: 1.2em;
}
img {
  width: 100%;
}
</style>
