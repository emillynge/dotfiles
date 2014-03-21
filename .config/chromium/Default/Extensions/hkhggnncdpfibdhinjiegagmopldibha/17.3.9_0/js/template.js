$(function () {
	if (localStorage.templateTitle) {
		$("#title").html(localStorage.templateTitle);
		delete localStorage.templateTitle;
	}
	if (localStorage.templateText) {
		$("#text").html(localStorage.templateText);
		delete localStorage.templateText;
	}
	
	$("body").click(function () {
        if (chrome.extension.getBackgroundPage().templateCallback) {
        	chrome.extension.getBackgroundPage().templateCallback();
        }
        window.close();
	});
});