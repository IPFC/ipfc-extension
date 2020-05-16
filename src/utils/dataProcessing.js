import { isEmpty, pickBy } from 'lodash';
const combineMineAndOthersWebsites = function(websites, othersWebsites) {
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
        if (isEmpty(website.deleted)) website.deleted = [];
        if (isEmpty(oWebsite.deleted)) oWebsite.deleted = [];
        const mergedDeletedRaw = website.deleted.concat(
          oWebsite.deleted.filter(entry => !website.deleted.includes(entry))
        );
        const mergedDeleted = [];
        for (const entry of mergedDeletedRaw) {
          if (!mergedDeleted.includes(entry)) mergedDeleted.push(entry);
        }
        combinedWebsite.deleted = mergedDeleted;
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
};
// const filterOutCardCopies = function(rawCards, userId) {
//   console.log('rawCards', rawCards);
//   const copierCards = rawCards.filter(card => {
//     return card.is_copy_of;
//   });
//   const copierCardIds = [];
//   for (const copierCard of copierCards) copierCardIds.push(copierCard.card_id);
//   console.log('copierCards', copierCards);
//   const cards = [];
//   const copiedCardIds = [];
//   const copiedCards = [];
//   for (const copierCard of copierCards) {
//     for (const rawCard of rawCards) {
//       if (rawCard.card_id === copierCard.is_copy_of) {
//         if (!copiedCardIds.includes(rawCard.card_id)) {
//           copiedCardIds.push(rawCard.card_id);
//           copiedCards.push(rawCard);
//         }
//       }
//     }
//   }
//   const conflictedSets = {};
//   for (const copiedCard of copiedCards) conflictedSets[copiedCard.card_id] = [copiedCard];
//   for (const copierCard of copierCards) {
//     // the card it copied isn't present
//     if (!copiedCardIds.includes(copierCard.is_copy_of)) cards.push(copierCard);
//     else {
//       conflictedSets[copierCard.is_copy_of].push(copierCard);
//     }
//   }
//   console.log('conflictedSets, cards', conflictedSets, cards);

//   for (const card of rawCards) {
//     if (!copiedCardIds.includes(card.card_id) && !copierCardIds.includes(card.card_id))
//       cards.push(card); // not a conflicted card
//   }
//   console.log('conflictedSets, cards', conflictedSets, cards);
//   for (const conflictedSet in conflictedSets) {
//     let count = 0;
//     for (const card of conflictedSets[conflictedSet]) {
//       if (card.user_id === userId) {
//         cards.push(card); // prioritize my cards
//         count++;
//         break;
//       }
//     }
//     if (count === 0) cards.push(conflictedSets[conflictedSet][0]); // if neither are mine, just pick the first
//   }

//   console.log('joined cards', cards);
//   return cards;
// };
const filterOutCardCopies = function(rawCards, userId) {
  // console.log('rawCards', rawCards);
  const myCards = [];
  for (const rawCard of rawCards) {
    if (rawCard.user_id === userId) {
      let count = 0;
      for (const myCard of myCards) {
        if (rawCard.front_text === myCard.front_text && rawCard.back_text === myCard.back_text) {
          count++;
          break;
        }
      }
      if (count === 0) myCards.push(rawCard);
    }
  }
  const cards = JSON.parse(JSON.stringify(myCards));
  for (const rawCard of rawCards) {
    if (!myCards.includes(rawCard)) {
      let count = 0;
      for (const card of cards) {
        if (rawCard.front_text === card.front_text && rawCard.back_text === card.back_text) {
          count++;
          break;
        }
      }
      if (count === 0) cards.push(rawCard);
    }
  }
  // console.log('cards', cards);

  return cards;
};
const findHiddenHighlight = function(card, websites, order) {
  if (!card.highlight_id || !websites) return null;
  const id = card.highlight_id;
  const highlights = websites[card.highlight_url].highlights;
  const original = pickBy(highlights, highlight => {
    return highlight.highlight_id === id;
  });
  if (!isEmpty(original)) {
    for (const highlight in highlights) {
      if (!isEmpty(highlights[highlight])) {
        // console.log(highlights[highlight], original);
        if (highlights[highlight].string === original[Object.keys(original)[0]].string) {
          if (highlights[highlight] !== original[Object.keys(original)[0]])
            if (order.includes(highlights[highlight].highlight_id)) return highlights[highlight];
        }
      }
    }
  }
};
const cleanedUrl = function(url) {
  let cleaned = url;
  if (url.includes('#')) cleaned = url.split('#')[0];
  if (cleaned.includes('?')) cleaned = cleaned.split('?')[0];
  if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);
  if (cleaned.endsWith('.asp')) cleaned = cleaned.slice(0, -4);
  if (cleaned.endsWith('.html')) cleaned = cleaned.slice(0, -5);
  // console.log('cleanedUrl', cleaned);
  return cleaned;
};
export { combineMineAndOthersWebsites, filterOutCardCopies, findHiddenHighlight, cleanedUrl };
