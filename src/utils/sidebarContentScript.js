var windowWidth = window.innerWidth;
var windowHeight = window.innerHeight;

const resize = function() {
  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;
  console.log(windowHeight);
  console.log(windowWidth);
};
// TO DO
window.addEventListener('resize', resize());

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
    // if it won't fit on the left, put it on the right
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
