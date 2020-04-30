<template>
  <div ref="editor-main">
    <div id="card-editor-body" class="scroller">
      <b-container v-if="loaded && !cancelled" fluid>
        <b-row id="main-row">
          <b-col id="main-col">
            <b-container class="card scroller" :class="frontFocusClass">
              <!-- had to wrap this in a div because of v-highlight bugginess -->
              <div v-if="!frontFocused" v-highlight class="preview" @click="focusInputFront()">
                <div v-if="card.front_rich_text" v-dompurify-html="card.front_rich_text"></div>
              </div>
              <quill-editor
                v-if="frontFocused"
                ref="myQuillEditorFront"
                v-model="card.front_rich_text"
                class="quill"
                :options="editorOption"
              ></quill-editor>
            </b-container>
            <br />
            <b-container class="card scroller" :class="backFocusClass">
              <div v-if="!backFocused" v-highlight class="preview" @click="focusInputBack()">
                <div v-if="card.back_rich_text" v-dompurify-html="card.back_rich_text"></div>
              </div>
              <quill-editor
                v-if="backFocused"
                ref="myQuillEditorBack"
                v-model="card.back_rich_text"
                class="quill"
                :options="editorOption"
              ></quill-editor>
            </b-container>
            <p id="counter">{{ cardNumberOutOfDeck }}</p>
            <br />
            <b-container class="tag-chooser">
              <p class="d-inline tags-label">
                In deck:
                <b-button class="add-btn">
                  <font-awesome-icon
                    v-if="!addingDeck"
                    class="d-inline add-icon"
                    color="white"
                    size="1x"
                    icon="plus-circle"
                    @click="toggleAddingDeck()"
                  />
                  <font-awesome-icon
                    v-if="addingDeck"
                    class="d-inline add-icon"
                    color="white"
                    size="1x"
                    icon="plus-circle"
                    @click="createNewDeck()"
                  />
                  <b-form-input
                    v-if="addingDeck"
                    v-model="newDeckTitle"
                    class="d-inline tag-input"
                    @keyup.enter.prevent="createNewDeck()"
                  ></b-form-input>
                </b-button>
              </p>
              <b-button class="tag-style-button green-btn d-inline">{{ deck.title }}</b-button>
              <br />
              <b-button
                v-for="unincludedDeck in unincludedDecks"
                :key="unincludedDeck.deck_id"
                class="tag-style-button white-btn d-inline"
                @click="switchDeck(unincludedDeck.deck_id)"
                >{{ unincludedDeck.title }}</b-button
              >
            </b-container>
            <br />
            <b-container class="tag-chooser page-bottom">
              <p class="d-inline tags-label">
                Tags:
                <b-button class="add-btn">
                  <font-awesome-icon
                    v-if="!addingTag"
                    class="d-inline add-icon"
                    color="white"
                    size="1x"
                    icon="plus-circle"
                    @click="toggleAddingTag()"
                  />
                  <font-awesome-icon
                    v-if="addingTag"
                    class="d-inline add-icon"
                    color="white"
                    size="1x"
                    icon="plus-circle"
                    @click="addNewTag()"
                  />
                  <b-form-input
                    v-if="addingTag"
                    v-model="newTagTitle"
                    class="d-inline tag-input"
                    @keyup.enter.prevent="addNewTag()"
                  ></b-form-input>
                </b-button>
              </p>
              <b-button
                v-for="tag in card.card_tags"
                :key="tag"
                class="tag-style-button green-btn d-inline"
                @click="removeTagFromCard(tag)"
                >{{ tag }}</b-button
              >
              <br />
              <b-button
                v-for="tag in unincludedTags"
                :key="tag"
                class="tag-style-button white-btn d-inline"
                @click="addTagToCard(tag)"
                >{{ tag }}</b-button
              >
            </b-container>
          </b-col>
        </b-row>
        <b-row id="buttons-row">
          <b-col id="buttons-col">
            <b-container id="buttons-inner">
              <b-row>
                <b-col class="btn-col">
                  <b-button class="btn-circle btn-md" @click="doneCheck()">
                    <font-awesome-icon size="2x" style="height: 2em" icon="check" />
                  </b-button>
                </b-col>
                <b-col class="btn-col">
                  <b-button class="btn-circle btn-md" @click="cancel()">
                    <font-awesome-icon size="2x" style="height: 2em" icon="times" />
                  </b-button>
                </b-col>
                <b-col class="btn-col">
                  <b-button class="btn-circle btn-md" @click="deleteCard()">
                    <font-awesome-icon size="2x" style="height: 2em" icon="trash-alt" />
                  </b-button>
                </b-col>
              </b-row>
            </b-container>
          </b-col>
        </b-row>
      </b-container>
    </div>
  </div>
