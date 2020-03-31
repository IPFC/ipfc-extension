<template>
  <div id="sidebar-content-body" class="scroller" :class="windowSetting" :style="sidebarStyle">
    <sidebar-header @TabSelected="switchTab" />
    <b-container v-if="loaded" class="sidebar-content-main">
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
import { isEqual } from 'lodash/core';
import SidebarHeader from '../components/SidebarHeader.vue';
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
export default {
  components: { BCard, BImgLazy, BCardText, SidebarHeader },
  data() {
    return {
      windowSetting: '',
      selectedTab: 'page-mine',
      sidebarStyle: {},
      loaded: false,
      makingApiCall: false,
      refreshingDeck: false,
      decks: [],
      clickedCardId: '',
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
        that.resizeInNewWindow(that.sidebarWinId, updateData);
      }
      // scroll to function
      if (msg.highlightClicked) {
        // console.log('highlight clicked msg', msg);
        let cardId;
        chrome.storage.local.get(['highlights'], function(items) {
          const associatedCards = items.highlights[msg.highlightUrl].cards;
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
        chrome.storage.local.get(['highlights'], function(items) {
          if (!isEqual(items.highlights, that.highlights)) {
            // console.log('orderRefreshed');
            if (that.selectedTab === 'page-mine') {
              that.loadPageMine();
            } else if (that.selectedTab === 'mine-all') {
              that.loadMineAll();
            } else if (that.selectedTab === 'page-all') {
              that.loadpageAll();
            }
          }
        });
      }
    });
  },
  mounted() {
    const that = this;
    chrome.storage.local.get(['runInNewWindow', 'user_collection', 'jwt'], function(items) {
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
        that.user_collection = items.user_collection;
        if (that.selectedTab === 'mine-all') {
          that.loadMineAll(true);
        } else if (that.selectedTab === 'page-mine') {
          that.loadPageMine(true);
        } else if (that.selectedTab === 'page-all') {
          that.loadpageAll(true);
        }
      }
    });
  },
  methods: {
    loadMineAll(startingLoad) {
      const purgeOthersHighlights = function(that) {
        that.loaded = false;
        chrome.storage.local.get(['highlights'], function(items) {
          const highlights = items.highlights;
          that.highlights = highlights;
          const userId = that.user_collection.user_id;
          const purgedHighlights = {};
          for (const url of Object.keys(highlights)) {
            const original = highlights[url];
            const purged = {
              cards: [],
              orderedCards: [],
              orderlessCards: [],
              order: JSON.parse(JSON.stringify(original.order)),
            };
            for (const key of Object.keys(original)) {
              if (
                original[key].user_id === userId &&
                key !== 'cards' &&
                key !== 'orderedCards' &&
                key !== 'orderlessCards' &&
                key !== 'order'
              ) {
                purged[key] = original[key];
              }
            }
            for (const card of original.cards) {
              if (card.user_id === userId) {
                purged.cards.push(card);
              }
            }
            for (const card of original.orderedCards) {
              if (card.user_id === userId) {
                purged.orderedCards.push(card);
              }
            }
            for (const card of original.orderlessCards) {
              if (card.user_id === userId) {
                purged.orderlessCards.push(card);
              }
            }
            purgedHighlights[url] = purged;
          }
          loadDecks(that, JSON.parse(JSON.stringify(purgedHighlights)));
        });
      };
      const loadDecks = function(that, highlights) {
        // console.log(highlights);
        const decks = [];
        for (const url of Object.keys(highlights)) {
          if (highlights[url].cards.length > 0) {
            decks.push({
              title: url,
              cards: highlights[url].cards,
            });
          }
        }
        that.decks = decks;
        that.loaded = true;
      };
      purgeOthersHighlights(this);
    },
    isDecksEqual(decks1, decks2) {
      // console.log('decks1, decks2', decks1, decks2);
      // Does not care about order
      if (decks1.length !== decks2.length) return false;
      const titles = [];
      for (const deck2 of decks2) {
        titles.push(deck2.title);
      }
      for (const deck1 of decks1) {
        if (!titles.includes(deck1.title)) return false;
        for (const deck2 of decks2) {
          if (deck1.title === deck2.title) {
            if (deck1.cards.length !== deck2.cards.length) return false;
            for (const card1 of deck1.cards) {
              for (const card2 of deck2.cards) {
                if (card1.card_id === card2.card_id) {
                  if (
                    card1.front_text !== card2.front_text ||
                    card1.back_text !== card2.back_text ||
                    card1.front_rich_text !== card2.front_rich_text ||
                    card1.back_rich_text !== card2.back_rich_text
                  ) {
                    return false;
                  }
                }
                break;
              }
            }
            break;
          }
        }
      }
      return true;
    },
    compareAndUpdateDecks(myPurgedDecks, that) {
      if (
        !that.isDecksEqual(
          JSON.parse(JSON.stringify(myPurgedDecks)),
          JSON.parse(JSON.stringify(that.decks))
        )
      ) {
        // console.log('unequal');
        that.loaded = false;
        that.decks = myPurgedDecks;
        // console.log(that.decks);
        that.loaded = true;
      } else {
        // console.log('equal');
        that.loaded = true;
      }
    },
    getActiveTab(callback) {
      const that = this;
      chrome.storage.local.get(['lastActiveTabId', 'lastActiveTabUrl'], function(items) {
        that.lastActiveTabId = items.lastActiveTabId;
        that.lastActiveTabUrl = items.lastActiveTabUrl;
        if (callback) callback();
      });
    },
    loadPageMine() {
      // console.log('loadPageMine called');
      const setDecks = function(thisUrlsHighlights, url, that) {
        that.decks = [
          { title: url, cards: thisUrlsHighlights.orderedCards },
          { title: 'Cards without a highlight', cards: thisUrlsHighlights.orderlessCards },
        ];
        // console.log('decks set, decks', that.decks);
        that.loaded = true;
      };
      const purgeOtherHighlightsFromThisUrl = function(that) {
        that.loaded = false;
        chrome.storage.local.get(['highlights', 'lastActiveTabUrl'], function(items) {
          const highlights = items.highlights;
          that.highlights = highlights;
          const userId = that.user_collection.user_id;
          const url = items.lastActiveTabUrl;
          const original = highlights[url];
          // console.log('url, highlights, original', url, highlights, original);
          const purged = {
            cards: [],
            orderedCards: [],
            orderlessCards: [],
            order: JSON.parse(JSON.stringify(original.order)),
          };
          for (const key of Object.keys(original)) {
            if (
              original[key].user_id === userId &&
              key !== 'cards' &&
              key !== 'orderedCards' &&
              key !== 'orderlessCards' &&
              key !== 'order'
            ) {
              purged[key] = original[key];
            }
          }
          for (const card of original.cards) {
            if (card.user_id === userId) {
              purged.cards.push(card);
            }
          }
          for (const card of original.orderedCards) {
            if (card.user_id === userId) {
              purged.orderedCards.push(card);
            }
          }
          for (const card of original.orderlessCards) {
            if (card.user_id === userId) {
              purged.orderlessCards.push(card);
            }
          }
          if (!isEqual(purged, original)) {
            // console.log('unequal after purge');
            highlights[url] = purged;
            chrome.storage.local.set({ highlights: highlights });
            chrome.runtime.sendMessage({ refreshHighlights: true, refreshOrder: true });
          } else setDecks(purged, url, that);
        });
      };
      purgeOtherHighlightsFromThisUrl(this);
    },

    loadpageAll(url) {
      // load from mineAndOthers first. if that doesn't exist first load mine from local,
      // then make API call (add spinner) and add when done
      // then save to local, refresh page, regenerate order, and reorg sidebar based on order

      // first pass, load from local
      const loadAllfromLocal = function(callback) {
        if (!this.mineAndOthersDecks || this.mineAndOthersDecks === {}) {
          const sortedCards = this.getCardsInOrder(
            this.highlights[this.lastActiveTabUrl].cards,
            this.highlights[this.lastActiveTabUrl].order
          );
          this.mineAndOthersDecks = [
            {
              title: this.lastActiveTabUrl,
              icon_color: this.generateRandomHslaColor(),
              cards: sortedCards.orderedCards,
            },
            {
              title: 'Unordered Cards ' + this.lastActiveTabUrl,
              icon_color: this.generateRandomHslaColor(),
              cards: sortedCards.unorderedCards,
            },
          ];
        } else {
          let deckExists = 0;
          let deck;
          let unorderedDeck = {};
          for (const _deck of this.mineAndOthersDecks) {
            if (_deck.title === this.lastActiveTabUrl) {
              deck = _deck;
              deckExists++;
            }
            if (_deck.title === 'Unordered Cards ' + this.lastActiveTabUrl) {
              unorderedDeck = deck;
            }
          }
          if (deckExists === 0) {
            const deck = {
              title: this.lastActiveTabUrl,
              icon_color: this.generateRandomHslaColor(),
              cards: this.highlights[this.lastActiveTabUrl].cards,
            };
            this.mineAndOthersDecks.push(deck);
          }
          if (unorderedDeck !== {}) this.decks = [deck, unorderedDeck];
          else this.decks = [deck];
        }
        this.loaded = true;
        if (callback) callback();
      };
      this.loaded = false;
      this.getActiveTab(() => {
        loadAllfromLocal();
      });
      // second pass, get most recent from API
      // const ApiHighlights = this.ApiGetpageAll(this.lastActiveTabUrl);
      // then update highlights, update order, and finally update this.decks.
      // make sure to check that its actually changed even before calling loading=false

      // change
      const reloadUponUpdatedOrder = function() {
        const that = this;
        chrome.runtime.onMessage.addListener(function(msg) {
          if (msg.orderRefreshed && that.selectedTab === 'page-mine') {
            chrome.storage.local.get(['highlights'], function(items) {
              that.highlights = items.highlights;
              loadJustMyHighlightsIntoDeck(that);
            });
          }
        });
      };
    },
    ApiGetpageAll(url) {
      return axios();
    },
    resetLocalStorageAndRefreshHighlights() {},
    generateRandomHslaColor() {
      // round to an interval of 20, 0-360
      const hue = Math.round((Math.random() * 360) / 20) * 20;
      const color = `hsla(${hue}, 100%, 50%, 1)`;
      return color;
    },
    switchTab(tab) {
      this.selectedTab = tab;
      if (tab === 'mine-all') {
        this.loadMineAll();
      } else if (tab === 'page-mine') {
        this.loadPageMine();
      } else if (tab === 'page-all') {
        this.loadpageAll();
      }
    },
    refreshDeck() {
      this.refreshingDeck = true;
      if (this.selectedTab === 'mine-all') {
        this.loadMineAll(true);
      } else if (this.selectedTab === 'page-mine') {
        this.loadPageMine(true);
      } else if (this.selectedTab === 'page-all') {
        this.loadpageAll(true);
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
    resizeInNewWindow(winId, updateData) {
      // if was on the left originally
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
      chrome.windows.update(winId, {
        height: updateData.height,
        width: updateData.width,
        top: updateData.top,
        left: updateData.left,
        focused: true,
      });
      chrome.runtime.sendMessage({ resizeComplete: true });
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
#sidebar-content-body {
  position: fixed;
  width: 100%;
  height: 100%;
  background-color: #f6f6f6;
  overflow-y: auto;
  padding: 0;
}
.in-other-window {
}
.in-this-window {
}
.spinner-div {
  height: calc(100% - 85px);
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
  background-color: rgba(1, 1, 1, 0);
  /* padding-right: 5px; */
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
  margin: 0;
  overflow-y: auto;
  padding: 0px 0px 100px 0px;
}
.idebar-content-main::-webkit-scrollbar {
  width: 0em;
}
.deck-row {
  margin: 10px 0 0 0;
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
