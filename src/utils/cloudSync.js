import { isEqual } from 'lodash/core';
import { isEmpty } from 'lodash';
import { sendMesageToAllTabs } from '../background';
import { putCard, postCard, postDeck } from '../highlighter/storageManager';
const axios = require('axios');

const syncStatus = {
  syncing: false,
  syncFailed: false,
  syncingBlockedBySyncing: false,
};

const cloudSync = async function(skipEqualityCheck) {
  console.log('    asyncCloudSync called, syncing status', syncStatus.syncing, timestamp());
  if (syncStatus.syncing) {
    console.log('    syncing blocked by concurrent sync', timestamp());
    syncStatus.syncingBlockedBySyncing = true;
    return null;
  } else syncStatus.syncingBlockedBySyncing = false;
  syncStatus.syncing = true;
  sendOutMessage({ syncing: true, value: true });
  try {
    let serverUrl;
    chrome.storage.sync.get(['serverUrl'], items => {
      serverUrl = items.serverUrl;
    });
    const storage = await getStorage();
    // console.log('    getStorage results', storage);
    const jwt = storage.jwt;
    const lastSyncsUserCollection = storage.lastSyncsUserCollection;
    const lastSyncsWebsites = storage.lastSyncsWebsites;
    let localUserCollection = storage.localUserCollection;
    let localWebsites = storage.localWebsites;
    if (isEmpty(localUserCollection)) localUserCollection = {};
    const initialUserCollection = JSON.parse(JSON.stringify(localUserCollection));
    if (isEmpty(localWebsites)) localWebsites = {};
    const initialWebsites = JSON.parse(JSON.stringify(localWebsites));
    const uploadFailedCardsPut = storage.uploadFailedCardsPut;
    const uploadFailedCardsPost = storage.uploadFailedCardsPost;
    const uploadFailedDecksPost = storage.uploadFailedDecksPost;

    await uploadFailedItems(
      jwt,
      serverUrl,
      uploadFailedDecksPost,
      uploadFailedCardsPut,
      uploadFailedCardsPost
    );

    if (!skipEqualityCheck) {
      const equal = await checkEquality(
        lastSyncsWebsites,
        lastSyncsUserCollection,
        localWebsites,
        localUserCollection
      );
      if (equal) {
        syncStatus.syncing = false;
        sendOutMessage({ syncing: true, value: false });
        sendOutMessage({ syncNotUpToDate: true, value: false });
        return null;
      }
    }

    const serverCollection = await getMetaData(jwt, serverUrl);
    // console.log('    serverCollection', serverCollection);

    localUserCollection = await syncHighlightUrls(
      jwt,
      serverUrl,
      localWebsites,
      localUserCollection,
      serverCollection,
      initialUserCollection
    );

    localUserCollection = await syncUserCollection(
      jwt,
      serverUrl,
      localUserCollection,
      serverCollection,
      initialUserCollection
    );

    const serverWebsites = await getWebsitesMeta(jwt, serverUrl);

    const comparison = await compareLocalAndServerWebsites(
      localWebsites,
      serverWebsites,
      localUserCollection.user_id
    );
    const localNewer = comparison.localNewer;
    const serverNewer = comparison.serverNewer;
    localWebsites = comparison.localWebsites;

    localWebsites = await removeDeletedFromLocal(localWebsites);

    const getWebsitesSelectedContentResults = await getNewerFromServer(jwt, serverUrl, serverNewer);

    const saved = await saveNewerToLocal(
      getWebsitesSelectedContentResults,
      localWebsites,
      localUserCollection,
      initialWebsites
    );
    if (!saved) {
      console.log('    collection changed while syncing, abort and restart sync', timestamp());
      syncStatus.syncing = false;
      cloudSync(true);
      return null;
    }

    await uploadNewerToServer(jwt, serverUrl, localNewer);
    console.log(
      '    sync complete, was syncingBlockedBySyncing?',
      syncStatus.syncingBlockedBySyncing,
      timestamp()
    );
    if (syncStatus.syncingBlockedBySyncing) {
      syncStatus.syncing = false;
      cloudSync();
      return null;
    } else {
      // success!
      syncStatus.syncing = false;
      sendOutMessage({ syncing: true, value: false });
      sendOutMessage({ syncNotUpToDate: true, value: false });
    }
  } catch (error) {
    console.log('    sync error', error, timestamp());
    syncStatus.syncing = false;
    sendOutMessage({ syncing: true, value: false });
    sendOutMessage({ syncNotUpToDate: true, value: true });
    return null;
  }
};
function sendOutMessage(msg) {
  // because the popup also needs to hear the message, so sendMessageToAllTabs won't reach it
  sendMesageToAllTabs(msg);
  chrome.runtime.sendMessage(msg);
}
function timestamp() {
  const now = new Date();
  return `${now.getMinutes()}:${now.getSeconds()}:${now.getMilliseconds()}`;
}
// during sync, should we send to the highlighter delete the cards, or just do it in the sync function?
// function sendOutDeleteCard(cardId, url) {
//   chrome.storage.local.get(['websites'], function(items) {
//     const websites = items.websites;
//     let card;
//     for (const cardToCheck of websites[url].cards) {
//       if (cardToCheck.card_id === cardId) card = cardToCheck;
//       break;
//     }
//     sendMesageToAllTabs({
//       deleteCard: true,
//       card: card,
//       url: url,
//     });
//   });
// }

