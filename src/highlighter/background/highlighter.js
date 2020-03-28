import { deleteHighlight } from './storageManager';
var $ = require('jquery');
// const throttle = require('lodash/throttle');

// Pick a combination of characters that should (almost) never occur
var DELIMITERS = {
  start: '~|:;',
  end: ';:~|',
};

var HIGHLIGHT_CLASS = 'highlighter--highlighted';

const highlightsOrder = function() {
  const highlightsInOrder = [];
  $('.' + HIGHLIGHT_CLASS).each(function() {
    // console.log('highlight order this', this);
    highlightsInOrder.push(this.id);
  });
  // console.log('highlightsInOrder', highlightsInOrder);
  return highlightsInOrder;
};

var clickedHighlightId;

const setupContextMenu = function() {
  var leftContextMenuHtml = `<ul id="left-context-ul">
  <li class="left-context-li" id="delete-highlight">delete highlight</li>
  <li class="left-context-li" id="collect-highlight">collect highlight</li>
</ul>
`;
  const leftContextMenu = document.createElement('div');
  leftContextMenu.id = 'left-context-menu';
  document.body.append(leftContextMenu);
  $('#left-context-menu').html(leftContextMenuHtml);
  const $menu = $('#left-context-menu');
  const repositionAndShowLeftContextMenu = function(e) {
    // console.log('repositionAndShowLeftContextMenu e', e);
    if ($(e.target).is('#delete-highlight')) {
      deleteHighlight(window.location.href, clickedHighlightId);
      $menu.hide();
    } else if (
      !$(e.target)
        .parents()
        .addBack()
        .is('#left-context-menu') &&
      $(e.target)
        .parents()
        .addBack()
        .is('.' + HIGHLIGHT_CLASS)
    ) {
      const target = $(e.target);
      console.log(target);
      const id = target[0].id;
      clickedHighlightId = id;
      console.log(clickedHighlightId);
      const offsetTop = target[0].offsetTop;
      const offsetHeight = target[0].offsetHeight;
      const offsetLeft = target[0].offsetLeft;
      chrome.runtime.sendMessage({
        highlightClicked: true,
        highlightId: id,
        highlightUrl: window.location.href,
      });
      $menu.css({
        position: 'absolute',
        top: offsetTop - offsetHeight,
        left: offsetLeft,
      });

      $menu.toggle();
      togglePopupLeftContextMenu();
    }
  };

  const togglePopupLeftContextMenu = function() {
    const $menu = $('#left-context-menu');
    const callback = function(e) {
      if (
        !$(e.target)
          .parents()
          .addBack()
          .is('#left-context-menu')
      ) {
        $menu.hide();
        $(document).off('click', callback);
        $(document).on('click', repositionAndShowLeftContextMenu);
      }
    };
    if ($menu.is(':visible')) {
      $(document).off('click', repositionAndShowLeftContextMenu);
      $(document).on('click', callback);
    }
    return false;
  };
  $(document).off('click');
  $(document).on('click', repositionAndShowLeftContextMenu);
};

$(document).ready(setupContextMenu);

chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.focusMainWinHighlight) {
    // console.log('focusMainWinHighlight msg', msg);
    focusHighlight(msg.highlightId);
  }
});

const focusHighlight = function(highlightId) {
  $('html, body').animate(
    {
      scrollTop: $('#' + highlightId).offset().top - 200,
    },
    400
  );
};

function getReplacements(color, highlightId) {
  // console.log('get replacements. id', highlightId);
  return {
    // removed style="background-color: ' + color + ';
    // id needs to append some letters, hence the 'h-id-'
    start: `<span id="${highlightId}" class="${HIGHLIGHT_CLASS}">`,
    end: '</span>',
  };
}

var anchor = null;
var focus = null;
var anchorOffset = 0;
var focusOffset = 0;
var selectionString = '';
var selectionLength = 0;

var startFound = false;
var charsHighlighted = 0;

var alreadyHighlighted = true;

function resetVars() {
  anchor = null;
  focus = null;
  anchorOffset = 0;
  focusOffset = 0;
  selectionString = '';
  selectionLength = 0;
  startFound = false;
  charsHighlighted = 0;
  alreadyHighlighted = true;
}