</template>

<script>
/* eslint-disable vue/valid-v-on */
import { BFormInput } from 'bootstrap-vue';
import { Quill, quillEditor } from 'vue-quill-editor';
import { isEmpty } from 'lodash';
import 'quill/dist/quill.snow.css';
import imageUpload from 'quill-plugin-image-upload';
import defaultCollection from '../assets/defaultCollection.json';
import { highlighter } from '../utils/syntaxHighlight.js';

const uuidv4 = require('uuid/v4');
const axios = require('axios');
const FormData = require('form-data');
Quill.register('modules/imageUpload', imageUpload);
var quillKeyBindings = {
  custom: {
    key: 'ENTER',
    shiftKey: true,
    handler: function() {
      // find again
      document.querySelector('body > div:nth-child(1)').__vue__.editorShiftEnter();
    },
  },
};

export default {
  name: 'CardEditor',
  components: { BFormInput, quillEditor },
  data() {
    return {
      loaded: false,
      cancelled: false,
      frontFocused: true,
      backFocused: false,
      frontFocusClass: '',
      backFocusClass: '',
      initialDeckState: null,
      addingTag: false,
      newTagTitle: '',
      addingDeck: false,
      newDeckTitle: '',
      deck: {
        title: '',
        edited: 0,
        deck_id: '',
        card_count: 0,
      },
      card: {
        card_tags: ['Daily Review'],
        front_text: '',
        back_text: '',
        front_rich_text: '',
        back_rich_text: '',
      },
      user_collection: defaultCollection.user_collection,
      pinataKeys: {
        pinata_api: '',
        pinata_key: '',
      },
      editorOption: {
        theme: 'snow',
        modules: {
          imageUpload: {
            upload: file => {
              const gateway = 'https://gateway.pinata.cloud/ipfs/';
              const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
              const data = new FormData();
              data.append('file', file);
              const metadata = JSON.stringify({
                name: 'testname',
                keyvalues: {
                  exampleKey: 'exampleValue',
                },
              });
              data.append('pinataMetadata', metadata);
              return axios
                .post(url, data, {
                  maxContentLength: 'Infinity', // this is needed to prevent axios from erroring out with large files
                  headers: {
                    'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                    pinata_api_key: this.pinataKeys.pinata_api,
                    pinata_secret_api_key: this.pinataKeys.pinata_key,
                  },
                })
                .then(function(response) {
                  return gateway + response.data.IpfsHash;
                })
                .catch(function() {
                  // console.log(error)
                });
            },
          },
          toolbar: defaultCollection.user_collection.webapp_settings.text_editor.options.toolbar,
          syntax: {
            highlight: text => highlighter.highlightAuto(text).value,
          },
          history: {
            delay: 2000,
            maxStack: 500,
            userOnly: true,
          },
          keyboard: {
            bindings: quillKeyBindings,
          },
        },
      },
      jwt: '',
    };
  },
  computed: {
    unincludedTags() {
      // this now rides on review deck in getters
      const allTagsList = this.user_collection.all_card_tags.list;
      const unincludedTagsList = [];
      if (!isEmpty(allTagsList))
        for (const tag of allTagsList) {
          if (!this.card.card_tags.includes(tag)) {
            unincludedTagsList.push(tag);
          }
        }
      return unincludedTagsList;
    },
    unincludedDecks() {
      const unincludedDecks = [];
      for (const deck of this.decks_meta) {
        if (deck.deck_id !== this.deck.deck_id) unincludedDecks.push(deck);
      }
      return unincludedDecks;
    },
    cardNumberOutOfDeck() {
      const totalCards = this.deck.card_count + 1;
      return `Card ${totalCards}/${totalCards} in: ${this.deck.title}`;
    },
  },
  watch: {},
  created() {
    const that = this;
    chrome.windows.getCurrent(function(win) {
      chrome.runtime.sendMessage({ editorWinId: win.id });
      that.editorWinId = win.id;
    });
  },
  mounted() {
    this.loadStorage();
  },
  methods: {
    setCard(cardData) {
      this.card = {
        card_tags: ['Daily Review'],
        front_text: cardData.selection
          ? cardData.selection
          : cardData.front_text
          ? cardData.front_text
          : '',
        back_text: cardData.back_text ? cardData.back_text : '',
        front_rich_text: cardData.selection
          ? cardData.selection
          : cardData.front_rich_text
          ? cardData.front_rich_text
          : '',
        back_rich_text: cardData.back_rich_text ? cardData.back_rich_text : '',
        card_id: cardData.card_id,
        user_id: cardData.user_id,
        highlight_url: cardData.highlight_url,
        edited: new Date().getTime(),
      };
      if (cardData.highlight_id) this.card.highlight_id = cardData.highlight_id;
      if (this.lastUsedDeck[cardData.highlight_url]) {
        for (const deck of this.decks_meta) {
          if (deck.title === this.lastUsedDeck[cardData.highlight_url]) {
            this.deck = deck;
            return null;
          }
        }
        // if the title was changed, or not found
        this.setDeck(this.formatTitle(cardData.highlight_url));
      } else this.setDeck(this.formatTitle(cardData.highlight_url));
    },
    setDeck(deckTitle) {
      for (const deck of this.decks_meta) {
        if (deck.title === deckTitle) {
          this.deck = deck;
          return null;
        }
      }
      const newDeck = {
        cards: [this.card],
        user_id: this.user_collection.user_id,
        deck_id: uuidv4(),
        deck_tags: [],
        description: null,
        editable_by: 'only_me',
        edited: new Date().getTime(),
        lang_back: 'en',
        lang_front: 'en',
        card_count: 0,
        title: deckTitle,
        visibility: 'public',
        icon_color: this.generateRandomHslaColor(),
      };
      this.decks_meta.push(newDeck);
      this.deck = newDeck;
      this.newDeckToPost = deckTitle;
    },
    loadStorage() {
      const that = this;
      chrome.storage.local.get(
        [
          'user_collection',
          'lastUsedDeck',
          'pinata_keys',
          'newCardData',
          'toEditCardData',
          'decks_meta',
          'jwt',
        ],
        function(items) {
          chrome.storage.sync.get(['serverUrl'], syncItems => {
            that.serverUrl = syncItems.serverUrl;
          });
          if (!items.user_collection) {
            window.close();
            that.cancelled = true;
            return null;
          }
          that.lastUsedDeck = items.lastUsedDeck ? items.lastUsedDeck : {};
          that.user_collection = items.user_collection;
          that.decks_meta = items.decks_meta;
          that.jwt = items.jwt;
          that.toEditCardData = items.toEditCardData;
          that.newCardData = items.newCardData;
          that.editorOption.modules.toolbar =
            items.user_collection.webapp_settings.text_editor.options.toolbar;
          if (items.toEditCardData) that.setCard(items.toEditCardData.card);
          else if (items.newCardData) that.setCard(items.newCardData);
          that.loaded = true;
        }
      );
    },
    cancel() {
      this.cancelled = true;
      window.close();
    },
    deleteCard() {
      chrome.runtime.sendMessage({
        deleteCard: true,
        url: this.card.highlight_url,
        card: this.card,
      });
      this.cancelled = true;
      window.close();
    },
    editorShiftEnter() {
      event.preventDefault();
      if (this.frontFocused) {
        this.focusInputBack();
      } else {
        this.doneCheck();
      }
    },
    focusInputFront() {
      this.frontFocused = true;
      this.backFocused = false;
      this.frontFocusClass = 'focused';
      this.backFocusClass = 'unfocused';
      this.$nextTick(() => {
        const length = this.$refs.myQuillEditorFront.quill.getLength();
        this.$refs.myQuillEditorFront.quill.setSelection(length);
      });
    },
    focusInputBack() {
      this.frontFocused = false;
      this.backFocused = true;
      this.frontFocusClass = 'unfocused';
      this.backFocusClass = 'focused';
      this.$nextTick(() => {
        const length = this.$refs.myQuillEditorBack.quill.getLength();
        this.$refs.myQuillEditorBack.quill.setSelection(length);
      });
    },
    doneCheck: function() {
      if (!this.unChanged) {
        this.submit(this.card);
      }
    },
    getQuillData: function(cardInput, quill) {
      // copy image and plaintext

      const card = JSON.parse(JSON.stringify(cardInput));
      for (const line of quill.quillFrontDelta.ops) {
        if (line.insert.image) {
          card.front_image = line.insert.image;
          break;
        }
      }
      card.front_text = quill.frontGottenText;
      for (const line of quill.quillBackDelta.ops) {
        if (line.insert.image) {
          card.back_image = line.insert.image;
          break;
        }
      }
      card.back_text = quill.backGottenText;
      return card;
    },
    submit(card) {
      // this focuses both sides so that quill is showing
      card.edited = new Date().getTime();
      this.backFocused = true;
      this.frontFocused = true;
      this.$nextTick(() => {
        const quill = JSON.parse(
          JSON.stringify({
            quillFrontDelta: this.$refs.myQuillEditorFront.quill.getContents(),
            frontGottenText: this.$refs.myQuillEditorFront.quill.getText(),
            quillBackDelta: this.$refs.myQuillEditorBack.quill.getContents(),
            backGottenText: this.$refs.myQuillEditorBack.quill.getText(),
          })
        );
        // if (!unChanged)
        // if (card.is_copy_of) {
        //   card.is_copy_of = false;
        //   card.card_id = uuidv4();
        // }
        this.submitStep2(card, quill);
      });
    },
    submitStep2: async function(cardInput, quill) {
      const card = await this.getQuillData(cardInput, quill);
      if (card.card_tags.includes('Daily Review')) this.addCardToSchedule(card.card_id);
      chrome.runtime.sendMessage({ storeCardFromEditor: true, card: card });
      // if editing old card
      let updatingCard;
      if (this.toEditCardData) {
        if (!this.newCardData) updatingCard = true;
        else if (this.toEditCardData.time > this.newCardData.time) updatingCard = true;
      }
      if (this.newDeckToPost === this.deck.title) {
        this.deck.card_count = 1;
        this.deck.cards = [card];
        chrome.runtime.sendMessage({
          postDeck: true,
          jwt: this.jwt,
          serverUrl: this.serverUrl,
          card: card,
          deck: this.deck,
        });
      } else if (updatingCard) {
        chrome.runtime.sendMessage({
          putCard: true,
          jwt: this.jwt,
          serverUrl: this.serverUrl,
          card: card,
          deckId: this.deck.deck_id,
        });
      } else {
        chrome.runtime.sendMessage({
          postCard: true,
          jwt: this.jwt,
          serverUrl: this.serverUrl,
          card: card,
          deckId: this.deck.deck_id,
        });
      }
      this.lastUsedDeck[card.highlight_url] = this.deck.title;
      chrome.storage.local.set({
        lastUsedDeck: this.lastUsedDeck,
        toEditCardData: null,
        newCardData: null,
      });
      window.close();
      return true;
    },
    // use later for dropdown menu, copy to other deck
    switchDeck(deckId) {
      for (const deck of this.decks_meta) {
        if (deck.deck_id === deckId) this.deck = deck;
      }
    },
    removeTagFromCard(tag) {
      const card = JSON.parse(JSON.stringify(this.card));
      card.card_tags.splice(card.card_tags.indexOf(tag), 1);
    },
    addTagToCard(tag) {
      this.card.card_tags.unshift(tag);
    },
    toggleAddingTag: function() {
      this.addingTag = !this.addingTag;
    },
    toggleAddingDeck: function() {
      this.addingDeck = !this.addingDeck;
    },
    createNewDeck: function() {
      if (this.newDeckTitle === '' || this.newDeckTitle === ' ') {
        this.toggleAddingDeck();
      } else {
        const emptyDeck = {
          cards: [this.card],
          user_id: this.user_collection.user_id,
          deck_id: uuidv4(),
          deck_tags: [],
          description: null,
          editable_by: 'only_me',
          edited: new Date().getTime(),
          lang_back: 'en',
          lang_front: 'en',
          card_count: 0,
          title: this.newDeckTitle,
          visibility: 'public',
          icon_color: this.generateRandomHslaColor(),
        };
        this.decks_meta.push(emptyDeck);
        this.deck = emptyDeck;
        this.toggleAddingDeck();
        this.newDeckTitle = '';
      }
    },
    addCardToSchedule(cardId) {
      let dupCount = 0;
      for (const scheduleItem of this.user_collection.schedule.list) {
        if (scheduleItem.card_id === cardId) {
          dupCount++;
          break;
        }
      }
      if (dupCount === 0) {
        this.user_collection.schedule.list.push({
          card_id: cardId,
          level: 0,
          due: new Date().getTime(),
          last_interval: null,
        });
        this.user_collection.schedule.edited = new Date().getTime();
        chrome.storage.local.set({ user_collection: this.user_collection });
      }
    },
    generateRandomHslaColor: function() {
      // round to an interval of 20, 0-360
      const hue = Math.round((Math.random() * 360) / 20) * 20;
      const color = `hsla(${hue}, 100%, 50%, 1)`;
      return color;
    },
    addNewTag: function() {
      const card = JSON.parse(JSON.stringify(this.card));
      const allTags = this.unincludedTags.concat(card.card_tags);
      if (
        allTags.includes(this.newTagTitle) ||
        this.newTagTitle === '' ||
        this.newTagTitle === ' '
      ) {
        this.newTagTitle = '';
        this.toggleAddingTag();
      } else {
        card.card_tags.unshift(this.newTagTitle);
        this.user_collection.all_card_tags.list.push(this.newTagTitle);
        this.user_collection.all_card_tags.edited = new Date().getTime();
        chrome.storage.local.set({ user_collection: this.user_collection });
        this.newTagTitle = '';
        this.toggleAddingTag();
      }
    },
    formatTitle(title) {
      let frontTrunc;
      if (!title.includes('http://') && !title.includes('https://')) frontTrunc = title;
      else {
        if (title.includes('http://')) {
          frontTrunc = title.replace('http://', '');
        } else if (title.includes('https://')) {
          frontTrunc = title.replace('https://', '');
        }
      }
      if (frontTrunc.includes('/')) {
        const backTrunc = frontTrunc.split('/');
        return backTrunc[0];
      } else return frontTrunc;
    },
  },
};
</script>

