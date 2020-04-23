import { isEmpty } from 'lodash';
import { addHighlightError } from './errorManager';
import { highlight } from './highlighter';
const axios = require('axios');
const $ = require('jquery');
const HIGHLIGHT_CLASS = 'highlighter--highlighted';

const clearPageHighlights = callback => {
  $('.' + HIGHLIGHT_CLASS).css('background-color', 'inherit');
  $('.' + HIGHLIGHT_CLASS).removeClass();
  if (callback) callback();
};

const getCardsInOrder = function(cards, order) {
  // console.log('cards, order', cards, order);
  const orderedCards = [];
  const orderlessCards = [];
  for (const highlightId of order) {
    for (const card of cards) {
      if (card.highlight_id === highlightId) {
        orderedCards.push(card);
        break;
      }
    }
  }
  for (const card of cards) {
    if (!order.includes(card.highlight_id)) {
      orderlessCards.push(card);
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
  // and creates mineAndOthers
  console.log('storeHighlightsOrder');
  chrome.storage.local.get(['websites', 'othersWebsites', 'highlightsViewMode'], items => {
    let websites;
    if (items.highlightsViewMode === 'mineAndOthers')
      websites = combineMineAndOthersWebsites(items.websites, items.othersWebsites);
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
      const sortedCards = getCardsInOrder(websites[url].cards, websites[url].order);
      websites[url].orderedCards = sortedCards.orderedCards;
      websites[url].orderlessCards = sortedCards.orderlessCards;
      if (items.highlightsViewMode !== 'mineAndOthers') {
        chrome.storage.local.set({ websites: websites }, () => {
          if (callback) callback();
        });
      }
    }
    if (items.highlightsViewMode === 'mineAndOthers') {
      console.log('setting mineAndOthersWebsites', websites[url]);
      chrome.storage.local.set({ mineAndOthersWebsites: websites }, () => {
        if (callback) callback();
      });
    }
  });
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
  chrome.storage.local.get(['websites', 'user_collection'], items => {
    let websites = items.websites;
    const userCollection = items.user_collection;
    if (!websites) websites = {};
    if (!websites[url]) {
      websites[url] = {};
    }
    if (!websites[url].highlights) {
      websites[url].highlights = {};
    }
    console.log('user_collection', userCollection);
    if (!userCollection.highlight_urls || !userCollection.highlight_urls.list) {
      userCollection.highlight_urls = {};
      userCollection.highlight_urls.list = [];
    }
    if (!items.user_collection.highlight_urls.list.includes(url)) {
      userCollection.highlight_urls.list.push(url);
      userCollection.highlight_urls.edited = new Date().getTime();
      console.log('user colleciton after adding highlight urls', userCollection);
      chrome.storage.local.set({
        user_collection: userCollection,
      });
    }
    websites[url].highlights[highlightId] = {
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
    // console.log('highlights[url]', highlights[url]);
    // console.log('thisURLsHighlights', thisURLsHighlights);
    chrome.storage.local.set(
      {
        websites: websites,
      },
      () => {
        if (callback) callback();
      }
    );
    // chrome.runtime.sendMessage({
    //   debouncedCloudSync: true,
    // });
  });
};
// can also be used to replace a card
const storeCard = function(card, callback) {
  // console.log('store card. card', card);
  const url = card.highlight_url;
  chrome.storage.local.get(['websites', 'user_collection'], items => {
    if (!items.user_collection) {
      alert('please log in to IPFC');
      return null;
    }
    let websites = items.websites;
    if (!websites) websites = {};
    if (!websites[url]) {
      websites[url] = {};
    }
    if (!websites[url].cards) {
      websites[url].cards = [];
    }
    for (const existingCard of websites[url].cards) {
      if (existingCard.card_id === card.card_id) {
        websites[url].cards.splice(websites[url].cards.indexOf(existingCard), 1);
        break;
      }
    }
    websites[url].cards.push(card);
    // console.log('card stored', highlights.cards);
    chrome.storage.local.set(
      {
        websites: websites,
      },
      () => {
        chrome.runtime.sendMessage({
          refreshHighlights: true,
          refreshOrder: true,
          url: url,
        });
        if (callback) callback();
      }
    );
  });
};
const postCard = async function(jwt, serverUrl, card, deckId) {
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
  console.log('putting card', options.data);
  await axios(options)
    .then(response => {
      result = response.data;
      console.log(' card updated, result: ', result);
      chrome.storage.local.get(['uploadFailedCardsPut'], items => {
        const uploadFailedCardsPut = items.uploadFailedCardsPut;
        const entry = { card: card, deck_id: deckId };
        if (!uploadFailedCardsPut.includes(entry))
          uploadFailedCardsPut.splice(uploadFailedCardsPut.indexOf(entry), 1);
        chrome.storage.local.set({ uploadFailedCardsPut: uploadFailedCardsPut });
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
  let result;
  await axios(options)
    .then(response => {
      result = response.data;
      console.log('deck posted, result: ', result);
      chrome.storage.local.get(['uploadFailedDecksPost'], items => {
        const uploadFailedDecksPost = items.uploadFailedDecksPost;
        const entry = { card: card, deck: deck };
        if (!uploadFailedDecksPost.includes(entry))
          uploadFailedDecksPost.splice(uploadFailedDecksPost.indexOf(entry), 1);
        chrome.storage.local.set({ uploadFailedDecksPost: uploadFailedDecksPost });
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
  // console.log('loadThisUrlsHighlights');
  chrome.storage.local.get(['websites', 'othersWebsites', 'highlightsViewMode'], function(items) {
    // console.log('load highlights items', items);
    let websites;
    if (items.highlightsViewMode === 'mineAndOthers')
      websites = combineMineAndOthersWebsites(items.websites, items.othersWebsites);
    else websites = items.websites;
    if (!websites && items.highlightsViewMode === 'mine') {
      websites = {};
      chrome.storage.local.set({ websites: websites }, () => {
        if (callback) callback();
        return null;
      });
    }
    console.log('websites[url]', websites[url]);
    if (!isEmpty(websites[url])) {
      if (!isEmpty(websites[url].highlights)) {
        const highlights = websites[url].highlights;
        console.log('loadThisUrlsHighlights - loading highlights', highlights);
        console.log(Object.keys(highlights));
        console.log(Object.keys(highlights)[Object.keys(highlights).length - 1]);
        for (const key in highlights) {
          if (key === Object.keys(highlights)[Object.keys(highlights).length - 1]) {
            if (callback) loadHighlight(highlights[key], false, callback);
          } else loadHighlight(highlights[key]);
        }
      } else if (callback) callback();
    } else if (callback) callback();
  });
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
  // if (syncing) {
  //   alert('syncing, please wait');
  //   return null;
  // }
  chrome.storage.local.get(['websites', 'user_collection'], items => {
    if (!items.user_collection) {
      alert('please log in to IPFC');
      return null;
    }
    const websites = items.websites;
    if (!websites) return null;
    if (!websites[url]) return null;
    if (!websites[url].highlights) return null;
    if (!websites[url].deleted) websites[url].deleted = [];
    websites[url].deleted.push(id);
    if (websites[url].highlights[id]) delete websites[url].highlights[id];
    // if highlights are empty, remove from highlights list
    if (Object.keys(websites[url].highlights).length === 0) {
      chrome.storage.local.get(['user_collection'], items => {
        const userCollection = items.user_collection;
        userCollection.highlight_urls.list.splice(
          userCollection.highlight_urls.list.indexOf(url),
          1
        );
        userCollection.highlight_urls.edited = new Date().getTime();
        chrome.storage.local.set({ user_collection: userCollection });
      });
    }
    console.log('delete websites[url] after', websites[url]);
    chrome.storage.local.set({ websites }, () => {
      // window.location.reload();
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
      chrome.runtime.sendMessage({ refreshHighlights: true, refreshOrder: true, url: url });
    });

    // chrome.runtime.sendMessage({ debouncedCloudSync: true });
    // refreshHighlights(url, true);
  });
};
const deleteCard = function(url, card, thenDeleteHighlight = true) {
  chrome.storage.local.get(['websites', 'user_collection'], items => {
    // if (syncing) {
    //   alert('syncing, please wait');
    //   return null;
    // }
    if (!items.user_collection) {
      alert('please log in to IPFC');
      return null;
    }
    const websites = items.websites;
    if (!websites) return null;
    if (!websites[url]) return null;
    if (!websites[url].highlights) return null;
    if (!websites[url].deleted) websites[url].deleted = [];
    websites[url].deleted.push(card.card_id);
    console.log('card deleted and added to .deleted', card.card_id, websites[url].deleted);
    for (const existingCard of websites[url].cards) {
      if (existingCard.card_id === card.card_id) {
        websites[url].cards.splice(websites[url].cards.indexOf(existingCard), 1);
        break;
      }
    }
    chrome.storage.local.set(
      {
        websites,
      },
      () => {
        if (thenDeleteHighlight) deleteHighlight(url, card.highlight_id);
        else {
          // window.location.reload();
          chrome.runtime.sendMessage({ refreshHighlights: true, refreshOrder: true, url: url });
        }
      }
    );
    // chrome.runtime.sendMessage({
    //   debouncedCloudSync: true,
    // });
  });
};
function combineMineAndOthersWebsites(websites, othersWebsites) {
  const combinedWebsites = {};
  if (isEmpty(websites) && isEmpty(othersWebsites)) return {};
  if (isEmpty(websites) && !isEmpty(othersWebsites)) return othersWebsites;
  if (!isEmpty(websites) && isEmpty(othersWebsites)) return websites;
  for (const url in websites) {
    const website = websites[url];
    if (!Object.keys(othersWebsites).includes(url)) combinedWebsites[url] = website;
    for (const oUrl in othersWebsites) {
      const oWebsite = othersWebsites[oUrl];
      if (!Object.keys(websites).includes(oUrl) && !Object.keys(combinedWebsites).includes(oUrl))
        combinedWebsites[oUrl] = oWebsite;
      else if (url === oUrl) {
        const combinedWebsite = {};
        combinedWebsite.deleted = [];
        if (!isEmpty(oWebsite.deleted) || !isEmpty(website.deleted)) {
          if (isEmpty(oWebsite.deleted)) combinedWebsite.deleted = oWebsite.deleted;
          else if (isEmpty(website.deleted)) combinedWebsite.deleted = website.deleted;
          else
            for (const entry of website.deleted)
              if (!combinedWebsite.deleted.includes(entry)) combinedWebsite.deleted.push(entry);
        }
        // console.log(oWebsite.cards, website.cards);
        if (!isEmpty(oWebsite.cards) || !isEmpty(website.cards)) {
          if (isEmpty(oWebsite.cards)) combinedWebsite.cards = website.cards;
          else if (isEmpty(website.cards)) combinedWebsite.cards = oWebsite.cards;
          else {
            combinedWebsite.cards = [];
            const combinedWebsiteCardIds = [];
            for (const card of website.cards) {
              if (!combinedWebsite.deleted.includes(card.card_id)) {
                combinedWebsite.cards.push(card);
                combinedWebsiteCardIds.push(card.card_id);
              }
            }
            for (const card of oWebsite.cards)
              if (
                !combinedWebsite.deleted.includes(card.card_id) &&
                !combinedWebsiteCardIds.includes(card.card_id)
              )
                combinedWebsite.cards.push(card);
          }
        }
        // console.log(oWebsite.highlights, website.highlights);
        if (!isEmpty(oWebsite.highlights) || !isEmpty(website.highlights)) {
          if (isEmpty(oWebsite.highlights)) combinedWebsite.highlights = website.highlights;
          else if (isEmpty(website.highlights)) combinedWebsite.highlights = oWebsite.highlights;
          else {
            combinedWebsite.highlights = {};
            const combinedHighlightIds = [];
            if (!isEmpty(website.highlights))
              for (const highlight in website.highlights)
                if (!combinedWebsite.deleted.includes(highlight)) {
                  combinedWebsite.highlights[highlight] = website.highlights[highlight];
                  combinedHighlightIds.push(highlight);
                }
            if (!isEmpty(oWebsite.highlights))
              for (const highlight in oWebsite.highlights)
                if (
                  !combinedWebsite.deleted.includes(highlight) &&
                  !combinedHighlightIds.includes(highlight)
                )
                  combinedWebsite.highlights[highlight] = oWebsite.highlights[highlight];
          }
        }
        if (!isEmpty(website.order)) combinedWebsite.order = website.order;
        if (!isEmpty(website.orderedCards)) combinedWebsite.order = website.orderedCards;
        if (!isEmpty(website.orderlessCards)) combinedWebsite.order = website.orderlessCards;
        combinedWebsites[oUrl] = combinedWebsite;
      }
    }
  }
  // console.log('combined websites', combinedWebsites);
  return combinedWebsites;
}

export {
  storeHighlightsOrder,
  storeHighlight,
  deleteHighlight,
  storeCard,
  deleteCard,
  postCard,
  putCard,
  postDeck,
  loadThisUrlsHighlights,
  loadHighlight,
  deleteAllPageHighlights,
  clearPageHighlights,
};
