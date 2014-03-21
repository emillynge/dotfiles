var loadingTimer = null;
var savingTimer = null;
var openingSite = false;

// Bubble
var bubbleDate = null;
var what = null;
var selectedTab = null;

var whatLabel = null;
var whatValue = null;
var description = null;
var descriptionFromPage;

var calendarViewSelected;
var calendarLoadedOnce = false;
var HEIGHT_BUFFER = 10;

var email = bg.email;
var embedPrefix;
var cals;
var finalLocation = null;
var lastMouseEvent;
var withAnimation;
var calendarType = pref("calendarType", "newLook");

function isGmailCheckerInstalled(callback) {
	// use cached response for true
	if (localStorage.gmailCheckerInstalled) {
		callback(true);
	} else {
		chrome.runtime.sendMessage("oeopbcgkkoapgobdbedcemjljbihmemj", {}, function(response) { // oeopbcgkkoapgobdbedcemjljbihmemj  pghicafekklkkiapjlojhgdokkegilki
			var installed = false;
			if (response && response.installed) {
				installed = true;
				localStorage.gmailCheckerInstalled = "true";
			}
			callback(installed);
		});
	}
}

function isNewLook() {
	return calendarType && calendarType.indexOf("newLook") != -1;
}

function stretchWindow() {
	$("body").addClass("wide");
	//$("body").width(800);
	//$("#stretcher").show();
	//$("#stretcher").width( $("body").width() );
}

function convertEventToFullCalendarEvent(jEvent, snoozeTime) {
	var fcEvent = {};
	
	fcEvent.id = getEventID(jEvent);
	
	fcEvent.title = jEvent.title;
	if (!fcEvent.title) {
		fcEvent.title = jEvent.summary;
		if (!fcEvent.title) {
			fcEvent.title = "(" + getMessage("noTitle") + ")";
		}
	}
	
	fcEvent.url = jEvent.htmlLink;

	var currentUserAttendeeDetails = getCurrentUserAttendeeDetails(jEvent);
	if (currentUserAttendeeDetails && currentUserAttendeeDetails.responseStatus == "declined") {
		fcEvent.isDeclined = true;
	}
	
	if (snoozeTime) {		
		fcEvent.isSnoozer = true;
		fcEvent.id += "_snooze";
		
		fcEvent.start = snoozeTime;
		fcEvent.end = snoozeTime.addDays(1);
		// required for fullcalendar or else it would spread the event across many days
		fcEvent.end.clearTime();
		//fcEvent.end = new Date("Sun Dec 29 2013 00:00:00 GMT-0500");
		console.log(fcEvent.title + " " + snoozeTime, fcEvent);
		//var diffInDays = snoozeTime.diffInDays(jEvent.startTime);
		//fcEvent.end = jEvent.endTime.addDays(2, true);
	} else {
		fcEvent.start = new Date(jEvent.startTime);
		fcEvent.end = new Date(jEvent.endTime);
	}

	/*
	if (jEvent.allDay) { // && jEvent.startTime.diffInHours(jEvent.endTime) == -24
		// patch: or else the all day event spreads over 2 days with this widget??
		//fcEvent.end = event.start;
		fcEvent.end = new Date(jEvent.endTime);
		//fcEvent.end.clearTime();				
	} else {									
		fcEvent.end = new Date(jEvent.endTime);
	}
	*/	
	//fcEvent.end = new Date("2012-05-3");
	
	fcEvent.allDay = jEvent.allDay;
	var colors = bg.cachedFeeds["colors"];
	if (pref("eventColors") && jEvent.colorId && colors) {
		fcEvent.color = colors.event[jEvent.colorId].background;
		fcEvent.textColor = colors.event[jEvent.colorId].foreground;
	} else {
		fcEvent.color = colors.calendar[jEvent.calendar.colorId].background; //jEvent.calendar.backgroundColor;
		fcEvent.textColor = colors.calendar[jEvent.calendar.colorId].foreground; //jEvent.calendar.foregroundColor;
	}
	fcEvent.jEvent = jEvent;
	return fcEvent;
}

function convertEventsToFullCalendarEvents(events) {
	console.log("convertEventsToFullCalendarEvents")
	var fullCalendarEvents = [];
	var selectedCalendars = getSelectedCalendars();
	
	for (var a=0; a<events.length; a++) {
		var snoozeTime;
		if (events[a].isSnoozer) {
			jEvent = events[a].event;			
			snoozeTime = events[a].time;
			
			// let's force the snoozed event to allday if not today - so that the time does not appear
			if (!snoozeTime.isToday()) {
				jEvent.allDay = true;
			}
		} else {
			jEvent = events[a];
		}
		
		var selected = isCalendarSelectedInExtension(jEvent.calendar, email, selectedCalendars);
		
		//if (!isGadgetCalendar(jEvent) && selected && passedShowDeclinedEventsTest(jEvent, bg.storage)) {
		if (selected && passedShowDeclinedEventsTest(jEvent, bg.storage)) {
			var event = convertEventToFullCalendarEvent(jEvent, snoozeTime);
			fullCalendarEvents.push(event);
		}
	}
	return fullCalendarEvents;
}

function openSiteInsteadOfPopup() {
	openingSite = true;
	createTab({url:getProtocol() + "://www.google.com/calendar", urlToFind:"://www.google.com/calendar"}, function() {
		window.close();
	});
}

var tooLateForShortcut = false;
setInterval(function() {tooLateForShortcut=true}, 1000);
window.addEventListener ("keydown", function(e) {
	
	// for bypassing popup and opening google calendar webpage
	if (!tooLateForShortcut && e.ctrlKey) {
		tooLateForShortcut = true;
		if (donationClicked("CtrlKeyOnIcon")) {
			openSiteInsteadOfPopup();
			return;
		}
	}
	
	// for Dismissing events
	if (e.altKey && letterPressedEquals(e, "d")) {
		chrome.runtime.sendMessage({name: "dismissAll"}, function() {
			window.close();
		});		
	}
	
}, false);

var quickAddPerformed = false;

/*
if (!bg.online) {
	bg.pollServer({source:"notOnlineInPopup"});
}
*/

function reloadCalendar(params) {
	
	if (params.maybeThisEventShouldShowANotification) {
		params.ignoreNotifications = false;
	} else {
		// default atleast in the context of this popup window is to ignorenotification for performance
		params.ignoreNotifications = true;
	}
	
	bg.pollServer(params)
	if (isNewLook()) {
		if (pref("newLookView", "month") == "basicDay") {
			bg.refreshWidgetData();
			setTimeout(function() {
				document.getElementById("agenda").contentDocument.location.reload(true);				
			}, 1000);
		}
	} else {
		document.getElementById("calendar").src = setUrlParam(document.getElementById("calendar").src, "userReloaded", "true");
	}
}

function showSavingMessage(delay) {
	if (typeof(delay) == "undefined") {
		delay = 1200;
	}
	savingTimer = setTimeout(function() {$("#processing").show()}, delay);
}

function clearSavingMessage() {
	clearTimeout(savingTimer);
	$("#processing").hide();
}

function setStatusMessage(params) { //$msg, delay, errorFlag
	if (!params.delay) {
		params.delay = 3200;
	}
	
	$("#statusMessage").empty();
	
	if (params.errorFlag) {
		$("#statusMessage").addClass("error");
	} else {
		$("#statusMessage").removeClass("error")
	}
	
	if (params.messageNode) {
		$("#statusMessage").append(params.messageNode);
	} else {
		$("#statusMessage").html(params.message)
	}

	$("#topStatusMessageWrapper").fadeIn().delay(params.delay).fadeOut("slow");
}

function setEventDateMessage(eventEntry) {
	var $msg = getEventDateMessage(eventEntry, function() {
		// onClick param/function
		chrome.tabs.create({url:eventEntry.htmlLink});
		setTimeout(function() {
			window.close();
		}, 200);
	}, function() {
		// onUndo param/function
		deleteEvent(eventEntry.eid, null, eventEntry, function(response) {
			if (response.status == 200 || response.status == 204) {
				$("#topStatusMessageWrapper").stop(true).show();
				
				$("#betaCalendar").fullCalendar('removeEvents', getEventID(eventEntry));
				
				setStatusMessage({message:getMessage("eventDeleted"), delay:1000});
				reloadCalendar({source:"deleteEvent"});
			} else {
				alert("Error deleting event: " + response.status);
			}
		});
	});
	setStatusMessage({messageNode:$msg});
}