<style scoped>
#card-editor-body {
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.51);
  left: 0px;
  top: 0px;
  z-index: 99999999;
  position: fixed;
  height: 100%;
  width: 100%;
  overflow-y: auto;
  background-color: #f6f6f6;
}
.scroller::-webkit-scrollbar {
  width: 8px;
  padding-right: 5px;
}
.scroller::-webkit-scrollbar-thumb {
  background-color: rgba(162, 162, 162, 0.5);
  border-radius: 10px;
}
#main-col {
  width: 100%;
  padding: 0px 10px;
}
#card-container {
  padding: 0;
}
.card {
  width: 100%;
  max-width: 600px;
  margin: auto;
  top: 15px;
  border-radius: 10px;
  cursor: pointer;
  padding: 0px 5px 0px;
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.51);
  text-align: left;
  overflow-y: auto;
}
.focused {
  max-height: 20em;
  transition: max-height 0.5s ease;
}
.unfocused {
  max-height: 8em;
}
.preview {
  padding: 12px 15px;
  min-height: 2em;
}
.throw-right {
  transform: translateX(1000px);
  z-index: 10000;
  transition: transform 0.15s ease-in;
}
.throw-left {
  transform: translateX(-1000px);
  z-index: 10000;
  transition: transform 0.15s ease-in;
}
.offscreen-left {
  visibility: hidden;
  transform: translateX(-1000px);
  transition: transform 0s linear;
}
.offscreen-right {
  visibility: hidden;
  transform: translateX(1000px);
  transition: transform 0s linear;
}
.enter {
  transform: translateX(0px);
  transition: transform 0.15s ease-out;
}
.flashcard:hover {
  box-shadow: 0 0px 25px rgba(0, 0, 0, 0.8);
}
#counter {
  color: grey;
  margin: 40px auto 0px;
  max-width: 600px;
}

