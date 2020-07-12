import { isEmpty, sortBy } from 'lodash';
import { addHighlightError } from './errorManager';
import { highlight } from './highlighter';
import {
  filterOutCardCopies,
  combineMineAndOthersWebsites,
  findHiddenHighlight,
} from '../utils/dataProcessing';
import {
  // sendMessageToAllTabs,
  SendOutRefresh,
} from '../utils/messaging';

const axios = require('axios');
const uuidv4 = require('uuid/v4');
const $ = require('jquery');
const HIGHLIGHT_CLASS = 'highlighter--highlighted';

const clearPageHighlights = callback => {
  $('.' + HIGHLIGHT_CLASS).css('background-color', 'inherit');
  $('.' + HIGHLIGHT_CLASS).removeClass();
  if (callback) callback();
};

const getCardsInOrder = function(rawCards, order, userId, websites) {
  const cards = filterOutCardCopies(rawCards, userId);
  const orderedCards = [];
  const orderlessCards = [];

  for (const card of cards) {
    if (!order.includes(card.highlight_id)) {
      // try to find cards matching highlights that aren't displayed. look for highlights with the same anchors
      const hiddenHighlight = findHiddenHighlight(card, websites, order);
      if (hiddenHighlight) {
        console.log('hiddenHighlight', hiddenHighlight);
        card.highlight_id = hiddenHighlight.highlight_id;
      } else orderlessCards.push(card);
    }
  }
  for (const highlightId of order) {
    for (const card of cards) {
      if (card.highlight_id === highlightId) {
        orderedCards.push(card);
      }
    }
  }
  return {
    orderedCards: orderedCards,
    orderlessCards: orderlessCards,
  };
};
const getHighlightsOrder = function() {
  const highlightsInOrder = [];
  $('.' + HIGHLIGHT_CLASS).each(function() {
    // console.log('highlight order this', this);
    if (!highlightsInOrder.includes(this.id)) highlightsInOrder.push(this.id);
  });
  // console.log('highlightsInOrder', highlightsInOrder);
  return highlightsInOrder;
};
const storeHighlightsOrder = function(url, callback) {
  // and creates mineAndOthers ordered and orderless cards
  // console.log('storeHighlightsOrder');
  chrome.storage.local.get(
    ['websites', 'mineAndOthersWebsites', 'highlightsViewMode', 'user_collection'],
    items => {
      let websites;
      // this might get expensive with a large collection, especially to do on every load..
      if (items.highlightsViewMode === 'mineAndOthers')
        websites = combineMineAndOthersWebsites(items.websites, items.mineAndOthersWebsites);
      else websites = items.websites;
      if (isEmpty(websites)) {
        if (callback) callback();
        return null;
      }
      if (isEmpty(websites[url])) {
        if (callback) callback();
        return null;
      }
      if (websites[url].cards) {
        websites[url].order = getHighlightsOrder();
        const sortedCards = getCardsInOrder(
          websites[url].cards,
          websites[url].order,
          items.user_collection.user_id,
          websites
        );
        // console.log('sortedCards', sortedCards);
        websites[url].orderedCards = sortedCards.orderedCards;
        websites[url].orderlessCards = sortedCards.orderlessCards;
        if (items.highlightsViewMode === 'mine') {
          chrome.storage.local.set({ websites: websites }, () => {
            if (callback) callback();
          });
        }
      }
      if (items.highlightsViewMode === 'mineAndOthers') {
        // console.log('setting mineAndOthersWebsites', websites[url]);
        chrome.storage.local.set({ mineAndOthersWebsites: websites }, () => {
          if (callback) callback();
        });
      }
    }
  );
};
const storeHighlight = function(
  selection,
  container,
  url,
  color,
  userId,
  cardId,
  highlightId,
  callback
) {
  // From an DOM element, get a query to that DOM element
  function getQuery(element) {
    // Colons and spaces are accepted in IDs in HTML but not in CSS syntax
    // Similar (but much more simplified) to the CSS.escape() working draft
    function escapeCSSString(cssString) {
      return cssString.replace(/(:)/g, '\\$1');
    }
    // console.log('getQuery', element);
    if (element.id) return '#' + escapeCSSString(element.id);
    if (element.localName === 'html') return 'html';
    const parent = element.parentNode;
    let index;
    const parentSelector = getQuery(parent);
    // The element is a text node
    if (!element.localName) {
      // Find the index of the text node:
      index = Array.prototype.indexOf.call(parent.childNodes, element);
      return parentSelector + '>textNode:nth-of-type(' + index + ')';
    } else {
      const jEl = $(element);
      index = jEl.index(parentSelector + '>' + element.localName) + 1;
      return parentSelector + '>' + element.localName + ':nth-of-type(' + index + ')';
    }
  }
  // if (syncing) {
  //   alert('syncing, please wait');
  //   return null;
  // }
  // console.log('storeHighlight called');
  const newHighlight = {
    string: selection.toString(),
    container: getQuery(container),
    anchorNode: getQuery(selection.anchorNode),
    anchorOffset: selection.anchorOffset,
    focusNode: getQuery(selection.focusNode),
    focusOffset: selection.focusOffset,
    color: color,
    highlight_id: highlightId,
    user_id: userId,
    card_id: cardId,
    visibility: 'public',
    editable_by: 'public',
    edited: new Date().getTime(),
    created: new Date().getTime(),
  };
  addHighlightToLocalStorage(newHighlight, url, false, callback);
};

