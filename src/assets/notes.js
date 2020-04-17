// old parts of the cloudsync

// sync highlights
// build highlights metas, only adding basic skeleton info from all highlights
const highlightsMeta = {};
// console.log('localHighlights', localHighlights);
for (const url in localHighlights) {
  let hasCards = false;
  let hasHighlights = false;
  for (const highlightKey in localHighlights[url]) {
    if (highlightKey === 'cards') {
      if (localHighlights[url].cards.length > 0) {
        hasCards = true;
        break;
      }
    }
    if (highlightKey.startsWith('h-id-')) {
      hasHighlights = true;
      break;
    }
  }
  if (hasCards || hasHighlights) {
    highlightsMeta[url] = {};
    for (const highlightKey in localHighlights[url]) {
      if (highlightKey.startsWith('h-id-')) {
        if (localHighlights[url][highlightKey].user_id === localUserCollection.user_id) {
          // console.log('localHighlights[url][highlightKey]', localHighlights[url][highlightKey]);
          // console.log('highlightsMeta', highlightsMeta);
          highlightsMeta[url][highlightKey] = localHighlights[url][highlightKey].edited;
        }
      }
      if (highlightKey === 'cards') {
        highlightsMeta[url].cards = [];
        for (const card in localHighlights[url].cards) {
          const cardMeta = {
            card_id: [card].card_id,
            edited: [card].edited,
          };
          highlightsMeta[url].cards.push(cardMeta);
        }
      }
      if (highlightKey === 'deleted') {
        highlightsMeta[url].deleted = localHighlights[url][highlightKey];
      }
    }
  }
}

// send server the highlightsMetas. Server will compare and send back the one's it has that are newer
console.log('posting compare_highlights_and_cards', highlightsMeta);
const compareHighlightsMetaData = {
  url: serverURL + '/compare_highlights_and_cards',
  jwt: jwt,
  method: 'POST',
  data: {
    highlights_meta: highlightsMeta,
  },
};
let compareHighlightsMetaResult = null;
await callAPI(compareHighlightsMetaData).then(data => {
  compareHighlightsMetaResult = data;
});
console.log('      compareHighlightsMeta result', compareHighlightsMetaResult);
if (!compareHighlightsMetaResult) {
  syncing = false;
  syncFailed = true;
  return null;
}
const serverNewer = compareHighlightsMetaResult.server_newer;
if (Object.keys(serverNewer).length > 0) {
  for (const url in serverNewer) {
    if (!localHighlights[url]) localHighlights[url] = serverNewer[url];
    else {
      for (const urlLocal in localHighlights) {
        if (url === urlLocal) {
          for (const highlight in serverNewer[url]) {
            if (highlight === 'deleted') {
              // for new deleted from server, we need to delete locally and update deleted list
              if (!localHighlights[url].deleted) localHighlights[url].deleted = [];
              for (const item of serverNewer[url].deleted) {
                localHighlights[url].deleted.push(item);
                if (item.card_id) {
                  sendOutDeleteCard(item.card_id, url);
                } else if (item.highlight_id) {
                  sendMesageToAllTabs({
                    deleteHighlight: true,
                    id: item.highlight_id,
                    url: url,
                  });
                }
              }
            } else if (highlight.startsWith('h-id-')) {
              if (localHighlights[url][highlight].edited < serverNewer[url][highlight])
                localHighlights[url][highlight] = serverNewer[url][highlight];
            } else if (highlight === 'cards') {
              if (!localHighlights[url].cards) localHighlights[url].cards = [];
              for (const card of serverNewer[url].cards) {
                localHighlights[url].cards.push(card);
              }
            }
          }
        }
      }
    }
  }
  chrome.storage.local.set({ highlights: localHighlights });
}
const clientNewer = compareHighlightsMetaResult.client_newer;
const highlightsToPost = {};
for (const url in clientNewer) {
  for (const urlLocal in localHighlights) {
    if (url === urlLocal) {
      highlightsToPost[url] = {};
      for (const highlight in localHighlights[url]) {
        if (highlight === 'cards') {
          if (localHighlights[url].cards) {
            for (const card of localHighlights[url].cards) {
              if (clientNewer[url].cards) {
                for (const card2 of clientNewer[url].cards) {
                  if (card.card_id === card2.card_id) {
                    if (!highlightsToPost[url].cards) highlightsToPost[url].cards = [];
                    highlightsToPost[url].cards.push(card);
                  }
                }
              }
            }
          }
        } else if (highlight === 'deleted') {
          // for client newer deleted we need to post the whole local deleted as is
          highlightsToPost[url].deleted = localHighlights[url].deleted;
        } else if (clientNewer[url][highlight] && highlight.startsWith('h-id-')) {
          highlightsToPost[url][highlight] = localHighlights[url][highlight];
        }
      }
    }
  }
}
