window.addEventListener('focus', resize());

chrome.runtime.onMessage.addListener(msg => {
  if (msg.resizeSidebar) resize();
});

function resize() {
  chrome.storage.local.get(['lastActiveTabUrl'], items => {
    // console.log('resize called');
    if (window.location.href === items.lastActiveTabUrl) {
      const updateData = {
        mainWinLeft: window.screenLeft,
        mainWinWidth: window.outerWidth,
      };
      updateData.height = window.outerHeight;
      updateData.top = window.screenTop;
      chrome.runtime.sendMessage({
        sidebarResize: true,
        updateData: updateData,
      });
    }
  });
}

var oldX = window.screenX;
var oldY = window.screenY;
var oldWidth = window.outerWidth;

// https://stackoverflow.com/questions/4319487/detecting-if-the-browser-window-is-moved-with-javascript
setInterval(function() {
  if (oldX !== window.screenX || oldY !== window.screenY || oldWidth !== window.outerWidth) {
    resize();
  }
  oldX = window.screenX;
  oldY = window.screenY;
  oldWidth = window.outerWidth;
}, 500);

// window.addEventListener('resize', function() {
//   resize();
// });

const createSidebar = function() {
  chrome.windows.getCurrent(function(win) {
    const sidebar = {
      type: 'popup',
      url: 'sidebar/sidebar.html',
    };
    sidebar.height = win.height;
    sidebar.top = win.top;
    sidebar.width = Math.round(win.width * 0.25);
    if (sidebar.width > 450) {
      sidebar.width = 450;
    } else if (sidebar.width < 250) {
      sidebar.width = 250;
    }
    let updatedWinLeft = win.left;
    let updatedWinWidth = win.width - sidebar.width;
    if (updatedWinWidth < 500) {
      updatedWinWidth = 500;
    }
    // if it won't fit on the right, put it on the left
    if (win.left + updatedWinWidth + sidebar.width > window.screen.availWidth) {
      updatedWinLeft += win.width - updatedWinWidth;
      sidebar.left = updatedWinLeft - sidebar.width;
    } else {
      sidebar.left = win.left + updatedWinWidth;
    }
    chrome.windows.update(win.id, { width: updatedWinWidth, left: updatedWinLeft });
    chrome.windows.create(sidebar);
  });
};

export { createSidebar };