function onCalendarLoad() {
	if (!quickAddPerformed) {
		clearTimeout(loadingTimer);
		$('#loading').hide();
		
		if (!calendarLoadedOnce) {
			/*
			if (shouldShowReducedDonationMsg()) {
				$("#reducedDonation")
					.fadeTo(1000, 1.0)
					.click(function() {
						localStorage.reducedDonationAdClicked = true;
						createTab("donate.html?ref=reducedDonationFromPopup");
					})
				;
				$("#bottomRightAdWrapper").hide();
				$("#bottomArea").show();
			} else if (!pref("tryMyOtherExtensionsClicked")) { // previous prefs: writeAboutMeClicked, tryMyOtherExtensionsClicked
				isGmailCheckerInstalled(function(installed) {
					if (!installed) {
						$("#reducedDonation").hide();
						$("#bottomRightAdWrapper").fadeTo(1000, 1.0);
						$("#bottomArea").show();
					}
				});
			}
			*/
		}
	}
	if (calendarType == "agenda") {
		// patch: because height of agenda from does not have time to expand
		setTimeout(function() {
			$("#calendar").height( $("#calendar").height()-1 )
		}, 10);
	}
	
	calendarLoadedOnce = true;
}

function setCalendarWrapperDimensions(width, height) {
	if (width) {				
		document.getElementById("wrapper").style.width = document.getElementById("calendarWrapper").style.width = width;
	} else if (isRockMelt()) {
		document.getElementById("wrapper").style.width = document.getElementById("calendarWrapper").style.width = "100%";
	}
	if (height) {
		document.getElementById("calendarWrapper").style.height = parseInt(height) + HEIGHT_BUFFER;
	} else {
		document.getElementById("calendarWrapper").style.height = $("#calendar").height() + HEIGHT_BUFFER;
	}
}

function maybePerformUnlock(processor, callback) {
	callback();
}

function adjustSize(width) {
	if (calendarType == "agenda" || calendarType == "agendaOnly") {
		var width;
		if (isRockMelt()) {
			width = "100%";
		} else {
			width = 440;
		}
		$("#bottomArea").hide();
		document.getElementById("wrapper").style.width = width;
		setCalendarWrapperDimensions(width);
	} else if (calendarType == "week" || calendarType == "month") {
		setCalendarWrapperDimensions();
	} else if (calendarType == "newLook") {

		stretchWindow();
		
		$("#wrapper").width("100%")
		//setCalendarWrapperDimensions("740", "300");
		//$("html,body").height("100px")
	} else if (calendarType == "newLookNormal") {
		// do nothing
	} else if (calendarType == "newLookSmall") {
		$(".fc-button-today").hide();
		$("#wrapper").css("width", "360px");
	} else if (localStorage["customizedCalendar"]) {
		var currentHeight = $(localStorage["customizedCalendar"]).attr("height");
		if (currentHeight) {
			var newHeight = currentHeight;// - 70;
			document.getElementById("calendar").style.height = newHeight;
		}
		var currentWidth = $(localStorage["customizedCalendar"]).attr("width");
		if (currentWidth) {
			var newWidth = currentWidth;// - 200;
			document.getElementById("calendar").style.width = newWidth;
		}
		setCalendarWrapperDimensions(newWidth, newHeight);
	} else {
		// possilby empty customizedCalendar
		setCalendarWrapperDimensions();
	}
}

function cleanICal(str) {
	return str.replace(/\\/g, "");
}

function showError(response) {
	// seems like status 500 errors are not returning details about the error and so the oauth just returns the statusText "error"
	if (response.error == "error") {
		setStatusMessage({message:"Intermittent error, please try again!", errorFlag:true});
	} else {
		// assuming we found an oauth error display it here
		setStatusMessage({message:response.error, errorFlag:true});			
	}
}

function centerBubble(params) {
	if (!params.mouseX) {
		params.mouseX = $("body").width() / 2
	}
	if (!params.mouseY) {
		params.mouseY = $("body").height() / 2
	}
	
	var x = params.mouseX - (params.$bubble.width() / 2); // ($("body").width() - newBubble.width()) / 2;
	var RIGHT_MARGIN_BUFFER = 22;
	if (x < 0) {
		x = 0;
	} else if (params.mouseX + (params.$bubble.width() / 2) > $("body").width() - RIGHT_MARGIN_BUFFER) {
		x = $("body").width() - params.$bubble.width() - RIGHT_MARGIN_BUFFER;
	}
	var y = params.mouseY - params.$bubble.height() - $("#betaCalendar").offset().top; //$("body").height / 2;
	if (y < 0) {
		y = 0;
	}
	params.$bubble.css("top", y + "px");
	params.$bubble.css("left", x + "px");
}

function showCreateBubble(params) {
	
	params.$bubble.data("selectionParams", params);
	
	bubbleDate = new Date(params.start);
	
	if (params.end) {
		if (params.allDay) {
			$("#bubbleDate").text(bubbleDate.format(getMessage("notificationDateFormat")) + " – " + params.end.format(getMessage("notificationDateFormat")));
		} else {
			$("#bubbleDate").text(bubbleDate.format(getMessage("notificationDateFormat")) + ", " + params.start.formatTime() + " – " + params.end.formatTime());
		}
	} else {
		$("#bubbleDate").text(bubbleDate.format(getMessage("notificationDateFormat")));
	}
	
	$("#bubbleWhat").attr("lang", pref("lang", window.navigator.language).substring(0, 2));
	$("#bubbleWhatRadio").get(0).checked = true;
	$("#bubbleWhatRadio").click();
	description = "";
	descriptionFromPage = "";
	$("#bubbleDescription").val("");			
	
	// hide other bubbles
	$(".bubble").removeClass("visible");

	centerBubble(params);
	
	what = null;
	getActiveTab(function(tab) {
		selectedTab = tab;
		
		getEventDetailsFromPage(selectedTab, function(response) {
			$("#bubbleWhat2").val(response.title);
			descriptionFromPage = response.description;
			//$("#bubbleDescription").val(response.description);
		});
		
		if (selectedTab.favIconUrl) {
			$("#bubbleWhat2").css("background", "#fff url('" + selectedTab.favIconUrl + "') no-repeat 1px 1px");
			$("#bubbleWhat2").css("background-size", "22px");
			$("#bubbleWhat2").css("padding-left", "26px");
		} else {
			$("#bubbleWhat2").css("padding-left", "0");
		}
		
		if (withAnimation) {
			params.$bubble.show();
			setTimeout(function() {
				params.$bubble.addClass("visible");			
			}, 1);
		} else {
			params.$bubble.addClass("visible");
		}
		$("#bubbleWhat")
			.focus()
		;

		var placeHolder;
		if (params.end) {
			if (params.allDay) {
				placeHolder = getMessage("quickAddDefaultTextMultipleDays");
			} else {
				placeHolder = getMessage("quickAddDefaultTextMultipleHours");
			}
		} else {
			placeHolder = getMessage("quickAddDefaultText");					
		}
		$("#bubbleWhat").prop("placeholder", placeHolder)		
	});
}

function reloadEventsAndShowMessage(message, delay) {
	clearSavingMessage();
	bg.pollServer({source:"reloadEventsAndShowMessage", ignoreNotifications:true});
	setStatusMessage({message:message, delay:delay});
}
		
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	switch (request.name) {
	case "moveEvent":
		/*
		var title = $.trim(request.title);
		//alert(request.dragStartDate + " xx" + request.title + "xx  " + request.dropDate);
		var startTime = new Date(request.dragStartDate);
		var eventFound = false;
		var gEvents = bg.gEvents;
		$.each(gEvents, function(index, event) {
			console.log(title + "_" + event.title);
			if (startTime.isSameDay(event.startTime) && $.trim(title) == $.trim(event.title)) {
				eventFound = true;
				
				var eid = getUrlValue(event.url, "eid");
				var oldStartTime = event.startTime;
				var oldEndTime = event.endTime;
				var newStartTime = new Date(request.dropDate);
				newStartTime.setHours(oldStartTime.getHours());
				newStartTime.setMinutes(oldStartTime.getMinutes());
				newStartTime.setSeconds(oldStartTime.getSeconds());
				var newEndTime = calculateNewEndTime(oldStartTime, oldEndTime, newStartTime);
				var eventEntry = {eid:eid, allDay:event.allDay, startTime:newStartTime, endTime:newEndTime};
				updateEvent(eventEntry, function(response) {
					if (!response.error) {
						// also update the gEvent if you want to move this event again in the same popup session 
						event.startTime = newStartTime;
						event.endTime = newEndTime;
						
						setTimeout(function() {
							setStatusMessage({message:getMessage("eventUpdated"), delay:1500});
						}, 500);
						reloadCalendar({source:"moveEvent"});
					}
					sendResponse(response);
				});
				
				return false;
			}
			// only used to avoid underline errors in Eclipse
			return true;
		});
		if (!eventFound) {
			//alert('event not found');
			sendResponse({error:"notfound"});
		}
		*/
		break;
	case "actionMessage":
		if (request.message) {
			if (request.message == "saving") {
				showSavingMessage();
			}
		} else {
			clearSavingMessage();
		}
		break;
	case "showCreateBubble":
		showCreateBubble({$bubble:$("#createEventBubble"), start:request.date, mouseX:request.pageX, mouseY:request.pageY});
		break;
	case "closeBubble":
		$(".bubbleCloseButton").click();
		break;
	case "reloadEventsAndShowMessage":
		reloadEventsAndShowMessage(request.message, request.delay);
		break;
	}
	return true;
});

