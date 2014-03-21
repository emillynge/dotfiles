// For https://chrome.google.com/webstore/detail/mgmiemnjjchgkmgbeljfocdjjnpjnmcg

// Learn more about poke v3 here:
// http://wiki.antp.co/
var info = {
  "poke"    :   3,                                // poke version 3
  "width"   :   2,                                // 406 px default
  "height"  :   1,                                // 200 px default
  "path"    :   "xkcd.html",
  "v2"      :   {
                  "resize"          :   true,     // Set to true ONLY if you create a range below.
                  "min_width"       :   1,        // Required; set to default width if not resizable
                  "max_width"       :   2,        // Required; set to default width if not resizable
                  "min_height"      :   1,        // Required; set to default height if not resizable
                  "max_height"      :   1         // Required; set to default height if not resizable
                },
  "v3"      :   {
                  "multi_placement" :   false     // Allows the widget to be placed more than once
                                                  // Set to false unless you allow users to customize each one
                }
};

chrome.extension.onMessageExternal.addListener(function(request, sender, sendResponse) {
  if(request === "mgmiemnjjchgkmgbeljfocdjjnpjnmcg-poke") {
    chrome.extension.sendMessage(
      sender.id,
      {
        head: "mgmiemnjjchgkmgbeljfocdjjnpjnmcg-pokeback",
        body: info,
      }
    );
  }
});

// Start widget-specific code
function update() {
  $.getJSON("http://xkcd.com/info.0.json", function(data) {
    console.log(data);
    localStorage.setItem("xkcd", JSON.stringify( data ));
  });
}

setInterval(update, 1*60*60*1000);
update();
