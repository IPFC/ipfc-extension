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

export { combineMineAndOthersWebsites };
