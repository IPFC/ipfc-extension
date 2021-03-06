const $ = require('jquery');

const highlight = function(selectionString, container, selection, color, highlightId, callback) {
  const DELIMITERS = {
    start: '~|:;',
    end: ';:~|',
  };
  const HIGHLIGHT_CLASS = 'highlighter--highlighted';
  let anchor = null;
  let focus = null;
  let anchorOffset = 0;
  let focusOffset = 0;
  let startFound = false;
  let charsHighlighted = 0;
  let alreadyHighlighted = false;
  // console.log('highlight called');
  // console.log(selString, container, selection, color, highlightId);
  const selectionLength = selectionString.length;

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
          if (parent.nodeName === 'SPAN' && parent.className === HIGHLIGHT_CLASS)
            alreadyHighlighted = true;
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
  // Step 1 + 2:
  recursiveWrapper(container);
  //  color = color ? color : 'yellow';
  color = color || 'rgba(248, 103, 13, 0.728)';
  function getReplacements(color, highlightId) {
    // console.log('get replacements. id', highlightId);
    return {
      // removed style="background-color: ' + color + '; in favor of using the highlihght class
      // id needs to append some letters, hence the 'h-id-'
      start: `<span id="${highlightId}" class="${HIGHLIGHT_CLASS}">`,
      end: '</span>',
    };
  }
  var replacements = getReplacements(color, highlightId);

  // Step 3:
  // Either highlight, or un-highlight the selection

  // Need to take the parent in order to be able to open and close the container's root element (a <span> in the un-highlight case)
  // Also needed for the negative lookahead of the highlight case
  var parent = container.parent();
  var content = parent.html();
  // Escape Regex special characters
  function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }
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
  // sometimes ID was being added, but highlight class was not being added
  function recheck() {
    $('[id^=h-id]').each(function() {
      const el = $(this);
      // console.log(
      //   'selectionString.includes(el.text), !el.hasClass(HIGHLIGHT_CLASS),',
      //   selectionString.includes(el.text()),
      //   !el.find('[id^=h-id]').hasClass(HIGHLIGHT_CLASS)
      // );
      if (selectionString.includes(el.text()) && !el.find('[id^=h-id]').hasClass(HIGHLIGHT_CLASS)) {
        el.addClass(HIGHLIGHT_CLASS);
        el.attr('style', 'background-color: ""');
      } else el.attr('style', 'background-color: ""');
    });
  }
  // Step 4:
  if (selection.removeAllRanges) selection.removeAllRanges();
  recheck();
  if (callback) callback();
  return true; // No errors. 'undefined' is returned by default if any error occurs during this method's execution, like if 'content.replace' fails by 'content' being 'undefined'
};

export { highlight };
