var bg = chrome.extension.getBackgroundPage();
var currentNotificationNode;
var $lastNotificationBeingHovered;
var expandTitleTimeout;
var lastSnoozeType;
var notificationsShown;
var snoozeTimesWidth;
var idleTimeout;
var windowRecentlyResized = false;
var windowRecentlyResizedTimeout;
var MAX_CHROME_WINDOW_HEIGHT = 160;
var MAX_NOTIFICATION_AREA_HEIGHT = MAX_CHROME_WINDOW_HEIGHT - 8 // buffer for margins etc.
var ratio = 1;
var defaultFontSize = pref("notificationFontSize", "26");

var eventsShown = bg.eventsShown;
var snoozers = bg.snoozers;
var notificationsQueue = bg.notificationsQueue;

var INTERVAL_IN_MINUTES = 30;
//var sliderMax = 60 / 5 * 24; // on hour divided by 5 minutes intervals * the whole day
//sliderMax -= 1; // subtract one because we don't want to display the same time for the next day
var SLIDER_NOTCHES_RESERVED_FOR_DAYS = 7;
var sliderNotches;
var mouseDown;
var mouseDownTime;
var lastMouseX;
var lastMouseY;

if (pref("drawAttentionToBrowser")) {
	chrome.windows.getCurrent(function(window) {
		bg.console.log("in notif-curen window: " + window.id)
		if (!window.focused) {
			bg.drawAttentionDate = today();
			chrome.windows.update(window.id, {drawAttention:true});
		}
	});
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	switch (message.name) {
		case "addNewNotifications":
			var $notificationsInPopup = $(".notification");
			var newNotifications = [];
			$.each(notificationsQueue, function(a, notification) {
				var found = false;
				$notificationsInPopup.each(function(index) {
					if (isSameEvent($(this).data("data").event, notification.event)) {
						found = true;
						return false;
					}
					return true;
				});
				if (!found) {
					newNotifications.push(notification);
				}
			});
			if (newNotifications.length >=1) {
				addNotifications(newNotifications, true);
				updateTimeElapsed();
			}
			sendResponse({});
			break;
		case "savedButtonClickedFromEventPage":
			// save (or delete) meaning probably reschedule so close/dimiss the event in the notifications
			var eidFromOpenTab = getUrlValue(message.url, "eid");
			if (eidFromOpenTab) {
				$(".notification").each(function(index) {
					var notification = getNotification($(this));
					var eidFromNotificationEvent = getUrlValue(notification.event.url, "eid");
					if (eidFromNotificationEvent == eidFromOpenTab) {
						closeNotification(getNotificationNode(this));
						return false;
					}
					return true;
				});
			}
			break;
	}
});
function SnoozeObj(time, currentEvent, reminderTime) {
	this.time = time;
	this.event = currentEvent;
	this.reminderTime = reminderTime;
	this.email = bg.email;
}
function setSnoozeInMinutes(notification, minutes) {
	setSnoozeDate(notification, new Date(now() + 1000 * 60 * minutes));
}
function setSnoozeDate(notification, time) {
	
	// remove first then add again
	removeSnoozer(notification.event);
	
	var snooze = new SnoozeObj(time, notification.event, notification.reminderTime); // last # = minutes
	snoozers.push(snooze);
	localStorage["snoozers"] = JSON.stringify(snoozers);
}

function updateTimeElapsed() {
	$("#currentDate").text(today().format(getMessage("notificationDateFormat")));
	
	$(".notification").each(function(index) {
		var notification = $(this).data("data");
		var event = notification.event;
		
		var timeElapsedMsg = null;
		var diffInDays = event.startTime.diffInDays();
		if (event.allDay) {
			if (isYesterday(event.startTime)) {
				timeElapsedMsg = getMessage("yesterday");
			} else if (isTomorrow(event.startTime)) {
				timeElapsedMsg = getMessage("tomorrow");
			} else if (!isToday(event.startTime)) {				
				if (diffInDays > 0) {
					timeElapsedMsg = getMessage("daysLeft", diffInDays + "");
				} else {
					timeElapsedMsg = getMessage("daysAgo", Math.abs(diffInDays) + "");
				}
			}
		} else {
			var diff = (now() - event.startTime.getTime()) / ONE_MINUTE;
			
			var diffInHours = Math.abs(diff / 60);
			if (diffInHours <= 2) {
				diffInHours = diffInHours.toFixed(1).replace(".0", "");
			} else {
				diffInHours = diffInHours.toFixed(0);
			}
			
			if (diff <= -(60 * 24)) {				
				timeElapsedMsg = getMessage("daysLeft", Math.abs(Math.ceil(diff / 60 / 24)) + "");
			} else if (diff <= -60) {
				timeElapsedMsg = getMessage("hoursLeft", diffInHours);
			} else if (diff <= 0) {
				timeElapsedMsg = getMessage("minutesLeft", Math.abs(Math.floor(diff)) + "");
			} else if (diff <= 2) {
				// Just happened so do nothing
			} else if (diff < 60) {
				timeElapsedMsg = getMessage("minutesAgo", Math.floor(diff) + "");
			} else if (isYesterday(event.startTime)) {
				timeElapsedMsg = getMessage("yesterday");
			} else if (diff < 60 * 24) {
				timeElapsedMsg = getMessage("hoursAgo", diffInHours);
			} else {
				timeElapsedMsg = getMessage("daysAgo", Math.abs(diffInDays) + "");
			}
		}
		var $timeElapsed = $(this).find(".timeElapsed");
		if (timeElapsedMsg) {
			$timeElapsed.html("(" + timeElapsedMsg + ")");
			/*
			// if not at the beginning then place a space before the time elapsed
			if ($timeElapsed.offset().left > 10) {
				$timeElapsed.css("margin-left", 4);
			}
			*/
			$timeElapsed.slideDown("slow");
		} else {
			//$timeElapsed.hide();
		}
	});
}