function addHighlightToLocalStorage(highlight, url, refreshHighlights = false, callback) {
  chrome.storage.local.get(['websites', 'user_collection', 'mineAndOthersWebsites'], items => {
    let websites = items.websites;
    let mineAndOthersWebsites = items.mineAndOthersWebsites;
    const userCollection = items.user_collection;
    if (!websites) websites = {};
    if (!mineAndOthersWebsites) mineAndOthersWebsites = {};
    if (!websites[url]) {
      websites[url] = {};
    }
    if (!mineAndOthersWebsites[url]) {
      mineAndOthersWebsites[url] = {};
    }
    if (!websites[url].highlights) {
      websites[url].highlights = {};
    }
    if (!mineAndOthersWebsites[url].highlights) {
      mineAndOthersWebsites[url].highlights = {};
    }
    // console.log('user_collection', userCollection);
    if (!userCollection.highlight_urls || !userCollection.highlight_urls.list) {
      userCollection.highlight_urls = {};
      userCollection.highlight_urls.list = [];
    }
    if (!items.user_collection.highlight_urls.list.includes(url)) {
      userCollection.highlight_urls.list.push(url);
      userCollection.highlight_urls.edited = new Date().getTime();
      // console.log('user collection after adding highlight urls', userCollection);
      chrome.storage.local.set({
        user_collection: userCollection,
      });
    }
    websites[url].highlights[highlight.highlight_id] = highlight;
    mineAndOthersWebsites[url].highlights[highlight.highlight_id] = highlight;
    // console.log('highlights[url]', highlights[url]);
    // console.log('thisURLsHighlights', thisURLsHighlights);
    chrome.storage.local.set(
      {
        websites: websites,
        mineAndOthersWebsites: mineAndOthersWebsites,
      },
      () => {
        if (callback) callback();
      }
    );
    if (refreshHighlights) {
      SendOutRefresh(url, true, 'addHighlightToLocalStorage', false);
      chrome.runtime.sendMessage({
        refreshHighlights: true,
        refreshOrder: true,
        url: url,
        sender: 'addHighlightToLocalStorage',
      });
    }
  });
}