function fetchAndDisplayEvent(url) {
	$.ajax({
		url: url,
		type: "GET",
		jsonpCallback: "hello",
		timeout: 10000,
		complete: function(request, textStatus) {
			if (request.status == 200) {
				 var ical = $.icalendar.parse(request.responseText);
				 
				 var start = request.responseText.indexOf("DTSTART");
				 var end = request.responseText.indexOf("DTEND");
				 
				 var dtStart;
				 var startDateOnly;
				 
	 			 var eventEntry = new EventEntry();

				 try {
					 dtStart = request.responseText.substring(start+8, end-2);
					 // date only found ie. DTSTART:20121016
					 if (dtStart.length <= 10) {
						 startDateOnly = dtStart.parseDate();
						 startDateOnly.setDate(startDateOnly.getDate() + 1);
					 }
				 } catch (e) {
					 console.log("coud not parse for dtstart: ", e);
				 }
				 
				 $("#eventTitle").text(ical.vevent.summary);
				 
				 if (startDateOnly) {
					 ical.vevent.dtstart = startDateOnly;
					 ical.vevent.dtend = new Date(startDateOnly);
					 ical.vevent.dtend.setDate(ical.vevent.dtend.getDate() + 1);
					 eventEntry.allDay = true;
				 }
	 				
				 var dateStr = ical.vevent.dtstart.format("dddd, mmmm d");
				 if (!startDateOnly) {
					 dateStr += ", " + ical.vevent.dtstart.formatTime() + "";
				 }
				 
				 $("#eventDate").text(dateStr);
				 
				 $("#eventDetailsWrapper").show();
				 $("#newLookFeedback, #newLookNormalFeedback").hide();
				 $("#eventWrapper").show();
				 $("#calendar").height($("#calendar").height() - $("#eventWrapper").height() + 30);
				 $("#addICalEvent").click({ical: ical}, function(event) {
					 
		 			eventEntry.quickAdd = false;
		 			eventEntry.summary = cleanICal(ical.vevent.summary);
		 			eventEntry.description = cleanICal(ical.vevent.description);
		 			eventEntry.location = cleanICal(ical.vevent.location);
		 			
		 			//if (startDateOnly) {
		 				eventEntry.startTime = ical.vevent.dtstart;
		 				eventEntry.endTime = ical.vevent.dtend;
		 			//} else {
	 					//eventEntry.startTimeStr = ical.vevent.dtstart;
	 					//eventEntry.endTimeStr = ical.vevent.dtend;
		 			//}
		 			eventEntry.calendar = cals.first();
		 			
					saveAndLoadInCalendar(false, eventEntry, function() {
						$("#donate").hide();
						$("#calendar").fadeOut("fast");
						$("#eventWrapper").fadeOut("slow", function() {
							$("#calendar").fadeIn("fast");
						});
					});

				 });
			}
		}
	});
}

function saveAndLoadInCalendar(saveEventMethodFlag, eventEntry, callback) {
	if (!callback) {
		callback = function() {};
	}
	
	var saveFunction;
	if (saveEventMethodFlag) {
		saveFunction = saveEvent;
	} else {
		saveFunction = postToGoogleCalendar;
	}
	
	$("#betaCalendar").fullCalendar('unselect');

	console.log("savefunc: ", eventEntry);

	saveFunction(eventEntry, function(response) {
		if (response.error) {
			showError(response);
		} else {
			console.log("savefunc2: ", eventEntry);
			if (isNewLook()) {
				var fcEvent = convertEventToFullCalendarEvent(eventEntry);
				$("#betaCalendar").fullCalendar('renderEvent', fcEvent)
			}

			setEventDateMessage(eventEntry);
			
			var maybeThisEventShouldShowANotification = false;
			if ((eventEntry.allDay && eventEntry.startTime.isToday()) || eventEntry.startTime.isBefore()) {
				maybeThisEventShouldShowANotification = true;
			}
			
			quickAddPerformed = true;
			$("#bubbleWhat").val("");
			reloadCalendar({source:"saveEvent", maybeThisEventShouldShowANotification:maybeThisEventShouldShowANotification});
		}
		callback(response);
	});
}

function resizeCalendar() {
	console.log("source.events after callbak");
	setTimeout(function() {
        console.log("windowresize: " + $("#betaCalendar").height());
        if ($("body").hasVerticalScrollbar() || $("#betaCalendar").height() >= 530) {
        	// commented for now so we can show 50c deal at bottom
        	/*
        	console.log("add smaller")
        	$("#bottomArea").hide();
        	$("html").addClass("smaller");
        	$("#betaCalendar").fullCalendar( 'rerenderEvents' );
        	*/
        }
	}, 1);
}

// get future snoozes, includeAlreadyShown
function getSnoozes(snoozers, params) {
	params = initUndefinedObject(params);
	
	var futureSnoozes = [];
	$.each(snoozers, function(index, snoozer) {
		if ((!snoozer.email || snoozer.email == email) && snoozer.time.getTime() >= now()) {
			if ((params.includeAlreadyShown || !bg.isCurrentlyDisplayed(snoozer.event))) {
				if (!snoozer.time.isToday() || (snoozer.time.isToday() && !params.excludeToday)) {
					snoozer.isSnoozer = true;
					//futureSnoozes.push({event:snoozer.event, reminderTime:snoozer.reminderTime});
					futureSnoozes.push(snoozer);
				}
			}
		}
	});
	return futureSnoozes;
}

function setTimeline() {
    var curTime = new Date();
    
    /*
    var todayElem = $(".fc-today");
    todayElem.removeClass("fc-today");
    todayElem.removeClass("fc-state-highlight");

    todayElem.next().addClass("fc-today");
    todayElem.next().addClass("fc-state-highlight");
    */

    var parentDiv = $(".fc-agenda-slots:visible").parent();
    var timeline = parentDiv.children(".timeline");
    if (timeline.length == 0) { //if timeline isn't there, add it
        timeline = $("<hr>").addClass("timeline");
        parentDiv.prepend(timeline);
    }

    var curCalView = $('#betaCalendar').fullCalendar("getView");
    if (curCalView.visStart < curTime && curCalView.visEnd > curTime) {
    	console.log("timelineshow")

    	var minTime = pref("hideMorningHoursBefore", "0").parseTime();
    	var maxTime = pref("hideNightHoursAfter", "24").parseTime();
    	
    	var percentOfDay = (curTime.getTime() - minTime.getTime()) / (maxTime.getTime() - minTime.getTime());
    	
	    //var curSeconds = (curTime.getHours() * 60 * 60) + (curTime.getMinutes() * 60) + curTime.getSeconds();
	    //var percentOfDay = curSeconds / 86400; //24 * 60 * 60 = 86400, # of seconds in a day
	    //console.log("seconds: " + curSeconds);
	    var topLoc = Math.floor(parentDiv.height() * percentOfDay);
	
	    timeline.css("top", topLoc + "px");
	
	    if (curCalView.name == "agendaWeek") { //week view, don't want the timeline to go the whole way across
	        var dayCol = $(".fc-today:visible");
	        if (dayCol.position() != null) {
	            var left = dayCol.position().left + 1;
	            var width = dayCol.width();
	            timeline.css({
	                left: left + "px",
	                width: width + "px"
	            });
	        }
	    }
    	
    	timeline.show();
    } else {
        timeline.hide();
    }
    
}

function getAllEvents(events, start, end, callback) {
	if (events.length == 0 || start.isBefore(events.first().startTime) || end.isAfter(events.last().startTime)) {
		console.log("process calendars: " + start);
		$("#betaLoading").show();
		
		bg.fetchAllCalendarEvents({email:bg.email, startDate:start, endDate:end, source:"popup"}, function(cbParams) {
			if (cbParams.error) {
				setStatusMessage({message:"Error fetching, try reload button or sign in to Google Calendar!", errorFlag:true});
			} else {
				var newEvents = [];
				$.each(cbParams.events, function(c, event) {
					newEvents.push(event);
				});
				callback(newEvents);
			}
		});
	} else {
		callback(events.clone());
	}
}

