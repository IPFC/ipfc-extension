import { isEmpty } from 'lodash';
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
};
const filterOutCardCopies = function(rawCards, userId) {
  // console.log('cards, order', cards, order);
  const copierCards = rawCards.filter(card => {
    return card.is_copy_of;
  });
  const copierCardIds = [];
  for (const copierCard of copierCards) copierCardIds.push(copierCard.card_id);
  // console.log('copierCards', copierCards);
  const cards = [];
  const copiedCardIds = [];
  const conflictedSets = {};
  for (const copierCard of copierCards) {
    let count = 0;
    for (const rawCard of rawCards) {
      if (!copierCardIds.includes(rawCard.card_id))
        if (rawCard.card_id === copierCard.is_copy_of) {
          copiedCardIds.push(rawCard.card_id);
          if (isEmpty(conflictedSets[rawCard.card_id]))
            conflictedSets[rawCard.card_id] = [copierCard, rawCard];
          else conflictedSets[rawCard.card_id].push(copierCard);
          count++;
          break;
        }
    }
    if (count === 0) cards.push(copierCard); // the card it copied isn't present
  }
  for (const card of rawCards) {
    if (!copiedCardIds.includes(card.card_id) && !copierCardIds.includes(card.card_id))
      cards.push(card); // not a conflicted card
  }
  for (const conflictedSet in conflictedSets) {
    let count = 0;
    for (const card of conflictedSets[conflictedSet]) {
      if (card.user_id === userId) {
        cards.push(card); // prioritize my cards
        count++;
        break;
      }
    }
    if (count === 0) cards.push(conflictedSets[conflictedSet][0]); // if neither are mine, just pick the first
  }

  // console.log('joined cards', cards);
  return cards;
};
export { combineMineAndOthersWebsites, filterOutCardCopies };