const collectHighlight = function(
  highlight,
  url,
  userId,
  cardId = null,
  highlightId = null,
  callback = null
) {
  const updatedHighlight = {
    string: highlight.string,
    container: highlight.container,
    anchorNode: highlight.anchorNode,
    anchorOffset: highlight.anchorOffset,
    focusNode: highlight.focusNode,
    focusOffset: highlight.focusOffset,
    color: highlight.color,
    highlight_id: highlightId || uuidv4(),
    user_id: userId,
    card_id: cardId || highlight.card_id,
    visibility: 'public',
    editable_by: 'public',
    edited: new Date().getTime(),
    created: new Date().getTime(),
  };
  if (cardId) collectCard(cardId, url, userId, updatedHighlight.highlight_id);
  addHighlightToLocalStorage(updatedHighlight, url, true, callback);
};
const collectCardAndHighlight = function(card, userId) {
  console.log('collectCardAndHighlight', card, userId);
  // if we already have the highlight, store the card directly. if we don't, then collectHighlight from others
  // debugger;
  chrome.storage.local.get(
    ['websites', 'mineAndOthersWebsites', 'jwt', 'decks_meta', 'lastUsedDeck'],
    items => {
      function findHighlight(mineAndOthersWebsites, card, url) {
        if (!isEmpty(mineAndOthersWebsites)) {
          if (!isEmpty(mineAndOthersWebsites[url])) {
            if (!isEmpty(mineAndOthersWebsites[url].highlights)) {
              const highlight = mineAndOthersWebsites[url].highlights[card.highlight_id];
              if (!isEmpty(highlight)) {
                return highlight;
              }
            }
          }
        }
      }
      const highlight = findHighlight(items.mineAndOthersWebsites, card, card.highlight_url);
      const cardId = uuidv4();
      const highlightId = 'h-id-' + uuidv4();
      highlight.card_id = cardId;
      collectHighlight(highlight, card.highlight_url, userId, null, highlightId, () => {
        card.user_id = userId;
        card.highlight_id = highlightId;
        card.is_copy_of = card.card_id;
        card.card_id = cardId;
        // use store card not collect, because highlight ID will be diff
        storeCard(card, () => {
          postCollectedCard(
            items.lastUsedDeck,
            card.highlight_url,
            items.decks_meta,
            card,
            items.jwt
          );
        });
      });
    }
  );
};
function collectCard(cardId, url, userId, highlightId) {
  chrome.storage.local.get(
    ['mineAndOthersWebsites', 'jwt', 'decks_meta', 'lastUsedDeck'],
    items => {
      let website;
      let cardToPost = null;
      if (items.mineAndOthersWebsites) website = items.mineAndOthersWebsites[url];
      if (website)
        if (website.cards)
          for (const card of website.cards) {
            if (card.card_id === cardId) {
              card.user_id = userId;
              card.is_copy_of = card.card_id;
              card.card_id = uuidv4();
              if (highlightId) card.highlight_id = highlightId;
              cardToPost = card;
              storeCard(card, () => {
                if (cardToPost) {
                  postCollectedCard(
                    items.lastUsedDeck,
                    url,
                    items.decks_meta,
                    cardToPost,
                    items.jwt
                  );
                }
              });
              break;
            }
          }
    }
  );
}
function postCollectedCard(lastUsedDeck, url, decksMeta, cardToPost, jwt) {
  console.log('postCollectedCard', lastUsedDeck, url, decksMeta, cardToPost, jwt);
  const formatTitle = function(title) {
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
  };
  let toPostDeck = {};
  if (lastUsedDeck) {
    toPostDeck = lastUsedDeck[Object.keys(lastUsedDeck)[0]];
  } else {
    const urlAsTitle = formatTitle(url);
    let count = 0;
    for (const deck of decksMeta) {
      if (deck.title === urlAsTitle) {
        toPostDeck = deck;
        count++;
        break;
      }
    }
    if (count === 0) {
      const decksByEdited = sortBy(decksMeta, 'edited');
      toPostDeck = decksByEdited[0];
    }
  }
  console.log('toPostDeck', toPostDeck);
  chrome.storage.sync.get(['serverUrl'], syncItems => {
    postCard(jwt, syncItems.serverUrl, cardToPost, toPostDeck.deck_id, toPostDeck.title);
  });
}
// can also be used to replace a card
const storeCard = function(card, callback) {
  console.log('store card. card', card);
  const url = card.highlight_url;
  chrome.storage.local.get(['websites', 'mineAndOthersWebsites', 'user_collection'], items => {
    if (!items.user_collection) {
      alert('please log in to IPFC');
      return null;
    }
    let websites = items.websites;
    let mineAndOthersWebsites = items.mineAndOthersWebsites;
    if (!websites) websites = {};
    if (!mineAndOthersWebsites) mineAndOthersWebsites = {};
    if (!websites[url]) {
      websites[url] = {};
    }
    if (!mineAndOthersWebsites[url]) {
      mineAndOthersWebsites[url] = {};
    }
    if (!websites[url].cards) {
      websites[url].cards = [];
    }
    if (!mineAndOthersWebsites[url].cards) {
      mineAndOthersWebsites[url].cards = [];
    }
    console.log('before storing,', websites[url].cards, mineAndOthersWebsites[url].cards);
    for (const existingCard of websites[url].cards) {
      if (existingCard.card_id === card.card_id) {
        websites[url].cards.splice(websites[url].cards.indexOf(existingCard), 1);
        break;
      }
    }
    for (const existingCard of mineAndOthersWebsites[url].cards) {
      if (existingCard.card_id === card.card_id) {
        mineAndOthersWebsites[url].cards.splice(
          mineAndOthersWebsites[url].cards.indexOf(existingCard),
          1
        );
        break;
      }
    }
    websites[url].cards.push(card);
    mineAndOthersWebsites[url].cards.push(card);
    console.log('card stored', websites[url].cards, mineAndOthersWebsites[url].cards);
    chrome.storage.local.set(
      {
        websites: websites,
        mineAndOthersWebsites: mineAndOthersWebsites,
      },
      () => {
        // make sure mcorresponding highlight has card's ID included.
        if (card.highlight_id) {
          if (!isEmpty(websites[url].highlights))
            if (websites[url].highlights[card.highlight_id])
              if (websites[url].highlights[card.highlight_id].card_id) {
                if (websites[url].highlights[card.highlight_id].card_id !== card.card_id) {
                  websites[url].highlights[card.highlight_id].card_id = card.card_id;
                  chrome.storage.local.set({
                    websites: websites,
                  });
                }
              } else {
                websites[url].highlights[card.highlight_id].card_id = card.card_id;
                chrome.storage.local.set({
                  websites: websites,
                });
              }
          if (!isEmpty(mineAndOthersWebsites[url].highlights))
            if (mineAndOthersWebsites[url].highlights[card.highlight_id])
              if (mineAndOthersWebsites[url].highlights[card.highlight_id].card_id) {
                if (
                  mineAndOthersWebsites[url].highlights[card.highlight_id].card_id !== card.card_id
                ) {
                  mineAndOthersWebsites[url].highlights[card.highlight_id].card_id = card.card_id;
                  chrome.storage.local.set({
                    mineAndOthersWebsites: mineAndOthersWebsites,
                  });
                }
              } else {
                mineAndOthersWebsites[url].highlights[card.highlight_id].card_id = card.card_id;
                chrome.storage.local.set({
                  mineAndOthersWebsites: mineAndOthersWebsites,
                });
              }
        }
        SendOutRefresh(url, true, 'storeCard', false);
        chrome.runtime.sendMessage({
          refreshHighlights: true,
          refreshOrder: true,
          retry: true,
          url: url,
          sender: 'storeCard',
        });
        if (callback) callback();
      }
    );
  });
};
const postCard = async function(jwt, serverUrl, card, deckId, deckTitle) {
  console.log('posting card', jwt, serverUrl, card, deckId);
  const options = {
    url: serverUrl + '/post_card',
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': jwt,
    },
    method: 'POST',
    data: {
      card: card,
      deck_id: deckId,
    },
  };
  let result;
  await axios(options)
    .then(response => {
      result = response.data;
      console.log('new card posted, result: ', result);
      chrome.storage.local.get(['uploadFailedCardsPost'], items => {
        const uploadFailedCardsPost = items.uploadFailedCardsPost;
        const entry = { card: card, deck_id: deckId };
        if (!isEmpty(uploadFailedCardsPost))
          if (!uploadFailedCardsPost.includes(entry)) {
            uploadFailedCardsPost.splice(uploadFailedCardsPost.indexOf(entry), 1);
            chrome.storage.local.set({ uploadFailedCardsPost: uploadFailedCardsPost });
            chrome.runtime.sendMessage({ deckPosted: true, deckTitle: deckTitle });
          }
      });
      chrome.runtime.sendMessage({ cloudSync: true });
    })
    .catch(function(err) {
      chrome.storage.local.get(['uploadFailedCardsPost'], items => {
        let uploadFailedCardsPost = items.uploadFailedCardsPost;
        if (!uploadFailedCardsPost) uploadFailedCardsPost = [];
        uploadFailedCardsPost.push({ card: card, deck_id: deckId });
        chrome.storage.local.set({ uploadFailedCardsPost: uploadFailedCardsPost });
      });
      throw new Error(err);
    });
};
const putCard = async function(jwt, serverUrl, card, deckId) {
  const options = {
    url: serverUrl + '/put_card',
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': jwt,
    },
    method: 'PUT',
    data: {
      card: card,
      deck_id: deckId,
    },
  };
  let result;
  // console.log('putting card', options.data);
  await axios(options)
    .then(response => {
      result = response.data;
      console.log(' card updated, result: ', result);
      chrome.storage.local.get(['uploadFailedCardsPut'], items => {
        const uploadFailedCardsPut = items.uploadFailedCardsPut;
        const entry = { card: card, deck_id: deckId };
        if (!isEmpty(uploadFailedCardsPut)) {
          if (!uploadFailedCardsPut.includes(entry))
            uploadFailedCardsPut.splice(uploadFailedCardsPut.indexOf(entry), 1);
          chrome.storage.local.set({ uploadFailedCardsPut: uploadFailedCardsPut });
        }
      });
      chrome.runtime.sendMessage({ cloudSync: true });
    })
    .catch(function(err) {
      chrome.storage.local.get(['uploadFailedCardsPut'], items => {
        let uploadFailedCardsPut = items.uploadFailedCardsPut;
        if (!uploadFailedCardsPut) uploadFailedCardsPut = [];
        uploadFailedCardsPut.push({ card: card, deck_id: deckId });
        chrome.storage.local.set({ uploadFailedCardsPut: uploadFailedCardsPut });
      });
      throw new Error(err);
    });
};
const deleteServerCard = async function(jwt, serverUrl, card, deckId) {
  const options = {
    url: serverUrl + '/delete_card',
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': jwt,
    },
    method: 'DELETE',
    data: {
      card: card,
      deck_id: deckId,
    },
  };
  let result;
  console.log('deleting server card', options.data);
  await axios(options)
    .then(response => {
      result = response.data;
      console.log(' card deleted, result: ', result);
    })
    .catch(function(err) {
      throw new Error(err);
    });
};
const postDeck = async function(jwt, serverUrl, card, deck) {
  deck.edited = new Date().getTime();
  deck.cards = [card];
  const options = {
    url: serverUrl + '/post_deck',
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': jwt,
    },
    method: 'POST',
    data: deck,
  };
  // let result;
  await axios(options)
    .then(response => {
      const result = response.data;
      console.log('deck posted, result: ', result);
      chrome.storage.local.get(['uploadFailedDecksPost'], items => {
        const uploadFailedDecksPost = items.uploadFailedDecksPost;
        const entry = { card: card, deck: deck };
        if (!isEmpty(uploadFailedDecksPost)) {
          if (!uploadFailedDecksPost.includes(entry))
            uploadFailedDecksPost.splice(uploadFailedDecksPost.indexOf(entry), 1);
          chrome.storage.local.set({ uploadFailedDecksPost: uploadFailedDecksPost });
        }
      });
      chrome.runtime.sendMessage({ cloudSync: true });
    })
    .catch(function(err) {
      chrome.storage.local.get(['uploadFailedDecksPost'], items => {
        let uploadFailedDecksPost = items.uploadFailedDecksPost;
        if (!uploadFailedDecksPost) uploadFailedDecksPost = [];
        uploadFailedDecksPost.push({ card: card, deck: deck });
        chrome.storage.local.set({ uploadFailedDecksPost: uploadFailedDecksPost });
      });
      throw new Error(err);
    });
};
const loadThisUrlsHighlights = function(url, callback) {
  function checkHighlightsForCopies(highlights, userId) {
    let count = 0;
    for (const highlightKey1 in highlights) {
      if (count === 0)
        for (const highlightKey2 in highlights) {
          if (highlightKey1 !== highlightKey2) {
            const highlight1 = highlights[highlightKey1];
            const highlight2 = highlights[highlightKey2];
            if (highlight1.string === highlight2.string) {
              if (highlight1.user_id === userId) delete highlights[highlightKey2];
              else if (highlight2.user_id === userId) delete highlights[highlightKey1];
              else delete highlights[highlightKey2];
              count++;
              break;
            }
          }
        }
    }
    if (count > 0) {
      return checkHighlightsForCopies(highlights, userId);
    } else {
      return highlights;
    }
  }
  // console.log('loadThisUrlsHighlights');
  chrome.storage.local.get(
    ['websites', 'mineAndOthersWebsites', 'highlightsViewMode', 'user_collection'],
    items => {
      // console.log('load highlights items', items);
      let websites;
      websites =
        items.highlightsViewMode === 'mineAndOthers' ? items.mineAndOthersWebsites : items.websites;
      if (!websites) {
        websites = {};
        let setData = {};
        if (items.highlightsViewMode === 'mine') setData = { mineAndOthersWebsites: websites };
        else setData = { websites: websites };
        chrome.storage.local.set(setData, () => {
          if (callback) callback();
          return null;
        });
      }
      // console.log('websites[url]', websites[url]);
      if (!isEmpty(websites[url])) {
        if (!isEmpty(websites[url].highlights)) {
          // console.log('checkHighlightsForCopies before', Object.keys(websites[url].highlights));
          const highlights =
            items.highlightsViewMode === 'mineAndOthers'
              ? checkHighlightsForCopies(websites[url].highlights, items.user_collection.user_id)
              : websites[url].highlights;
          // console.log('checkHighlightsForCopies after', Object.keys(highlights));
          console.log('loadThisUrlsHighlights - loading highlights', highlights);
          for (const key in highlights) {
            if (key === Object.keys(highlights)[Object.keys(highlights).length - 1]) {
              if (callback) loadHighlight(highlights[key], false, callback);
            } else loadHighlight(highlights[key]);
          }
        } else if (callback) callback();
      } else if (callback) callback();
    }
  );
};
const loadHighlight = function(highlightVal, noErrorTracking, callback) {
  // noErrorTracking is optional
  // console.log('load highlight called');
  // console.log('highlightVal', highlightVal);
  // console.log('anchor node', highlightVal.anchorNode);
  function elementFromQuery(storedQuery) {
    // console.log('stored query', storedQuery);
    const re = />textNode:nth-of-type\(([0-9]+)\)$/i;
    const items = re.exec(storedQuery);
    // console.log('stored querey regex items', items);
    // console.log('$(storedQuery)[0]', $(storedQuery)[0]);
    if (items) {
      // For text nodes, nth-of-type needs to be handled differently (not a valid CSS selector)
      const textNodeIndex = parseInt(items[1]);
      // console.log('textNodeIndex', textNodeIndex);
      const storedQuery2 = storedQuery.replace(re, '');
      // console.log('storedQuery, replaced', storedQuery2);
      // console.log('element', $(storedQuery2));
      const parent = $(storedQuery2)[0];
      // console.log('parent', parent);
      if (!parent) return undefined;
      return parent.childNodes[textNodeIndex];
    } else return $(storedQuery)[0];
  }
  const selection = {
    anchorNode: elementFromQuery(highlightVal.anchorNode),
    anchorOffset: highlightVal.anchorOffset,
    focusNode: elementFromQuery(highlightVal.focusNode),
    focusOffset: highlightVal.focusOffset,
  };
  // console.log(selection);
  const selectionString = highlightVal.string;
  const container = elementFromQuery(highlightVal.container);
  const color = highlightVal.color;
  if (!selection.anchorNode || !selection.focusNode || !container) {
    if (!noErrorTracking) {
      addHighlightError(highlightVal);
    }
    if (callback) callback();

    return false;
  } else {
    const success = highlight(
      selectionString,
      container,
      selection,
      color,
      highlightVal.highlight_id
    );
    if (!noErrorTracking && !success) {
      addHighlightError(highlightVal);
    }
    if (callback) callback();
    return success;
  }
};
const deleteAllPageHighlights = function(url) {
  chrome.storage.local.get({ websites: {} }, items => {
    const websites = items.websites;
    delete websites[url];
    chrome.storage.local.set({ websites });
  });
};
const deleteHighlight = function(url, id, thenDeleteCard = true) {
  console.log('deleteHighlight, url, id, thenDeleteCard', url, id, thenDeleteCard);
  chrome.storage.local.get(['websites', 'mineAndOthersWebsites', 'user_collection'], items => {
    if (!items.user_collection) {
      alert('please log in to IPFC');
      return null;
    }
    let websites = items.websites;
    let mineAndOthersWebsites = items.mineAndOthersWebsites;
    const userCollection = items.user_collection;
    if (!websites) websites = {};
    if (!mineAndOthersWebsites) mineAndOthersWebsites = {};
    if (!websites[url]) websites[url] = {};
    if (!mineAndOthersWebsites[url]) mineAndOthersWebsites[url] = {};
    if (!websites[url].deleted) websites[url].deleted = [];
    if (!mineAndOthersWebsites[url].deleted) mineAndOthersWebsites[url].deleted = [];
    if (!websites[url].deleted.includes(id)) websites[url].deleted.push(id);
    if (!mineAndOthersWebsites[url].deleted.includes(id))
      mineAndOthersWebsites[url].deleted.push(id);

    if (!isEmpty(websites[url].highlights)) {
      if (websites[url].highlights[id]) {
        if (websites[url].highlights[id].user_id === userCollection.user_id)
          delete websites[url].highlights[id];
      }
      // if highlights are empty, remove from highlights list
      if (Object.keys(websites[url].highlights).length === 0) {
        userCollection.highlight_urls.list.splice(
          userCollection.highlight_urls.list.indexOf(url),
          1
        );
        userCollection.highlight_urls.edited = new Date().getTime();
        chrome.storage.local.set({ user_collection: userCollection });
      }
      // console.log('delete websites[url] after', websites[url]);
      chrome.storage.local.set({ websites }, () => {
        if (thenDeleteCard) {
          if (!isEmpty(websites[url].cards)) {
            const cards = websites[url].cards;
            for (const card of cards) {
              if (card.highlight_id === id) {
                deleteCard(url, card, false);
                break;
              }
            }
          }
        }
        SendOutRefresh(url, true, 'deleteHighlight', false);
        chrome.runtime.sendMessage({
          refreshHighlights: true,
          refreshOrder: true,
          url: url,
          sender: 'deleteHighlight',
        });
      });
    } else if (thenDeleteCard) {
      if (!isEmpty(websites[url].cards)) {
        const cards = websites[url].cards;
        for (const card of cards) {
          if (card.highlight_id === id && card.userId === userCollection.user_id) {
            deleteCard(url, card, false);
            break;
          }
        }
      }
      SendOutRefresh(url, true, 'deleteHighlight', false);

      chrome.runtime.sendMessage({
        refreshHighlights: true,
        refreshOrder: true,
        url: url,
        sender: 'deleteHighlight',
      });
    }
  });
};
const deleteCard = function(url, card, thenDeleteHighlight = true) {
  chrome.storage.local.get(['websites', 'user_collection'], items => {
    console.log('delete card', url, card, items);
    if (!items.user_collection) {
      alert('please log in to IPFC');
      return null;
    }
    const websites = items.websites;
    if (websites && websites[url] && websites[url].cards) {
      if (!websites[url].deleted) websites[url].deleted = [];
      if (!websites[url].deleted.includes(card.card_id)) websites[url].deleted.push(card.card_id);
      // console.log('card deleted and added to .deleted', card.card_id, websites[url].deleted);
      for (const existingCard of websites[url].cards) {
        if (existingCard.card_id === card.card_id) {
          if (card.user_id === items.user_collection.user_id) {
            websites[url].cards.splice(websites[url].cards.indexOf(existingCard), 1);
            break;
          }
        }
      }
      chrome.storage.local.set(
        {
          websites,
        },
        () => {
          if (thenDeleteHighlight) deleteHighlight(url, card.highlight_id, false);
          else {
            SendOutRefresh(url, true, 'deleteCard', false);
            chrome.runtime.sendMessage({
              refreshHighlights: true,
              refreshOrder: true,
              url: url,
              sender: 'deleteCard',
            });
          }
        }
      );
    } else if (thenDeleteHighlight) deleteHighlight(url, card.highlight_id);
    else {
      SendOutRefresh(url, true, 'deleteCard', false);
      chrome.runtime.sendMessage({
        refreshHighlights: true,
        refreshOrder: true,
        url: url,
        sender: 'deleteCard',
      });
    }
  });
};

export {
  storeHighlightsOrder,
  storeHighlight,
  collectHighlight,
  deleteHighlight,
  storeCard,
  collectCardAndHighlight,
  deleteCard,
  postCard,
  putCard,
  deleteServerCard,
  postDeck,
  loadThisUrlsHighlights,
  loadHighlight,
  deleteAllPageHighlights,
  clearPageHighlights,
};