function closeWindow() {
	bg.notificationWindowClosedViaLinks = true;
	window.close();
}

function getNotificationsHeight() {
	var $lastNotification = $(".notification").last(); 
	return $("#notificationsWrapper").scrollTop() + $lastNotification.offset().top + $lastNotification.height();
}

function setFontSizeByRatio($nodes, ratio) {
	var fontAndLineHeight = calculateNewValue(ratio, defaultFontSize, pref("notificationFontSizeSmallest", "14")) + "px";
	$nodes.css({"font-size": fontAndLineHeight, "line-height": fontAndLineHeight});
}

function setHeightsByRatio(ratio) {
	console.log("ratio: " + ratio);
	var paddingTop = calculateNewValue(ratio, 3, 2) + "px";
	var paddingBottom = calculateNewValue(ratio, 7, 2) + "px";
	$(".notification").css({"padding-top":paddingTop, "padding-bottom":paddingBottom});
	setFontSizeByRatio($(".title, #calculateFontWidth"), ratio);
	var marginTop = ($("#calculateFontWidth").height() / 2) - 5;
	$(".commands").css({"margin-top": marginTop});
}

function removeScrollBars() {
	console.log("remoe scroll bars overflow: " + $("#notificationsWrapper").css("overflow-y"));
	$("#notificationsWrapper").css("overflow-y", "hidden");
	$("#notificationsWrapper").css("height", "100%");
	
	//$("html").removeClass("addScrollBar");
	//$("html").height($("body").height());
	//$("html").width("300px")
}

