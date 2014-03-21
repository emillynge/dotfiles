function reset() {
  xkcd = JSON.parse(localStorage.getItem("xkcd"));

  if ( typeof(xkcd.img) === "string"
    && typeof(xkcd.title) === "string"
    && typeof(xkcd.alt) === "string" ) {
    $("#xkcd-container").html('\
      <a href="'+xkcd.img+'" class="xkcd-a" target="_parent"> \
        <div class="xkcd-title">'+xkcd.title+'</div> \
        <div class="xkcd-alt">'+xkcd.alt+'</div> \
        <img src="'+xkcd.img+'" class="xkcd-img" /> \
      </a>');
    $("#xkcd-container").css("background-image", "url(" + xkcd.img + ")");
  }

  $("#xkcd-container img").load(function() {
    $('.xkcd-a').jqzoom({ zoomType: 'innerzoom' });
  });
}

$(document).ready(function() {
  $('img').live('dragstart', function(event) { event.preventDefault(); });
  setInterval(reset, 15*60*1000);
  reset();
  $(window).bind("resize", function() {
    reset();
  });

  $(document).on("click", "img", function(e) {
    top.location.href = "http://xkcd.com/"
  });
});
