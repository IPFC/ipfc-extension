<template>
  <div
    id="sidebar-body"
    :class="windowSetting"
    class="scroller d-flex flex-column p-0 bg-light"
    :style="sidebarStyle"
  >
    <the-navbar ref="theNavbar" :in-sidebar="true" @tabSelected="switchTab" />
    <b-container
      v-if="loaded"
      id="sidebar-content-body"
      class="scroller position-absolute w-100 m-0 pt-1 pb-0 px-0 bg-light"
    >
      <b-row
        v-if="loadingOthers && selectedTab === 'page-all'"
        class="d-flex mx-0 mt-1 align-items-center justify-content-center text-center"
        ><font-awesome-icon
          v-if="connectionMsg.includes('Getting')"
          icon="spinner"
          spin
          size="1x"
          class="align-bottom"
        ></font-awesome-icon>
        <p class="ml-3 mb-0" v-text="connectionMsg"></p
      ></b-row>
      <b-row id="options-row" class="mt-2 ml-3 mb-2 d-flex">
        <p class="mr-2 text-muted">card backs</p>
        <toggle-button
          v-model="showCardBacks"
          class="m-0"
          :width="60"
          :labels="{ checked: 'show', unchecked: 'hide' }"
        ></toggle-button>
      </b-row>
      <!-- <b-row v-if="uncollectedCards.length > 0" class="mt-1 ml-3 mb-1 d-flex align-items-center">
        <p class="mr-4 text-muted">collect all</p>
        <font-awesome-icon
          icon="plus-square"
          size="2x"
          class="collect-btn"
          @click="collectAll(uncollectedCards)"
        ></font-awesome-icon>
      </b-row> -->
      <b-row v-for="deck of decks" :key="deck.title" class="deck-row mb-3 m-0">
        <!-- v-if="deck.title && deck.cards > 0 && !refreshingDeck"  -->
        <b-col class="deck-col m-auto p-0">
          <b-row class="w-100 m-0">
            <b-col class="text-break pt-0 pb-1 m-0">
              <p class="title m-0" @click="openLink(deck.title)">
                {{ formatTitle(deck.title) }}
              </p>
              <b-row class="px-3">
                <p v-if="deck.cards" class="text-muted m-0">
                  <small> {{ deck.cards.length }} card{{ cardOrCards(deck.cards.length) }} </small>
                </p>
                <p
                  v-if="selectedTab === 'mine-all' && showSitesCards !== deck.title"
                  class="text-muted m-0 ml-auto show-cards-btn"
                  @click="showSitesCards = deck.title"
                >
                  <small> show cards</small>
                </p>
                <p
                  v-if="selectedTab === 'mine-all' && showSitesCards === deck.title"
                  class="text-muted m-0 ml-auto show-cards-btn"
                  @click="showSitesCards = ''"
                >
                  <small> hide cards</small>
                </p>
              </b-row>
              <div class="underline"></div>
            </b-col>
          </b-row>
          <b-row
            v-if="selectedTab !== 'mine-all' ? true : showSitesCards === deck.title ? true : false"
            :key="cardRefreshKey"
            class="cards-row m-0"
          >
            <b-col class="cards-col p-0 d-flex flex-column align-items-center" cols="12">
              <flashcard-preview
                v-for="card in deck.cards"
                :id="'card-id' + card.card_id"
                :key="card.card_id"
                :card="card"
                :show-card-backs="showCardBacks"
                :collect-card="userCollection.user_id !== card.user_id"
                :clicked-card-id="clickedCardId"
                class="flashcard-outer"
                :class="card.card_id === clickedCardId ? 'card-focused' : 'card-unfocused'"
                @card-clicked="cardClicked(card)"
                @edit-clicked="editCard(card)"
                @collect-card-clicked="collectCard(card)"
              ></flashcard-preview>
            </b-col>
          </b-row>
        </b-col>
      </b-row>
    </b-container>
    <div v-else class="spinner-div w-100 d-flex align-items-center justify-content-center">
      <font-awesome-icon icon="spinner" spin size="3x" class="align-middle"></font-awesome-icon>
    </div>
    <span v-if="cardPostedDeck" id="card-post-popup">
      card added to deck:
      <p id="card-posted-deck">{{ cardPostedDeck }}</p>
    </span>
  </div>