function updateNotifications(resizeTitle) {
	var DELAY_TO_WAIT_FOR_DOM_RESIZING = 120;
	var notificationsLength = $(".notification").length; 
	if (notificationsLength == 0) {
		closeWindow();
	} else if (notificationsLength == 1) {
		$("#allCommands").hide();
		
		if (isEligibleForReducedDonation() && !localStorage.clickedReducedDonationAd) {
			if (!pref("donationClicked")) {
				$("#reducedDonationAd")
					.fadeIn()
				;
			}
		}
		
		if (daysElapsedSinceFirstInstalled() >= 3 && daysElapsedSinceFirstInstalled() <= 14 && !localStorage.clickedGmailCheckerAd) { //isEligibleForFreeUnlocking()) {				
			$("#unlockForFree").fadeIn();
			chrome.runtime.sendMessage("oeopbcgkkoapgobdbedcemjljbihmemj", {}, function(response) { //oeopbcgkkoapgobdbedcemjljbihmemj
			    if (response.installed) {
			    	$("#unlockForFree").hide();
			    }
			  });						
		}
	} else {
		$(".ad").hide();
		$("#allCommands").fadeIn();
	}
	
	if (resizeTitle) {
		$("#notificationsWrapper").css("opacity", 0);
		$("#notificationsWrapper").css("overflow-y", "hidden");
		$(".title").css("font-size", defaultFontSize);
		setHeightsByRatio(1);

		setTimeout(function() {
			var notificationsHeight = getNotificationsHeight();
			console.log("would be height: " + notificationsHeight)
			if (notificationsHeight > MAX_NOTIFICATION_AREA_HEIGHT) {
				ratio = MAX_NOTIFICATION_AREA_HEIGHT / notificationsHeight; 
				
				ratio -= 0.06;
				ratio = Math.min(1, ratio);
				
				setHeightsByRatio(ratio);				
				
				setTimeout(function() {
					$(".notification .title").each(function(index, titleElement) {
						var notification = getNotification(this); 
						setEllipsis(getSummary(notification.event), $(titleElement));
					});
					var newHeight = getNotificationsHeight();
					console.log("new height: " + newHeight)
					if (newHeight > MAX_NOTIFICATION_AREA_HEIGHT) {
						var scrollArea = $("#notificationsWrapper");
						var newScrollAreaHeight = MAX_NOTIFICATION_AREA_HEIGHT-scrollArea.offset().top + "px";
						console.log("set height: " + newScrollAreaHeight)
						scrollArea.css("height", newScrollAreaHeight);
						$("#notificationsWrapper").css("overflow-y", "auto");
						$("html").addClass("addScrollBar");
					} else {
						console.log("height 100%")
						removeScrollBars();
						//$("#notificationsWrapper").css("overflow-y", "auto");
					}
				}, DELAY_TO_WAIT_FOR_DOM_RESIZING);
			} else {
				console.log("height2 100%")
				removeScrollBars();
				//$("#notificationsWrapper").css("overflow-y", "auto");
			}
			$("#notificationsWrapper").css("opacity", 1);
		}, DELAY_TO_WAIT_FOR_DOM_RESIZING)
		
		/*
		setTimeout(function() {
			var notificationsHeight = getNotificationsHeight();
			
			adjustHeights(notificationsHeight);
			if ($(window).height() < MAX_CHROME_WINDOW_HEIGHT || notificationsHeight < MAX_CHROME_WINDOW_HEIGHT) {
				$("#notificationsWrapper").css("height", "100%");
			}
			// need to wait for adjustheights			
			setTimeout(function() {
				var notificationsHeight = getNotificationsHeight();
				var scrollArea = $("#notificationsWrapper");
				var buffer = 5;
				if (scrollArea.offset().top - buffer + notificationsHeight >= $(window).height()) {
					console.log("height: " + (scrollArea.offset().top - buffer + notificationsHeight) + " " + $(window).height() + " offset: " + scrollArea.offset().top)
					console.log("set new height: " + ($(window).height()-scrollArea.offset().top) + "px" + " winheigh: " + $(window).height() + " notificationsHeight: " + notificationsHeight);
					scrollArea.css("height", $(window).height()-scrollArea.offset().top + "px");
				} else {
					console.log("set height auto/100")
					$("#notificationsWrapper").css("height", "100%");
				}
			}, 300);
		}, 300);
		*/
	} else {
		setTimeout(function() {
			var height = getNotificationsHeight();
			console.log("height: "  + height);
			if (height <= MAX_NOTIFICATION_AREA_HEIGHT) {
				removeScrollBars();
			}
		}, DELAY_TO_WAIT_FOR_DOM_RESIZING);
	}
}

function getNotification(o) {
	return getNotificationNode(o).data("data");
}

function getNotificationNode(o) {
	if (o) {
		return $(o).closest(".notification");
	} else {
		return currentNotificationNode;
	}
}

function showNotificationCallback(notificationNode, notificationWindowAlreadyVisible) {
	if (--notificationsShown == 0) {
		updateNotifications(true);
	}
}

function calculateNewValue(ratio, max, min) {
	var valueInRange = Math.ceil(max * ratio);
	return Math.max(min, valueInRange);
}

function setEllipsis(titleStr, $titleNode) {
	// calculate 2 lines of text minus Snooze/Dismiss area			
	var widthAllowed = (294 * 2) - 98 + 0; // 294(width) * 2(lines) - 98(commands) + (buffer because c'mon not every letter is a big 'O')
	var maxLetters = (widthAllowed / $("#calculateFontWidth").width()) + 8; // (buffer because c'mon not every letter is a big 'O')
	if (titleStr.length > maxLetters) {
		$titleNode.text(titleStr.substring(0, maxLetters) + "...");
	} else {
		$titleNode.text(titleStr);
	}
}