.tag-chooser {
  margin: auto;
  height: 7em;
  overflow-x: auto;
  white-space: nowrap;
  position: initial;
  padding: 0px;
  max-width: 600px;
}
.tag-chooser::-webkit-scrollbar {
  height: 0.5em;
}
.tag-chooser::-webkit-scrollbar-thumb {
  background-color: rgba(162, 162, 162, 0.5);
  border-radius: 0px;
}
.tags-label {
  margin: 0px 0px 5px 0px;
  padding: 0px;
}

.tag-style-button {
  border-radius: 10px;
  margin: 5px 10px;
  border-width: 0px;
  color: grey;
  padding: 0.4em;
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.51);
}
.green-btn {
  background-color: rgba(185, 255, 184, 1);
}
.white-btn {
  background-color: white;
}

.page-bottom {
  margin-bottom: 60px;
}
.add-btn {
  border: none;
  border-radius: 10px;
  background-color: grey;
  padding: 0px 0px;
  overflow-x: hidden;
  display: inline-flex;
}
.add-icon {
  margin: 0.58em;
  height: 1em;
}
.tag-input {
  height: 2em;
}

.btn-circle.btn-md {
  width: 40px;
  height: 40px;
  padding: 0px 11px;
  margin: 5px auto;
  border-radius: 20px;
  font-size: 10px;
  text-align: center;
  color: grey;
  background-color: white;
  border: none;
  box-shadow: 0 0px 5px rgba(0, 0, 0, 0.5);
  max-height: 25vh;
}
.btn-circle.btn-md:hover {
  box-shadow: 0 0px 25px rgba(0, 0, 0, 0.8);
}