</template>

<script>
// import throttle from 'lodash/throttle';
// import { isEqual } from 'lodash/core';
import { isEmpty } from 'lodash';
import { ToggleButton } from 'vue-js-toggle-button';
import { sendMessageToAllTabs } from '../utils/messaging';
import {
  combineMineAndOthersWebsites,
  filterOutCardCopies,
  cleanedUrl,
} from '../utils/dataProcessing';
import TheNavbar from '../components/TheNavbar.vue';
import FlashcardPreview from '../components/FlashcardPreview';
const axios = require('axios');
const VueScrollTo = require('vue-scrollto');
const ScrollToOptions = {
  container: '#sidebar-content-body',
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
  components: { TheNavbar, FlashcardPreview, ToggleButton },
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
      showSitesCards: '',
      showCardBacks: false,
      connectionMsg: 'Getting highlights',
      userCollection: { user_id: '' },
      cardPostedDeck: null,
      cardRefreshKey: 0,
    };
  },
  computed: {
    uncollectedCards() {
      const cards = [];
      if (this.selectedTab === 'page-all')
        for (const deck of this.decks)
          for (const card of deck.cards) {
            if (this.userCollection.user_id !== card.user_id) cards.push(card);
          }
      return cards;
    },
  },
  watch: {
    showCardBacks() {
      this.refreshCardsKey++;
    },
    syncing() {
      this.loadSidebar();
    },
  },
  created() {
    // firefox can't set popup left and top, so need to call this immediately. In firefox, sidebar is part of the background
    sendMessageToAllTabs({ resizeSidebar: true });
    const that = this;
    chrome.windows.getCurrent(function(win) {
      chrome.runtime.sendMessage({ sidebarWinId: win.id });
      that.sidebarWinId = win.id;
    });
    chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
      // resize function
      if (msg.sidebarResize) {
        // console.log('sidebarResize recieved:  msg, sender', msg, sender);
        const updateData = msg.updateData;
        that.resizeSidebarWindow(that.sidebarWinId, updateData);
      }
      // scroll to function
      if (msg.sidebarScrollToCard) {
        console.log('scrollto recieved, msg', msg);
        VueScrollTo.scrollTo('#card-id' + msg.cardId, 300, ScrollToOptions);
        that.clickedCardId = msg.cardId;
      }
      if (msg.activeTabChanged) {
        // console.log('activeTabChanged');
        that.loadSidebar();
      }
      if (msg.orderRefreshed) {
        console.log('orderRefreshed');
        that.loadSidebar();
      }
      if (msg.syncing) {
        that.syncing = msg.value;
      }
      if (msg.cardPosted) {
        console.log('cardPosted', msg);
        that.cardPostedPrompt(msg.deckTitle);
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
        that.loadSidebar();
      }
    });
  },
  methods: {
    loadSidebar() {
      if (this.selectedTab === 'mine-all') {
        this.loadMineAll();
      } else if (this.selectedTab === 'page-mine') {
        this.loadPageMine();
      } else if (this.selectedTab === 'page-all') {
        this.loadpageAll();
      }
    },
    loadMineAll() {
      const that = this;
      chrome.storage.local.get(['websites', 'highlightsViewMode', 'lastActiveTabUrl'], items => {
        if (items.highlightsViewMode !== 'mine') {
          chrome.storage.local.set({ highlightsViewMode: 'mine' });
          chrome.runtime.sendMessage({
            refreshHighlights: true,
            refreshOrder: true,
            url: items.lastActiveTabUrl,
            sender: 'loadMineAll, set highlights mode',
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
        console.log('setting pageMine', website);
        // console.log('userID', that.userCollection.user_id);
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
              sender: 'loadPageAll, set highlights mode',
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
            chrome.runtime.sendMessage({
              refreshHighlights: true,
              refreshOrder: true,
              url: url,
              sender: 'loadPAgeMine, no ordered cards',
            });
            return null;
          } else setDecks(website, url, that);
        });
      };
      getWebsite(this);
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
      this.loaded = false;
      this.loadingOthers = true;
      this.connectionMsg = 'Getting Highlights';
      const storage = await getStorage();
      console.log('storage', storage);
      if (storage.highlightsViewMode !== 'mineAndOthers') {
        chrome.runtime.sendMessage({
          refreshHighlights: true,
          refreshOrder: true,
          url: storage.lastActiveTabUrl,
          sender: 'loadPageAll, set highlights mode',
        });
        chrome.storage.local.set({ highlightsViewMode: 'mineAndOthers' });
        // console.log('set storage view mode');
        return null;
      }

      this.decks = decksDefault;
      const websites = storage.websites;
      const url = storage.lastActiveTabUrl;

      // if mineAndOthersWebsites exists, load that, set small spinner
      // otherwise load local and set small spinner
      let mineAndOthersWebsites = storage.mineAndOthersWebsites;
      if (isEmpty(mineAndOthersWebsites)) mineAndOthersWebsites = {};

      if (!isEmpty(mineAndOthersWebsites[url])) {
        this.decks = [{ title: url, cards: mineAndOthersWebsites[url].orderedCards }];
        if (!isEmpty(mineAndOthersWebsites[url].orderlessCards))
          this.decks.push({
            title: 'Cards without a highlight',
            cards: mineAndOthersWebsites[url].orderlessCards,
          });
        this.loaded = true;
      } else if (!isEmpty(websites[url])) {
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
      const getPageData = {
        url: this.serverUrl + '/get_website',
        jwt: this.jwt,
        method: 'POST',
        data: { url: url },
      };
      // these trials check if the version we got from the website includes our local cards, if not we need to cloud sync and add them
      const apiGetWebsite = await this.callAPI(getPageData);
      // console.log('apiGetWebsite', apiGetWebsite);
      if (!apiGetWebsite) {
        if (!isEmpty(websites[url])) {
          if (!isEmpty(websites[url].highlights) || !isEmpty(websites[url].cards))
            chrome.runtime.sendMessage({ cloudSync: true });
        }
        this.loadingOthers = false;
        this.loaded = true;
        return null;
      }
      const apiWebsite = apiGetWebsite.website;
      if (isEmpty(apiWebsite)) {
        if (!isEmpty(websites[url])) {
          if (!isEmpty(websites[url].highlights) || !isEmpty(websites[url].cards))
            chrome.runtime.sendMessage({ cloudSync: true });
        }
        this.loadingOthers = false;
        this.loaded = true;
        // console.log('found empty');
        return null;
      }
      if (!isEmpty(websites[url])) {
        if (!isEmpty(websites[url].highlights))
          if (apiWebsite.highlights) {
            for (const highlight in websites[url].highlights) {
              if (!Object.keys(apiWebsite.highlights).includes(highlight)) {
                chrome.runtime.sendMessage({ cloudSync: true });
                break;
              }
            }
          }
        if (!isEmpty(apiWebsite.cards))
          if (!isEmpty(websites[url].cards)) {
            // console.log(websites[url].cards, apiWebsite.cards);
            for (const card in websites[url].cards) {
              let count = 0;
              for (const aCard in apiWebsite.cards) {
                if (aCard.card_id === card.card_id) {
                  count++;
                  break;
                }
              }
              if (count === 0) {
                console.log('cards not uploaded, cloudsync sent');
                chrome.runtime.sendMessage({ cloudSync: true });
                break;
              }
            }
          }
      }

      // if the number of highlights and number of cards is the same in MineAndothers and in apigetwebsites. and MineAndOthers has been sorted (has ordered) then we are good
      // otherwise we need to refresh the page and try again
      let apiHighlightCount = 0;
      let apiCardCount = 0;
      let localHighlightCount = 0;
      let localCardCount = 0;
      // problem... new collected card is not in here..

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
      } else {
        if (mineAndOthersWebsites[url].orderedCards) {
          this.decks = [{ title: url, cards: mineAndOthersWebsites[url].orderedCards }];
          if (mineAndOthersWebsites[url].orderlessCards.length > 0)
            this.decks.push({
              title: 'Cards without a highlight',
              cards: mineAndOthersWebsites[url].orderlessCards,
            });
          this.loaded = true;
        }
        this.loadingOthers = false;
      }
    },
    async callAPI(data) {
      let result = null;
      const that = this;
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
          that.connectionMsg = 'Unable to reach database';
          that.loadingOthers = false;
          that.loaded = true;
          return null;
        });
      return result;
    },
    generateRandomHslaColor() {
      // round to an interval of 20, 0-360
      const hue = Math.round((Math.random() * 360) / 20) * 20;
      const color = `hsla(${hue}, 100%, 50%, 1)`;
      return color;
    },
    async switchTab(tab) {
      this.selectedTab = tab;
      this.loadSidebar();
    },
    refreshDeck() {
      this.refreshingDeck = true;
      this.loadSidebar();
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
    collectCard(card) {
      console.log('collecting card, card', card, this.userCollection.user_id);
      chrome.runtime.sendMessage({
        collectCardAndHighlight: true,
        card: card,
        userId: this.userCollection.user_id,
      });
      const decks = JSON.parse(JSON.stringify(this.decks));
      for (const deck of decks) {
        for (const origCard of deck.cards) {
          if (origCard.card_id === card.card_id) {
            origCard.user_id = this.userCollection.user_id;
            this.decks = decks;
            this.cardRefreshKey++;
            return null;
          }
        }
      }
    },
    collectAll(cards) {
      for (const card of cards) this.collectCard(card);
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
      if (!updateData && document.hidden) {
        const windowUpdate = {
          focused: true,
        };
        chrome.windows.update(winId, windowUpdate);
        chrome.runtime.sendMessage({ resizeComplete: true, refocus: true });
      }
      if (updateData) {
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
      }
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
    openLink(url) {
      // console.log('url to open', url);
      if (url !== 'Cards without a highlight' && this.lastActiveTabUrl !== cleanedUrl(url)) {
        chrome.tabs.create({ url: url });
        this.lastActiveTabUrl = url;
        chrome.storage.local.set({ lastActiveTabUrl: url });
      }
    },
    cardClicked(card) {
      if (this.clickedCardId !== card.card_id) {
        this.focusMainWinHighlight(card.card_id, card.highlight_id);
      }
    },
    cardPostedPrompt(title) {
      const that = this;
      this.cardPostedDeck = title;
      async function countdown() {
        setTimeout(() => {
          that.cardPostedDeck = null;
        }, 5000);
      }
      countdown();
    },
  },
};
</script>