function addNotifications(notifications, notificationWindowAlreadyVisible) {
	notificationsShown = notifications.length;
	
	// Update this only if a new event has been added which is the default scenario to this method
	bg.console.log("addnotifcation shown date: " + today());
	bg.lastNotificationShownDate = today();

	$.each(notifications, function(a, notification) {
		var $notificationNode = $(".notificationTEMPLATE").clone();
		$notificationNode.removeClass('notificationTEMPLATE').addClass('notification');
		$notificationNode.css("background", "-webkit-gradient(linear, left top, left bottom, from(#fff), to(" + pref("backgroundOfNotification", "#f1f1f1") + ")) no-repeat");
		
		// patch for when user zooms with browser (note: to zoom the notification window you can open the options paeg of the extension while notification is open and it will zoom it)
		if ($(window).width() < 300) {
			$notificationNode.css("width", $(window).width());
		}
				
		var event = notification.event;
		console.log("e: ", event);
		$notificationNode.data("data", notification);
		
		var linkInDescription = null;
		if (event.description) {
			var matches = event.description.match(/(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/i);
			if (matches) {
				linkInDescription = $.trim(matches[0]);
			}
		}
		
		//var cal = bg.getCalendarFromEvent(event);
		
		if (linkInDescription) {
			// .show() does not work here so used .css("display", "block") instead
			$notificationNode.find(".linkInDescriptionWrapper").css("display", "block");
			//var formattedLink = linkInDescription.replace(/(^https?|^ftps?)?\:\/\/(www.)?/g, "");
			var formattedLink = linkInDescription.replace(/(www.)?/g, "");
			$notificationNode.find(".linkInDescription").text(formattedLink).attr("href", linkInDescription);
		} else {
			//$notificationNode.find(".calendar").css("margin-left", "6px");
		}
		
		var $title = $notificationNode.find(".title");
		/*
		$.each([$title, $("#calculateFontWidth")], function(index, value) {
			value.css("font-size", defaultFontSize + "px");
		});		
		*/
		
		setFontSizeByRatio($title.add("#calculateFontWidth"), ratio);
		console.log(event);
		setEllipsis(getSummary(event), $title);
		console.log("after");
		
		var css = pref("oauth") ? {color:darkenColor(event.calendar.backgroundColor)} : {color:event.calendar.color};

		$title.addClass("colored");			
		$title.add($notificationNode.find(".linkInDescription")).css(css);

		// show calendar name if not the main one
		var mainCalendarFlag;
		if (pref("oauth")) {
			mainCalendarFlag = event.calendar.id == bg.defaultCalendar.id;
		} else {
			mainCalendarFlag = event.calendar.main;
		}
		
		if (!mainCalendarFlag) {
			$notificationNode.find(".calendar").css(css).text("(" + getSummary(event.calendar) + ")").removeClass("hide");					
		}
		
		/*
		if ($("#titleAndCalendar").height() >= 68) {
			$("#titleAndCalendar").css("font-size", pref("notificationFontSizeSmallest", "18") + "px");
		}
		*/
		
		$("#notificationsWrapper").prepend($notificationNode);

		if (notificationWindowAlreadyVisible) {
			// temporarily hide the commands because making the new added item jump
			$notificationNode.find(".title, .commands").hide();
			$notificationNode.slideDown("slow", function() {
				$notificationNode.find(".title, .commands").fadeIn();
				showNotificationCallback($(this), notificationWindowAlreadyVisible);
			});
		} else {
			$notificationNode.show();
			showNotificationCallback($(this), notificationWindowAlreadyVisible);
		}
	});
}

function markReminderTimeAsShown(event, reminderTime, eventToModify) {
	eventToModify.startTime = event.startTime;
	if (reminderTime) {
		//log(getSummary(event) + " remindertime", "showConsoleMessagesEventsSnoozes");
		if (pref("oauth")) {
			if (!eventToModify.reminderTimes) {
				eventToModify.reminderTimes = [];
			}
			eventToModify.reminderTimes.push({time:reminderTime, shown:true});
		} else {
			$.each(event.reminderTimes, function(a, thisReminderTime) {
				if (thisReminderTime.time.getTime() == reminderTime.getTime()) {
					log(getSummary(event) + " mark as shown", "showConsoleMessagesEventsSnoozes");
					// bug from natebyron@gmail.com that was returning TypeError: Cannot set property 'time' of undefined this happens when the reminderTimes[a] is null OR reminderTimes = [] (empty)
					if (!eventToModify.reminderTimes) {
						eventToModify.reminderTimes = [];
					}
					if (a >= eventToModify.reminderTimes.length) {
						console.log("nate bug: a=" + (a) + " reminderTimes len: " + eventToModify.reminderTimes.length);
						eventToModify.reminderTimes[a] = {};
					}
					
					eventToModify.reminderTimes[a].time = reminderTime;
					eventToModify.reminderTimes[a].shown = true;
					return false;
				}
				return true;
			});
		}
	}
}

function findEvent(event, eventsShown) {
	for (var a=0; a<eventsShown.length; a++) {
		if (isSameEvent(eventsShown[a], event)) {
			console.log("find events");
			return eventsShown[a];
		}
	}
}

function removeSnoozer(event) {
	// Remove IF from Snoozers
	for (var a=0; a<snoozers.length; a++) {
		var snoozer = snoozers[a];
		bg.console.log("snooze found")
		//if (isSameUrl(event.url, snoozer.event.url) && snoozer.time.getTime() < now()) {
		if (isSameEvent(event, snoozer.event)) {
			//if (snoozer.time.getTime() < now()) {
			//if (lastAction == "snooze") {
				// do nothing
			//} else {
				//if (lastAction != "snooze") {
					bg.console.log("remove snooze")
					snoozers.splice(a, 1);
					a--;
				//}
			//}
			break;
		}
	}
	localStorage["snoozers"] = JSON.stringify(snoozers);
}

function closeNotification(notificationNode, lastAction) {
	var notification = notificationNode.data("data");
	var event = notification.event;
	var reminderTime = notification.reminderTime;
	// mark event as shown
	var strippedEvent = $.extend(true, {}, event);
	strippedEvent.title = "";
	strippedEvent.location = "";
	strippedEvent.attendeeStatus = "";
	console.log("event: ", event);		

	// Update eventsShown with stripped event
	var eventToModify = findEvent(event, eventsShown);
	
	console.log("lastactin: ", lastAction);
	console.log("eventToModify: ", eventToModify);
	if (eventToModify) {
		markReminderTimeAsShown(event, reminderTime, eventToModify);
	} else {
		markReminderTimeAsShown(event, reminderTime, strippedEvent);
		eventsShown.push(strippedEvent);
	}
	
	if (lastAction != "snooze") {
		removeSnoozer(event);
	}

	for (var a=0; thisNotification=notificationsQueue[a], a<notificationsQueue.length; a++) {
		if (isSameEvent(event, thisNotification.event)) {
			notificationsQueue.splice(a, 1);
			a--;
			break;
		}
	}
	
	// only do this if not dismissall because or else this process is long and delays the closing of the window for a few seconds
	if (lastAction != "dismissAll") {		
		bg.serializeEventsShown();
		//localStorage["eventsShown"] = JSON.stringify(eventsShown);

		if ($(".notification").length == 1) { // last one then no animation just close
			closeWindow();
		} else {
			notificationNode.slideUp("fast", function() {
				$(this).remove();
				updateNotifications();
			});
		}
	}
}

function snoozeAndClose($notificationNode, snoozeParams) {
	var notification = getNotification($notificationNode);
	
	if (snoozeParams.snoozeTime) {
		setSnoozeDate(notification, snoozeParams.snoozeTime);
	} else if (snoozeParams.inMinutes) {
		setSnoozeInMinutes(notification, snoozeParams.inMinutes);
	} else { // in days
		var daysToSnooze = snoozeParams.inDays;
		var snoozeToThisDay = today();
		snoozeToThisDay.setDate(snoozeToThisDay.getDate()+parseInt(daysToSnooze));
		snoozeToThisDay.setHours(5);
		snoozeToThisDay.setMinutes(0);
		snoozeToThisDay.setSeconds(0);
    	setSnoozeDate(notification, snoozeToThisDay);
	}

	$("#snoozeTimes").fadeOut(100);
	closeNotification($notificationNode, "snooze");
}

function snoozeAllAndClose(snoozeParams) {
	var notificationNodes = $(".notification");
	for (var a=notificationNodes.length-1; $notificationNode=$(notificationNodes[a]),a>=0; a--) {
		snoozeAndClose($notificationNode, snoozeParams);
	}
	closeWindow();
}

function showSnoozeTimes($snoozeLink) {
	console.log("show snooze")
	if (!windowRecentlyResized) {
		console.log("passed recenrezised")
		var $notificationNode = getNotificationNode($snoozeLink);
		// if not animating then display snooze
		if (!$notificationNode.queue() || $notificationNode.queue().length == 0) {
			console.log("passed queue")
			var x = $(window).width() - $snoozeLink.offset().left - $snoozeLink.width() - 10; // shrink so snoozetimes to cover snozoe button so it doenst popup out twice
			var y = $snoozeLink.offset().top - 20; // original was (- 1)
			var delay;
			if ($snoozeLink.attr("id") == "snoozeAll") {
				lastSnoozeType = "ALL"
				delay = 0;
				$("#snoozeTimes").addClass("all")
				$("#snoozeTimes").css("top", "-4px");
				$("#snoozeTimes").css("right", (x - 10) + "px");
			} else {
				lastSnoozeType = "";
				delay = 100;
				$("#snoozeTimes").removeClass("all")
				$("#snoozeTimes").css("top", y + "px");
				$("#snoozeTimes").css("right", x + "px");
			}
			currentNotificationNode = getNotificationNode($snoozeLink);
			currentNotificationNode.addClass("snoozeHover");
			//$("#snoozeTimes").fadeIn(200);			
			$("#snoozeTimes").css("width", "1%");
			$("#snoozeTimes").css("opacity", "0");
			//$("#snoozeTimes").addClass("scrolling");
			$("#snoozeTimes").show();		
			$("#snoozeTimes").delay(delay).animate({width:snoozeTimesWidth, opacity:1}, 200, "swing", function() {
				//console.log('add hover')
				//$("#snoozeTimes a").last().addClass("hover");
				
				//setTimeout(function() {
					//$("#snoozeTimes").removeClass("scrolling");
				//}, 300);
			});
		}
	}

	// init slider
	var maxTime = new Date();
	maxTime.setHours(24);
	maxTime.setMinutes(0);

	sliderNotches = getSliderNotchesForThisTime(maxTime);
	sliderNotches = parseInt(sliderNotches);
	sliderNotches += SLIDER_NOTCHES_RESERVED_FOR_DAYS; // add days
	sliderNotches += 1; // because we substracted one when calculating .change ??? (val-1)
	
	$("#snoozeSlider").attr("max", sliderNotches);
}

function getSliderNotchesForThisTime(offsetTime) {
	var currentTime = new Date();
	return offsetTime.diffInMinutes(currentTime) / INTERVAL_IN_MINUTES;
}

function resetIdle(delay) {
	if (!delay) {
		delay = 1200;
	}
	clearTimeout(idleTimeout);
	idleTimeout = setTimeout(function() {
		console.log("queue: " + $("#sliderWarning").queue().length)
		if ($("#sliderWarning").queue().length == 0) {
			hideSnoozeTimes(true);
		}
	}, delay);
}

function hideSnoozeTimes(fadeOut) {
	$("#snoozeTimes").stop(true);
	if (fadeOut) {
		$("#snoozeTimes").fadeOut();
	} else {
		$("#snoozeTimes").hide();
	}
	$(".notification").removeClass("snoozeHover");
	$("#snoozeTimes a").removeClass("hover");
}

function onDismissMouseMove() {
	$(".notification").removeClass("snoozeHover");
	hideSnoozeTimes();
}

function updateExactSnoozeTimeDisplay(params) { //snoozeTime, daysAway
	if (params.snoozeTime) {
		$("#exactSnoozeTime")
			.text( bg.formatTime(params.snoozeTime) )
			.data("snoozeTime", params.snoozeTime)
		;
	} else {
		var snoozeTime = new Date();
		snoozeTime.setDate(snoozeTime.getDate()+parseInt(params.daysOffset));
		snoozeTime.setHours(5);
		snoozeTime.setMinutes(0);
		snoozeTime.setSeconds(0);

		var dayStr;
		if (params.daysOffset == 1) {
			dayStr = getMessage("tomorrow");
		} else {
			dayStr = snoozeTime.format("dddd");
		}
		
		$("#exactSnoozeTime")
			.text(params.daysOffset + getMessage("d") + " (" + dayStr + ")")
			.data("snoozeTime", snoozeTime)
		;
	}
}

function isSliderInSnoozeByDaysRegion($slider) {
	var val = parseInt($slider.val());
	return val > sliderNotches - SLIDER_NOTCHES_RESERVED_FOR_DAYS;	
}

$(document).ready(function() {
	
	var lang = pref("lang", window.navigator.language);
	
	if (pref("testMode")) {
		$("#snoozeTimes *[snoozeInMinutes='5']").attr("snoozeInMinutes", 1);
	}
	
	$("html").attr("lang", lang);

	var defaultZoom = 100;
	var zoom = pref("notificationZoom", defaultZoom); 
	if (zoom != defaultZoom) {
		$("body").css("zoom", zoom + "%");
		
		// patch for jQuery offset method...
		/*
		(function($) {
			$.fn.offsetOld = $.fn.offset; $.fn.offset = function() {
				var result = this.offsetOld();
				result.top -= window.scrollY;
				result.left -= window.scrollX + (180-zoom);
				return result;
			};
		})(jQuery);
		*/
		
		(function($){
			$.fn.offsetOld = $.fn.offset; $.fn.offset = function() {
				var result = this.offsetOld();
		        var top = result.top, left = result.left;
		        var offsetMultiplier = 1;
		        if (document.body && document.body.getBoundingClientRect) {
		            var bound = document.body.getBoundingClientRect();
		            offsetMultiplier = parseFloat(Math.round(((bound.right - bound.left) / $(window).width()) * 100)) / 100;
		            if (isNaN(offsetMultiplier)) {
		                offsetMultiplier = 1;
		            }
		            //top = Math.round(top / offsetMultiplier),
		            left = Math.round(left / offsetMultiplier);
		        }
		        return { top: top, left: left, offsetMultiplier: offsetMultiplier };
		    };
		})(jQuery);
		
	}

	//if (getUrlValue(location.href, "testNotification")) {
//			var testQueue = [];
		//var testEvent = {title:"Test", description:"Test description"};
		//testQueue.push({event:testEvent});
		//addNotifications(testQueue);
	//} else {
		addNotifications(notificationsQueue);
	//}

	$(window).resize(function() {
		console.log("resize");
		windowRecentlyResized = true;
		clearTimeout(windowRecentlyResizedTimeout);
		windowRecentlyResizedTimeout = setTimeout(function() {
			windowRecentlyResized = false;
		}, 300);
	});
	
	if (!pref("donationClicked")) {
		$("#snoozeTimes a[snoozeInDays]").addClass("donationFeature");
	}
	
	$("#notificationsWrapper").on("click", ".title", function() {
		$(this).addClass("clickedEffect"); //.fadeIn().delay(1000).fadeIn().removeClass("clickedEffect");
		var notification = getNotification(this);
		
		var url = pref("oauth") ? notification.event.htmlLink : notification.event.url;
		
		createTab({url:url, urlToFind:notification.event.id}, function() {
			//closeNotification(notificationNode);
		});
	})
	
	$("#notificationsWrapper").on("mouseenter mouseleave", ".title", function(e) {
		console.log("in wrap: " + e.type);
		if (e.type == "mouseleave") {
			clearTimeout(expandTitleTimeout);
		} else if (e.type == "mouseenter") {
			$lastNotificationBeingHovered = getNotificationNode(this);
			expandTitleTimeout = setTimeout(function() {
				var notification = getNotification($lastNotificationBeingHovered);
				//$lastNotificationBeingHovered.find(".title").text(notification.event.title);
				var description = notification.event.description
				if (!description) {
					description = "<span style='white-space:nowrap'>(" + getMessage("noDetails") + ")</span>";
				}
				$("#details").hide().html("<span class='titleInPopupDescription'>" + getSummary(notification.event) + "</span>" + description).fadeIn();
				//$("#details").css("max-height", $("#notificationsWrapper").height()-18);
				$("#detailsWrapper").css("left", e.pageX + 2);
				$("#detailsWrapper").css("width", $(window).width()- e.pageX);
				$("#detailsWrapper").css("display", "-webkit-box");
				$("#detailsWrapper, #details").off().on("mousedown", function() {
					console.log("detailswrapper click probably instead of the title");
					$lastNotificationBeingHovered.find(".title").click();
				});
			}, 800);
		}
	});
	
	$("#notificationsWrapper").on("click", ".linkInDescription", function() {
		createTab($(this).attr("href"));
	});
	
	snoozeTimesWidth = $("#snoozeTimes").width();
	
	$("#snoozeTimes a").on("mousemove mouseenter", function() {
		// do not enable hovering until the expand animation is complete
		if ($("#snoozeTimes").queue().length == 0) {				
			$("#snoozeTimes a").removeClass("hover");
			$(this).addClass("hover");
			var snoozeInMinutes = $(this).attr("snoozeInMinutes");
			if (snoozeInMinutes) {
				snoozeInMinutes = parseInt(snoozeInMinutes);
				//Date.now()
				//new Date("Sun Aug 26 2012 20:22:41 GMT-0400 (Eastern Daylight Time)")
				var snoozeTime = new Date(Date.now() + (ONE_MINUTE * snoozeInMinutes));
				var sliderNotchesForThisSnoozeTime = getSliderNotchesForThisTime(snoozeTime);
				
				// if snoozeinminutes crossers over to next tomorrow then set the slider to tomorrow (or else the slider might go the left of tomorrow
				if (sliderNotchesForThisSnoozeTime >= sliderNotches - SLIDER_NOTCHES_RESERVED_FOR_DAYS) {
					$("#snoozeSlider").val(sliderNotches - SLIDER_NOTCHES_RESERVED_FOR_DAYS);
				} else {
					$("#snoozeSlider").val(sliderNotchesForThisSnoozeTime);
				}
					
				updateExactSnoozeTimeDisplay({snoozeTime:snoozeTime});
			} else { // snooze n days
				var daysOffset = parseInt($(this).attr("snoozeInDays"));
				$("#snoozeSlider").val(sliderNotches - (SLIDER_NOTCHES_RESERVED_FOR_DAYS-daysOffset));
				updateExactSnoozeTimeDisplay({daysOffset:daysOffset});
			}
		}
	});

	$("#notificationsWrapper").on("click mouseenter", ".snooze", function() {
		console.log("mouseenter snooze");
		showSnoozeTimes($(this));
	});
	
	$("#snoozeAll").click(function() {
		showSnoozeTimes($(this));
	});
	
	$("#snoozeTimes").mousemove(function(e) {
		resetIdle();
		e.stopPropagation(); // must do this so the body mousemove is not triggered, note: must be consistent with live mousemove or .mousemove
	});
	
	$("body").mousemove(function(e) {
		
		// it appears that a mousemose event is trigger if focus of mouse returns to body after having been focused on a hovering layer, so use coordinates to determine if really did move
		if (e.pageX != lastMouseX && e.pageY != lastMouseY) {
			console.log("mousemove body: " + e.pageX + " " + e.pageY);
			resetIdle();
			$("#detailsWrapper").fadeOut("fast");
			if ($("#snoozeTimes").width() > 30) { // body mousemove is triggered before the snoozetimes expands so stop it if it's about to grow
				hideSnoozeTimes();
			}
		}
		
		lastMouseX = e.pageX;
		lastMouseY = e.pageY;
		
	});

	$("#snoozeTimes *[snoozeInMinutes], #snoozeTimes *[snoozeInDays]").click(function() {
		var snoozeParams = {inMinutes:$(this).attr("snoozeInMinutes"), inDays:$(this).attr("snoozeInDays")};
		if (snoozeParams.inMinutes || (snoozeParams.inDays && donationClicked("snooze"))) {
			if (lastSnoozeType == "ALL") {
				snoozeAllAndClose(snoozeParams);
			} else {
				snoozeAndClose(getNotificationNode(), snoozeParams);
			}
		}
	});
	
	$("#header #dismissAll").mousemove(function() {
		onDismissMouseMove();
	});
	

	$("#notificationsWrapper").on("mousemove", ".dismiss", function() {
		onDismissMouseMove();
	});		
	
	$("#notificationsWrapper").on("click", ".dismiss", function() {
		closeNotification(getNotificationNode(this));
	});
	
	$("#header #dismissAll").click(function() {
		$(".notification").each(function() {
			closeNotification($(this), "dismissAll");
		});
		
		// Do this after because processing each closeNotification because it is not performed inside closeNotification if dismissall is passed
		bg.serializeEventsShown();
		closeWindow();
	});
			
	$("html").mousedown(function(e) {
		if (e.button == 2) {
			//window.close();
		}
	});
	
	$("#currentDate").click(function() {
		createTab(getProtocol() + "://www.google.com/calendar");
		return false;
	});
	
	$("#unlockForFree").click(function() {
		localStorage.clickedGmailCheckerAd = true;
		$(this).fadeOut();
		createTab("https://chrome.google.com/webstore/detail/oeopbcgkkoapgobdbedcemjljbihmemj?ref=calpopupnotif");
	});

	$("#reducedDonationAd").click(function() {
		localStorage.clickedReducedDonationAd = true;
		$(this).fadeOut();
		createTab("donate.html");
	});

	$("#snoozeSlider")
		.val(1)
		.hover(function() {
			$("#snoozeTimes a").removeClass("hover");
		})
		.hover(function() {
			$("#snoozeTimes").addClass("hoveringSlider");
		}, function() {
			$("#snoozeTimes").removeClass("hoveringSlider");
		})
		.mousedown(function() {
			mouseDown = true;
			mouseDownTime = Date.now();
		})
		.mouseup(function() {
			mouseDown = false;
			
			// too fast, must have just clicked
			if (Date.now() - mouseDownTime < 300) {
				$("#sliderWarning").fadeIn().delay(1000).fadeOut();
				resetIdle();
			} else { // good, we dragged dropped
				var sliderInSnoozeByDaysRegion = isSliderInSnoozeByDaysRegion($(this));
				if (!sliderInSnoozeByDaysRegion || (sliderInSnoozeByDaysRegion && donationClicked("snooze"))) {
					var snoozeParams = {snoozeTime:$("#exactSnoozeTime").data("snoozeTime")};
					
					if (lastSnoozeType == "ALL") {
						snoozeAllAndClose(snoozeParams);
					} else {
						snoozeAndClose(getNotificationNode(), snoozeParams);
					}
				}
			}
		})
		.change(function() {
			$("#snoozeTimes a").removeClass("hover");
			var val = parseInt($(this).val());
			if (isSliderInSnoozeByDaysRegion($(this))) { // these are for days
				console.log((sliderNotches - val))
				var daysOffset = (SLIDER_NOTCHES_RESERVED_FOR_DAYS - (sliderNotches - val));
				updateExactSnoozeTimeDisplay({daysOffset:daysOffset});
			} else { // these are in minutes
				
				var snoozeOffset
				if (val == 1) { // if all the way to the right then just use 5 min
					snoozeOffset = 5 * ONE_MINUTE;
				} else { // use the interval
					snoozeOffset = INTERVAL_IN_MINUTES * (val-2) * ONE_MINUTE;
				}

				var snoozeTime = Date.now() + snoozeOffset;
				snoozeTime = new Date(snoozeTime);

				if (val >= 2) {
					// round to nearest INTERVAL_IN_MINUTES
					var offsetMinutes;
					for (offsetMinutes=0; offsetMinutes<60; offsetMinutes++) {
						if ((snoozeTime.getMinutes()+offsetMinutes) % INTERVAL_IN_MINUTES == 0) {
							break;
						}
					}
					snoozeTime.setMinutes(snoozeTime.getMinutes()+offsetMinutes);
				}
				
				updateExactSnoozeTimeDisplay({snoozeTime:snoozeTime});
			}
		})
	;
	
	updateTimeElapsed();
	
	setInterval(updateTimeElapsed, 60000);

	// Repeat sound...
	if (pref("repeatSound")) {
		setInterval(function() {
			$(".notification").each(function(index) {
				var notification = getNotification($(this));
				if (notification.audioPlayedCount <= parseInt(pref("repeatSoundStopAfter", 3))) {
					bg.playNotificationSound(notification);
				}
			});
		}, parseInt(pref("repeatSoundInterval", 5)) * ONE_MINUTE);
	}

	if (pref("closePopupsAfterAWhile")) {
		setTimeout(function() {
			if (pref("actionForPopupsAfterAWhile", "dismiss") == "dismiss") {
				$("#dismissAll").click();
			} else {
				var snoozeParams = {inMinutes:5};
				snoozeAllAndClose(snoozeParams);
			}
		}, ONE_SECOND * parseInt(pref("closePopupsAfterAWhileInterval", 1800)));
	}
});