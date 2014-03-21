window.onerror = function(msg, url, line) {
	bg.console.error("error in addevent: " + msg + " " + url + "_" + line);
	//return false; // false prevents default error handling.
};

var email = bg.email;
var titleClicked, deleteClicked;
var deleting;
var previousTabID = getUrlValue(location.href, "tabID");
var DELAY_BEFORE_FADING_OUT_MESSAGE = 3000;
var delayOver = false;

function showErrorMessage(msg) {
	$("body").css("background", "red");
	$("#statusMessage").empty().text(msg);
}

function closeWindow() {
	getActiveTab(function(currentTab) {
		if (previousTabID) {
			chrome.tabs.update(parseInt(previousTabID), {selected:true});
		}
		window.close();
		//console.log("remove: " + currentTab.id)
		//chrome.tabs.remove(currentTab.id);
	});
}

function prepareCloseWindow() {
	//console.log("prepareclosed")
	if (!titleClicked && !deleteClicked) {
		closeWindow();
	}
}

setTimeout(function() {
	delayOver = true;
}, DELAY_BEFORE_FADING_OUT_MESSAGE);

function onMessageShown() {
	$("body").mouseenter(function() {
		if (!deleting) {
			$(this).stop(true).css("opacity", 1);
		}
	}).mouseleave(function() {
		if (delayOver && !deleting) {
			$(this).stop().delay(600).fadeOut("slow", function() {
				prepareCloseWindow();
			});
		}
	});
}

function doAfterSubmit(eventEntry) {
	$("#savingWrapper").slideUp("fast", function() {
		//$("body").css("background", "#FFF0A8");				
	});
	
	var $msg = getEventDateMessage(eventEntry, function() {
		// onClick param/function
		titleClicked = true;
		
		createTabAndFocusWindow(eventEntry.htmlLink);
		window.close();
	}, function() {
		// onUndo param/function
		deleteClicked = true;
		deleteEvent(eventEntry.eid, null, eventEntry, function(response) {
			if (response.status == 200 || response.status == 204) {
				//setStatusMessage($msg);
				deleting = true;
				$("body").stop().show();
				$("#statusMessage").empty().append($("<span>" + getMessage("eventDeleted") + "</span>"));
				bg.pollServer();
				setTimeout(function() {
					$("body").fadeOut("slow", function() {
						closeWindow();
					});
				}, 1400);
			} else {
				showErrorMessage("Error deleting event: " + response.status);
			}
		});
	});
	// if no secid then we can't delete so hide the undo link
	if (!bg.contentScriptParams["secid"]) {
		$msg.find(".eventUndo").hide();
	}
	
	// if no title found in the result of the quick add then open the edit page
	if (eventEntry.summary) {
		$("#statusMessage").empty().append($msg);
		$("body").slideDown("fast", onMessageShown).delay(DELAY_BEFORE_FADING_OUT_MESSAGE).fadeOut("slow", function() {
			prepareCloseWindow();
		});
	} else {						
		createTabAndFocusWindow(eventEntry.htmlLink);
		window.close();
	}						
	bg.pollServer();
}

$(document).ready(function() {
	if (location.href.match("=contextMenu")) {
		chrome.tabs.get(parseInt(previousTabID), function(tab) {
			$("#logo").attr("src", tab.favIconUrl);
		});
	}
	
	rotate($("#logo"));
	
	var eventEntry = new EventEntry();			
	eventEntry.summary = decodeURIComponent(getUrlValue(location.href, "text"));
	eventEntry.description = getUrlValue(location.href, "description")
	if (eventEntry.description) {
		eventEntry.description = decodeURIComponent(eventEntry.description);
	}
	
	var startTime = today();
	var startTimeInMillis = getUrlValue(location.href, "startTime");
	if (startTimeInMillis) {
		startTimeInMillis = decodeURIComponent(startTimeInMillis);
		startTime = new Date(parseInt(startTimeInMillis));
		eventEntry.startTime = startTime; 
		eventEntry.quickAdd = false;
	}
	eventEntry.allDay = decodeURIComponent(getUrlValue(location.href, "allDay")) == "true";  

	console.log(eventEntry);
	//return;

	saveEvent(eventEntry, function(response) {
		var saveEventResponse = response;
		if (response.error) {
			showErrorMessage("Error: " + response.error + " Try using the quick add from the popup!")
		} else {
			// if title is small, empty or just useless than try getting the page details to fill the title
			var shortestTitleLength = 3;
			if (/zh|ja|ko/i.test(bg.storage.calendarSettings.calendarLocale)) {
				shortestTitleLength = 1;
			}
			if (location.href.match("=contextMenu") && $.trim(eventEntry.summary).length <= shortestTitleLength) {
				chrome.tabs.get(parseInt(previousTabID), function(tab) {
					getEventDetailsFromPage(tab, function(response) {
						eventEntry.summary = response.title;
						eventEntry.description = response.description;
						
						var eventEntryOrNewParams;
						var patchFields = {};
						patchFields.summary = response.title;
						patchFields.description = response.description;
						eventEntryOrNewParams = {eventEntry:eventEntry, googleCalendarEvent:saveEventResponse.data, patchFields:patchFields};
						//eventEntryOrNewParams = {eid:eid, allDay:allDay, startTime:fcEvent.start, endTime:fcEvent.end, event:fcEvent.jEvent};
						updateEvent(eventEntryOrNewParams, function(response) {
							if (response.error) {
								showErrorMessage("Error: " + response.error);
							} else {
								doAfterSubmit(eventEntry);
							}
						});
					});
				});
			} else {
				doAfterSubmit(eventEntry);
			}						
		}
	});
});