const highlight = function(selString, container, selection, color, highlightId, callback) {
  resetVars();
  // console.log('highlight called');
  // console.log(selString, container, selection, color, highlightId);
  selectionString = selString;
  selectionLength = selectionString.length;

  container = $(container);
  anchor = $(selection.anchorNode);
  anchorOffset = selection.anchorOffset;
  focus = $(selection.focusNode);
  focusOffset = selection.focusOffset;

  /**
   * STEPS:
   * 1 - Use the offset of the anchor/focus to find the start of the selected text in the anchor/focus element
   *     - Use the first of the anchor of the focus elements to appear
   * 2 - From there, go through the elements and find all Text Nodes until the selected text is all found.
   *     - Wrap all the text nodes (or parts of them) in special characters
   * 3 - Replace the special characters by span tags with a yellow background color in the container html
   * 4 - Deselect text
   */

  // Step 1 + 2:
  recursiveWrapper(container);
  //  color = color ? color : 'yellow';
  color = color ? color : 'rgba(248, 103, 13, 0.728)';
  var replacements = getReplacements(color, highlightId);

  // Step 3:
  // Either highlight, or un-highlight the selection

  // Need to take the parent in order to be able to open and close the container's root element (a <span> in the un-highlight case)
  // Also needed for the negative lookahead of the highlight case
  var parent = container.parent();
  var content = parent.html();

  var startRe, endRe, sanitizeRe;
  if (!alreadyHighlighted) {
    startRe = new RegExp(escapeRegex(DELIMITERS.start), 'g');
    endRe = new RegExp(escapeRegex(DELIMITERS.end), 'g');
    content = content.replace(startRe, replacements.start).replace(endRe, replacements.end);

    // Make sure to not highlight the same thing twice, as it breaks the un-highlighting
    sanitizeRe = new RegExp(
      escapeRegex(replacements.start + replacements.start) +
        '(.*?)' +
        escapeRegex(replacements.end + replacements.end),
      'g'
    );
    parent.html(content.replace(sanitizeRe, replacements.start + '$1' + replacements.end));
  } else {
    startRe = new RegExp(escapeRegex(DELIMITERS.start), 'g');
    endRe = new RegExp(escapeRegex(DELIMITERS.end), 'g');
    // The trick here is to replace the start with the end and vice-versa which will remove the selected text from the highlight
    content = content.replace(startRe, replacements.end).replace(endRe, replacements.start);

    // Clean-up by removing empty spans
    sanitizeRe = new RegExp(escapeRegex(replacements.start + replacements.end), 'g');
    parent.html(content.replace(sanitizeRe, ''));
  }

  // Step 4:
  if (selection.removeAllRanges) selection.removeAllRanges();
  if (callback) callback();
  return true; // No errors. 'undefined' is returned by default if any error occurs during this method's execution, like if 'content.replace' fails by 'content' being 'undefined'
};

function recursiveWrapper(container) {
  container.contents().each(function(index, element) {
    if (element.nodeType === Node.TEXT_NODE) {
      var startIndex = 0;
      // Step 1:
      // The first element to appear could be the anchor OR the focus node,
      // since you can highlight from left to right or right to left
      if (!startFound) {
        if (anchor.is(element)) {
          startFound = true;
          startIndex = anchorOffset;
        }
        if (focus.is(element)) {
          if (startFound)
            // If the anchor and the focus elements are the same, use the smallest index
            startIndex = Math.min(anchorOffset, focusOffset);
          else {
            startFound = true;
            startIndex = focusOffset;
          }
        }
      }
      // Step 2:
      if (startFound && charsHighlighted < selectionLength) {
        var nodeValueLength = element.nodeValue.length;
        var newText = '';
        // If one of the textElement is not wrapped in a .highlighter--highlighted span,
        // the selection is not already highlighted
        var parent = element.parentElement;
        if (parent.nodeName !== 'SPAN' || parent.className !== HIGHLIGHT_CLASS)
          alreadyHighlighted = false;
        // Go over all characters to see if they match the selection.
        // This is done because the selection text and node text contents differ.
        for (var i = 0; i < nodeValueLength; i++) {
          if (i === startIndex) newText += DELIMITERS.start;
          if (charsHighlighted === selectionLength) {
            newText += DELIMITERS.end;
            newText += element.nodeValue.substr(i);
            break;
          }
          newText += element.nodeValue[i];
          if (i >= startIndex && charsHighlighted < selectionLength) {
            // Skip whitespaces as they often cause trouble (differences between selection and actual text)
            while (
              charsHighlighted < selectionLength &&
              selectionString[charsHighlighted].match(/\s/)
            )
              charsHighlighted++;

            if (selectionString[charsHighlighted] === element.nodeValue[i]) charsHighlighted++;
          }
          if (i === nodeValueLength - 1) newText += DELIMITERS.end;
        }
        element.nodeValue = newText;
      }
    } else recursiveWrapper($(element));
  });
}

/** UTILS **/

// Escape Regex special characters
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export { highlight, highlightsOrder };