async function callAPI(data) {
  let result = null;
  const options = {
    url: data.url,
    headers: {
      'content-type': 'application/json',
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
      console.log(result);
    })
    .catch(function(err) {
      console.log(err, timestamp());
      sendOutMessage({ syncing: true, value: false });
      sendOutMessage({ syncNotUpToDate: true, value: true });
      throw new Error(err);
    });
  return result;
}
function getStorage() {
  // using chrome.storage inside an async, wrap it in a promise (remember to add 'new' before promise!)
  // https://stackoverflow.com/questions/59440008/how-to-wait-for-asynchronous-chrome-storage-local-get-to-finish-before-continu
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      [
        'user_collection',
        'lastSyncsUserCollection',
        'lastSyncsWebsites',
        'websites',
        'decks_meta',
        'jwt',
        'uploadFailedCards',
        'uploadFailedDecks',
      ],
      function(items) {
        // console.log('    items', items);
        const returnData = {};
        returnData.jwt = items.jwt;
        isEmpty(items.websites)
          ? (returnData.localWebsites = {})
          : (returnData.localWebsites = items.websites);

        returnData.localUserCollection = items.user_collection;
        // because of strange firefox bug where user_collection wasn't getting set properly
        if (isEmpty(items.user_collection) && !isEmpty(items.lastSyncsUserCollection))
          returnData.localUserCollection = items.lastSyncsUserCollection;
        returnData.lastSyncsUserCollection = items.lastSyncsUserCollection;
        returnData.lastSyncsWebsites = items.lastSyncsWebsites;
        returnData.uploadFailedCards = items.uploadFailedCards;
        returnData.uploadFailedDecks = items.uploadFailedDecks;
        if (items.jwt !== undefined) {
          resolve(returnData);
        } else {
          reject(new Error('Unable to retrieve local storage'));
        }
      }
    );
  });
}
async function checkEquality(
  lastSyncsWebsites,
  lastSyncsUserCollection,
  localWebsites,
  localUserCollection
) {
  if (lastSyncsWebsites && lastSyncsUserCollection) {
    // console.log('    lastSyncsWebsites, localWebsites', lastSyncsWebsites, localWebsites);
    // console.log(
    //   'lastSyncsUserCollection.highlight_urls, localUserCollection.highlight_urls',
    //   lastSyncsUserCollection.highlight_urls,
    //   localUserCollection.highlight_urls
    // );
    if (
      isEqual(lastSyncsWebsites, localWebsites) &&
      isEqual(lastSyncsUserCollection.highlight_urls, localUserCollection.highlight_urls)
    ) {
      console.log('    last sync equal', timestamp());
      return true;
    }
  }
  console.log('    last sync unequal', timestamp());
  return false;
}
async function uploadFailedItems(
  jwt,
  serverUrl,
  uploadFailedDecksPost,
  uploadFailedCardsPut,
  uploadFailedCardsPost
) {
  if (!isEmpty(uploadFailedDecksPost)) {
    for (const entry of uploadFailedCardsPost) {
      postDeck(jwt, serverUrl, entry.card, entry.deck);
    }
  }
  if (!isEmpty(uploadFailedCardsPut)) {
    for (const entry of uploadFailedCardsPost) {
      putCard(jwt, serverUrl, entry.card, entry.deck_id);
    }
  }
  if (!isEmpty(uploadFailedCardsPost)) {
    for (const entry of uploadFailedCardsPost) {
      postCard(jwt, serverUrl, entry.card, entry.deck_id);
    }
  }
}
async function getMetaData(jwt, serverUrl) {
  const getMetaDataCall = {
    url: serverUrl + '/get_decks_meta_and_collection',
    jwt: jwt,
    method: 'GET',
  };
  let metaDataCallResults = null;
  await callAPI(getMetaDataCall).then(data => {
    metaDataCallResults = data;
  });
  console.log('        Get Meta and Collection results ', metaDataCallResults);
  if (!metaDataCallResults) {
    throw new Error('error in get_decks_meta_and_collection');
  }
  chrome.storage.local.set({ decks_meta: metaDataCallResults.decks_meta });
  return metaDataCallResults.user_collection;
}
async function syncHighlightUrls(
  jwt,
  serverUrl,
  localWebsites,
  localUserCollection,
  serverCollection,
  initialUserCollection
) {
  // console.log(
  //   'sync highlight urls',
  //   jwt,
  //   serverUrl,
  //   localWebsites,
  //   localUserCollection,
  //   serverCollection,
  //   initialUserCollection
  // );
  // sync highlight_urls // This still isn't perfect, what if local or server added urls but didnt sync
  let postHighlightUrls = false;
  // make sure localHighlights_Urls is accurate
  const lHighlightUrls = localUserCollection.highlight_urls;
  const sHighlightUrls = serverCollection.highlight_urls;
  let highlightUrlsHighlightUrlsListCheck = localUserCollection.highlight_urls.list;
  if (isEmpty(localWebsites)) highlightUrlsHighlightUrlsListCheck = [];
  else {
    highlightUrlsHighlightUrlsListCheck = [];
    for (const url in localWebsites) {
      let hasHighlights;
      let hasCards;
      let hasDeleted;
      if (!isEmpty(localWebsites[url].highlights)) hasHighlights = true;
      if (!isEmpty(localWebsites[url].cards)) hasCards = true;
      if (!isEmpty(localWebsites[url].deleted)) hasDeleted = true;
      if (hasHighlights || hasCards || hasDeleted) highlightUrlsHighlightUrlsListCheck.push(url);
    }
  }

  if (!isEqual(highlightUrlsHighlightUrlsListCheck, lHighlightUrls.list)) {
    localUserCollection.highlight_urls.list = highlightUrlsHighlightUrlsListCheck;
    lHighlightUrls.list = highlightUrlsHighlightUrlsListCheck;
  }
  if (!sHighlightUrls || sHighlightUrls.list.length === 0) {
    if (lHighlightUrls.list.length > 0) postHighlightUrls = true;
  } else {
    // console.log('sHighlightUrls, lHighlightUrls', sHighlightUrls, lHighlightUrls);
    if (!isEqual(sHighlightUrls, lHighlightUrls)) {
      if (
        sHighlightUrls.edited > lHighlightUrls.edited ||
        (sHighlightUrls.edited === lHighlightUrls.edited &&
          sHighlightUrls.list.length > lHighlightUrls.list.length)
      ) {
        chrome.storage.local.get(['user_collection'], function(items) {
          if (
            !isEqual(initialUserCollection.highlight_urls, items.user_collection.highlight_urls)
          ) {
            console.log(
              '    collection changed while syncing, abort and restart sync',
              timestamp()
            );
            syncStatus.syncing = false;
            cloudSync(true);
            return null;
          } else {
            localUserCollection.highlight_urls = serverCollection.highlight_urls;
            chrome.storage.local.set({
              user_collection: localUserCollection,
            });
          }
        });
      } else {
        postHighlightUrls = true;
      }
    }
  }
  // console.log('    postHighlightUrls', postHighlightUrls);
  // console.log('    localUserCollection.highlight_urls', localUserCollection.highlight_urls);
  if (postHighlightUrls) {
    // console.log('    posting highlight_urls', localUserCollection.highlight_urls);
    const putSettingsData = {
      url: serverUrl + '/put_user_collection',
      jwt: jwt,
      method: 'PUT',
      data: {
        highlight_urls: localUserCollection.highlight_urls,
      },
    };
    let putSettingsResult = null;
    await callAPI(putSettingsData).then(data => {
      putSettingsResult = data;
    });
    console.log('       Put highlight_urls changes', putSettingsResult, timestamp());
    if (!putSettingsResult) {
      throw new Error('error in highlight_urls');
    }
  }
  return localUserCollection;
}
async function syncUserCollection(
  jwt,
  serverUrl,
  localUserCollection,
  serverCollection,
  initialUserCollection
) {
  // sync settings, schedule, all_card_tags, //later extension settings. any one with 'edited'
  for (const section in localUserCollection) {
    if (section === 'webapp_settings' || section === 'schedule' || section === 'all_card_tags') {
      if (isEmpty(serverCollection[section]))
        serverCollection[section] = {
          edited: 0,
        };
      if (isEmpty(localUserCollection[section]))
        localUserCollection[section] = {
          edited: 0,
        };
      if (!isEqual(serverCollection[section], localUserCollection[section])) {
        console.log(
          'serverCollection[section], userCollection[section]',
          serverCollection[section],
          localUserCollection[section]
        );
        if (serverCollection[section].edited > localUserCollection[section].edited) {
          chrome.storage.local.get(['user_collection'], function(items) {
            if (
              !isEqual(initialUserCollection[section], items.user_collection[section]) ||
              !isEqual(initialUserCollection[section], items.user_collection[section])
            ) {
              console.log(
                '    collection changed while syncing, abort and restart sync',
                timestamp()
              );
              syncStatus.syncing = false;
              cloudSync(true);
              return null;
            } else {
              localUserCollection.highlight_urls = serverCollection.highlight_urls;
              chrome.storage.local.set({
                user_collection: localUserCollection,
              });
            }
          });
          localUserCollection[section] = serverCollection[section];
        } else if (serverCollection[section].edited < localUserCollection[section].edited) {
          console.log('putting section: ', section);
          const putSectionData = {
            url: serverUrl + '/put_user_collection',
            jwt: jwt,
            method: 'PUT',
            data: {
              [section]: localUserCollection[section],
            },
          };
          let putSectionResult = null;
          await callAPI(putSectionData).then(data => {
            putSectionResult = data;
          });
          console.log('    PUT section results', putSectionResult);
        }
      }
    }
  }
  return localUserCollection;
}
async function getWebsitesMeta(jwt, serverUrl) {
  const getWebsitesMetaCall = {
    url: serverUrl + '/get_websites_meta',
    jwt: jwt,
    method: 'GET',
  };
  let websitesMetaResults = null;
  await callAPI(getWebsitesMetaCall).then(data => {
    websitesMetaResults = data;
  });
  console.log('        websitesMetaResults ', websitesMetaResults, timestamp());
  if (!websitesMetaResults) {
    throw new Error('error in get_websites_selected_content');
  }
  return websitesMetaResults.websites_meta;
}
async function compareLocalAndServerWebsites(localWebsites, serverWebsites, userId) {
  let localNewer = {};
  let serverNewer = {};
  console.log(
    '    compareLocalAndServerWebsites: localWebsites, serverWebsites',
    localWebsites,
    serverWebsites,
    timestamp()
  );
  // for cards, highlighted, and deleted, check if it only exists in one, if entry exists in both, compare edited date
  if (isEmpty(serverWebsites)) localNewer = localWebsites;
  else {
    if (isEmpty(localWebsites)) serverNewer = serverWebsites;
    else {
      for (const url in serverWebsites) {
        localNewer[url] = {
          cards: [],
          highlights: {},
          deleted: [],
        };
        serverNewer[url] = {
          cards: [],
          highlights: {},
          deleted: [],
        };
        if (!Object.keys(localWebsites).includes(url)) serverNewer[url] = serverWebsites[url];
        for (const lUrl in localWebsites) {
          if (
            !Object.keys(serverWebsites).includes(lUrl) &&
            !Object.keys(localNewer).includes(lUrl)
          )
            localNewer[lUrl] = localWebsites[lUrl];
          else {
            if (!Object.keys(localNewer).includes(lUrl))
              localNewer[lUrl] = {
                cards: [],
                highlights: {},
                deleted: [],
              };
            if (!Object.keys(serverNewer).includes(lUrl))
              serverNewer[lUrl] = {
                cards: [],
                highlights: {},
                deleted: [],
              };
            else if (url === lUrl) {
              const serverWebsite = serverWebsites[url];
              const localWebsite = localWebsites[url];
              // compare cards
              const serverCards = [];
              const localCards = [];
              if (!isEmpty(serverWebsite.cards)) {
                for (const sCard of serverWebsite.cards) {
                  serverCards.push(sCard.card_id);
                }
              }
              if (!isEmpty(localWebsite.cards)) {
                for (const lCard of localWebsite.cards) {
                  localCards.push(lCard.card_id);
                  // if same exists, compare edited
                  if (serverCards.includes(lCard.card_id)) {
                    for (const sCard of serverWebsite.cards) {
                      if (sCard.card_id === lCard.card_id) {
                        if (sCard.edited > lCard.edited) {
                          serverNewer[url].cards.push(sCard);
                        } else if (sCard.edited < lCard.edited) {
                          localNewer[url].cards.push(sCard);
                        }
                      }
                    }
                  } else {
                    // if doesn't exist, add directly
                    localNewer[url].cards.push(lCard);
                  }
                }
              }
              if (serverCards.length > 0) {
                for (const sCard of serverWebsite.cards) {
                  if (!localCards.includes(sCard.card_id)) {
                    serverNewer[lUrl].cards.push(sCard);
                  }
                }
              }
              // compare highlights
              const lHighlights = localWebsite.highlights;
              const sHighlights = serverWebsite.highlights;
              if (isEmpty(sHighlights) && !isEmpty(lHighlights))
                localNewer[url].highlights = lHighlights;
              else if (isEmpty(lHighlights) && !isEmpty(sHighlights))
                serverNewer[url].highlights = sHighlights;
              else if (!isEmpty(lHighlights) && !isEmpty(sHighlights)) {
                for (const highlight in sHighlights) {
                  if (!Object.keys(lHighlights).includes(highlight))
                    serverNewer[url].highlights[highlight] = sHighlights[highlight];
                  for (const lHighlight in lHighlights) {
                    if (!Object.keys(sHighlights).includes(lHighlight))
                      localNewer[url].highlights[lHighlight] = lHighlights[lHighlight];
                    else if (lHighlight === highlight) {
                      if (lHighlights[highlight].edited > sHighlights[highlight].edited)
                        localNewer[url].highlights[highlight] = lHighlights[highlight];
                      else if (lHighlights[highlight].edited < sHighlights[highlight].edited)
                        serverNewer[url].highlights[highlight] = sHighlights[highlight];
                    }
                  }
                }
              }
              // compare deleted
              if (isEmpty(serverWebsite.deleted) && !isEmpty(localWebsite.deleted))
                localNewer[url].deleted = localWebsite.deleted;
              else if (isEmpty(localWebsite.deleted) && !isEmpty(serverWebsite.deleted))
                serverNewer[url].deleted = serverWebsite.deleted;
              else if (!isEmpty(serverWebsite.deleted) && !isEmpty(localWebsite.deleted)) {
                const mergedDeleted = serverWebsite.deleted.concat(
                  localWebsite.deleted.filter(entry => !serverWebsite.deleted.includes(entry))
                );
                // console.log(
                //   'mergedDeleted, serverWebsite.deleted, localWebsite.deleted',
                //   mergedDeleted,
                //   serverWebsite.deleted,
                //   localWebsite.deleted,
                //   timestamp()
                // );
                if (!isEqual(mergedDeleted, serverWebsite.deleted))
                  localNewer[url].deleted = localWebsite.deleted;
                if (!isEqual(mergedDeleted, localWebsite.deleted)) {
                  serverNewer[url].deleted = serverWebsite.deleted;
                  // this insures localWebsites is up to date for the next part
                  localWebsites[url].deleted = mergedDeleted;
                }
              }
            }
          }
        }
      }
    }
  }

  function purgeEmptyAndDeleted(localNewer, serverNewer) {
    const purgedLocalNewer = {};
    // console.log('    localNewer, serverNewer', localNewer, serverNewer, timestamp());
    // filter out deleted cards/highlights, others cards/highlights and empty sections here
    for (const url in localNewer) {
      let deleted = [];
      // based on previous steps, this should already be the up to date merged deleted list
      if (localWebsites[url]) {
        if (localWebsites[url].deleted) deleted = localWebsites[url].deleted;
      }
      let hasCards = false;
      let hasHighlights = false;
      let hasDeleted = false;
      if (!isEmpty(localNewer[url].cards)) hasCards = true;
      if (!isEmpty(localNewer[url].highlights)) hasHighlights = true;
      if (!isEmpty(localNewer[url].deleted)) hasDeleted = true;
      if (hasCards || hasHighlights || hasDeleted) {
        purgedLocalNewer[url] = {};
        if (hasCards)
          for (const card of localNewer[url].cards)
            if (!deleted.includes(card.card_id) && card.user_id === userId) {
              if (!purgedLocalNewer[url].cards) purgedLocalNewer[url].cards = [];
              purgedLocalNewer[url].cards.push(card);
            }
        if (hasHighlights)
          for (const highlight in localNewer[url].highlights)
            if (
              !deleted.includes(highlight) &&
              localNewer[url].highlights[highlight].user_id === userId
            ) {
              if (!purgedLocalNewer[url].highlights) purgedLocalNewer[url].highlights = {};
              purgedLocalNewer[url].highlights[highlight] = localNewer[url].highlights[highlight];
            }
        if (hasDeleted) purgedLocalNewer[url].deleted = localNewer[url].deleted;
      }
    }
    const purgedServerNewer = {};
    for (const url in serverNewer) {
      let deleted = [];
      if (localWebsites[url]) {
        if (localWebsites[url].deleted) deleted = localWebsites[url].deleted;
      }
      let hasCards = false;
      let hasHighlights = false;
      let hasDeleted = false;
      if (!isEmpty(serverNewer[url].cards)) hasCards = true;
      if (!isEmpty(serverNewer[url].highlights)) hasHighlights = true;
      if (!isEmpty(serverNewer[url].deleted)) hasDeleted = true;
      if (hasCards || hasHighlights || hasDeleted) {
        purgedServerNewer[url] = {};
        if (hasCards)
          for (const card of serverNewer[url].cards)
            if (!deleted.includes(card.card_id) && card.user_id === userId) {
              if (!purgedServerNewer[url].cards) purgedServerNewer[url].cards = [];
              purgedServerNewer[url].cards.push(card);
            }
        if (hasHighlights)
          for (const highlight in serverNewer[url].highlights)
            if (
              !deleted.includes(highlight) &&
              serverNewer[url].highlights[highlight].user_id === userId
            ) {
              if (!purgedServerNewer[url].highlights) purgedServerNewer[url].highlights = {};
              purgedServerNewer[url].highlights[highlight] = serverNewer[url].highlights[highlight];
            }
        if (hasDeleted) purgedServerNewer[url].deleted = serverNewer[url].deleted;
      }
    }
    console.log(
      '    purgedLocalNewer, purgedServerNewer',
      purgedLocalNewer,
      purgedServerNewer,
      timestamp()
    );
    return {
      localNewer: purgedLocalNewer,
      serverNewer: purgedServerNewer,
    };
  }
  const purged = purgeEmptyAndDeleted(localNewer, serverNewer);
  return {
    localNewer: purged.localNewer,
    serverNewer: purged.serverNewer,
    localWebsites: localWebsites,
  };
}
async function removeDeletedFromLocal(localWebsites) {
  // delete local cards and highlights from local
  // console.log('    localWebsites before deletions', localWebsites);
  if (!isEmpty(localWebsites)) {
    for (const url in localWebsites) {
      const website = JSON.parse(JSON.stringify(localWebsites[url]));
      if (website.deleted) {
        if (website.cards) {
          const purgedCards = [];
          for (const card of website.cards) {
            if (!website.deleted.includes(card.card_id)) purgedCards.push(card);
          }
          if (purgedCards.length !== website.cards.length) website.cards = purgedCards;
        }
        if (website.highlights) {
          const purgedHighlights = {};
          for (const highlight in website.highlights) {
            if (!website.deleted.includes(highlight))
              purgedHighlights[highlight] = website.highlights[highlight];
          }
          if (Object.keys(website.highlights).length !== Object.keys(purgedHighlights).length)
            website.highlights = purgedHighlights;
        }
        localWebsites[url] = website;
      }
    }
  }
  // console.log('    localWebsites after deletions', localWebsites);
  return localWebsites;
}
async function getNewerFromServer(jwt, serverUrl, serverNewer) {
  // get highlights/cards
  let getWebsitesSelectedContentResults = null;
  if (!isEmpty(serverNewer)) {
    const getWebsitesSelectedContentCall = {
      url: serverUrl + '/get_websites_selected_content',
      jwt: jwt,
      method: 'POST',
      data: serverNewer,
    };
    await callAPI(getWebsitesSelectedContentCall).then(data => {
      getWebsitesSelectedContentResults = data;
    });
    console.log(
      '    get Websites Selected Content Results ',
      getWebsitesSelectedContentResults,
      timestamp()
    );
    if (!getWebsitesSelectedContentResults) {
      throw new Error('error in get_websites_selected_content');
    }
    return getWebsitesSelectedContentResults;
  }
}
async function saveNewerToLocal(
  getWebsitesSelectedContentResults,
  localWebsites,
  localUserCollection,
  initialWebsites
) {
  // add new items to local
  if (!isEmpty(getWebsitesSelectedContentResults)) {
    if (!isEmpty(getWebsitesSelectedContentResults.websites)) {
      const newWebsites = getWebsitesSelectedContentResults.websites;
      if (isEmpty(localWebsites)) localWebsites = newWebsites;
      else {
        for (const url in newWebsites) {
          const nWebsite = newWebsites[url];
          if (!Object.keys(localWebsites).includes(url)) localWebsites[url] = nWebsite;
          else {
            for (const lUrl in localWebsites) {
              if (url === lUrl) {
                const lWebsite = localWebsites[url];
                if (!isEmpty(nWebsite.cards)) {
                  if (!lWebsite.cards) lWebsite.cards = [];
                  for (const card of nWebsite.cards) lWebsite.cards.push(card);
                }
                if (!isEmpty(nWebsite.highlights)) {
                  if (!lWebsite.highlights) lWebsite.highlights = {};
                  for (const highlight in nWebsite.highlights) {
                    lWebsite.highlights[highlight] = nWebsite.highlights[highlight];
                  }
                }
                if (!isEmpty(nWebsite.deleted)) {
                  if (!lWebsite.deleted) lWebsite.deleted = [];
                  for (const entry of nWebsite.deleted) lWebsite.deleted.push(entry);
                }
                // unnecesary? not sure if getting changed without this and the JSON.parse
                localWebsites[url] = lWebsite;
              }
            }
          }
        }
      }
    }
  }
  function getStorageWebsites() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['websites'], items => {
        let websites;
        isEmpty(items.websites) ? (websites = {}) : (websites = items.websites);
        if (websites !== undefined) {
          resolve(websites);
        } else {
          reject(new Error('Unable to retrieve local storage'));
        }
      });
    });
  }
  function setStorage(items) {
    return new Promise(resolve => {
      console.log('    saving to local, localWebsites', localWebsites, timestamp());
      chrome.storage.local.set(items, () => {
        resolve(true);
      });
    });
  }

  const currentWebsites = await getStorageWebsites();
  // bug =deleted is not in local websites.....
  // save to local
  if (!isEqual(initialWebsites, currentWebsites)) {
    for (const iWebsite in initialWebsites) {
      if (!Object.keys(currentWebsites).includes(iWebsite)) console.log(iWebsite);
      for (const cWebsite in currentWebsites) {
        if (!Object.keys(initialWebsites).includes(cWebsite)) console.log(cWebsite);
        if (iWebsite === cWebsite) {
          if (!isEqual(initialWebsites[iWebsite], currentWebsites[cWebsite])) {
            for (const iItem in initialWebsites[iWebsite]) {
              if (!Object.keys(cWebsite).includes(iItem))
                console.log('cWebsite not included', initialWebsites[iWebsite][iItem]);
              for (const cItem in currentWebsites[cWebsite]) {
                if (!Object.keys(iWebsite).includes(cItem))
                  console.log('iWebsite not included', currentWebsites[cWebsite][cItem]);
                if (iItem === cItem) {
                  if (!isEqual(iItem, cItem))
                    console.log(
                      'difference here',
                      currentWebsites[cWebsite][cItem],
                      initialWebsites[iWebsite][iItem]
                    );
                }
              }
            }
          }
        }
      }
    }
    return false;
  } else {
    if (isEmpty(localWebsites)) localWebsites = {};
    const items = {
      websites: localWebsites,
      lastSyncsWebsites: localWebsites,
      lastSyncsUserCollection: localUserCollection,
    };
    return setStorage(items);
  }
}
async function uploadNewerToServer(jwt, serverUrl, localNewer) {
  // post to server
  if (!isEmpty(localNewer)) {
    console.log('    posting websites, localNewer', localNewer, timestamp());
    const postWebsitesCall = {
      url: serverUrl + '/post_websites',
      jwt: jwt,
      method: 'POST',
      data: {
        websites: localNewer,
      },
    };
    let postWebsitesResult = null;
    await callAPI(postWebsitesCall).then(data => {
      postWebsitesResult = data;
    });
    console.log('          postWebsites Result', postWebsitesResult, timestamp());
    if (!postWebsitesResult) {
      throw new Error('error posting websites');
    }
  }
}

export { cloudSync, syncStatus };
