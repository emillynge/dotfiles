// Called when the user clicks on the browser action.
chrome.browserAction.onClicked.addListener(function(tab) {
  var url, js;
  if(tab.url.match(/https/)) {
    js = 'https://pf-cdn.printfriendly.com/ssl/main.js';
  } else {
    js = 'http://cdn.printfriendly.com/printfriendly.js';
  }
  url = "javascript:(function(){if(window['priFri']){window.print()}else{pfstyle='cbk';_pnicer_script=document.createElement('SCRIPT');_pnicer_script.type='text/javascript';_pnicer_script.src='" + js + "?x='+(Math.random());document.getElementsByTagName('head')[0].appendChild(_pnicer_script);}})();";
  chrome.tabs.update(tab.id, {url: url});
});

document.addEventListener('DOMContentLoaded', function () {
  var currentIcon = localStorage["pf_icon"];
  if (currentIcon) {
    chrome.browserAction.setIcon({
      path: "images/" + currentIcon + ".png"
    });
  }
});