$(document).ready(function() {
	
	// patch for mac because "i think" webkit animation would cause problems like text entered in create event bubble appearning underneath and fuzzy scaling
	// update: fixed on mac now so removed patch
	//if (navigator.platform.toLowerCase().indexOf("mac") == -1 && navigator.platform.toLowerCase().indexOf("linux") == -1) {
		withAnimation = true;
		$("html").addClass("withAnimation");
	//}
	
	if (openingSite) {
		return;
	} else {
		$("body").show();
	}
	
	$(document)
		.ajaxStart(function(e, jqxhr, settings) {
			showSavingMessage();
		})
		.ajaxStop(function(e, jqxhr, settings) {
			clearSavingMessage();
		})
	;
	
	calendarViewSelected = calendarType;
	// Never user selected so choose default which is month
	if (!calendarViewSelected) {
		calendarViewSelected = "month";
	}
	$("#optionsMenu li[val=" + calendarViewSelected + "]").addClass("selected");
	
	if (pref("showSnoozedEvents", true)) {
		$("#optionsMenu li[val='showSnoozedEvents']").addClass("selected");		
	}
	
	if (pref("donationClicked")) {
		$("#optionsMenu li[val='extraFeatures']").hide();
	}

	if (pref("showHeader", true)) {
		if (pref("showQuickAdd", true)) {
			var msgKey;
			if (Math.random() * 5 < 3) {
				msgKey = "quickAddDefaultText";
			} else {
				msgKey = "quickAddTitle";
			}
			$("#quickAdd").attr("placeholder", getMessage(msgKey));
		} else {
			$("#quickAddWrapper").hide();
		}
		if (!pref("showRefresh", true)) {
			$("#refresh").hide();
		} 
		if (!pref("showOpenCalendar", true)) {
			$("#openCalendar").hide();
		} 
	} else {
		$("#quickAddWrapper, #toolbar").hide();
	}

	cals = bg.getArrayOfCalendars();
	embedPrefix = "https://www.google.com/calendar/embed?";
	console.log("Calendar type: " + calendarType);
	
	loadingTimer = setTimeout(function() {
		$("#loading").show();
	}, 900);
	
	
	// Add css
	var css = "";
	
	if (pref("pastDays")) {
		css += " .fc-past {background:#bbb;opacity:0.3} .fc-event-past {opacity:0.3} ";
	}
	if (pref("highlightWeekends")) {
		css += " .fc-sat, .fc-sun {background:#ddd;opacity:1} ";
	}
	
	var $style = $("<style id='calendarCustomCSS'>" + css + "</style>");
	$("head").append( $style );
	
	if (!bg.loggedOut) {
		
		$("#wrapper").show();
		
		if (isNewLook()) {
			
			$("#calendarWrapper").hide();
			
			/*
			if (localStorage["calendarType"] == "newLookNormal") {					
				$("#newLookNormalFeedback").fadeIn();
			} else {
				$("#newLookFeedback").fadeIn();
			}
			*/
			
			var date = new Date();
			var d = date.getDate();
			var m = date.getMonth();
			var y = date.getFullYear();
			
			var sources = [];
			source = {};
			//source.color = cals[a].color;
			//source.textColor = 'white';
			source.events = function(start, end, callback) {
				console.log("source.events");
				
		    	// look if this date range not been added yet... 
		    	var events = bg.events;
	
				if (start == "Invalid Date") {
					console.log("invvvvvv");
					return;
				}
	
		    	console.log(events.length + " start: " + start + " end: " + end);
				if (events.first() && events.last()) {
					console.log(events.first().startTime + " " + events.last().startTime);
				} 
		    	
				getAllEvents(events, start, end, function(allEvents) {
		    		$("#betaLoading").hide();
		    		
		    		if (pref("showSnoozedEvents", true)) {
			    		// includes snoozes
			    		var futureSnoozes = getSnoozes(bg.snoozers, {includeAlreadyShown:true, excludeToday:true});
			    		console.log("future snoozes", futureSnoozes);
			    		allEvents = allEvents.concat(futureSnoozes);
		    		}
		    		
		    		var fcEvents = convertEventsToFullCalendarEvents(allEvents);
		    		
		    		callback(fcEvents);
		    		resizeCalendar();
				});
		    	
		    }
			sources.push(source);
			
			var timeFormatStrNoDuration;
			var timeFormatStrWithDuration;
			
			var axisFormatTime;
			
			if (pref("24hourMode")) {
				axisFormatTime = "H:mm";
				timeFormatStrNoDuration = "H:mm";
				timeFormatStrWithDuration = "H:mm{ - H:mm}";
			} else {
				axisFormatTime = "h(:mm)tt";
				timeFormatStrNoDuration = "h(:mm)t";
				timeFormatStrWithDuration = "h(:mm)t{ - h(:mm)t}";
			}
			
			var columnFormat = "M/d";
			if (bg.storage.calendarSettings.dateFieldOrder == "MDY") {
				columnFormat = "M/d";
			} else if (bg.storage.calendarSettings.dateFieldOrder == "DMY") {
				columnFormat = "d/M";
			} else if (bg.storage.calendarSettings.dateFieldOrder == "YMD") {
				columnFormat = "M/d";
			}
			
			$('#betaCalendar').mousemove(function(e) {
				lastMouseEvent = e;
				//$(".bubble").css({top:lastMouseEvent.pageY, left:lastMouseEvent.pageX});
				centerBubble({$bubble:$("#createEventBubble:not(.visible)"), mouseX:e.pageX, mouseY:e.pageY});
				centerBubble({$bubble:$("#clickedEventDetails:not(.visible)"), mouseX:e.pageX, mouseY:e.pageY+10});
			});
			
			$('#betaCalendar').fullCalendar({
				header: {
					left: 'today prev,next, title',
					//center: 'title',
					right: 'agendaDay,agendaWeek,month,basicDay' //basicDay,basicWeek
				},
				weekMode: 'variable',
				timeFormat: {agenda:timeFormatStrWithDuration, '':timeFormatStrNoDuration}, // uppercase H for 24-hour clock
				columnFormat: {
				    month: 'ddd',    // Mon
				    week: 'ddd ' + columnFormat, // Mon 9/7
				    day: 'dddd ' + columnFormat  // Monday 9/7
				},
				axisFormat: axisFormatTime,
				width: 400,
				height: 450,
				//aspectRatio: 2,
				weekends: !bg.storage.calendarSettings.hideWeekends,
				firstDay: bg.storage.calendarSettings.weekStart,
				selectable: true,
				selectHelper: true,
				select: function(start, end, allDay, jsEvent, view) {
					if (start.getTime() == end.getTime()) { // means: all day and one day selection only					
						showCreateBubble({$bubble:$("#createEventBubble"), start:start, allDay:allDay, mouseX:jsEvent.pageX, mouseY:jsEvent.pageY});
					} else {
						showCreateBubble({$bubble:$("#createEventBubble"), start:start, end:end, allDay:allDay, mouseX:jsEvent.pageX, mouseY:jsEvent.pageY});
					}
				},
				editable: true,
				buttonText: {
			        today:    getMessage("today"),
			        prev: '&lt;',
			        next: '&gt;',
			        month:    getMessage("month"),
			        week:     getMessage("week"),
			        day:      getMessage("day"),
			        basicDay: getMessage("agenda")
			    },
			    allDayText: getMessage("allDayText"),
			    firstHour: today().getHours()-1,
			    minTime: pref("hideMorningHoursBefore", "0"),
			    maxTime: pref("hideNightHoursAfter", "24"),
			    isRTL: pref("lang", window.navigator.language) == "he" || pref("lang", window.navigator.language) == "ar",
			    weekNumbers: pref("showWeekNumbers"),
			    monthNames: dateFormat.i18n.monthNames,
			    monthNamesShort: dateFormat.i18n.monthNamesShort,
			    dayNames: dateFormat.i18n.dayNames,
			    dayNamesShort: dateFormat.i18n.dayNamesShort,
				defaultView: pref("newLookView", "month"),
				viewDisplay: function(view) {
			        localStorage.newLookView = view.name;
			        console.log("viewdisplay: " + view.name)
			        if (view.name == "basicDay") {
			        	$(".fc-header-left").hide();
			        	$(".fc-view-basicDay")
			        		.empty()
			        		.css("text-align", "center")
			        		.append( $("<iframe id='agenda' style='height:480px' src='widget.html?source=popup'/>") );
			        } else {
			        	$(".fc-header-left").show();
			        }
			        
			        if (view.name == "agendaWeek" || view.name == "agendaDay") {
			        	setTimeline();
			        }
			    },
				windowResize: function(view) {
					console.log("windowresize");
			    },
				eventMouseover: function( event, jsEvent, view ) {
					var title;
					if (event.isSnoozer) {
						title = event.title + " (snoozed)";
					} else {
						title = event.title;
					}
					$(this).attr("title", title);
				},
				eventClick: function(calEvent, jsEvent, view) {
					console.log(calEvent);
					
					// hide other bubbles
					$(".bubble").removeClass("visible");
					
					var title;
					if (calEvent.title) {
						title = calEvent.title;
					} else {
						title = "(" + getMessage("noTitle") + ")";
					}
					
					if (calEvent.isSnoozer) {
						title += " (snoozed)";
					}
					
					$("#clickedEventTitle")
						.text(title)
						.css("color", darkenColor(calEvent.color))
					;
					
					var startDateStr = calEvent.start.format(getMessage("notificationDateFormat"));
					console.log("start date: " + calEvent.start);
					if (calEvent.allDay) {
						if (calEvent.start.diffInDays(calEvent.end) == -1) {
							$("#clickedEventDate").text(startDateStr);
						} else {
							var endDate = new Date(calEvent.end);
							endDate.setDate(endDate.getDate()-1);
							$("#clickedEventDate").text(startDateStr + " - " + endDate.format(getMessage("notificationDateFormat")));
						}
					} else {
						var noZeroes = pref("24hourMode") ? false : true;
						var timeStr = calEvent.start.formatTime(true);
						if (calEvent.end) {
							if (calEvent.start.isSameDay(calEvent.end)) {
								timeStr += " - " + calEvent.end.formatTime(true);
							} else {
								timeStr += " - " + calEvent.end.format(getMessage("notificationDateFormat")) + ", " + calEvent.end.formatTime(true);
							}
						}
						$("#clickedEventDate").text(startDateStr + ", " + timeStr);
					}
					
					var location = calEvent.jEvent.location;
					if (location) {
						$("#clickedEventLocation").text(location);
						$("#clickedEventLocationMapLink").attr("href", "http://maps.google.ca/maps?q=" + encodeURIComponent(location) + "&source=calendar");
						$("#clickedEventLocationWrapper").show();
					} else {
						$("#clickedEventLocationWrapper").hide();
					}

					var hangoutLink = calEvent.jEvent.hangoutLink;
					if (hangoutLink) {
						$("#clickedEventVideoLink").attr("href", hangoutLink);
						$("#clickedEventVideoWrapper").show();
					} else {
						$("#clickedEventVideoWrapper").hide();
					}

					var eventSource = getEventSource(calEvent.jEvent);
					if (eventSource) {
						// show logo for this type of source 
						if (eventSource.url.match("https?://mail.google.com")) {
							$("#eventSourceLogo").show();
						} else {
							$("#eventSourceLogo").hide();
						}
						
						$("#clickedEventSourceLink")
							.text(eventSource.title)
							.attr("href", eventSource.url)
							.attr("title", eventSource.url)
						;
						$("#clickedEventSourceWrapper").show();
					} else {
						$("#clickedEventSourceWrapper").hide();
					}
					
					if (calEvent.jEvent.attendees) {
						var $attendees = $("#clickedEventAttendeesWrapper .clickedEventSubDetails");
						$attendees.empty();
						
						$.each(calEvent.jEvent.attendees, function(index, attendee) {
							console.log("attendee", attendee)
							var $attendee = $("<a/>")
								.text(attendee.displayName)
								.attr("href", "mailto:" + attendee.email)
								.attr("target", "_blank")
								.attr("title", attendee.email)
							;
							if (index >= 1) {
								$attendees.append($("<span>, </span>"));
							} else if (index >= 10) {
								$attendees.append($("<span>...</span>"));
								return false;
							}
							$attendees.append($attendee);
						});
					
						$("#clickedEventAttendeesWrapper").show();
					} else {
						$("#clickedEventAttendeesWrapper").hide();
					}

					if (calEvent.jEvent.description) {
						var description = calEvent.jEvent.description;
						if (description) {
							description = description.summarize(100).replaceAll("\n", "<br>");
						}
						$("#clickedEventDescriptionWrapper .clickedEventSubDetails")
							.html(description)
							.attr("title", calEvent.jEvent.description)
						;
						$("#clickedEventDescriptionWrapper").show();
					} else {
						$("#clickedEventDescriptionWrapper").hide();
					}

					var eid = calEvent.jEvent.eid;
					if (!eid) {
						eid = getUrlValue(calEvent.jEvent.url, "eid");
					}
					$("#clickedEventDelete").off().on("click", {eid:eid, fcEvent:calEvent, ls:localStorage}, function(e) {
						console.log("del event", e);

						$(this).closest(".bubble").removeClass("visible");

						if (e.data.fcEvent.isSnoozer) {
							for (var a=0; a<bg.snoozers.length; a++) {
								var snoozer = bg.snoozers[a];
								bg.console.log("snooze found")
								if (isSameEvent(e.data.fcEvent.jEvent, snoozer.event)) {
									bg.console.log("remove snooze");
									bg.snoozers.splice(a, 1);
									a--;
									break;
								}
							}

							bg.storage.snoozers = bg.snoozers;
							bg.storageManager.set("snoozers", bg.storage.snoozers);

							$("#betaCalendar").fullCalendar('removeEvents', calEvent.id);
						} else {
							initDeleteEvent(e, function(response) {
								console.log(response);
								if (response && response.error) {
									setStatusMessage({message:response.error, delay:1500, errorFlag:true});
									clearSavingMessage();
								} else {
									chrome.runtime.sendMessage({name: "statusMessage", message:"eventDeleted", delay:1000});
									$("#betaCalendar").fullCalendar('removeEvents', calEvent.id);
									reloadEventsAndShowMessage(getMessage("eventDeleted"), 1000);
								}
							});							
						}
					});
	
					$("#clickedEventTitle").off().on("click", {fcEvent:calEvent}, function(e) {
						chrome.tabs.create({url:e.data.fcEvent.jEvent.htmlLink});
					});
					
					$("#clickedEventEditDetails").off().on("click", {fcEvent:calEvent}, function(e) {
						console.log("editdetails", e);
						if (e.data.fcEvent.isSnoozer) {
							openSnoozePopup([{event:e.data.fcEvent.jEvent}]);
							close();
						} else {
							chrome.tabs.create({url:e.data.fcEvent.jEvent.htmlLink});
						}
					});
					
					if (withAnimation) {
						$("#clickedEventDetails").show();
					}
					setTimeout(function() {
						$("#clickedEventDetails").addClass("visible");
					}, 1);
				},
				eventDblClick: function(calEvent, jsEvent, view) {
					chrome.tabs.create({url:calEvent.jEvent.htmlLink});
				},
				eventDrop: function(fcEvent, dayDelta, minuteDelta, allDay, revertFunc) {
					var eid = fcEvent.jEvent.eid;
					if (!eid) {
						eid = getUrlValue(fcEvent.jEvent.url, "eid");
					}
					
					if (fcEvent.isSnoozer) {
						// do nothing seems to work
					} else {
						var eventEntry = {eid:eid, allDay:allDay, startTime:fcEvent.start, endTime:fcEvent.end, event:fcEvent.jEvent};
						
						updateEvent(eventEntry, function(response) {
							if (response.error) {
								setStatusMessage({message:response.error, delay:1500, errorFlag:true});
								revertFunc();
							} else {
								// also update the gEvent if you want to move this event again in the same popup session 
								//event.startTime = newStartTime;
								//event.endTime = newEndTime;
								
								setTimeout(function() {
									setStatusMessage({message:getMessage("eventUpdated"), delay:1500});
								}, 500);
								reloadCalendar({source:"dragDrop"});
							}						
						});
					}
				},
				eventResize: function( fcEvent, dayDelta, minuteDelta, revertFunc, jsEvent, ui, view ) { 
					var eid = fcEvent.jEvent.eid;
					if (!eid) {
						eid = getUrlValue(fcEvent.jEvent.url, "eid");
					}
					var eventEntry = {eid:eid, allDay:false, startTime:fcEvent.start, endTime:fcEvent.end, event:fcEvent.jEvent};
					updateEvent(eventEntry, function(response) {
						if (response.error) {
							setStatusMessage({message:response.error, delay:1500, errorFlag:true});
							revertFunc();
						} else {
							// also update the gEvent if you want to move this event again in the same popup session 
							//event.startTime = newStartTime;
							//event.endTime = newEndTime;
							
							setTimeout(function() {
								setStatusMessage({message:getMessage("eventUpdated"), delay:1500});
							}, 500);
							reloadCalendar({source:"eventResize"});
						}						
					});
				}
			});
			$("#betaCalendar").show();
			
			setTimeout(function() {
				$("#betaCalendar").fullCalendar('addEventSource', source);
			}, 300);
			
			onCalendarLoad();
			
		} else {
			if (calendarType == "agenda") {
				finalLocation = "https://www.google.com/calendar/ig";
			} else if (calendarType == "customized" && localStorage["customizedCalendar"]) {
				///if (email) {
					var src = $(localStorage["customizedCalendar"]).attr("src");
					console.log(src + " email: " + email);
					if (src) {
						finalLocation = $(localStorage["customizedCalendar"]).attr("src");
					} else {
						finalLocation = embedPrefix;
					}
					/*
					if (unescape(src).indexOf(email) != -1) {
						finalLocation = $(localStorage["customizedCalendar"]).attr("src");
					} else {
						finalLocation = embedPrefix + "src=" + email;
					}
					*/
				//} else {
					//document.write("<a target='_blank' href='http://www.google.com/calendar'>" + getMessage("signIn") + "</a> " + getMessage("toSeeCalendar"));
				//}
			} else {
				var params = "";
					
				var oldCalendarFeed;
				var oldCalendarEntries;
				if (bg.feeds) {
					oldCalendarFeed = bg.getElementInArray(bg.feeds, "https://www.google.com/calendar/feeds/default/allcalendars/full");
					if (oldCalendarFeed) {
						oldCalendarEntries = oldCalendarFeed.entries;
					}
				}
				
				$.each(bg.getArrayOfCalendars(), function(index, calendar) {
					if (calendar.selected) {
						var color;
						if (oldCalendarEntries) {
							$.each(oldCalendarEntries, function(index, entry) {
								if (calendar.id == decodeURIComponent(getCalendarIDFromURL(entry.url))) {
									color = entry.color;
									return false;
								} else {
									return true;
								}
							});
						}
						
						params += "src=" + encodeURIComponent(calendar.id) + "&";
						if (color) {
							params += "&color=" + encodeURIComponent(color) + "&";
						}
					}
				});
				var mode = "";
				if (calendarType == "agendaOnly") {
					mode = "&mode=AGENDA";
				} else if (calendarType == "week") {
					mode = "&mode=WEEK";
				}
				params += mode + "&showTabs=0&showPrint=0";
				finalLocation = embedPrefix + params;
				console.log(embedPrefix + params);
			}
			if (finalLocation.indexOf("?") != -1) {
				finalLocation += "&";
			} else {
				finalLocation += "?";
			}
			finalLocation += "GCCP_calledFrom=popup.html";
			
			setTimeout(function() {
				console.log("location: " + finalLocation);
				$("#calendar").attr("src", finalLocation);
				$("#calendar").on("load", function() {	
					onCalendarLoad();
				});
				$("#calendarWrapper").show();
			}, 100);
		}

		/*
		if (navigator.platform.toLowerCase().indexOf("mac") != -1 || navigator.platform.toLowerCase().indexOf("linux") != -1) {
			document.body.style.height=100;
		}
		*/
		
		adjustSize();
	}
	
	$("#save").click(function() {
		// Must match what timeFilte and formatContent returns
		var eventEntry = new EventEntry();
		var summary = $("#quickAdd").val();
		var dropDownValue = $("#quickAddDropdown").val();
		if (!summary) {
			if (dropDownValue == "quickAdd") {
				niceAlert(getMessage("enterATitle"));
				$("#quickAdd").focus();
				return;
			} else {
				summary = "alert";
			}
		}
		if (dropDownValue == "quickAdd") {
			eventEntry = new EventEntry(summary);
		} else if (dropDownValue.indexOf("min") != -1) {
			var minutes = dropDownValue.replace("min", "");
			eventEntry = formatTitle(summary, minutes);
		} else if (dropDownValue.indexOf("date_") != -1) {
			var millis = dropDownValue.replace("date_", "");
			eventEntry.startTime = new Date(parseInt(millis));
			eventEntry.summary = summary;
			dropDownValue = "days_" + eventEntry.startTime.diffInDays();
		} else {
			eventEntry.summary = summary;
		}
		
		eventEntry.allDay = true; // default to this

		sendGA(['_trackEvent', 'quickadd', 'click', dropDownValue]);
		//var data = "<?xml version='1.0' encoding='UTF-8' ?><entry xmlns='http://www.w3.org/2005/Atom' xmlns:gCal='http://schemas.google.com/gCal/2005'><content>" + content + "</content><reminder method='all' /></entry>";
		//var data = "<?xml version='1.0' encoding='UTF-8' ?><entry xmlns='http://www.w3.org/2005/Atom' xmlns:gCal='http://schemas.google.com/gCal/2005' xmlns:gd='http://schemas.google.com/g/2005'><content type='text'>" + content + "</content><gCal:quickadd value='true'/><gd:when startTime='2009-10-30'><gd:reminder /></gd:when></entry>";
		
		$("#save").addClass("disabled").text(getMessage("saving"));
		
		//eventEntry.calendar = bg.primaryCalendar;
		
		var selectedCalendar = $("#quickAddCalendars option:selected").data("calendar");
		eventEntry.calendar = selectedCalendar;
		
		saveAndLoadInCalendar(true, eventEntry, function(response) {
			$("#save").removeClass("disabled").text(getMessage("save"));
			if (response && response.error) {
				// leave text there
			} else {
				$("#quickAdd")
					.attr("placeholder", "")
					.val("")
				;
			}
		});
		
	});
	
	var futureSnoozes = getSnoozes(bg.snoozers);
	
	if (futureSnoozes.length) {
		
		console.log("snozzes", futureSnoozes);
		
		var snoozesTitles = "";
		$.each(futureSnoozes, function(index, futureSnooze) {
			snoozesTitles += "\n- " + getSummary(futureSnooze.event);
		});
		
		$("li[val='openSnoozedEvents']")
			.attr("title", getMessage("snoozes") + ":" + snoozesTitles)
			.show()
		;
	}

	$("#refresh").click(function() {
		$("#refresh img").addClass("rotate");			
		
		if (isNewLook()) {
			$("#betaLoading").show();
		}
		reloadCalendar({source:"refresh", bypassCache:true, callback:function() {
				if (isNewLook()) {
					$("#betaCalendar").fullCalendar( 'refetchEvents' );
				}
				$("#refresh img").removeClass("rotate");
			}
		});
	});

	$("#close").click(function() {
		window.close();
	});

	var calendarURL = null;
	calendarURL = getProtocol() + "://www.google.com/calendar";
	$("#openCalendar").click(function() {
		chrome.tabs.create({url:calendarURL});
		setTimeout(function() {
			window.close();
		}, 200)				
	});

	if (bg.loggedOut) {
		$("#openCalendar").text(getMessage("signIn"));
		$("#wrapper").hide();
		$("#signedOutCalendarSignIn").attr("href", calendarURL);
		
		if (email && !bg.oAuthForDevices.findTokenResponse({userEmail:email})) {
			$("#grantAccess").show();
		} else {
			$("#signedOut").show();
		}
		
	} else {
		$("#openCalendar")
			.html("<img valign='top' style='margin-top:-1px' src='images/maximize.png'/>")
			.attr("title", getMessage("openCalendar"))
		;
	}
	
	getActiveTab(function(tab) {
		var matches = tab.url.match(/facebook\.com\/events\/(\d*)/i);
		if (matches) {
			//var eventID = getUrlValue(tab.url, "eid");
			var eventID = matches[1];
			if (eventID) {
				chrome.permissions.contains({
					origins: [bg.FACEBOOK_PERMISSION_HOST]
				}, function(result) {								
					if (result) {
						fetchAndDisplayEvent("http://www.facebook.com/ical/event.php?eid=" + eventID);
					} else {
						$("#grantFacebookPermissionWrapper").show();
						$("#newLookFeedback, #newLookNormalFeedback").hide();
						$("#eventWrapper").show();
					}
				});
			}
		} else if (tab.url.match("evite.com")) {
			var eventID = getUrlValue(tab.url, "gid");
			if (eventID) {
				fetchAndDisplayEvent("http://new.evite.com/services/guests/" + eventID + "/export/ical");
			}
		}
	});

	$("#quickAddDropdown").append("<option value='quickAdd'>" + getMessage("quickAdd") + "</option>");
	//$("#quickAddDropdown").append("<option disabled>" + getMessage("alertMe") + "</option>");
	$("#quickAddDropdown").append("<option value='10min'>" + getMessage("inVARminutes", "10") + "</option>");
	$("#quickAddDropdown").append("<option value='30min'>" + getMessage("inVARminutes", "30") + "</option>");
	$("#quickAddDropdown").append("<option value='60min'>" + getMessage("inVARhour", "1") + "</option>");
	$("#quickAddDropdown").append("<option value='120min'>" + getMessage("inVARhours", "2") + "</option>");

	//if (!bg.locale || bg.locale.indexOf("en") != -1) {
		var nextDay = today();
		nextDay.setDate(nextDay.getDate()+1);
		$("#quickAddDropdown").append("<option value='-' disabled>&nbsp;...</option>");
		$("#quickAddDropdown").append("<option value='date_" + nextDay.getTime() + "'>" + getMessage("tomorrow") + "</option>");
		$("#quickAddDropdown").append("<option value='-' disabled>&nbsp;...</option>");
		//var daysInEnglish = new Array("sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday");

		for (var a=2; a<=7; a++) {
			nextDay.setDate(nextDay.getDate()+1);
			$("#quickAddDropdown").append("<option value='date_" + nextDay.getTime() + "'>" + dateFormat.i18n.dayNames[nextDay.getDay()] + "</option>");
		}			
	//}

	$("#quickAddDropdown").append("<option value='-' disabled>&nbsp;...</option>");
	for (a=2; a<=59; a++) {
		$("#quickAddDropdown").append("<option value='" + a + "min'>" + getMessage("inVARminutes", a+"") + "</option>");
	}
	$("#quickAddDropdown").append("<option value='-' disabled>&nbsp;...</option>");
	$("#quickAddDropdown").append("<option value='60min'>" + getMessage("inVARhour", "1") + "</option>");
	$("#quickAddDropdown").append("<option value='120min'>" + getMessage("inVARhours", "2") + "</option>");
	$("#quickAddDropdown").append("<option value='180min'>" + getMessage("inVARhours", "3") + "</option>");
	$("#quickAddDropdown").append("<option value='240min'>" + getMessage("inVARhours", "4") + "</option>");

	if (isRockMelt()) {
		$("#quickAdd").css("width", 100);
	} else if (calendarViewSelected.match("agenda|agendaOnly")) {
		$("#quickAdd").css("width", 150);
	}
	
	if (pref("lang", window.navigator.language).indexOf("de") != -1) {
		//$("#quickAdd").attr("size", 20);
	} else if (pref("lang", window.navigator.language).indexOf("en") != -1) {
		$("#quickAddDropdown").css("width", "90");
	}

	$("#options").click(function() {
		if ($("#optionsMenu").is(":visible")) {
			$("#optionsMenu").removeClass("visible");
			$("#optionsMenu").slideUp("fast");
		} else {
			$("#visibleCalendars").empty();
			
			var selectedCalendars = getSelectedCalendars();
			$.each(bg.getArrayOfCalendars(), function(index, calendar) {
				
				if (isGadgetCalendar(calendar)) {
					// exclude the weather etc. because i am not integrating it into calendar display
				} else {
					var calendarName = getCalendarName(calendar);
					
					var $li = $("<li><div class='visibleCalendarColor'></div><div class='visibleCalendarLabel'></div></li>");
					$li.data("calendar", calendar);
					
					$li.click(function() {
						
						if (!isNewLook()) {
							$("#visibleCalendarsOldLookWarning").slideDown();
							return;
						}
						
						var selectedCalendars = getSelectedCalendars();
						var calendar = $(this).data("calendar");
						
						var selected;
						if (isCalendarSelectedInExtension(calendar, email, selectedCalendars)) {						
							selected = false;
							$(this).find(".visibleCalendarColor").css("background-color", "");
						} else {
							selected = true;
							var bgColor = colors.calendar[calendar.colorId].background;
							$(this).find(".visibleCalendarColor").css("background-color", bgColor);
						}
						if (!selectedCalendars[email]) {
							selectedCalendars[email] = {};
						}
						selectedCalendars[email][calendar.id] = selected;
						localStorage.selectedCalendars = JSON.stringify(selectedCalendars);
						
						// refresh calendar/events
						$("#betaLoading").show();
						reloadCalendar({source:"selectedCalendars", callback:function() {
								$("#betaCalendar").fullCalendar( 'refetchEvents' );
							}
						});

					});
					
					var bgColor = colors.calendar[calendar.colorId].background

					if (isCalendarSelectedInExtension(calendar, email, selectedCalendars)) {
						$li.find(".visibleCalendarColor").css("background-color", bgColor);
					}
					$li.find(".visibleCalendarLabel")
						.text(calendarName)
						.attr("title", calendarName)
					;
					
					$("#visibleCalendars").append($li);
					//$("#visibleCalendars").append($li.clone());		
				}

			});
			
			$("#optionsMenu").removeClass("visible");
			$("#optionsMenu").slideDown("fast", function() {
				$(this).addClass("visible");
			});
		}
		
	});
	
	$("#optionsMenu li").click(function() {
		var value = $(this).attr("val");
		
		if (value == "SEP") {
			$("#optionsMenu").removeClass("visible");
			$("#optionsMenu").slideUp("fast");
		} else {
		
			sendGA(['_trackEvent', 'view', value]);
			
			if (value == "showSnoozedEvents") {
				var showSnoozedEvents = pref("showSnoozedEvents", true);
				if (showSnoozedEvents) {
					localStorage.showSnoozedEvents = "false";
					$(this).removeClass("selected");
				} else {
					localStorage.showSnoozedEvents = "true";
					$(this).addClass("selected");
				}
				$("#betaCalendar").fullCalendar( 'refetchEvents' );
			} else if (value == "openSnoozedEvents") {
				openSnoozePopup(futureSnoozes.clone());
				close();
			} else if (value == "extraFeatures") {
				chrome.tabs.create({url:"donate.html?ref=popup"});
			} else if (value == "optionsPage") {
				chrome.tabs.create({url:"options.html?ref=popup"});
			} else if (value == "changelog") {
				chrome.tabs.create({url:"http://jasonsavard.com/wiki/Checker_Plus_for_Google_Calendar_changelog?ref=CalendarCheckerOptionsMenu"});
			} else if (value == "discoverMyApps") {
				chrome.tabs.create({url:"http://jasonsavard.com?ref=CalendarCheckerOptionsMenu"});
			} else if (value == "followMe") {
				chrome.tabs.create({url:"http://jasonsavard.com/?followMe=true&ref=CalendarCheckerOptionsMenu"});
			} else if (value == "feedback") {
				chrome.tabs.create({url:"http://jasonsavard.com/forum/categories/checker-plus-for-google-calendar-feedback?ref=CalendarCheckerOptionsMenu"});
			} else if (value == "aboutMe") {
				chrome.tabs.create({url:"http://jasonsavard.com/bio?ref=CalendarCheckerOptionsMenu"});
			} else if (value == "help") {
				chrome.tabs.create({url:"http://jasonsavard.com/wiki/Checker_Plus_for_Google_Calendar?ref=CalendarCheckerOptionsMenu"});
			} else {			
				var previousValue = calendarType;
				localStorage["calendarType"] = value;
				if (value == "customized") {
					if (previousValue != "customized" && localStorage["customizedCalendar"]) {
						location.reload(true);
					} else {
						chrome.tabs.create({url:"options.html?calendarView=customized"});
					}
				} else {
					location.reload(true);
				}
			}			
		}
	});
	
	if (pref("removeShareLinks")) {
		$("#share").hide();
	}

	$("#share").click(function() {
		if ($("#shareMenu").is(":visible")) {
			$("#shareMenu").removeClass("visible");
			$("#shareMenu").slideUp("fast");
		} else {
			$("#shareMenu").removeClass("visible");
			$("#shareMenu").slideDown("fast", function() {
				$(this).addClass("visible");
			});
		}
		
	});

	$("#shareMenu li").click(function() {
		var value = $(this).attr("val");
		
		if (value == "SEP") {
			$("#shareMenu").removeClass("visible");
			$("#shareMenu").slideUp("fast");
		} else {
			sendGA(['_trackEvent', 'shareMenu', value]);
			
			var urlToShare = "http://jasonsavard.com/checkerPlusForGoogleCalendar";
			var imageToShare = "http://jasonsavard.com/images/extensions/mediumCheckerPlusForGoogleCalendar.png";
			
			if (value == "googlePlus") {
				openWindowInCenter("https://plus.google.com/share?url=" + encodeURIComponent(urlToShare), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 600, 600);
			} else if (value == "facebook") {
				openWindowInCenter("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(urlToShare), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 600, 500);
			} else if (value == "twitter") {
				openWindowInCenter("https://twitter.com/share?url=" + encodeURIComponent(urlToShare) + "&text=" + encodeURIComponent(getMessage("shareIntro") + ": " + getMessage("nameNoTM") + " @jasonsavard"), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 600, 285);
			} else if (value == "pinterest") {
				openWindowInCenter("http://www.pinterest.com/pin/create/button/?url=" + encodeURIComponent(urlToShare) + "&media=" + encodeURIComponent(imageToShare) + "&description=" + encodeURIComponent(getMessage("description")), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 750, 350);
			} else if (value == "tumblr") {
				openWindowInCenter("http://www.tumblr.com/share/link?url=" + encodeURIComponent(urlToShare) + "&name=" + encodeURIComponent(getMessage("nameNoTM")) + "&description=" + encodeURIComponent(getMessage("description")), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 600, 600);
			} else if (value == "linkedin") {
				openWindowInCenter("http://www.linkedin.com/shareArticle?mini=true&url=" + encodeURIComponent(urlToShare) + "&title=" + encodeURIComponent(getMessage("nameNoTM")) + "&summary=" + encodeURIComponent(getMessage("description")), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 600, 540);
			} else if (value == "reddit") {
				openWindowInCenter("http://www.reddit.com/submit?url=" + encodeURIComponent(urlToShare) + "&title=" + encodeURIComponent(getMessage("nameNoTM")) + "&summary=" + encodeURIComponent(getMessage("description")), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 900, 750);
			}
		}
	});
	
	$(document).click(function(e) {
		if ($(e.target).attr("id") != "options" && $(e.target).closest("#options").length == 0 && $(e.target).attr("id") != "share" && $(e.target).closest("#share").length == 0 && $(e.target).closest(".menu").length == 0) {
			if ($(".menu").is(":visible")) {
				$(".menu").removeClass("visible");
				$(".menu").slideUp("fast");
			}
		}
	});
	
	/*
	if ((!pref("tryMyOtherExtensionsClicked") && !gmailCheckerInstalled) || (shouldShowReducedDonationMsg()) && calendarType != "agendaOnly") {
		$("#bottomArea").show();
	}
	*/
	if (shouldShowReducedDonationMsg()) {
		$("#reducedDonation")
			.fadeTo(1000, 1.0)
			.click(function() {
				localStorage.reducedDonationAdClicked = true;
				createTab("donate.html?ref=reducedDonationFromPopup");
			})
		;
		$("#bottomRightAdWrapper").hide();
		$("#bottomArea").show();
	} else if (!pref("tryMyOtherExtensionsClicked")) { // previous prefs: writeAboutMeClicked, tryMyOtherExtensionsClicked
		isGmailCheckerInstalled(function(installed) {
			if (!installed) {
				$("#reducedDonation").hide();
				$("#bottomRightAdWrapper").fadeTo(1000, 1.0);
				$("#bottomArea").show();
			}
		});
	}
	
	$("#bottomRightAdWrapper").mouseenter(function() {
		$(this).find(".closeButton").css("visibility", "visible")
	}).mouseleave(function() {
		$(this).find(".closeButton").css("visibility", "hidden")
	});
	
	$("#bottomRightAdWrapper").find(".closeButton").click(function() {
		localStorage.tryMyOtherExtensionsClicked = true;
		$("#bottomRightAdWrapper").hide();
	});

	$("#bottomRightAd").click(function() {
		localStorage.tryMyOtherExtensionsClicked = true;
		setTimeout(function() {
			chrome.tabs.create({url:"http://jasonsavard.com/checkerPlusForGmail?ref=calpopup2"});
		}, 100);
	});
	
	$(".bubbleCloseButton").click(function() {
		$(this).closest(".bubble").removeClass("visible");
		$("#betaCalendar").fullCalendar('unselect');
	});
	
	if (pref("hideByJason")) {
		$("#by").hide();
	}
	
	var colors = bg.cachedFeeds["colors"];
	$.each(bg.getArrayOfCalendars(), function(index, calendar) {
		if (/owner|writer/i.test(calendar.accessRole)) {
			if (!calendar.hidden) {				
				var calendarName = getCalendarName(calendar);		
				var bgColor = colors.calendar[calendar.colorId].background;
				var $option = $("<option/>").text(calendarName).css("color", darkenColor(bgColor));				
				$option.data("calendar", calendar);				
				
				// load quick add calendar dropdown
				$("#quickAddCalendars").append( $option );
				
				// load create bubble calendar dropdown
				// must clone it and re-add data to cloned object or else it's lost
				var $clonedOption = $option.clone();
				$clonedOption.data("calendar", calendar);
				$("#bubbleCalendar").append( $clonedOption );
			}
		}				
	});
	
	var col1 = "85px"
	if (getMessage("what").length >= 10) {
		col1 = "110px";
	}
	$("#createEventBubble col").attr("width", col1);

	$("#bubbleWhatRadio, #bubbleWhat").click(function() {
		$("#bubbleWhat").attr("placeholder", "");
		$("#bubbleWhat2").css("opacity", "0.3");
		//$("#bubbleDescriptionWrapper").fadeOut();
		$("#bubbleWhatRadio").get(0).checked = true;
		if ($("#bubbleDescription").val() == descriptionFromPage) {
			$("#bubbleDescription").val("");
		}
	});
	$("#bubbleWhatRadio2, #bubbleWhat2").click(function() {
		$("#bubbleWhat2").css("opacity", "1");
		//$("#bubbleDescriptionWrapper").fadeIn();
		$("#bubbleWhatRadio2").get(0).checked = true;
		if ($("#bubbleDescription").val() == "") {
			$("#bubbleDescription").val(descriptionFromPage);
		}
	});
	

	$("#bubbleWhat").keydown(function(e) {
		console.log("bubble what keydown: " + e.keyCode)
		if (e.keyCode == 9) {
			$("#bubbleDescription").focus();
			return false;
		}
		return true;
	});
	
	// Set values...
	$("#bubbleCreateEvent, #bubbleEditEventDetails").click(function() {
		if ($("#bubbleWhatRadio").get(0).checked) {
			whatLabel = "click" // is really just 'from scratch' but kept the 'click' for history stats
			whatValue = $("#bubbleWhat").val();
		} else {
			whatLabel = "window title";
			whatValue = $("#bubbleWhat2").val();
		}
		description = $("#bubbleDescription").val();
	});
	$("#bubbleCreateEvent").click(function(e) {
		if (donationClicked("createEvent")) {
			// validate form
			if ($("#bubbleWhatRadio").get(0).checked && !$("#bubbleWhat").val()) {
				$("#bubbleWhat")
					.css("outline", "2px solid red")
					.focus()
					.select()
				;
				return;
			} else {
				$("#bubbleWhat").css("outline", "none");
			}
			
			$("#createEventBubble").removeClass("visible");
			
			sendGA(['_trackEvent', 'createEvent', whatLabel]);
			
			var eventEntry = new EventEntry(whatValue, bubbleDate, description, $("#bubbleCalendar option:selected").data("calendar") );
			
			var selectionParams = $("#createEventBubble").data("selectionParams");
			if (selectionParams.end) {
				eventEntry.endTime = selectionParams.end;
				eventEntry.quickAdd = false;
				
				eventEntry.allDay = selectionParams.allDay;
				
				// patch: for difference between fullcalendar and google calendar api: the end day for google api must be +1 day to equal fullcalendar
				if (selectionParams.allDay) {
					eventEntry.endTime.setDate(eventEntry.endTime.getDate()+1);
				}
				
				saveAndLoadInCalendar(false, eventEntry);
			} else {
				eventEntry.allDay = true;
				saveAndLoadInCalendar(true, eventEntry);
			}
			
		}
	});	
	$("#bubbleEditEventDetails").click(function(e) {
		var eventEntry = {summary:whatValue, allDay:true, startTime:bubbleDate, description:description, calendarURL:$("#bubbleCalendar").val()};
		var actionLinkObj = generateActionLink("TEMPLATE", eventEntry);
		var url = actionLinkObj.url + "?" + actionLinkObj.data;
		chrome.tabs.create({url:url});
		setTimeout(function() {
			window.close();
		}, 200);				
	});

	$("#createEventBubbleForm").submit(function() {
		// commented this below because it is already submitted
		//$("#bubbleCreateEvent").click();
		return false;
	});

	$("#quickAdd").click(function() {
		$(this).attr("placeholder", "");
	}).keypress(function(e) {
		
		$("#headerTitle").hide();
		$("#quickAddWrapper").addClass("selected")
		$("#quickAddCalendars")			
			.fadeIn()
		;
		$("#save").fadeIn()
		
		// enter pressed
		if (e.which == 13) {
			$("#save").click();
		}
	});

	$("#loginForm").submit(function() {
		return false;
	});
	
	$("#topStatusMessageWrapper").mouseenter(function() {
		$(this).stop(true).css("opacity", 1);
	}).mouseleave(function() {
		$(this).stop().delay(600).fadeOut("slow");
	});
	
	$("#grantFacebookPermission").click(function() {
		chrome.permissions.request({
			origins: [bg.FACEBOOK_PERMISSION_HOST]
		}, function(granted) {
			if (granted) {
				location.reload(true);
			} else {
				$("#eventWrapper").hide();
			}
		});
	});
	
	chrome.notifications.getAll(function(notifications) {
		if (!$.isEmptyObject(notifications)) {
			$("#pendingNotifications").slideDown();
		}
	});
	
	$("#pendingNotifications").click(function() {
		openSnoozePopup();
		window.close();
	});
	
	// patch for mac because autofocus didn't work in Chrome 26
	/*
	if (navigator.platform.toLowerCase().indexOf("mac") != -1) {
		setTimeout(function() {
			$("#quickAdd").focus();
		}, 100);
	}
	*/
	
	// legacy because agenda embed calendar was not working within an iframe so dumped it
	if (calendarType == "agenda") {
		$("#calendarWrapper").empty().html("<br><br>This view is not supported anymore! Try the many other view choices by clicking View at the top right")
		$("#calendarView").show();
	}
	
    // must be at the END*****
	initPrefAttributes();
	initOptions();
	
});