#buttons-row {
  text-align: center;
  position: fixed;
  bottom: 0px;
  width: 100%;
  z-index: 1000;
  background-color: rgba(63, 47, 47, 0.3);
}
#buttons-col {
  max-width: 600px;
  margin: auto;
}
.btn-col {
  padding: 0px;
  margin: 5px 2px;
}
.preview >>> img {
  width: 100%;
  margin: auto;
  object-fit: fill;
}
.preview >>> .ql-align-center {
  text-align: center;
}
.preview >>> .ql-align-right {
  text-align: right;
}
.preview >>> .ql-align-left {
  text-align: left;
}
.preview >>> .ql-align-justify {
  text-align: justify;
}
.preview >>> p {
  font-size: 1rem;
}
.preview >>> p .ql-size-small {
  font-size: 0.75rem;
}
.preview >>> p .ql-size-large {
  font-size: 1.5rem;
}
.preview >>> p .ql-size-huge {
  font-size: 2.5rem;
}
.quill >>> .ql-container.ql-snow {
  border: 0px;
}

.quill >>> .ql-toolbar.ql-snow {
  border: 0px solid #ccc;
  border-bottom: 1px solid #ccc;
}
.quill >>> p {
  font-size: 1rem;
}
.quill >>> p .ql-size-small {
  font-size: 0.75rem;
}
.quill >>> p .ql-size-large {
  font-size: 1.5rem;
}
.quill >>> p .ql-size-huge {
  font-size: 2.5rem;
}
</style>
