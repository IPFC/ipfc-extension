<template>
  <div id="sidebar-content-body" class="scroller" :class="windowSetting" :style="sidebarStyle">
    <sidebar-header />
    <b-container v-if="loaded" class="sidebar-content-main">
      <b-row id="main-row">
        <b-col v-if="!refreshingDeck" id="main-col">
          <b-row id="title-row">
            <b-col id="icon-col" cols="2" class="align-self-center ml-2">
              <div id="icon" :style="{ backgroundColor: deck.icon_color }">
                <p id="deck-abrev">
                  <strong>{{ getTitleAbrev(deck.title) }}</strong>
                </p>
              </div>
            </b-col>
            <b-col id="text-col">
              <p class="text title">
                {{ deck.title }}
              </p>
              <p class="text card-count">
                {{ deck.cards.length }} card{{ cardOrCards(deck.cards.length) }}
              </p>
              <div id="underline"></div>
            </b-col>
          </b-row>
          <b-row id="cards-row" class="m-0">
            <b-col id="cards-col" cols="12" style="padding: 0;">
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
  </div>
</template>

<script>
import { BCard, BImgLazy, BCardText } from 'bootstrap-vue';
import throttle from 'lodash/throttle';
import SidebarHeader from '../components/SidebarHeader.vue';
var VueScrollTo = require('vue-scrollto');
var ScrollToOptions = {
  container: '#sidebar-content-body',
  easing: 'ease-in',
  offset: -200,
  force: true,
  cancelable: true,
  // onStart: function(element) {
  // },
  // onDone: function(element) {
  // },
  // onCancel: function() {
  // },
  x: false,
  y: true,
};
export default {
  components: { BCard, BImgLazy, BCardText, SidebarHeader },
  data() {
    return {
      windowSetting: '',
      sidebarStyle: {},
      runInNewWindow: false,
      loaded: false,
      refreshingDeck: false,
      deck: {
        cards: [],
      },
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
      // console.log(msg);
      if (msg.sidebarResize) {
        const updateData = msg.updateData;
        that.resizeInNewWindow(that.sidebarWinId, updateData);
      }
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
          // console.log('cardId', cardId);
          // this.clickedHighlightId = msg.highlightId;
          // const element = document.querySelector('#card-id' + cardId);
          // console.log('element', element);
          VueScrollTo.scrollTo('#card-id' + cardId, 300, ScrollToOptions);
          that.clickedCardId = cardId;
        });
      }
      if (msg.newCardSaved) {
        // console.log('newcardsaved', msg);
        that.deck.cards.push(msg.card);
      }
      if (msg.highlightDeleted) {
        console.log('highlightDeleted recieved');
        throttle(that.refreshDeck(), 2000);
      }
    });
    chrome.storage.local.get(['runInNewWindow', 'user_collection', 'jwt', 'highlights'], function(
      items
    ) {
      that.runInNewWindow = items.runInNewWindow;
      that.user_collection = items.user_collection;
      that.jwt = items.jwt;
      const deck = {
        title: 'Cards',
        icon_color: 'blue',
        cards: [],
      };
      console.log('initial load, items.highlights', items.highlights);
      that.highlights = items.highlights;

      // this is getting all cards of all urls...
      for (const url of Object.keys(items.highlights)) {
        for (const card of items.highlights[url].cards) {
          deck.cards.push(card);
        }
      }
      that.deck = deck;
      console.log('deck', deck);
      that.loaded = true;
    });
  },
  mounted() {
    const that = this;
    chrome.storage.local.get(['runInNewWindow'], function(items) {
      if (!items.runInNewWindow) {
        // console.log('running in this window');
        that.resizeInThisWindow();
      } else {
        // console.log('running in new window');
        that.windowSetting = 'in-other-window';
      }
    });
  },
  methods: {
    refreshDeck: throttle(function() {
      this.refreshingDeck = true;
      // getting all cards for all urls now
      // won't refresh deck title for now
      const that = this;
      that.deck.cards = [];
      chrome.storage.local.get(['highlights'], function(items) {
        that.highlights = items.highlights;
        for (const url of Object.keys(items.highlights)) {
          for (const card of items.highlights[url].cards) {
            console.log(items.highlights[url].cards);
            // so this is all URLS mode. we don't care about order, but maybe we should put a divider with the site name in
            // for one URL mode, we need to loop through
            that.deck.cards.push(card);
          }
          console.log('refresh, deck', that.deck);
        }
      });
      this.refreshingDeck = false;
    }, 1000),
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
    getTitleAbrev(title) {
      // There shouldn't be any empty title decks, but we can leave this validation here just in case
      if (title === '') {
        return '';
      } else {
        let abrev;
        if (title.includes(' ')) {
          const split = title.split(' ')[0];
          abrev = split[0].charAt(0) + split[1].charAt(0);
        } else {
          abrev = title.charAt(0) + title.charAt(1);
        }
        return abrev;
      }
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
  -webkit-transform: scale(1.07, 1);
  transform: scale(1.07, 1);
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
  margin-top: 10px;
  overflow-y: auto;
  padding: 0px 0px 100px 0px;
}
.idebar-content-main::-webkit-scrollbar {
  width: 0em;
}
#main-row {
  margin: 0;
}
#main-col {
  margin: auto;
  max-width: 600px;
  padding: 0px;
}
#title-row {
  width: 100%;
}
#text-col {
  padding: 0px 0px 10px 20px;
  margin: 0px 0px 0px 20px;
}
#underline {
  position: absolute;
  bottom: 0px;
  left: 20px;
  height: 1px;
  width: 75%;
  background-color: rgba(0, 0, 0, 0.5);
}
#edit-col {
  padding: 0;
  margin: auto;
  width: 10px;
}
#icon-col {
  width: 50px;
  height: 50px;
}
#icon:hover {
  cursor: pointer;
}
#icon {
  width: 46px;
  height: 46px;
  border-radius: 23px;
  text-align: center;
  font-size: 28px;
  color: white;
  margin: auto;
}
#deck-abrev {
  margin: 0;
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