<style scoped>
.spinner-div {
  height: calc(100vh - 85px);
}
.collect-btn {
  color: #f8690d;
  cursor: pointer;
}
.show-cards-btn {
  cursor: pointer;
}
.flashcard-outer {
  width: 90%;
}
.card-unfocused {
  box-shadow: 0px 0px 15px 5px rgba(0, 0, 0, 0.1);
  -webkit-transform: scale(1, 1);
  transform: scale(1, 1);
  transition: transform 0.15s, margin 0.15s, box-shadow 0.15s, ease-in-out;
  margin: 10px 10px;
  cursor: pointer;
  font-size: 0.8rem;
}
.card-focused {
  box-shadow: 0px 0px 20px 10px rgba(0, 0, 0, 0.3);
  -webkit-transform: scale(1.05, 1);
  transform: scale(1.05, 1);
  transition: transform 0.15s, margin 0.15s, box-shadow 0.15s, ease-in-out;
  margin: 10px 5px;
  font-size: 0.9rem;
}
.scroller {
  scrollbar-color: rgba(162, 162, 162, 0.5) transparent; /* thumb and track color */
  scrollbar-width: thin;
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
#sidebar-content-body {
  overflow-x: hidden;
  overflow-y: auto;
  top: 87px;
  left: 0;
  height: calc(100% - 87px);
}

.deck-col {
  max-width: 100%;
}

.underline {
  position: absolute;
  bottom: 0px;
  left: 20px;
  height: 1px;
  width: 75%;
  background-color: rgba(0, 0, 0, 0.5);
}

.title {
  font-size: 1.2em;
}
.title:hover {
  cursor: pointer;
}
#card-post-popup {
  z-index: 50000;
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background-color: black;
  text-align: center;
  color: rgb(203, 203, 203);
}

#card-posted-deck {
  display: inline;
  color: white;
}
</style>
