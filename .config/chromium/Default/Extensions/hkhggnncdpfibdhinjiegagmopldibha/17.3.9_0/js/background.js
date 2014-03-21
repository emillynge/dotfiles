/*
   Copyright 2014 Jason Savard

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

var localeMessages;
var itemID = "CheckerPlus";
var RED = [208, 0, 24, 255];
var BLUE = [0, 24, 208, 255];
var GRAY = [150, 150, 150, 255];

var MSG_NO_TITLE = '(No Title)';
// POLLING_INTEVAL (when "online" is actually taken from the prefs default at 45000)
var POLL_INTERVAL_WHEN_OFFLINE = minutes(1); // cannot be shorter than CHECK_EVENTS_INTERVAL
var CHECK_EVENTS_INTERVAL = minutes(1);
var SECONDS_BEFORE_REOPENING_NOTIFICATION_WINDOW = 60;
var MAX_POSSIBLE_DAYS_FROM_NEXT_MONTH = 7;
var lastPollTime = 0;
var lastCheckEventsTime = 0;
var pendingLoadId_ = null;

// Clear this info
var feeds = new Array();
var cachedFeeds = {};
var events = new Array();
var snoozers = new Array();

var notificationWindow; // handler for single window like text or html
var notificationsOpened = []; // notifications wrapper objects for each event that is displayed in a notification (not necessarily notification handlers - because of grouped notifications option)
var notificationsQueue = new Array();
var lastNotificationShownDate = new Date();
var lastExtensionUpdateNotificationShownDate = new Date(1);
var eventsShown = new Array();
var loggedOut = true;
var email;

var lastBadgeIcon;
var contentScriptParams = new Array();
var menuIDs = [];
var contextMenuLastUpdated;
var drawAttentionDate = new Date(1);
var lastWindowOnFocusDate = today();
var lastWindowOnFocusID;
var FACEBOOK_PERMISSION_HOST = "*://*.facebook.com/*"; // MUST MATCH what is in manifest for optional_permissions
var notificationAudio;
var pokerListenerLastPokeTime = new Date(1);
var oAuthForDevices;
var storageManager;
var storage;
var primaryCalendar;
var tokenResponses;
var signedInEmails = [];
var lastBadgeDate = new Date();
var GROUPED_NOTIFICATION_ID = "GROUPED_NOTIFICATION";
var snoozePopup;
var forgottenReminderAnimation;
var excludedCalendars = new Array("p#weather@group.v.calendar.google.com");

var detectSleepMode = new DetectSleepMode(function() {
	// wakeup from sleep mode action...
	updateContextMenuItems();
});

var IDLE_DETECTION_INTERVAL = 120; // in seconds
var notificationsOpenedCountWhenIdle;

//init objects once in this background page and read them from all other views (html/popup/notification pages etc.)
ChromeTTS();
Tools();
Controller();

function updateArray(array, feed) {
	// DO NOT set temporary var like arrayItem = array[x]; arrayItem = newItem (cause this will erase the reference of arrayItem to the array and thus not change the array
	for (var a=0; a<array.length; a++) {
		if (isSameUrl(array[a].url, feed.url)) {
			array[a] = feed;
			return true;
		}
	}
	array.push(feed);
	return feed;
}

function getElementInArray(array, url) {
	for (var a=0; a<array.length; a++) {
		if (isSameUrl(array[a].url, url)) {
			return array[a];
		}
	}
}

function formatTimeForBadge(date) {
	var formattedTime = date.formatTime(true);
	if (formattedTime.length > 5) {
		formattedTime = formattedTime.replace("am", "").replace("pm", "");
	}
	return formattedTime;
}

function extractEntry(elem) {
	var out = {};
	var whenFound = false;
	var startTime;
	for (var node = elem.firstChild; node != null; node = node.nextSibling) {
		if (node.nodeName == 'id') {
			out.id = node.firstChild ? node.firstChild.nodeValue : "";
		} else if (node.nodeName == 'title') {
			out.title = node.firstChild ? node.firstChild.nodeValue : MSG_NO_TITLE;
		} else if (node.nodeName == 'content') {
			out.description = node.firstChild ? node.firstChild.nodeValue : "";
		} else if (node.nodeName == 'link' && node.getAttribute('rel') == 'alternate') {
			out.url = node.getAttribute('href');
			out.link = node.getAttribute('href');
		} else if (node.nodeName == 'gCal:color') {
			out.color = node.getAttribute('value');
		} else if (node.nodeName == 'gCal:accesslevel') {
			out.accessLevel = node.getAttribute('value');
		} else if (node.nodeName == 'gCal:selected') {
			out.selected = node.getAttribute('value');
		} else if (node.nodeName == 'gCal:hidden') {
			out.hidden = node.getAttribute('value');
		} else if (node.nodeName == 'gd:where') {
			out.location = node.getAttribute('valueString');
		} else if (node.nodeName == 'gd:who') {
			if (node.getAttribute('email') == email) {
				if (node.firstChild && node.firstChild.nodeName == "gd:attendeeStatus") {
					out.attendeeStatus = node.firstChild.getAttribute("value");
				}
			} 
		} else if (node.nodeName == 'gd:eventStatus') {
			out.status = node.getAttribute('value');
		// This key will only show up when the feed is NOT extracted using singleevents=true
		} else if (node.nodeName == 'gd:recurrence') {
			out.recurrence = node.firstChild ? node.firstChild.nodeValue : "";
		// This key will show up if the feed is extracted using singleevents=true and points the recurring event
		} else if (node.nodeName == 'gd:originalEvent') {
			out.originalEvent = node.getAttribute('id');
		} else if (node.nodeName == 'gd:when') {
			whenFound = true;
			var startTimeStr = node.getAttribute('startTime');
			var endTimeStr = node.getAttribute('endTime');
			startTime = startTimeStr.parseDate();
			endTime = endTimeStr.parseDate();
			if (startTime == null || endTime == null) {
				continue;
			}
			out.allDay = (startTimeStr.length <= 11);
			out.startTime = startTime;
			out.endTime = endTime;
			var startTimeTemp = new Date(startTime.getTime());
			if (out.allDay) {				
				startTimeTemp.setHours(5);
			}
			out.reminderTimes = new Array();
			// if reminder set for this event then loop inner nodes ie. <gd:reminder method='sms' minutes='10'/>
			for (var reminderNode=node.firstChild; reminderNode!=null; reminderNode=reminderNode.nextSibling) {
				if (reminderNode.getAttribute("method") == "alert") {
					var reminderTime = null;
					var num;
					num = reminderNode.getAttribute("hours");
					if (num) {
						reminderTime = new Date(startTimeTemp.getTime() - (parseInt(num) * 60 * ONE_MINUTE));
					} else {
						num = reminderNode.getAttribute("days");
						if (num) {
							reminderTime = new Date(startTimeTemp.getTime() - (parseInt(num) * 24 * 60 * ONE_MINUTE));
						} else {
							num = reminderNode.getAttribute("weeks");
							if (num) {
								reminderTime = new Date(startTimeTemp.getTime() - (parseInt(num) * 7 * 24 * 60 * ONE_MINUTE));
							} else {
								num = reminderNode.getAttribute("minutes");
								if (num) {
									reminderTime = new Date(startTimeTemp.getTime() - (parseInt(num) * ONE_MINUTE));
								}
							}
						}
					}
					if (reminderTime) {
						out.reminderTimes.push({time: reminderTime, shown:false});
					}
				}
			}
		}
	}
	if (!whenFound) {
		out.allDay = true;
	}
	return out;
}

function JSONparseFromLS(key, isArray) {
	var lsItem = localStorage[key];
	if (lsItem) {
		return JSON.parse(lsItem);
	} else if (isArray) {
		return new Array();
	}
}

function parseEventDates(event) { 
	// Patch for Date objects because they are no stringified as an object AND remove old events
	event.startTime = event.startTime.parseDate();
	if (event.endTime) {
		event.endTime = event.endTime.parseDate();
	}
	if (event.reminderTimes) {
		$.each(event.reminderTimes, function(a, thisEvent) {
			if (thisEvent.time) {
				thisEvent.time = thisEvent.time.parseDate();
			} else {
				console.warn("no time: ", thisEvent);
			}
		});
	} else {
		event.reminderTimes = new Array();
	}
}

function initEventDates(theseEvents) {
	var event;
	for (var a=0; event=theseEvents[a], a<theseEvents.length; a++) {
		if (event.startTime) {
			parseEventDates(event);
			var startTime = event.startTime;
			//2010-05-25T23:00:00Z
			if (startTime && startTime.getTime() < getStartDateOfPastEvents().getTime() - (ONE_DAY * 40)) { // last # = days
				console.log("removed old event: " + getSummary(event) + " " + startTime);
				// can't use splice with $.each atleast as of jquery 1.6.2
				theseEvents.splice(a, 1);
				a--;
			}
		} else {
			//console.log("ignore non reminder event: " + getSummary(event), event);
			//theseEvents.splice(a, 1);
			//a--;
		}
	}
}

function initPopup() {
	if (pref("popupGoogleCalendarWebsite")) {
		chrome.browserAction.setPopup({popup:""});
	} else {
		chrome.browserAction.setPopup({popup:"popup.html"});
	}
}

function setTestSettings() {
	if (pref("testMode")) {		 
		SECONDS_BEFORE_REOPENING_NOTIFICATION_WINDOW = 10;
	} else {
		SECONDS_BEFORE_REOPENING_NOTIFICATION_WINDOW = window.original_SECONDS_BEFORE_REOPENING_NOTIFICATION_WINDOW;
	}
}

function setOmniboxSuggestion(text, suggest) {
	//var tom = /^tom:/.test(text);
	// must be same regex as other references...
	var tom = new RegExp("^" + getMessage("tom") + ":").test(text);
	var plainText = text && text.length && !tom;
	var desc = "<match><url>cal</url></match> ";
	desc += plainText ? ('<match>' + text + '</match>') : getMessage("omniboxDefault");
	desc += "<dim> " + getMessage("or") + " </dim>";
	desc += tom ? ('<match>' + text + '</match>') : getMessage("tom") + ":" + getMessage("omniboxDefaultTom");
	try {
		chrome.omnibox.setDefaultSuggestion({
			description: desc
		});
	} catch (e) {
		logError("error setting omnibox: " + e);
	}
}

function fetchSettings(callback) {
	if (!callback) {
		callback = function () {};
	}
		
	// must declare ALL defaults or they are NOT retrieved when calling storage.get
	var storageDefaults = {};
	storageDefaults.calendarSettings = {};
	storageDefaults.excludedCalendars = new Array("p#weather@group.v.calendar.google.com");
	//storageDefaults.language = window.navigator.language;
	//storageDefaults.sortType = "byDate";

	console.log("loading storage");

	storageManager.get(storageDefaults, function(response) {
		if (response.error) {
			alert("The 'Checker Plus for Google Calendar' extension could not load because your browser profile is corrupt. You can fix and remove this message by clicking Ok and follow the instructions in the tab that will open, or just uninstall this extension.");
			createTab("http://jasonsavard.com/wiki/Corrupt_browser_profile?source=calendar_corruption_detected");
		} else {
			console.log("settings", response.items);
			storage = response.items;
			
			traverse(storage.snoozers, traverseDateParser);
			
			// BEGIN SMALL LEGACY CODE
			
			//part 1
			/*
			// move excludedCalendars from chrome.storage to localStorage (because I didn't want to deal with the hassle of synching this only chrome.storage item			
			if (localStorage.excludedCalendarsTemp) {
				excludedCalendars = JSON.parse(localStorage.excludedCalendarsTemp);
			} else {
				localStorage.excludedCalendarsTemp = JSON.stringify(storage.excludedCalendars);
				excludedCalendars = storage.excludedCalendars;
			}
			*/
			// legacy part 2
			if (localStorage.excludedCalendarsTemp) {
				localStorage.excludedCalendars = localStorage.excludedCalendarsTemp;
				localStorage.removeItem("excludedCalendarsTemp");
			}
			
			if (localStorage.excludedCalendars) {
				excludedCalendars = JSON.parse(localStorage.excludedCalendars);				
			}
			
			// END SMALL LEGACY CODE
			
			callback();
		}
	});
}

function fetchCalendarSettings(params, callback) {
	if (!params) {
		params = {};
	}
	
	if (params.grantingAccess || params.bypassCache || storage.calendarSettings.email != params.email) {
		console.log("Fetching setttings")	
		oAuthForDevices.send({userEmail:params.email, url: "/users/me/settings", roundtripArg:params.email}, function(response) {
			if (response.data) {
				initCalendarSettings(response.data.items);
				storage.calendarSettings.email = params.email;
				storageManager.set("calendarSettings", storage.calendarSettings);
			} else {
				logError("error fetching calendarin settings: " + response.error);
			}
			callback(response);
		});
	} else {
		console.log("Fetching setttings [CACHE]");
		callback();
	}
}

function fetchColors(params, callback) {
	if (!params) {
		params = {};
	}
	
	var feedFromCache = cachedFeeds.colors;		
	if (params.bypassCache != true && feedFromCache && feedUpdatedWithinTheseDays(feedFromCache, 30) && feedFromCache.email == params.email) {
		console.log("Fetching colors... [CACHE]");
		callback();
	} else {
		console.log("Fetching colors...")
		oAuthForDevices.send({userEmail:params.email, url: "/colors"}, function(response) {
			if (response.data) {
				// adding my custom additional attribute
				response.data.CPlastFetched = new Date();
				cachedFeeds.colors = response.data;
				cachedFeeds.colors.email = params.email;
				localStorage.cachedFeeds = JSON.stringify(cachedFeeds);					
			} else {
				logError("error fetching colors: " + response.error);
			}
			callback(response);
		});
	}
}

function shortcutNotApplicableAtThisTime(title) {
	var notif = webkitNotifications.createNotification("/images/icons/icon-48.png", title, "Click here to remove this shortcut.");
	notif.onclick = function() {
		chrome.tabs.create({ url: "http://jasonsavard.com/wiki/Checker_Plus_for_Google_Calendar#Keyboard_shortcuts" });
		this.cancel();
	}
	notif.show();
}

function closeNotifications(notifications, params) { // lastAction, skipNotificationClear
	params = initUndefinedObject(params);
	
	updateEventsShown(notifications, eventsShown, params.lastAction);
	
	var notificationsCloned = notifications.clone(); // because sometimes the notificationsOpened is passed in as notifications and when looping inside the next loop we modify the notificationsOpened which creates sync issues 
	
	console.log("notificationsCloned length: " + notificationsCloned.length)
	console.log("notificationsCloned: ", notificationsCloned)
	$.each(notificationsCloned, function(index, notification) {
		// remove from queue
		for (var a=0; a<notificationsQueue.length; a++) {
			if (isSameEvent(notificationsQueue[a].event, notification.event)) {				
				console.log("removed from queue: " + notification.event.summary);
				notificationsQueue.splice(a, 1);
				a--;
				break;
			}
		}

		// remove from array of opened notifs
		console.log("notificationsOpened length: " + notificationsOpened.length)
		for (var a=0; a<notificationsOpened.length; a++) {
			console.log("notificationsOpened[a].id: " + notificationsOpened[a].id)
			console.log("notificationsOpened[a]: ", notificationsOpened[a])
			console.log("notification.id: " + notification.id);
			if (notificationsOpened[a].id == notification.id) {
				console.log("removed from opened", notification.id);
				notificationsOpened.splice(a, 1);
				a--;
				break;
			}
		}
	});
	
	if (!params.skipNotificationClear) {
		if (isGroupedNotificationsEnabled()) {
			if (notificationsOpened.length == 0) {
				chrome.notifications.clear(GROUPED_NOTIFICATION_ID, function(wasCleared) {
					// patch to force close the notification by unfocusing the notification window
					// Because the notification.clear is not working when the notification has been retoasted by clicking on the bell in the tray
					if (params.source == "notificationButton") {						
						if (lastNotificationShownDate.diffInSeconds() < -25) { // 25 seconds is approx. the time it takes for the notification to hide, after that let's use the window technique
							openTemporaryWindowToRemoveFocus();
						}
					}
				});
			} else {
				updateNotifications();
			}
		} else {
			$.each(notifications, function(index, notification) {
				chrome.notifications.clear(notification.id, function(wasCleared) {});
			});
		}
	}
}

function performActionOutsideOfPopupCallback(eventEntry) {
	var title = eventEntry.summary;
	var message = "";
	
	if (eventEntry.startTime) {
		var addedFor = null;
		var atStr = "";
		if (!eventEntry.allDay) {
			atStr = "At";
		}
		if (eventEntry.startTime.isToday()) {
			addedFor = getMessage("addedForToday" + atStr, [getMessage("event").toLowerCase(), eventEntry.startTime.formatTime()]);
		} else if (eventEntry.startTime.isTomorrow()) {
			addedFor = getMessage("addedForTomorrow" + atStr, [getMessage("event").toLowerCase(), eventEntry.startTime.formatTime()]);
		} else {
			addedFor = getMessage("addedForSomeday" + atStr, [getMessage("event").toLowerCase(), eventEntry.startTime.format("dddd, mmm d"), eventEntry.startTime.formatTime()]);
		}
		message = addedFor;
	}
	
	var options = {
			type: "basic",
			title: title,
			message: message,
			buttons: [{title:"Undo", iconUrl:"images/trash.png"}],
			iconUrl: "images/icons/icon-128.png"
	}

	// if no title found in the result of the quick add then open the edit page
	if (eventEntry.summary) {
		
		var notificationWindowType = pref("notificationWindowType", "rich");
		if (notificationWindowType == "text") {
			// text notificaiton
			var omniboxBoxNotification = window.webkitNotifications.createNotification('images/icons/icon-128.png', title, message);
			omniboxBoxNotification.eventEntry = eventEntry;
			omniboxBoxNotification.onclick = function() {
				var url = this.eventEntry.htmlLink;
				if (url) {
					createTab({url:url, urlToFind:this.eventEntry.id}, function() {});
				}
				this.close();
			}			
			omniboxBoxNotification.show();
		} else {
			// rich notification
			var notification = {id:generateNotificationIdFromEvent(eventEntry), event:eventEntry, addedOutsideOfPopup:true};
			chrome.notifications.create(notification.id, options, function(notificationId) {
				// close it after a few seconds
				notificationsOpened.push(notification);
				setTimeout(function() {
					chrome.notifications.clear(notification.id, function(wasCleared) {});
				}, seconds(6));
			});
		}
	} else {
		createTabAndFocusWindow(eventEntry.htmlLink);
	}						
	pollServer();
}

function performActionOutsideOfPopup(eventEntry) {
	saveEvent(eventEntry, function(response) {
		var saveEventResponse = response;
		if (response.error) {
			alert("Error: " + response.error + " Try using the quick add from the popup!");
		} else {
			
			// if title is small, empty or just useless than try getting the page details to fill the title
			var shortestTitleLength = 3;
			if (/zh|ja|ko/i.test(storage.calendarSettings.calendarLocale)) {
				shortestTitleLength = 1;
			}
			if (eventEntry.fromContextMenu && $.trim(eventEntry.summary).length <= shortestTitleLength) {
				getActiveTab(function(tab) {
					getEventDetailsFromPage(tab, function(response) {
						eventEntry.summary = response.title;
						eventEntry.description = response.description;
						
						var eventEntryOrNewParams;
						var patchFields = {};
						patchFields.summary = response.title;
						patchFields.description = response.description;
						eventEntryOrNewParams = {eventEntry:eventEntry, googleCalendarEvent:saveEventResponse.data, patchFields:patchFields};
						
						updateEvent(eventEntryOrNewParams, function(response) {
							if (response.error) {
								alert("Error: " + response.error);
							} else {
								performActionOutsideOfPopupCallback(eventEntry);
							}
						});
					});
				});
			} else {
				performActionOutsideOfPopupCallback(eventEntry);
			}

		}
	});
}

function retoastNotifications() {
	updateNotifications({retoast:true})
}

function updateNotifications(params) {
	if (!params) {
		params = {};
	}
	
	if (notificationsOpened.length) {
		
		sortNotifications(notificationsOpened);
		
		if (isGroupedNotificationsEnabled()) {
			// grouped
			var notificationsOpenedForDisplay = notificationsOpened.clone();
			//notificationsOpenedForDisplay.reverse();
			var options = generateNotificationOptions(notificationsOpenedForDisplay);
			if (params.retoast) {
				chrome.notifications.create(GROUPED_NOTIFICATION_ID, options, function(notificationId) {});
			} else {
				chrome.notifications.update(GROUPED_NOTIFICATION_ID, options, function(wasUpdated) {});
			}
		} else {
			// dont retoast individual notifs
			if (!params.retoast) {
				// individual
				$.each(notificationsOpened, function(index, notification) {
					var options = generateNotificationOptions([notification]);
					// note: chrome.notifications.update calls the notification.onClosed
					chrome.notifications.update(notification.id, options, function(wasUpdated) {});
				});
			}
		}
	}
}

function init() {

	// BEGIN Legacy code and can be removed after everyone has updated
	
	// reversed boolean flag, from removeQuickAdd to showQuickAdd
	//if (pref("removeQuickAdd")) {
		//localStorage["showQuickAdd"] = "false";
	//}
	
	// now using the ssl2 setting
	//localStorage.removeItem("ssl");
	
	/*
	// should be done so i commented it now
	// 'default' used to be attributed to agenda view, replace it with 'agenda'
	if (localStorage["calendarType"] == "default") {
		localStorage["calendarType"] = "agenda";
	}
	*/
	
	/*
	// because 12pm when passing through parseTime gave halfday in redtimeline
	if (localStorage.hideNightHoursAfter == "12pm") {
		localStorage.hideNightHoursAfter = 24;
	}
	*/
	
	// END Legacy code and can be removed after everyone has updated
	
	initCalendarNames(dateFormat.i18n);
	
	storageManager = new StorageManager();
	
	var syncExcludeList = ["eventsShown", "widgetEvents", "cachedFeeds", "paypalInlineResponse"];
	syncOptions.init(syncExcludeList);

	fetchSettings(function(items) {

		//email = "blahblah@gmail.com";
		//loggedOut = false;
		
		// set originals here...
		window.original_SECONDS_BEFORE_REOPENING_NOTIFICATION_WINDOW = SECONDS_BEFORE_REOPENING_NOTIFICATION_WINDOW;		
		// now change them if need be...
		setTestSettings();
		
		initOAuth();
		updateBadge();
		initPopup();
		
		// Add listener once only here and it will only activate when browser action for popup = ""
		chrome.browserAction.onClicked.addListener(function(tab) {
			createTab({url:getProtocol() + "://www.google.com/calendar", urlToFind:"://www.google.com/calendar"}, function() {
				
			});
		});
		
		// Setup omnibox...
		chrome.omnibox.onInputChanged.addListener(function(text, suggest) {
			setOmniboxSuggestion(text, suggest);
		});
		
		chrome.windows.onFocusChanged.addListener(function(windowId) {
			// had to remove this because apparently window focus is never regained after the drawAttention call
			//if (windowId != chrome.windows.WINDOW_ID_NONE) {
				//console.log("onfocus: " + windowId + " " + today() + " diff: " + (Math.abs(drawAttentionDate.getTime() - today().getTime())));
				// patch: it seems that when drawAttention is called it calls focus to chrome window even though it doesn't get focus set let's ignore anything within 200 milis seconds of the drawattention
				if (Math.abs(drawAttentionDate.getTime() - today().getTime()) > 90) {
					//console.log("onfocus2: " + drawAttentionDate + " " + today());
					lastWindowOnFocusDate = today();
					lastWindowOnFocusID = windowId;
				}
			//}
		});
		
		if (chrome.commands) {
			chrome.commands.onCommand.addListener(function(command) {
				if (command == "dismissEvent") {
					console.log("oncommand dismiss");
					var notificationWindowType = pref("notificationWindowType", "rich");
					var noEventsToDismiss = false;
					
					if (notificationWindowType == "text") {
						if (notificationWindow) {
							notificationWindow.cancel();
						} else {
							noEventsToDismiss = true;
						}
					} else if (notificationWindowType == "rich") {
						if (notificationsOpened.length) {
							closeNotifications(notificationsOpened);
						} else {
							noEventsToDismiss = true;
						}
					}
					
					if (noEventsToDismiss) {
						shortcutNotApplicableAtThisTime("No events to dismiss");
					}
				}
			});
		}

		// check to see notifications are supported by browser			
		// html notif
		var notificationWindowType = pref("notificationWindowType", "rich"); // default is html (now it's rich)
		
		// legacy
		if (notificationWindowType == "html") {
			localStorage.notificationWindowType = "rich";
		}		

		if (chrome.notifications) {
			
			// clicked anywhere
			chrome.notifications.onClicked.addListener(function(notificationId) {
				console.log("notif onclick", notificationId);
				
				if (notificationId == "extensionUpdate") {
					createTab("http://jasonsavard.com/wiki/Checker_Plus_for_Google_Calendar_changelog");
					chrome.notifications.clear(notificationId, function() {});
					sendGA(['_trackEvent', "extensionUpdateNotification", "clicked notification"]);
				} else {
					ChromeTTS.stop();
					
					var notification = getNotification(notificationsOpened, notificationId);
					/*
					if (isGroupedNotificationsEnabled()) {					
						openSnoozePopup();
					} else {					
						if (notification.addedOutsideOfPopup) {
							chrome.notifications.clear(notificationId, function(wasCleared) {});
						} else {
							openSnoozePopup();
						}
					}
					*/
					if (notification && notification.addedOutsideOfPopup) {
						createTabAndFocusWindow(notification.event.htmlLink);
						chrome.notifications.clear(notificationId, function(wasCleared) {});
					} else {
						openSnoozePopup();
					}
				}
				
			});
			
			// buttons clicked
			chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
				console.log("notif onbuttonclick:", notificationId, buttonIndex);
				
				if (notificationId == "extensionUpdate") {
					if (buttonIndex == 0) {
						createTab("http://jasonsavard.com/wiki/Checker_Plus_for_Google_Calendar_changelog");
						chrome.notifications.clear(notificationId, function() {});
						sendGA(['_trackEvent', "extensionUpdateNotification", "clicked button - see updates"]);
					} else if (buttonIndex == 1) {
						localStorage.disabledExtensionUpdateNotifications = "true";
						chrome.notifications.clear(notificationId, function(wasCleared) {
							if (lastExtensionUpdateNotificationShownDate.diffInSeconds() < -7) { // 25 seconds is approx. the time it takes for the notification to hide, after that let's use the window technique
								openTemporaryWindowToRemoveFocus();
							}
						});
						sendGA(['_trackEvent', "extensionUpdateNotification", "clicked button - do not show future notifications"]);
					}
				} else {	

					ChromeTTS.stop();
					
					// patch: user might have re-toasted the notification by clicking the bell (before the notification had time to disappear naturally and therefore bypassing the openTemporaryWindowToRemoveFocus logic, so let's force it here
					if (notificationsOpened && notificationsOpened.length == 0) {
						console.log("patch: user might have re-toasted the notification by clicking the bell so let's force call the openTemporaryWindow...");
						openTemporaryWindowToRemoveFocus();
						return;
					}
					
					var notification = getNotification(notificationsOpened, notificationId);
					if (!notification) {
						// only one notification then we aren't grouped 
						if (notificationsOpened.length == 1) {
							notification = notificationsOpened.first();
						}
					}
					
					if (notification && notification.addedOutsideOfPopup) {
						console.log("small if");
						if (buttonIndex == 0) {
							deleteEvent(notification.event.eid, null, notification.event, function(response) {
								if (response.status == 200 || response.status == 204) {
									bg.pollServer();
									chrome.notifications.clear(notificationId, function(wasCleared) {});
								} else {
									alert("Error deleting event: " + response.status);
								}
							});
						}
					} else {
						var notificationButtonValue;
						
						var buttons;
						if (isGroupedNotificationsEnabled()) {
							buttons = notificationsOpened.first().buttons;
						} else {
							buttons = notification.buttons;
						}
						
						if (buttonIndex == 0) {
							notificationButtonValue = buttons[0].value;
						} else if (buttonIndex == 1) {
							notificationButtonValue = buttons[1].value;
						}
						
						console.log("notificationButtonValue", notificationButtonValue);
						
						if (notificationButtonValue == "dismiss") {
							// dismiss
							console.log("dismiss");
							if (isGroupedNotificationsEnabled()) {
								closeNotifications(notificationsOpened);
								if (snoozePopup) {
									snoozePopup.close();
								}
							} else {
								closeNotifications([notification]);
							}
						} else if (notificationButtonValue == "snoozeTimes") {
							openSnoozePopup();
						} else if (notificationButtonValue == "location|hangout") {
							var eventSource = getEventSource(notification.event);
							
							var hangoutLink = notification.event.hangoutLink;
							if (hangoutLink) {
								createTab({url:hangoutLink}, function() {});
							} else if (eventSource) {
								createTab({url:eventSource.url}, function() {});
							} else {
								createTab({url:"http://maps.google.ca/maps?q=" + encodeURIComponent(notification.event.location) + "&source=calendar"}, function() {});
							}
						} else if (notificationButtonValue == "reducedDonationAd") {
							localStorage.reducedDonationAdClicked = true;
							createTab("donate.html?ref=reducedDonationFromNotif");
							updateNotifications();
						} else {
							// snooze
							var unit = notificationButtonValue.split("_")[0];
							var delay = notificationButtonValue.split("_")[1];
							
							var snoozeParams = {};
							snoozeParams.source = "notificationButton";
							
							if (unit == "minutes") {
								snoozeParams.inMinutes = delay;
							} else if (unit == "hours") {
								snoozeParams.inHours = delay;
							} else if (unit == "days") {
								snoozeParams.inDays = delay;
							} else {
								logError("no unit in snooze: " + unit);
							}
							
							if (isGroupedNotificationsEnabled()) {
								snoozeNotifications(snoozeParams, notificationsOpened);
								if (snoozePopup) {
									snoozePopup.close();
								}
							} else {
								snoozeNotifications(snoozeParams, [notification]);
							}
						}
					}
				}
			});
			
			// closed notif
			chrome.notifications.onClosed.addListener(function(notificationId, byUser) {
				if (notificationId == "extensionUpdate") {
					if (byUser) {
						sendGA(['_trackEvent', "extensionUpdateNotification", "closed notification"]);
					}
				} else {				
					if (byUser) { // byUser happens ONLY when X is clicked ... NOT by closing browser, NOT by clicking action buttons, NOT by calling .clear
						console.log("notif onclose", notificationId, byUser);
						ChromeTTS.stop();
						if (isGroupedNotificationsEnabled()) {
							closeNotifications(notificationsOpened, {skipNotificationClear:true});
							if (snoozePopup) {
								snoozePopup.close();
							}
						} else {
							var notification = getNotification(notificationsOpened, notificationId);
							if (notification.addedOutsideOfPopup) {
								// do nothing - refer to patch with notification.update
								console.log("ignoreNotificationOnClosed");
							} else { 
								closeNotifications([notification], {skipNotificationClear:true});
							}
						}
					}
				}
			});
		}
		
		setOmniboxSuggestion();
		chrome.omnibox.onInputEntered.addListener(function(text) {
			getActiveTab(function(tab) {
				var eventEntry = new EventEntry();			
				eventEntry.summary = text;
				eventEntry.allDay = true;  

				performActionOutsideOfPopup(eventEntry);
			});
		});
		
		if (chrome.alarms) {
			chrome.alarms.onAlarm.addListener(function(alarm) {
				if (alarm.name == "extensionUpdatedSync") {
					syncOptions.save("extensionUpdatedSync");
				}
			});
		}
		
		if (chrome.storage) {
			chrome.storage.onChanged.addListener(function(changes, areaName) {
				console.log("storage changes " + new Date() + " : ", changes, areaName);
			});
		}
		
		chrome.browserAction.setBadgeBackgroundColor({color:[255, 255, 255, 1]});
		chrome.browserAction.setBadgeText({text : "..."});
		
		forgottenReminderAnimation = new IconAnimation("images/bell_badge.png");
		
		if (chrome.idle.setDetectionInterval) {
			chrome.idle.setDetectionInterval(IDLE_DETECTION_INTERVAL);
		}
		chrome.idle.onStateChanged.addListener(function(newState) {
			if (newState == "active") {
				console.log("idle state change: " + newState);
				if (isGroupedNotificationsEnabled()) {
					// re-toast grouped notifications if different from count when idle
					if (notificationsOpened.length >= 1 && notificationsOpened.length != notificationsOpenedCountWhenIdle) {
						if (pref("desktopNotification", true) && notificationsQueue.length >= 1) {
							console.log("new notif since idle re-toast notifs");
							//showNotifications();
							retoastNotifications()
						}
					}
				}
			}
		});

		// Load from localstorage
		eventsShown = JSONparseFromLS("eventsShown", true);
		initEventDates(eventsShown);

		if (true || pref("offlineMode")) {
			feeds = JSONparseFromLS("feeds", true);
			$.each(feeds, function(i, feed) {
				var theseEvents = feed.entries;
				initEventDates(theseEvents);
			});
		}
		
		cachedFeeds = localStorage.cachedFeeds;
		if (cachedFeeds) {
			try {
				cachedFeeds = JSON.parse(cachedFeeds);
			} catch (e) {
				cachedFeeds = {};
				localStorage.cachedFeeds = JSON.stringify(cachedFeeds);
				logError("Reseting cachedfeeds because a problem parsing them occured! Happens when computer/browser suddenly shuts down: " + e);
			}
			traverse(cachedFeeds, traverseDateParser);
		} else {
			cachedFeeds = {};
		}
		
		snoozers = storage.snoozers;
		if (!snoozers) {
			snoozers = [];
		}

		pollServer();
		
		// This is used to poll only once per second at most, and delay that if
		// we keep hitting pages that would otherwise force a load.
		chrome.tabs.onUpdated.addListener(function onTabUpdated(tabId, changeInfo, tab) {
			
			//console.log("onupdated: " + tab.url + " == " + tab.title);
			if (changeInfo.status == "loading") {
				
				var url = changeInfo.url;
				if (!url) {
					return;
				}
				
				/*
				 	Watch out when using /accounts because it can be from google.com/blah or google.ca/blah
				 	This is the order of urls when signing out and you have a youtube account...
				 	
					https://accounts.youtube.com/accounts/Logout2?service=cl&ilo=1&ils=s.youtube%2Cs.CA&ilc=0&continue=https%3A%2F%2Fwww.google.com%2Fcalendar%2Frender&zx=-690625416 background.js:620
					http://www.google.ca/accounts/Logout2?service=cl&ilo=1&ils=s.CA&ilc=1&continue=https%3A%2F%2Fwww.google.com%2Fcalendar%2Frender&zx=777281977 background.js:620
					https://accounts.google.com/ServiceLogin?service=cl&passive=1209600&continue=https://www.google.com/calendar/render&followup=http://www.google.com/calendar&scc=1 background.js:620
				*/
				
				if (url.urlOrPathContains('//www.google.com/calendar/') || url.urlOrPathContains('google.com/ServiceLogin') || url.urlOrPathContains("//mail.google.com")) {
					if (pendingLoadId_) {
						console.log("cancel pendingload")
						clearTimeout(pendingLoadId_);
						pendingLoadId_ = null;
					}
					
					var BUFFER_TIME = seconds(4);
					
					var pollServerDelay = -1;
					var source = "urlDetected";
					if (url.urlOrPathContains('//www.google.com/calendar/')) {
						if (loggedOut) {
							console.log("calendar loaded and not signed in, poll in some seconds");
							source = "calendarLoadedNotSignedIn";
							pollServerDelay = BUFFER_TIME;
						}
					} else if (url.urlOrPathContains("//mail.google.com")) {
						if (loggedOut) {
							console.log("gmail page loaded and not signed in to calendar, poll in some seconds");
							source = "gmailLoadedNotSignedIn";
							pollServerDelay = BUFFER_TIME;
						}
					} else {
						// do this even if last signed in to detect if they are now signing out
						console.log("sign in page detected, poll in some seconds")
						source = "signInPageLoaded";
						pollServerDelay = BUFFER_TIME;
					}
					
					if (pollServerDelay != -1) {
						pendingLoadId_ = setTimeout(function() {
							pollServer({source:source, urlThatInitiatedPoll:url, callback:function(response) {
								if (response && response.fetchedEventsFromServer) {
									// do nothing
								} else {
									checkEvents();
								}
							}});
						}, pollServerDelay);
					}
				}
			} else if (changeInfo.status == "complete") {

				// find code window and make sure its from this extension by matching the state
				if (tab.url.indexOf("https://accounts.google.com/o/oauth2/approval") != -1 && tab.title.indexOf("state=" + oAuthForDevices.getStateParam()) != -1) {
					if (tab.title.match(/success/i)) {
						var code = tab.title.match(/code=(.*)/i);
						if (code && code.length != 0) {
							code = code[1];
							chrome.tabs.remove(tabId);
							
							oAuthForDevices.getAccessToken(code, function(params) {
								if (params.tokenResponse) {

									//alert("test")
									//"yoyo8@nodomain.com";
									if (!pref("verifyPaymentRequestSent")) {
										Controller.verifyPayment(itemID, params.tokenResponse.userEmail, function(response) {
											if (response && response.unlocked) {
												processFeatures();
											}
										});
										localStorage["verifyPaymentRequestSent"] = true;
									}
									
									fetchCalendarSettings({grantingAccess:true, email:params.tokenResponse.userEmail}, function(response) {
										if (response.error) {
											alert(response.error + " please try again later!");
										} else {
											
											// free some localstorage space by removing v2 api stuff
											clearSnoozers();
											feeds = [];
											localStorage.removeItem("feeds");
											
											pollServer();
											chrome.runtime.sendMessage({command: "grantPermissionToCalendars", email:response.roundtripArg});
										}
									});
									
								} else {
									if (params.warning) {
										// ignore: might by re-trying to fetch the userEmail for the non default account									
									} else {
										alert("Error getting access token: " + params.error + " please try again or try later!");
									}
								}
							});
						} else {
							var error = "error: code not found, please try again!";
							logError(error)
							alert(error);
						}
					} else {
						logError(tab.title);
						alert("error " + tab.title + " please try again or try later!");
					}
				}
			}				

		});
		
		if (!chrome.runtime.onMessage || !chrome.storage) {
			chrome.tabs.create({url:"http://jasonsavard.com/wiki/Old_Chrome_version"});
		}
		
		chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
			switch (request.name) {
				case "fetchEvents":
					
					var start = new Date(request.year, request.month, 1);
					var end = new Date(request.year, request.month, 31);
					
					fetchAllCalendarEvents({email:email, startDate:start, endDate:end, source:"agenda"}, function(cbParams) {
						if (cbParams.error) {							
							sendResponse({error:"Error fetching, try reload button or sign in to Google Calendar"});
						} else {
							var newEvents = [];
							$.each(cbParams.events, function(c, event) {
								//if (!isGadgetCalendar(event.calendar)) {
									newEvents.push(event);
								//}
							});
							
							newEvents.sort(function(a,b) {
								if (a.startTime.getTime() < b.startTime.getTime()) {
									return -1;
								} else {
									return +1;
								}
							});
							
							traverse(newEvents, traverseDateStringifier);
							sendResponse({events:newEvents});
						}
					});
					break;
				case "getGlobals":
					sendResponse({ls: localStorage, localeMessages: localeMessages});
					break;
				case "setLocalStorage":
					localStorage[request.key] = request.value;
					sendResponse({blah : "blah"});
					break;
				case "startDateTimeWorker":
					getActiveTab(function(tab) {
						
						var i18nOtherLang;
						if (dateFormat.i18n.lang && dateFormat.i18n.lang != "en") {
							i18nOtherLang = dateFormat.i18n;
						}
						
						var messages = [];

						messages["morning"] = getMessage("morning");
						messages["night"] = getMessage("night");
						messages["tomorrow"] = getMessage("tomorrow");

						var dateTimeWorker = new Worker("/js/dateTimeWorker.js");
						dateTimeWorker.onmessage = function(e) {
							if (e.data.log) {
								if (e.data.obj) {
									console.log(e.data.log, e.data.obj);
								} else {
									console.log(e.data.log);
								}
							} else {
								sendResponse({selectedTab:tab, onMessageResponse:e});
							}								
						}
						dateTimeWorker.onerror = function(e) {
							sendResponse({selectedTab:tab, onErrorResponse:e});
						}
						
						dateTimeWorker.postMessage({text:request.text, i18nEnglish:dateFormat.i18nEnglish, i18nOtherLang:i18nOtherLang, messages:messages});						
					});
					break;
				case "insertCSS":
					chrome.tabs.insertCSS(null, request.details, sendResponse);
					break;
				case "getSelectedTab":
					getActiveTab(function(tab) {
						sendResponse({tab : tab});
					});
					break;
				case "getEventDetailsFromPage":
					getEventDetailsFromPage(null, function(response) {
						console.log("getevents response:", response);
						sendResponse({pageDetails : response});
					});
					break;
				case "gaq":
					sendGA(request.value);
					break;
				case "openTab":
					chrome.tabs.create({url:request.url});
					break;
				case "contentScriptParams":
					//alert('get content: ' + request.value)
					contentScriptParams[request.key] = request.value;
					break;
				case "getVariable":
					sendResponse({variable:eval(request.variableName)});
					break;
				case "console":
					if (request.log) {
						console.log(request.log);
					} else if (request.error) {
						console.error(request.error);
					}
					break;
				case "executeScript":
					//chrome.tabs.executeScript(null, {file: request.value});
					chrome.tabs.executeScript(null, {code: "window._onload()"});
					break;					
				case "getDateFormat":
					sendResponse({dateFormati18n:dateFormat.i18n, dateFormati18nCalendarLanguage:dateFormat.i18nCalendarLanguage});
					break;
				case "generateActionLink":
					var eventEntry = request.eventEntry;
					var actionLinkObj = generateActionLink("TEMPLATE", eventEntry);
					var url = actionLinkObj.url + "?" + actionLinkObj.data;
					sendResponse({url:url});
					break;
				case "savedButtonClickedFromEventPage":
					// save (or delete) meaning probably reschedule so close/dimiss the event in the notifications
					var eidFromOpenTab = getUrlValue(request.url, "eid");
					if (eidFromOpenTab) {
						for (var a=0; a<notificationsOpened.length; a++) {
							var notification = notificationsOpened[a];
							var eidFromNotificationEvent = getUrlValue(notification.event.htmlLink, "eid");
							if (eidFromNotificationEvent == eidFromOpenTab) {
								closeNotifications([notification]);
								return false;
							}
						}
					}
					break;
				case "deleteEvent":
					console.log("bg deleteEvent", request.event);
					deleteEvent(request.eid, request.secid, request.event, function(response) {
						sendResponse(response);
					});
					break;
			}
			return true;
		 });
		
		
		// set widgtet defaults
		
		// set default widget background color
		if (!localStorage.widgetBackgroundColor) {
			localStorage.widgetBackgroundColor = "#E8EBE9";
		}
		if (!localStorage.widgetShowCalendar) {
			localStorage.widgetShowCalendar = "true";
		}
		if (!localStorage.widgetShowLogo) {
			localStorage.widgetShowLogo = "true";
		}
		if (!localStorage.widgetShowTime) {
			localStorage.widgetShowTime = "true";
		}
		
		var info = {
		  "poke"    :   2,              // poke version 2
		  "width"   :   1,              // 406 px default width
		  "height"  :   2,              // 200 px default height
		  "path"    :   "widget.html",
		  "v2"      :   {
		                  "resize"    :   true,  // Set to true ONLY if you create a range below.
		                  "min_width" :   1,     // 200 px min width
		                  "max_width" :   3,     // 406 px max width
		                  "min_height":   1,     // 200 px min height
		                  "max_height":   3      // 200 px max height
		                }
		};

		// Below is the required poke listener
		chrome.runtime.onMessageExternal.addListener(function(message, sender, sendResponse) {
		  if (message === "mgmiemnjjchgkmgbeljfocdjjnpjnmcg-poke") {
			  pokerListenerLastPokeTime = new Date();
			  chrome.runtime.sendMessage(
					  sender.id,
					  {
						  head: "mgmiemnjjchgkmgbeljfocdjjnpjnmcg-pokeback",
						  body: info
					  }
			  );

		  }
		});
		// Above is the required poke listener
		// DO NOT MODIFY ANY OF THE ABOVE CODE
		
		setInterval(function() {
			checkEvents({source:"interval"});
		}, CHECK_EVENTS_INTERVAL);
		
		// start this 30 seconds later so that we don't flicker the notifications immediately after displaying them
		setTimeout(function() {
			// update snooze notifiation times
			setInterval(function() {
				var notificationWindowType = pref("notificationWindowType", "rich");
				if (notificationWindowType == "rich") {
					updateNotifications();
				}
			}, minutes(1));
		}, seconds(30));
		
		// is iselibigable for reduced donations than make sure user hasn't contributed before, if so do not display this eligable notice
		setInterval(function() {
			if (!pref("donationClicked") && !localStorage["verifyPaymentRequestSentForReducedDonation"] && email) {

				// check sometime within 7 days (important *** reduce the load on my host)
				if (passedRandomTime("randomTimeForVerifyPayment", 7)) {
					Controller.verifyPayment(itemID, email, function(response) {
						if (response && response.unlocked) {
							processFeatures();
						}
					});
					localStorage["verifyPaymentRequestSentForReducedDonation"] = true;
				}
			}
		}, minutes(5));

	});
	
	localStorage.widgetToday = getMessage("today");
	localStorage.widgetTomorrow = getMessage("tomorrow");
	localStorage.i18n = JSON.stringify(dateFormat.i18n);
	
	$(window).on("offline online", function(e) {
		console.log("offline/online detected", e);
		
		if (e.type == "online") {
			
		}
		
		updateBadge();
	});

}

function filterEventsForDisplayingInAgenda(maxEvents) {
	var widgetEvents = [];
	var eventsCount = 0;
	
	var selectedCalendars = getSelectedCalendars();
	
	$.each(events, function(index, event) {
		var selected = isCalendarSelectedInExtension(event.calendar, email, selectedCalendars);
		if (selected && new Date(event.startTime).diffInDays() >= 0) { // today and on
		//if (selected && !isGadgetCalendar(event) && new Date(event.startTime).diffInDays() >= 0) { // today and on
			widgetEvents.push(event);
			if (eventsCount++ > maxEvents) {
				return false;
			}
		}
	});
	
	return widgetEvents;
}

function refreshWidgetData() {
	var MAX_EVENTS = 30;
	var widgetEvents = filterEventsForDisplayingInAgenda(MAX_EVENTS);
	
	localStorage.currentEmail = email;
	localStorage.widgetWeekStart = storage.calendarSettings.weekStart;
	localStorage["widgetEvents"] = JSON.stringify(widgetEvents);
}

function menuItemOnClick(info, tab) {
	var params = menuIDs[info.menuItemId];
	if (params.template) {
		if (info.selectionText) {
	    	var actionLinkObj = generateActionLink("TEMPLATE", {summary:info.selectionText, startTime:today(), allDay:true});
	    	chrome.tabs.create({url: actionLinkObj.url + "?" + actionLinkObj.data});
		} else {
			// page selected
			getEventDetailsFromPage(tab, function(response) {
		    	var actionLinkObj = generateActionLink("TEMPLATE", {summary:response.title, description:response.description, startTime:today(), allDay:true});
		    	chrome.tabs.create({url: actionLinkObj.url + "?" + actionLinkObj.data});
			});
		}
	} else {
		var eventEntry = new EventEntry();
		eventEntry.fromContextMenu = true;
		
		if (!params.quickAdd) {
			eventEntry.startTime = new Date(params.date.getTime());
			eventEntry.quickAdd = false;
		}
		eventEntry.allDay = params.allDay;  
		
		if (info.selectionText) {
			// Text selected
			eventEntry.summary = info.selectionText;
			performActionOutsideOfPopup(eventEntry);
		} else {
			// Page selected
			getEventDetailsFromPage(tab, function(response) {
				eventEntry.summary = response.title;
		    	if (!params.quickAdd) {
		    		eventEntry.description = response.description;
		    	}
		    	
		    	if (tab && tab.url) {
		    		eventEntry.source = {title:response.title, url:tab.url};
		    	}
		    	
		    	performActionOutsideOfPopup(eventEntry);
			});
		}
	}	
		
	var gaAction;
	if (info.selectionText) {
		gaAction = "selectedText";
	} else {
		gaAction = "rightClickOnPage";
	}
	sendGA(['_trackEvent', 'contextMenu', gaAction, getHost(tab.url)]);
}

function setMenuItemTimes(parentId, startTime) {
	var offsetTime = new Date(startTime); 
	for (var a=0; a<48 && offsetTime.getHours() <= 23 && offsetTime.getMinutes() <= 30 && offsetTime.diffInDays(startTime) == 0; offsetTime.setMinutes(offsetTime.getMinutes()+30), a++) {		
		var timeStr;
		if (pref("24hourMode")) {
			timeStr = offsetTime.format("HH:MM");
		} else {
			timeStr = offsetTime.format("h:MM tt");
		}
		menuID = chrome.contextMenus.create({title: timeStr, contexts: ["all"], parentId: parentId, onclick: menuItemOnClick});
		menuIDs[menuID] = {date:new Date(offsetTime)}; // MUST instantiate a new date
	}
}

function updateContextMenuItems() {
	if (pref("showContextMenuItem", true)) {
		console.log("addchange conextmenu: " + today())
		addChangeContextMenuItems();
		contextMenuLastUpdated = today();
	}
}

function addChangeContextMenuItems() {
	var menuID;
	menuIDs = [];
	
	// remove past menu items first
	chrome.contextMenus.removeAll(function() {
		
		// If a selection then add this before the other menu items
		menuID = chrome.contextMenus.create({title: getMessage("quickAdd") + "  '%s'", contexts: ["selection"], onclick: menuItemOnClick});
		menuIDs[menuID] = {quickAdd:true, allDay:true};

		menuID = chrome.contextMenus.create({title: getMessage("quickAdd") + " " + getMessage("byEmailSubject"), contexts: ["page", "frame", "link", "image", "video", "audio"], onclick: menuItemOnClick});
		menuIDs[menuID] = {quickAdd:true, allDay:true};

		chrome.contextMenus.create({contexts: ["all"], type:"separator"});
		
		// Today all day
		menuID = chrome.contextMenus.create({title: getMessage("today"), contexts: ["all"], onclick: menuItemOnClick});
		menuIDs[menuID] = {date:today(), allDay:true};
		
		// Today times...
		var offsetTime = today();
		if (offsetTime.getMinutes() <= 29) {
			offsetTime.setMinutes(30)
		} else {
			offsetTime.setHours(offsetTime.getHours()+1);
			offsetTime.setMinutes(0);
		}
		offsetTime.setSeconds(0);
		
		if (offsetTime.getHours() <= 23 && offsetTime.getMinutes() <= 30) {
			menuID = chrome.contextMenus.create({title: getMessage("todayAt"), contexts: ["all"]});
			setMenuItemTimes(menuID, offsetTime);
		}
		
		chrome.contextMenus.create({contexts: ["all"], type:"separator"});
		
		// Tomorrow
		menuID = chrome.contextMenus.create({title: getMessage("tomorrow"), contexts: ["all"], onclick: menuItemOnClick});
		menuIDs[menuID] = {date:tomorrow(), allDay:true}; // MUST instantiate a new date
		
		// Tomorrow times...
		menuID = chrome.contextMenus.create({title: getMessage("tomorrowAt"), contexts: ["all"]});
		offsetTime = tomorrow();
		offsetTime.setHours(1);
		offsetTime.setMinutes(0);
		setMenuItemTimes(menuID, offsetTime);
		
		// Days of week
		offsetTime = tomorrow();
		for (var a=2; a<=7; a++) {
			chrome.contextMenus.create({contexts: ["all"], type:"separator"});
			
			offsetTime.setDate(offsetTime.getDate()+1);
			menuID = chrome.contextMenus.create({title: dateFormat.i18n.dayNames[offsetTime.getDay()], contexts: ["all"], onclick: menuItemOnClick});
			var offsetDate = new Date(offsetTime);
			menuIDs[menuID] = {date:offsetDate, allDay:true}; // MUST instantiate a new date

			menuID = chrome.contextMenus.create({title: getMessage("somedayAt", dateFormat.i18n.dayNames[offsetTime.getDay()]), contexts: ["all"]});
			offsetDate.setHours(1);
			offsetDate.setMinutes(0);
			setMenuItemTimes(menuID, offsetDate);
		}
		
		chrome.contextMenus.create({contexts: ["all"], type:"separator"});
		
		// Other date
		menuID = chrome.contextMenus.create({title: getMessage("setDateTime") + "...", contexts: ["all"], onclick: menuItemOnClick});
		menuIDs[menuID] = {template:true};
				
	});
}

function playNotificationSoundFile(reminder) {
	try {
		if (!notificationAudio) {
			notificationAudio = new Audio();
		}
		
		var source = pref("sn_audio", "ding.ogg");
	
		if (source == "custom") {
			source = pref("sn_audio_raw");
		}

		if (!notificationAudio.src || notificationAudio.src.indexOf(source) == -1) {
			notificationAudio.src = source;
		}
	   
		// notificationAudio.load();
	   
		var volume = pref("notificationSoundVolume", 100);
	   
		// if reminder than lower the volume by 50%
		if (reminder) {
			volume = volume * 0.75;
		}
	   
		notificationAudio.volume = volume / 100;		   
		notificationAudio.play();
	} catch (e) {
		logError(e);
	}
}

function playNotificationSound(notification) {
	
	var textToSpeak;
	textToSpeak = notification.event.summary;
	
	if (notification.audioPlayedCount) {
		notification.audioPlayedCount++;
	} else {
		notification.audioPlayedCount = 1;
	}
	if (pref("notificationSound", true)) {
		playNotificationSoundFile();
	}
	if (pref("notificationTextToSpeech")) {
		chrome.idle.queryState(parseInt(pref("voiceNotificationOnlyIfIdleInterval", 15)), function(state) {
			// check if idle rules
			if (!pref("voiceNotificationOnlyIfIdle", true) || (pref("voiceNotificationOnlyIfIdle", true) && state != "active" && !detectSleepMode.isWakingFromSleepMode())) {
				if (pref("voice", "native").indexOf("Multilingual TTS Engine") != -1 && !navigator.onLine) {
					// fetch default machine voice by passing false as 2nd parameter to getDefaultVoice
					chrome.tts.getVoices(function(voices) {
						var voiceIndexMatched = getDefaultVoice(voices, false);
						if (voiceIndexMatched != -1) {
							var voice = voices[voiceIndexMatched];
							ChromeTTS.queue(textToSpeak, voice);
						}
					});
				} else {
					ChromeTTS.queue(textToSpeak);
				}
			}
		});
	}
}

function getEntries(params, callback) { //old func... url, params
	
	if (!params.pollParams) {
		params.pollParams = {};
	}

	var fullURL = params.urlParams ? params.url + "?" + params.urlParams : params.url;	
	var feedFromCache = getElementInArray(feeds, params.url);
	var bypassCache = params.pollParams.bypassCache;
	
	var cachedTypes = params.type == "settings" || params.type == "fetchCalendars";
	
	// legacy patch because we need to have settingEntries now, if not force refresh
	if (params.type == "settings" && feedFromCache && !feedFromCache.settingEntries) {
		console.log('force refresh: ', feedFromCache)
		sendGA(['_trackEvent', 'getEntries3', "settings", "forcerefresh"]);
		feedFromCache = null;
	}

	// legacy patch because we need to extract email from feed
	if (params.type == "fetchCalendars" && feedFromCache && !feedFromCache.email) {
		sendGA(['_trackEvent', 'getEntries3', "fetchCalendars", "forcerefresh"]);
		feedFromCache = null;
	}

	var cachedCalendars = fullURL.indexOf("holiday.calendar.google.com") != -1 ||
						  fullURL.indexOf("group.v.calendar.google.com") != -1 || // includes Interesting calendars "more" section ie. Contacts's bdays, Day of the year etc.
						  fullURL.indexOf("import.calendar.google.com") != -1 ||
						  fullURL.indexOf("ht3jlfaac5lfd6263ulfh4tql8%40group.calendar.google.com") != -1 // moon phases
						  ;
	
	// use cache for calendars unless older than 1 day...
	var fetchCalendarsFromCache = true;
	if (feedFromCache) {
		if (params.type == "fetchCalendars") {
			if (feedFromCache.lastFetched) {
				var lastFetched = new Date(feedFromCache.lastFetched);
				if (!lastFetched.isToday()) {
					fetchCalendarsFromCache = false;
				}
			} else {
				fetchCalendarsFromCache = false;
			}
		}
	}
	
	// same fetched url with same dates and it's a calendar that is not updated often (like holidays etc.) then send cached version
	if (bypassCache != true && feedFromCache && feedFromCache.fullURL == fullURL && fetchCalendarsFromCache && (cachedTypes || cachedCalendars)) {
		console.log("cached");
		callback({
			feed : feedFromCache,
			status : 200,
			success : true,
			fromCache : true
		});		
	} else {
		$.ajax({
			url: fullURL,
			type: "GET",
			timeout: parseInt(pref("timeout", 45)) * 1000,
			beforeSend: function(xhr) {
				if (pref("apps")) {
					//xhr.setRequestHeader("Authorization", "GoogleLogin auth=" + localStorage["appsAuth"]);
				}
			},
			complete: function(request, textStatus) {
				var status = getStatus(request, textStatus);
				
				// TESTING for Small things ** remove after
				/*
				if (url.indexOf("uvvrra3f3tnm3rs61nic1gqdb0") != -1) {
					status = 500;
				}
				*/				
				if (status == 200) {
					var title = request.responseXML.getElementsByTagName('title');
					if (title && title.length >= 1) {
						title = title[0].textContent;
					} else {
						title = "";
					}
					
					var link = request.responseXML.getElementsByTagName('link');
					if (link && link.length >= 1) {
						link = link[0].getAttribute("href");
					} else {
						link = "";
					}
					
					var emailFromFeed;
					try {
						var emailNode = request.responseXML.getElementsByTagName('email');
						if (emailNode && emailNode.length) {
							emailFromFeed = emailNode[0].textContent;
						}
					} catch (e) {
						logError("cannot extra feed from url: " + e);
					}
					
					var entriesDOM = request.responseXML.getElementsByTagName('entry');
					//var entriesJQuery = $(request.responseText.replace(/title>/ig, "titleX>")).find("entry");
					var entries = new Array();
					$.each(entriesDOM, function(a, entryDOM) {
						entries.push(extractEntry(entryDOM));
					});
					var feed = {title:title,link:link,url:params.url,entries:entries,fullURL:fullURL,lastFetched:today(),email:emailFromFeed}					
					// because i was lazy so just put responseXML so the previous parsing still works
					if (params.type == "settings") {
						entries = new Array();
						
						$.each(entriesDOM, function(a, entryDOM) {
							for (var node = entryDOM.firstChild; node != null; node = node.nextSibling) {
								if (node.nodeName == 'gCal:settingsProperty') {
									entries.push({id:node.getAttribute('name'), value:node.getAttribute('value')})
								}
							}
						});
						
						feed.entries = entries;
						feed.settingEntries = true;
					}
					
					updateArray(feeds, feed);
					callback({
						feed : feed,
						status : status,
						responseXML : request.responseXML,
						success : true,
						fromCache : false,
						mainCalendar : params.mainCalendar
					});
				} else {
					//0 success (when no internet)
					//401 error (when not gmail logged)
					//403 error (when not gmail logged)
					logError("getEntries: " + status + " " + textStatus + " url: " + fullURL);
					var offlineFeed = null;
					if (true || pref("offlineMode")) {
						offlineFeed = getElementInArray(feeds, params.url);
					}
					if (!offlineFeed) {
						offlineFeed = {entries:new Array()}
					}
					callback({
						feed : offlineFeed,
						status : status,
						fromCache : true,
						mainCalendar : params.mainCalendar
					});
				}
				
				var source = params.pollParams.source;
				if (!source) {
					source = "interval";
				}
				var type = params.type; 
				
				if (status == 200) {
					sendGA(['_trackEvent', 'getEntries', source, type]);
				}
				
				var source2;
				var type2;
				
				if (params.mainCalendar) {
					source2 = "mainCalendar";
					type2 = params.pollParams.totalCalendars;
					if (type2) {
						// seems analtics was not accepting int but only strings
						type2 = type2.toString();
					}
				} else {
					source2 = "other";
					type2 = params.url;
				}
					
				sendGA(['_trackEvent', 'getEntries2', source2, type2]);
			}
		});

	}
	
}

function showLoggedOut() {
	chrome.browserAction.setBadgeBackgroundColor({color:GRAY});
	chrome.browserAction.setBadgeText({text : "X"});
	chrome.browserAction.setTitle({title : getMessage("notLoggedIn")});
}

function logout() {
	console.log("logout");
	if (pref("signedOutOfGoogleCalendarAction", "signOut") == "staySignedIn") {
		console.log("logout cancelled");
	} else {		
		loggedOut = true;
		showLoggedOut();
		clearMemory();
	}
}

function clearEventTraces() {
	console.log('clearEventTrace');
	localStorage.removeItem("feeds");
	clearMemory();
}

function clearSnoozers() {
	snoozers = new Array();
	localStorage.removeItem('snoozers');
	console.log("Cleared snoozers!");
}

function clearMemory() {
	feeds = new Array();
}

function clearEventsShown() {
	eventsShown = new Array();
	localStorage.removeItem('eventsShown');
	console.log("Cleared events shown!");
}

function getStartDateOfPastEvents() {
	return new Date(now()-(ONE_DAY*4));
}

function getStartDateBeforeThisMonth() {
	var date = today();
	date.setDate(1);
	date.setHours(1);
	date.setMinutes(1);
	date.setDate(date.getDate()-MAX_POSSIBLE_DAYS_FROM_NEXT_MONTH);
	return date; 
}

// usage: params.badgeText = undefined (don't change anything) badgeText = "" then remove badgeText etc...
function updateBadge(params) {
	if (!params) {
		params = {};
	}
	
	var iconName = pref("badgeIcon", "default");
	var state = navigator.onLine ? "" : "_offline";
	var imageSrc = "images/icons/icon-19_" + iconName.replace("WithDate", "") + state + ".png";
	
	chrome.browserAction.getBadgeText({}, function(previousBadgeText) {
		var badgeTextVisibilityToggled = false;
		if ((params.forceRefresh && params.badgeText) || (params.badgeText != undefined && params.badgeText != previousBadgeText)) {
			badgeTextVisibilityToggled = true;
			try {
				chrome.browserAction.setBadgeText({text:params.badgeText});
			} catch (e) {
				logError("error setting badgetext: " + e);
			}
		}
		
		// if icon changed from last time or badgeTextVisibilityToggled then update it icon
		if (params.forceRefresh || imageSrc != lastBadgeIcon || badgeTextVisibilityToggled || !lastBadgeDate.isToday()) {
			var image = new Image();
			image.src = imageSrc;
			image.onload = function() {
				var badgeIconCanvas = document.getElementById('badgeIconCanvas');
				// the onload loads again after changing badeicon and document.body is empty, weird, so check for canvas
				if (badgeIconCanvas) {
					badgeIconCanvas.width = image.width;
					badgeIconCanvas.height = image.height;
					context = badgeIconCanvas.getContext('2d');
					context.drawImage(image, 0, 0);
					
					if (iconName.indexOf("WithDate") != -1) {
						//context.font = 'bold 11px "helvetica", sans-serif';
						//context.font = "20px Times New Roman";
						context.shadowOffsetX = 1;
						context.shadowOffsetY = 1;
						context.shadowBlur = 1;
						context.shadowColor = "rgba(0, 0, 0, 0.2)";
						if (iconName == "newWithDate" || iconName == "new2WithDate") {
							context.font = 'bold 12px "arial", sans-serif';
							context.fillStyle = '#FFF'
						} else {
							context.font = 'bold 10px "arial", sans-serif';
							context.fillStyle = "#333"
						}
						context.textAlign = "center";
						var day = (new Date).getDate();
						
						var heightOffset;
						
						var hasHasBadgeText = false;
						if (params.badgeText == undefined) {
							if (previousBadgeText) {
								hasHasBadgeText = true;
							}
						} else {
							if (params.badgeText) {
								hasHasBadgeText = true;
							}
						}						
						
						if (hasHasBadgeText) {
							heightOffset = 11;
						} else {
							heightOffset = 13;
						}
							
						context.fillText(day, badgeIconCanvas.width / 2 - 0, heightOffset);
						lastBadgeDate = new Date();
					}
					chrome.browserAction.setIcon({imageData: context.getImageData(0, 0, 19, 19)});
				}
			}
		}
		lastBadgeIcon = imageSrc;
	});
		
}

function getNodeValue(elements, key, defaultValue) {
	var value = null;
	if (elements) {
		$.each(elements, function(a, element) {
			if (element.getAttribute("name") == key) {
				value = element.getAttribute("value");
			}
		});
	}
	if (defaultValue == undefined) {
		defaultValue = false;
	}
	return value == null ? defaultValue : toBool(value);
}

function getSetting(settings, key, defaultValue) {
	var value = null;
	if (settings) {
		$.each(settings, function(a, setting) {
			if (setting.id == key) {
				value = setting.value;
				return false;
			}
		});
	}
	if (defaultValue == undefined) {
		defaultValue = false;
	}
	return value == null ? defaultValue : toBool(value);
}

function getSignedInEmails(callback) {
	// look to see if calendar is signed into first
	getDefaultSignedInCalendarEmail(function(email) {
		if (email) {
			callback([email]);
		} else {
			// not signed into calendar, but maybe they are signed into their gmail
			getSignedInGmailEmails({}, function(params) {
				if (params.error) {
					callback();
				} else {
					console.log("gmail emails: ", params.emails);
					callback(params.emails);
				}
			});
		}
	});
}

function getDefaultSignedInCalendarEmail(callback) {
	chrome.cookies.getAll({domain:"www.google.com", name:"OL_SESSION"}, function (cookies) {
		var email;
		// Somethis happens on chrome/extenion startup: Error during cookies.getAll: No accessible cookie store found for the current execution context.
		if (cookies) {
			$.each(cookies, function(index, cookie) {
				if (cookie.path == "/calendar") { // the rest are /calendar/b/1 etc.
					email = cookie.value.match(/(.*)-cal/i)[1]; // ie. "test%40gmail.com-cal2"
					email = unescape(email);
					return false;
				}
			});
		}
		callback(email);
	});
}

function getSignedInGmailEmails(params, callback) {
	var MAX_ACCOUNTS = 10;
	if (params.accountIndex == undefined) {
		params.accountIndex = 0;
	} else {
		params.accountIndex++;
	}
	if (!params.emails) {
		params.emails = [];
	}
	
	if (params.accountIndex < MAX_ACCOUNTS && navigator.onLine) {
		console.log("fetch emails for index: " + params.accountIndex);
		$.ajax({
			type: "GET",
			dataType: "text",
			url: "https://mail.google.com/mail/u/" + params.accountIndex + "/feed/atom?timestamp=" + Date.now(),
			timeout: 5000,
			complete: function(jqXHR, textStatus) {
				if (textStatus == "success") {				
					var parser = new DOMParser();
				   	parsedFeed = $(parser.parseFromString(jqXHR.responseText, "text/xml"));
				   
				   	var titleNode = parsedFeed.find('title');
				   	if (titleNode.length >= 1) {
					   	var mailTitle = $(titleNode[0]).text().replace("Gmail - ", "");
					   	// patch because <title> tag could contain a label with a '@' that is not an email address ie. Gmail - Label '@test@' for blahblah@gmail.com
					   	var emails = mailTitle.match(/([\S]+@[\S]+)/ig);
					   	var email = emails.last();
	
						params.emails.push(email);
	
					   	getSignedInGmailEmails(params, callback);
				   	} else {
				   		var error = "Could not find title node from feed";
				   		logError(error);
				   		callback({error:error});
				   	}				
				} else {
					if (jqXHR.status == 401 || textStatus.toLowerCase() == "unauthorized") {
						// finally reached an unauthorized account so should be the end, let's exit recursion
						callback(params);
					} else {						
						// could be timeout so skip this one and keep going
						console.warn("could be timeout so skip this one and keep going: ", textStatus, jqXHR);
						getSignedInGmailEmails(params, callback);
					}
				}
			}
		});
	} else {
		var error = "max accounts reached or not online";
		logError(error);
		callback({error:error});
	}
}

function feedUpdatedToday(feed) {
	if (feed) {
		var lastFetched = new Date(feed.CPlastFetched);
		return lastFetched.isToday();
	}
}

function feedUpdatedWithinTheseDays(feed, days) {
	if (feed) {
		var lastFetched = new Date(feed.CPlastFetched);
		return lastFetched.diffInDays() >= -days;
	}
}

function getArrayOfCalendars() {
	if (cachedFeeds["calendarList"]) {
		return cachedFeeds["calendarList"].items;		
	} else {
		return [];
	}
}

function fetchCalendarList(params, callback) {

	if (!params) {
		params = {};
	}
	
	if (!callback) {
		callback = function() {};
	}
	
	var feedFromCache = cachedFeeds.calendarList;	
	
	if (params.bypassCache != true && feedFromCache && feedUpdatedToday(feedFromCache) && feedFromCache.email == params.email) {
		console.log("Fetching calendarlist [CACHE]");
		processCalendarListFeed(params, callback);
	} else {
		console.log("Fetching calendarlist");
		oAuthForDevices.send({userEmail:params.email, url: "/users/me/calendarList"}, function(response) {
			if (response.data) {
				// adding my custom additional attribute
				response.data.CPlastFetched = new Date();
				cachedFeeds.calendarList = response.data;
				cachedFeeds.calendarList.email = params.email;
				processCalendarListFeed(params, callback);
			} else {
				logError("Error fetching feed: ", response.error);
				if (feedFromCache) {
					console.log("instead we are fetching from cache");
					processCalendarListFeed(params, callback);
				} else {
					callback(response);
				}
			}
		});
	}
}

function processCalendarListFeed(params, callback) {
	var calendarList = getArrayOfCalendars();

	// find primary calendar, they must be owner and the id shuold be the email and should not contain calendar.google.com
	$.each(calendarList, function(index, calendar) {
		if (calendar.id == params.email) {
			calendar.primaryCalendar = true;
			primaryCalendar = calendar;
			return false;
		}
		/*
		if (calendar.accessRole == "owner" && calendar.id.indexOf("@") != -1 && calendar.id.indexOf("calendar.google.com") == -1) {
			primaryCalendar = calendar;
			email = calendar.id;
			return false;
		}
		*/
	});
	
	calendarList.sort(function(a, b) {
		if (a.id == primaryCalendar.id) {
			return -1;
		} else if (b.id == primaryCalendar.id) {
			return +1;
		} else if (a.accessRole == "owner") {
			return -1;
		} else if (b.accessRole == "owner") {
			return +1;
		} else if (a.summary.toLowerCase() < b.summary.toLowerCase()) {
			return -1;
		} else {
			return +1;
		}
	});
		
	fetchAllCalendarEvents(params, function(response) {
		if (response.error) {
			callback(response);
		} else {
			events = response.events;
			
			var allDayVStimeSpecific = pref("showTimeSpecificEventsBeforeAllDay") ? -1 : 1;
			events.sort(function(e1, e2) {
				if (e1.allDay && !e2.allDay && e1.startTime.isSameDay(e2.startTime)) {
					return allDayVStimeSpecific * -1;
				} else if (!e1.allDay && e2.allDay && e1.startTime.isSameDay(e2.startTime)) {
					return allDayVStimeSpecific * +1
				} else {
					var retValue = null;
					try {
						retValue = e1.startTime.getTime() - e2.startTime.getTime();
					} catch (e) {
						logError(e1 + "_" + e2);
					}
					if (e1.allDay && e2.allDay && e1.startTime.isSameDay(e2.startTime)) {
						// make sure no null summaries "Untitled event"
						if (e1.summary && e2.summary) {
							if (e1.summary.toLowerCase() < e2.summary.toLowerCase()) {
								return -1;
							} else if (e1.summary.toLowerCase() > e2.summary.toLowerCase()) {
								return +1; 
							} else {
								return 0;
							}
						} else {
							return -1;
						}
					} else {
						return retValue;
					}
				}
			});
			// User might have logged out during the fetching of calendars, must empty the array because in offlineMode combined with bacground mode these events were refilled after being cleared with logout
			if (loggedOut) {
				//console.log("logged out during calendar fetching so clear gEvents");
				//events = [];
			}
	
			if (true || pref("offlineMode")) {
				//localStorage["feeds"] = JSON.stringify(feeds);
			}
	
			if (pref("console_messages")) {
				console.log("=====start====");
				console.log("events...")
				/*
				$.each(events, function(d, event) {
					if (event.allDay) {
						console.log("               " + event.summary);
					} else {
						console.log((event.startTime.getTime() - now()) + " " + " " + event.summary);
					}
				});
				*/
				console.log("=====end====");
			}
			
			// exclude calendars with lots of events from writing to localstorage (because causes quota error and might prevent caching atleast the smaller calendars)
			var MAX_EVENTS_PER_CALENDAR = 300;
			var feedsToSerialize = {};
			for (var feedKey in cachedFeeds) {
				var cachedFeed = cachedFeeds[feedKey];
				if (cachedFeed && cachedFeed.items) {
					if (cachedFeed.items.length < MAX_EVENTS_PER_CALENDAR) {
						feedsToSerialize[feedKey] = cachedFeed;
					} else {
						console.warn("excluding 'large' calendar from localStorage: " + cachedFeed.summary + " - " + feedKey);
					}
				} else {
					feedsToSerialize[feedKey] = cachedFeed;
				}
			}
			
			try {				
				localStorage.cachedFeeds = JSON.stringify(feedsToSerialize);
			} catch (e) {
				logError("localstorage is probably full and couldn't save cachedfeeds", e);
			}
			
			checkEvents(params);
			callback({fetchedEventsFromServer:true});
		}
	});

}

function fetchAllCalendarEvents(params, callback) {
	
	var startDate;
	var endDate;
	
	if (params.startDate) { // override defaults if passed here
		startDate = params.startDate;
		endDate = params.endDate;
	} else { // default dates...
		startDate = getStartDateBeforeThisMonth();

		// Must pull all events visible in month view so that the drag drop for moving events can locate the event ids
		var maxDaysAhead = (31-today().getDate()) + MAX_POSSIBLE_DAYS_FROM_NEXT_MONTH;
		// if pref: maxDaysAhead is larger than this than use it instead
		maxDaysAhead = Math.max(maxDaysAhead, parseInt(pref("maxDaysAhead", 2))+1);
		
		endDate = new Date(now()+(ONE_DAY*(maxDaysAhead)));
		// must do this because or else enddate is always seconds off and i use this enddate diff to determine if i should fetch more feeds
		endDate.setHours(23);
		endDate.setMinutes(0);
		endDate.setSeconds(0);
		endDate.setMilliseconds(0);
	}
	
	console.log("startdate: " + startDate);
	
	oAuthForDevices.ensureTokenForEmail(params.email, function(response) {
		if (response.error) {
			callback(response);
		} else {

			var deferreds = new Array();
			var events = [];
			
			var selectedCalendars = getSelectedCalendars(); 

			$.each(getArrayOfCalendars(), function(index, calendar) {
				// must clone because .calendar for instance is alway set as the last iterated calendar after looping here
				var moreParams = clone(params);
				
				moreParams.calendar = calendar;
				moreParams.startDate = startDate;
				moreParams.endDate = endDate;
				
				var deferred = fetchCalendarEvents(moreParams, selectedCalendars, function(response) {
					if (response.error) {
						logError("error fetching calendar:", response.error);
					}
				});
				deferreds.push(deferred);		
			});

			$.when.apply($, deferreds).always(function(response, response2, response3) {
				// instead of mentioning the respones in the params, use .arguments to fetch them all, note this respones were set with the "dfd.resolve(response)"
				console.log("responses:", arguments);
				
				var errorResponses = 0;
				var revokedAccess = false;
				
				$.each(arguments, function(index, response) {
					if (response.error) {
						errorResponses++;
						if (response.jqXHR.status == 401) {
							revokedAccess = true;
						}
					} else {
						if (response.data && response.data.items) {

							$.each(response.data.items, function(index, event) {
								
								// jason add calendar to event and add defaultreminders to event for reference 
								event.calendar = response.roundtripArg;
								event.calendar.defaultReminders = response.data.defaultReminders;
								
								initEventObj(event);
							});
							
							events = events.concat(response.data.items);
						}
					}
				});
				
				if (revokedAccess) {
					// should be handled by onTokenError
					// so do nothing
				} else if (arguments.length == errorResponses) {
					logout();
				} else {
					loggedOut = false;
				}
				
				callback({events:events, errorResponses:errorResponses, revokedAccess:revokedAccess});

			});
		
		}
	});	
	
}

function fetchCalendarEvents(params, selectedCalendars, callback) {
	var dfd = new $.Deferred();
	
	var feedFromCache = cachedFeeds[params.calendar.id];
	// simulate response and pass this "dummy" roundtripArg because it is fetched in .always 
	var response = {data:feedFromCache, roundtripArg:params.calendar};

	if ( isCalendarSelectedInExtension(params.calendar, email, selectedCalendars) || (pref("desktopNotification", true) && !isInArray(params.calendar.id, excludedCalendars) && !isGadgetCalendar(params.calendar))) {
	
		var calendarThatShouldBeCached =
			params.calendar.id.indexOf("holiday.calendar.google.com") != -1 ||
			params.calendar.id.indexOf("group.v.calendar.google.com") != -1 || // includes Interesting calendars "more" section ie. Contacts's bdays, Day of the year etc.
			params.calendar.id.indexOf("import.calendar.google.com") != -1
			
			// commented out because these are now excluded via the isGadgetCalenadar with the previous call abovee to isCalendarSelectedInExtension
			//params.calendar.id.indexOf("g0k1sv1gsdief8q28kvek83ps4@group.calendar.google.com") != -1 || 	// Week Numbers
			//params.calendar.id.indexOf("ht3jlfaac5lfd6263ulfh4tql8@group.calendar.google.com") != -1 		// Phases of the Moon
	  	;
		
		var expired = false;
		
		// weather feed must be updated daily
		if (params.calendar.id == "p#weather@group.v.calendar.google.com") {
			// commented: don't ever refresh this weather calendar because i'm not using it the weather display
			//expired = !feedUpdatedToday(feedFromCache);
		} else if (calendarThatShouldBeCached) {
			expired = !feedUpdatedWithinTheseDays(feedFromCache, 30);
		}
		
		/*
		console.log("bypasscache: " + params.bypassCache)
		console.log("calendarThatShouldBeCached: " + calendarThatShouldBeCached)
		console.log("feedFromCache: " + feedFromCache)
		console.log("expired: " + expired)
		if (feedFromCache) {
			console.log("params.startDate.isEqualOrAfter(feedFromCache.CPstartDate): " + params.startDate.isEqualOrAfter(feedFromCache.CPstartDate))
			console.log("params.endDate.isEqualOrBefore(feedFromCache.CPendDate): " + params.endDate.isEqualOrBefore(feedFromCache.CPendDate))
			console.log("params.startDate: " + params.startDate)
			console.log("mCache.CPstartDate: " + feedFromCache.CPstartDate)
			console.log("params.endDate: " + params.endDate.getTime())
			console.log("ache.CPendDate: " + feedFromCache.CPendDate.getTime())
		}
		*/
	
		// one time such as browsing calendar next/prev (let's use cache if possible and NOT override cache with these results)
		var oneTimeFetch = params.source == "popup" || params.source == "agenda" || params.source == "selectedCalendars";
		
		if (params.bypassCache != true && (calendarThatShouldBeCached || oneTimeFetch) && feedFromCache && !expired && params.startDate.isEqualOrAfter(feedFromCache.CPstartDate) && params.endDate.isEqualOrBefore(feedFromCache.CPendDate)) {
			console.log("Fetching " + params.calendar.summary + " [CACHED]");
			callback(response);
			dfd.resolve(response);
		} else {
			console.log("Fetching " + params.calendar.summary);
			
			var moreParams = clone(params);
			moreParams.userEmail = params.email;
			moreParams.roundtripArg = params.calendar;
			moreParams.url = "/calendars/" + encodeURIComponent(params.calendar.id) + "/events";
			moreParams.data = {orderBy:"startTime", maxResults:1000, singleEvents:true, timeMin:params.startDate.toRFC3339(), timeMax:params.endDate.toRFC3339()};
			
			oAuthForDevices.send(moreParams, function(response) {
				if (response.error) {
					logError("error in oauth send:", response.error);
				} else {
					
					if (!oneTimeFetch) {
						// adding my custom additional attribute
						response.data.CPlastFetched = new Date();
						response.data.CPstartDate = params.startDate;
						response.data.CPendDate = params.endDate;
					
						cachedFeeds[params.calendar.id] = response.data;
					}
				}
				
				callback(response);
				dfd.resolve(response);
	
				try {
					var calendarSource;
					/*
					var source = params.source;
					if (!source) {
						source = "interval";
					}
					*/
					var label;
					
					if (params.calendar.primaryCalendar) {
						calendarSource = "mainCalendar";
						label = cachedFeeds["calendarList"].items.length;
						if (label) {
							// seems analtics was not accepting int but only strings
							label = label.toString();
						}
					} else {
						calendarSource = "other";
						label = params.calendar.id + ": " + params.calendar.summary + " - " + params.calendar.accessRole;
					}
						
					sendGA(['_trackEvent', 'getEntries4', calendarSource, label]);
				} catch (e) {
					console.error("error with GA on getentries4: " + e);
				}
			
			});
		}
	} else {
		console.log("Fetching " + params.calendar.summary + " [invisible + (notifs off OR excluded OR isGadget]");
		callback(response);
		dfd.resolve(response);
	}	
	return dfd.promise();
}

function pollServer(params) {
	if (!params) {
		params = {};
	}
	
	if (!params.callback) {
		params.callback = function() {};
	}
	
	pendingLoadId_ = "";
	lastPollTime = now();
	
	getSignedInEmails(function(emails) {
		
		signedInEmails = emails;
		if (emails) {
			email = emails.first();
		}
		
		var emailToFetch;
		var mustLogout = false;
		
		if (tokenResponses.length) {
			if (pref("signedOutOfGoogleCalendarAction", "signOut") == "signOut") {
				if (emails && emails.length) {
					if (oAuthForDevices.findTokenResponse({userEmail:email})) {
						emailToFetch = email;
					} else {
						console.log("default email " + email + " has no token");
						mustLogout = true;
					}
					/*
					var tokenResponseForDefaultEmail;
					// loop through all emails
					$.each(emails, function(emailsIndex, thisEmail) {							
						// loop through all tokens
						$.each(tokenResponses, function(tokenResponsesIndex, tokenResponse) {
							if (tokenResponse.userEmail == thisEmail) {
								tokenResponseForDefaultEmail = tokenResponse;
								return false;
							}
						});
						if (tokenResponseForDefaultEmail) {
							return false;
						}
					});
					if (tokenResponseForDefaultEmail) {
						emailToFetch = tokenResponseForDefaultEmail.userEmail;
					} else {
						console.log("no tokens found for signed in emails:", emails);
						mustLogout = true;
					}
					*/
				} else {
					if (navigator.onLine) {
						console.log("not signed in")
						mustLogout = true;
					} else {
						console.log("no emails because we are offline")
					}
				}
			} else {
				// get most recent token used
				var mostRecentTokenUsed;
				$.each(tokenResponses, function(index, tokenResponse) {
					if (!mostRecentTokenUsed || tokenResponse.expiryDate.isAfter(mostRecentTokenUsed.expiryDate)) {
						mostRecentTokenUsed = tokenResponse;
					}
				});
				
				email = mostRecentTokenUsed.userEmail
				emailToFetch = email;
			}
		} else {
			console.log("no tokens saved");
			mustLogout = true;
		}
		
		if (emailToFetch && !mustLogout) {
			
			params.email = emailToFetch;
			
			if (loggedOut) {
				chrome.browserAction.setBadgeBackgroundColor({color:[255, 255, 255, 1]});
				updateBadge({badgeText:"..."});
				chrome.browserAction.setTitle({title:"Loading..."});
			}
			
			if (navigator.onLine) {
				fetchCalendarSettings(params, function(response) {
					fetchColors(params, function(response) {
						// Legacy: need to get the colors from the old v2 feed to be used in the old embed calendar
						getEntries({url:"https://www.google.com/calendar/feeds/default/allcalendars/full", type:"fetchCalendars", pollParams:params}, function(response) {
							fetchCalendarList(params, function(response) {
								params.callback(response);
							});
						});
					});
				})
			} else {
				console.log("offline: so skip ALL fetches");
				params.callback();
			}
		} else {
			console.log("no email found");
			logout();
			params.callback();
		}
		
		});
		
}

function isCurrentlyDisplayed(event) {
	for (var a=0; notification=notificationsQueue[a], a<notificationsQueue.length; a++) {
		if (isSameEvent(event, notification.event)) {
			log("current displayed", "showConsoleMessagesEventsSnoozes");
			return true;
		}
	}
	return false;
}

function isEventShownOrSnoozed(event, reminderTime) {
	
	if (isCurrentlyDisplayed(event)) {
		return true;
	}
	
	// Must check snoozers before eventsshown because a snoozed event has remindertime passed as a param
	for (var a=0; a<snoozers.length; a++) {
		if (isSameEvent(event, snoozers[a].event)) {
			return true;
		}
	}
	for (var a=0; eventShown=eventsShown[a], a<eventsShown.length; a++) {		
		if (isSameEvent(event, eventShown)) {
			log("matched in eventsShown", "showConsoleMessagesEventsSnoozes");
			if (event.startTime.getTime() == eventShown.startTime.getTime()) {
				// Check that this particular reminder time has not been shown (may have other reminder times due to the ability to set multiple popup reminder settings per event)
				log("starttimes are equal", "showConsoleMessagesEventsSnoozes");
				if (reminderTime) {
					log("reminderTime param passed", "showConsoleMessagesEventsSnoozes");
					if (eventShown.reminderTimes) {
						for (var b=0; thisReminderTime=eventShown.reminderTimes[b], b<eventShown.reminderTimes.length; b++) {
							if (thisReminderTime.time && reminderTime) {
								if (thisReminderTime.time.getTime() == reminderTime.getTime()) {
									log(getSummary(event) + " reminderTime found in reminderTimes[]", "showConsoleMessagesEventsSnoozes");
									return thisReminderTime.shown;
								}
							} else {
								logError("One is empty: " + thisReminderTime + " _ " + reminderTime);
							}
						}
					}
				} else {
					return true;
				}
			} else {
				return false;
			}
		}
	}
	log("past eventsShown loop return false", "showConsoleMessagesEventsSnoozes");
	return false;
}

function isTimeToShowNotification(event, reminderTime) {
	var pastDoNotShowPastNotificationsFlag = true;
	if (pref("doNotShowPastNotifications")) {

		// get minimum buffer which is equal to check interval
		var bufferInSeconds = CHECK_EVENTS_INTERVAL / ONE_SECOND;
		// than add double that buffer (just to make sure)
		bufferInSeconds += bufferInSeconds * 2;
		var bufferDate = new Date().subtractSeconds(bufferInSeconds);
		
		//if (reminderTime.isBefore(extensionStartTime)) {
		// ** using endTime instead of reminderTime (because if the event is still in progress than still show notification)
		if (event.endTime && event.endTime.isBefore(bufferDate)) {
			pastDoNotShowPastNotificationsFlag = false;
		}
	}
	
	// the journal exception: do not show notification for events created in the past, like when marieve puts past events for the purpose of journaling
	var createdDate;
	if (event.created) {
		createdDate = new Date(event.created);
	}
	
	var isTimeToShow = false;
	if (!event.allDay && reminderTime && pastDoNotShowPastNotificationsFlag && reminderTime.isBefore()) {
		isTimeToShow = true;
	} else if ((event.allDay && isToday(reminderTime) && today().getHours() >= 5) || (event.allDay && !isToday(reminderTime) && pastDoNotShowPastNotificationsFlag && reminderTime.isBefore())) {
		isTimeToShow = true;
	} else {
		isTimeToShow = false;
	}

	// dno't show if created in past or if all day event is created today
	if (isTimeToShow && createdDate && reminderTime && (reminderTime.isBefore(createdDate) || (event.allDay && reminderTime.isToday() && createdDate.isToday()) ) ) {
		//console.log("journal exception", event.summary, reminderTime, createdDate);
		isTimeToShow = false;
	}
	
	return isTimeToShow;
}

function generateNotificationButton(buttons, buttonsWithValues, value, event) {
	if (value) {
		
		var button;
		
		if (value == "dismiss") {
			// dismiss
			
			var title;
			if (isGroupedNotificationsEnabled() && notificationsOpened.length >= 2) {
				title = getMessage("dismissAll");
			} else {
				title = getMessage("dismiss");
			}
			button = {title:title, iconUrl:"images/cancel.png"};
			
		} else if (value == "snoozeTimes") {
			button = {title:"Snooze times...", iconUrl:"images/snooze.png"};
		} else if (value == "location|hangout") {
			if (!isGroupedNotificationsEnabled() || (isGroupedNotificationsEnabled() && notificationsOpened.length == 1)) {
				if (event) {
					var eventSource = getEventSource(event);
					//eventSource = {title:"Hello", url:"https://mail.google.com"};
					
					if (event.hangoutLink) {
						button = {title:getMessage("joinVideoCall"), iconUrl:"images/Google+.png"};
					} else if (eventSource) {
						var iconUrl;
						if (eventSource.url.match("https?://mail.google.com")) {
							iconUrl = "images/gmail.png";
						} else {
							iconUrl = "images/link.png";
						}
						button = {title:eventSource.title, iconUrl:iconUrl};
					} else if (event.location) {
						button = {title:event.location, iconUrl:"images/pin_map.png"};
					}
				}
			}
		} else if (value == "reducedDonationAd") {
			button = {title:getMessage("reducedDonationAd_notification", "50¢")};
			//button = {title:"Extras are only 50c click to see/hide this.", iconUrl:"images/thumbs_up.png"};
		} else {
			// snooze
			var unit = value.split("_")[0];
			var delay = value.split("_")[1];
			
			var msgId;
			if (unit == "minutes") {
				msgId = "Xminutes"
			} else if (unit == "hours") {
				if (delay == 1) {
					msgId = "Xhour";
				} else {
					msgId = "Xhours";
				}
			} else if (unit == "days") {
				if (delay == 1) {
					msgId = "Xday";
				} else {
					msgId = "Xdays";
				}
			} else {
				console.error("no unit in snooze: " + unit);
			}
			
			var title;
			if (isGroupedNotificationsEnabled() && notificationsOpened.length >= 2) {
				title = getMessage("snoozeAll");
			} else {
				title = getMessage("snooze");
			}
			title += ": " + getMessage(msgId, delay) + "";
			button = {title:title, iconUrl:"images/snooze.png"};
		}

		if (button) {
			buttons.push(button);
			
			var buttonWithValue = clone(button);
			buttonWithValue.value = value;
			buttonsWithValues.push(buttonWithValue);
		}
	}
}

function getNotificationEventTitle(event) {
	var title = getSummary(event);
	if (!title) {
		title = "(" + getMessage("noTitle") + ")";
	}
	return title;
}

function getEventNotificationDetails(event) {
	// if not signed in then set a default calendar so the rest doesn't get undefined
	if (!event.calendar) {
		event.calendar = {};
		event.calendar.main = true;
	}
	
	var title = getNotificationEventTitle(event);
	
	// show calendar name if not the main one
	var calendarName;
	var showCalendarInNotification = pref("showCalendarInNotification", "onlyNonPrimary");
	if ((showCalendarInNotification == "onlyNonPrimary" && !event.calendar.primaryCalendar) || showCalendarInNotification == "always") {
		calendarName = getCalendarName(event.calendar);
		if (!calendarName) {
			calendarName = "";
		}
	}

	var timeElapsed = getTimeElapsed(event);
	
	return {title:title, calendarName:calendarName, timeElapsed:timeElapsed};
}

function generateNotificationItem(event) {
	var eventNotificationDetails = getEventNotificationDetails(event);
	var item = {};
	item.title = eventNotificationDetails.title;
	item.message = "";
	if (eventNotificationDetails.timeElapsed) {
		item.message = " " + eventNotificationDetails.timeElapsed;
	}
	if (eventNotificationDetails.calendarName) {
		if (item.message) {
			item.message += " ";
		}
		item.message += "(" + eventNotificationDetails.calendarName + ")";
	}
	return item;
}

function generateNotificationOptions(notifications) {
	
	var type = "";
	var title = "";
	var message = "";
	var items = [];
	var imageUrl;

	// seems linux user are getting empty notifications when using the type='image' (refer to denis sorn) so force them to use type="basic"
	var patchForLinuxUsers = navigator.userAgent.toLowerCase().indexOf("linux") != -1;

	if (pref("richNotificationFontSize", "small") == "small" || patchForLinuxUsers) {
		 
		if (notifications.length == 1) {
			type = "list";
			var eventNotificationDetails = getEventNotificationDetails(notifications[0].event);
			title = eventNotificationDetails.title;
			
			var item = {title: "", message: ""}			
			if (eventNotificationDetails.timeElapsed) {
				item.message = eventNotificationDetails.timeElapsed;
			}
			if (eventNotificationDetails.calendarName) {
				if (item.message) {
					item.message += " ";
				}
				item.message += "(" + eventNotificationDetails.calendarName + ")";
			}
			items.push(item);			
		} else {
			type = "list";
			var startOfOldNotifications = 0;
			
			// if only 1 new recent event among the old ones than highlight it (bigger font) by putting it in the title of the notification
			if (notifications.length >= 2 && notifications[0].recent && !notifications[1].recent) {
				
				var eventNotificationDetails = getEventNotificationDetails(notifications[0].event);
				title = eventNotificationDetails.title;
				if (eventNotificationDetails.timeElapsed) {
					title += " (" + eventNotificationDetails.timeElapsed + ")";
				}
				if (eventNotificationDetails.calendarName) {
					title += " (" + eventNotificationDetails.calendarName + ")";
				}
				
				startOfOldNotifications = 1;
			} else {
				if (navigator.userAgent && navigator.userAgent.toLowerCase().indexOf("linux") != -1) {
					// patch because linux gave empty notification unless the title was not empty or not empty string ""
					title = notifications.length + " reminders";
				}
			}
			
			var MAX_ITEM_LINES = 5;
			$.each(notifications, function(index, notification) {
				// skip those that have been highlighted already above
				if (index >= startOfOldNotifications) {
					// if on last available line and but there still 2 or more events than put the "more notice"
					if (items.length == MAX_ITEM_LINES - 1 && notifications.length - index >= 2) {
						items.push({title:(notifications.length - items.length - startOfOldNotifications) + " " + getMessage("more") + "...", message:""});
						return false;
					} else {
						var item = generateNotificationItem(notification.event);
						items.push(item);
					}
				}
			});
			
		}
	} else {
		type = "image";
		
		console.log("useragent", navigator);
		if (navigator.userAgent && navigator.userAgent.toLowerCase().indexOf("linux") != -1) {
			// patch because linux gave empty notification unless the title was not empty or not empty string ""
			title = "Reminder";
			message = "";
		} else if (navigator.platform && navigator.platform.toLowerCase().indexOf("win") != -1) {
			message = "                                    " + today().formatTime() + " " + today().format(getMessage("notificationDateFormat"));
			//title = "Good news long time user!";
			//message = "Get all the latest extra features for only 50¢";
		} else {
			// on mac the message area is shorter or bigger font (i think) and it displays the text bigger to the side 
			title = "";
			message = "";
		}
		
		var tempCanvas = document.getElementById("tempCanvas");
		var notificationCanvas = document.getElementById("notificationCanvas");
		var context = notificationCanvas.getContext("2d");
		
		var MAX_NOTIFICATION_WIDTH = 360;
		var MAX_NOTIFICATION_HEIGHT = 160;
		var EVENT_X_LEFT_BUFFER = 18;
		var EVENT_X_LEFT_BUFFER_WITH_DASHES = 8;
		var EVENT_X_RIGHT_BUFFER = 8;
		var EVENT_Y_SPACING = 10;
		var SMALL_FONT_X_BUFFER = 7;
		var TITLE_FONT = "18px Georgia";
		
		var MAX_TITLE_WIDTH_PERCENT = 0.88; // with no time elapsed
		var MAX_TITLE_WITH_TIME_ELAPSED_WIDTH_PERCENT = 0.75; // with time elapsed
		
		var x;
		var y = -4;
		var y = 10;

		// note: changing width/height after will blank out the canvas
		notificationCanvas.width = tempCanvas.width = MAX_NOTIFICATION_WIDTH;
		notificationCanvas.height = tempCanvas.height = 2000;
	
		$.each(notifications, function(index, notification) {
			var eventNotificationDetails = getEventNotificationDetails(notification.event);
			
			// test
			//eventNotificationDetails.title = "where did all the people find apples";
			//eventNotificationDetails.timeElapsed = "25 minutes ago";
			//eventNotificationDetails.calendarName = "Small things";
			
			context.textBaseline = "top";
			context.font = TITLE_FONT;
			
			if (notifications.length == 1) {
				x = EVENT_X_LEFT_BUFFER;
			} else { // 2 or more
				x = EVENT_X_LEFT_BUFFER_WITH_DASHES;
				var titlePrefix = "- ";
				context.fillStyle = "#ccc";
				context.fillText(titlePrefix, x, y);
				x += context.measureText(titlePrefix).width;
			}
			
			//context.fillStyle = "black";
			
			// calculate how much text we can fit on the line
			var title = eventNotificationDetails.title;
			var maxLetters = title.length * (MAX_NOTIFICATION_WIDTH / (context.measureText(title).width + x));
			if (x + context.measureText(title).width >= MAX_NOTIFICATION_WIDTH * MAX_TITLE_WIDTH_PERCENT && !eventNotificationDetails.timeElapsed) {
				title = title.substring(0, maxLetters * MAX_TITLE_WIDTH_PERCENT) + "…";
			} else if (x + context.measureText(title).width >= MAX_NOTIFICATION_WIDTH * MAX_TITLE_WITH_TIME_ELAPSED_WIDTH_PERCENT && eventNotificationDetails.timeElapsed) {
				title = title.substring(0, maxLetters * MAX_TITLE_WITH_TIME_ELAPSED_WIDTH_PERCENT) + "…";
			}
			
			//context.fillStyle = getEventColor(notification.event);
			context.fillStyle = "white";
			
			context.fillText(title, x, y);
			x += context.measureText(title).width + EVENT_X_RIGHT_BUFFER;
			
			if (eventNotificationDetails.timeElapsed) {
				context.font = "10px arial";
				context.fillStyle = "gray";
				context.textBaseline = "top";
				
				context.fillText(eventNotificationDetails.timeElapsed, x, y + SMALL_FONT_X_BUFFER);
				x += context.measureText(eventNotificationDetails.timeElapsed).width + EVENT_X_RIGHT_BUFFER;
			}
			
			if (eventNotificationDetails.calendarName) {
				context.font = "10px arial";
	
				//context.fillStyle = getEventColor(notification.event);
				context.fillStyle = "gray";
				
				context.fillText(eventNotificationDetails.calendarName, x, y + SMALL_FONT_X_BUFFER);
				x += context.measureText(eventNotificationDetails.calendarName).width + EVENT_X_RIGHT_BUFFER;
			}
	
			y += getTextHeight(TITLE_FONT).height + EVENT_Y_SPACING;
			
			var remainingEvents = notifications.length - index - 1;
			if (y + getTextHeight(TITLE_FONT).height + EVENT_Y_SPACING >= MAX_NOTIFICATION_HEIGHT && remainingEvents >= 2) {
				console.log("more...")
				context.font = "15px arial italic";
				context.fillStyle = "gray";
				context.textBaseline = "top";
				context.fillText(remainingEvents + " " + getMessage("more") + "...", EVENT_X_LEFT_BUFFER, y);
				y += getTextHeight(context.font).height + EVENT_Y_SPACING;
				return false;
			}
		});
		
		// save canvas to temp (because changing width/height after will blank out the canvas)
		var tempCanvasContext = tempCanvas.getContext('2d');
		
		tempCanvasContext.fillStyle = "#222";
		tempCanvasContext.fillRect(0,0, notificationCanvas.width, notificationCanvas.height);

		tempCanvasContext.drawImage(notificationCanvas, 0, 0);
		
		// resize new canvas
		var BOTTOM_BUFFER = 5;
		notificationCanvas.height = y + BOTTOM_BUFFER;
		//notificationCanvas.height = 240;
		
		// copy temp canvas to new canvas
		context.drawImage(tempCanvas, 0, 0, tempCanvas.width, notificationCanvas.height, 0, 0, notificationCanvas.width, notificationCanvas.height);
		imageUrl = notificationCanvas.toDataURL("image/png");
		
		/*
		var testcanvas = document.getElementById("testcanvas");
		var context = testcanvas.getContext("2d");
		
		context.width = 200;
		context.height = 200;
	
		context.textBaseline = "top";
		context.font = TITLE_FONT;
		context.fillStyle = 'yellow';
		context.fillRect(0,0,200,200);
		context.fillStyle = "#ccc";
		context.fillText("test", 0, 0);
		
		imageUrl = testcanvas.toDataURL("image/png");
		*/
	}

	var buttons = [];
	var buttonsWithValues = []; // used to associate button values inside notification object
	var buttonValue;
	
	var event = notifications.first().event;
	
	buttonValue = pref("notificationButton1", "hours_1");
	generateNotificationButton(buttons, buttonsWithValues, buttonValue, event);

	if (shouldShowReducedDonationMsg()) {
		buttonValue = "reducedDonationAd";
	} else {
		buttonValue = pref("notificationButton2", "location|hangout");
	}
	generateNotificationButton(buttons, buttonsWithValues, buttonValue, event);
	
	if (notifications.length) {
		$.each(notifications, function(index, notification) {
			notification.buttons = buttonsWithValues;
		});
	}
	
	var options = {
			type: type,
			title: title,
			message: message,
			buttons: buttons,
			iconUrl: "images/bell-middle.png",
			imageUrl: imageUrl
	}
	if (items.length) {
		options.items = items;
	}
	
	var showNotificationDuration = pref("showNotificationDuration", 25);
	if (showNotificationDuration == "7") {
		options.priority = 0;
	} else {
		options.priority = 1;
	}
	
	return options;
}

function generateNotificationIdFromEvent(event) {
	return event.summary + "_" + String(Math.floor(Math.random() * 1000000));
}

function openNotification(notifications, callback) {
	var options = generateNotificationOptions(notifications);
	//options.isClickable = true;
	
	console.log("create notif: ", notifications, options);
	
	var notificationId;
	if (isGroupedNotificationsEnabled()) {
		notificationId = GROUPED_NOTIFICATION_ID;
	} else {
		notificationId = notifications.first().id;
	}
	chrome.notifications.create(notificationId, options, function(notificationId) {
		var cbParams = {};
		if (chrome.extension.lastError) {
			logError("create notif error: " + chrome.extension.lastError.message);
			cbParams.error = chrome.extension.lastError;
		} else {
			lastNotificationShownDate = new Date();
			
			chrome.idle.queryState(IDLE_DETECTION_INTERVAL, function(newState) {
				console.log("idle state when show notif: " + newState);
				if (newState != "active") {
					notificationsOpenedCountWhenIdle = notificationsOpened.length;
				}
			});
			
			var pendingNotificationsInterval = pref("pendingNotificationsInterval", "15");
			if (pendingNotificationsInterval) {
				pendingNotificationsInterval = minutes(parseInt(pendingNotificationsInterval));
				// test
				//pendingNotificationsInterval = 10000;
				ForgottenReminder.start(pendingNotificationsInterval);
			}
		}
		callback(cbParams);
	});
}

var ForgottenReminder = (function() {
	var reminderCount;
	var interval;
	return { // public interface
		start: function(intervalTime) {
			// all private members are accesible here
			ForgottenReminder.stop();
			reminderCount = 0;
			interval = setInterval(function() {				
				reminderCount++;
				chrome.notifications.getAll(function(notifications) {
					if ($.isEmptyObject(notifications)) {
						// no reminders let's stop interval
						ForgottenReminder.stop();
					} else {
						ForgottenReminder.execute();
					}
				});
			}, intervalTime);
		},
		execute: function(params) {
			if (!params) {
				params = {};
			}
			if (params.test || reminderCount == 1) {
				if (pref("notificationSound", true)) {
					console.log("forgotten reminder sound: " + new Date());
					chrome.idle.queryState(15, function(newState) {
						if (newState == "active") {
							playNotificationSoundFile(true);
						}
					});					
				}
			}
			
			forgottenReminderAnimation.animate(function(previousBadgeText) {
				updateBadge({forceRefresh:true, badgeText:previousBadgeText});
			});			
		},
		stop: function() {
			clearInterval(interval);			
		}
	};
})();

function showNotifications(params) {
	if (!params) {
		params = {};
	}
	
	if (notificationsQueue.length >= 1) {
		
		var notificationWindowType = pref("notificationWindowType", "rich"); // default is html
		
		var textNotification = params.testType == "text" || (params.testType == undefined && notificationWindowType == "text");
		var richNotification = params.testType == "rich" || (params.testType == undefined && notificationWindowType == "rich");
		
		if (textNotification || !chrome.notifications) {
			
			if (window.webkitNotifications) {
				// text window
				$.each(notificationsQueue, function(a, notification) {
					
					var eventNotificationDetails = getEventNotificationDetails(notification.event);
					
					var title = eventNotificationDetails.title;
					var message = "";
					if (eventNotificationDetails.calendarName) {
						message = "from " + eventNotificationDetails.calendarName;
					}
	
					notificationWindow = window.webkitNotifications.createNotification('images/bell-48.png', title, message);
					notificationWindow.notification = notification;
					
					notificationWindow.onclick = function() {
						var url = this.notification.event.htmlLink;
						if (url) {
							createTab({url:url, urlToFind:this.notification.event.id}, function() {});
						}
						this.close();
					}			
					notificationWindow.ondisplay = function() {
						var thisNotification = this;
						if (pref("closePopupsAfterAWhile")) {
							setTimeout(function() {
								if (pref("actionForPopupsAfterAWhile", "dismiss") == "dismiss") {
									thisNotification.close();
								}
							}, ONE_SECOND * parseInt(pref("closePopupsAfterAWhileInterval", 1800)));
						}
					}			
					notificationWindow.onclose = function() {
						notificationWindow = null;
					}
					notificationWindow.onerror = function(e) {
						logError("error displaying text notification: " + e);
					}
					notificationWindow.show();
					
					// clear queue
					updateEventsShown([notification], eventsShown);
					notificationsQueue = [];
				});
			} else {
				console.warn("notifications not supported");
			}

		} else if (richNotification) {
			// rich notification
			
			// notificationsQueue = notifications that should be launched and are acculumated each time checkEvents is passed
			if (isGroupedNotificationsEnabled()) {
				// group notifications

				var newNotifications = [];
				var oldNotifications = [];
				$.each(notificationsQueue, function(a, notification) {
					
					// patch for issue when notification was not being removed when snoozed within snoozePopup because id's were mismatched
					if (!notification.id) {
						notification.id = generateNotificationIdFromEvent(notification.event);						
					}
					
					var found = false;
					$.each(notificationsOpened, function(index, notificationOpened) {
						if (isSameEvent(notification.event, notificationOpened.event)) {
							found = true;
							return false;
						}
						return true;
					});
					
					if (found) {
						notification.recent = false;
						oldNotifications.push(notification);
					} else {
						notification.recent = true;
						newNotifications.push(notification);
					}
				});
				
				// re-initialize eventsInGroupNotification *after performing code above to identify new notifications
				notificationsOpened = notificationsQueue.clone();
				
				var notificationsInOrder = [];
				//newNotifications.reverse();
				//oldNotifications.reverse();
				notificationsInOrder = notificationsInOrder.concat(newNotifications, oldNotifications);

				sortNotifications(notificationsInOrder);
				
				console.log("new notifs", newNotifications);
				if (newNotifications.length) {
					console.log("clear", newNotifications);
					chrome.notifications.clear(GROUPED_NOTIFICATION_ID, function(wasCleared) {
						openNotification(notificationsInOrder, function(response) {});
					});
				} else {
					console.log("nothing new", newNotifications);					
				}
				
			} else {
				// Individual Notifications
				// notificationOpened = notification that HAVE been launched
				// this method is used to make we don't relaunch notification that have already been displayed
				
				$.each(notificationsQueue, function(a, notification) {
	
					var found = false;
					$.each(notificationsOpened, function(index, notificationOpened) {
						if (isSameEvent(notification.event, notificationOpened.event)) {
							found = true;
							return false;
						}
						return true;
					});
					if (!found) {
						notification.id = generateNotificationIdFromEvent(notification.event);
						
						openNotification([notification], function(response) {
							if (!response.error) {
								notificationsOpened.push(notification);
							} 
						});
					}
	
				});
			}
		} else {
			// html window
			// Handle exists
			// not used anymore...
			logError("html not used anymore")
		}
	}
}

function getPollingInterval() {
	// note users before may have had polling intervals of 1, 2, 5 or 10 minutes WAY TOO SHORT sometimes
	return hours(1);
}

function getChromeWindowOrBackgroundMode(callback) {
	chrome.permissions.contains({permissions: ["background"]}, function(result) {
		if (result) {
			callback(true);
		} else {
			chrome.windows.getAll(null, function(windows) {
				if (windows && windows.length) {
					callback(true);
				} else {
					callback(false);
				}
			});
		}
	});
}

function checkEvents(params) {
	
	if (!params) {
		params = {};
	}
	
	getChromeWindowOrBackgroundMode(function(chromeWindowOrBackgroundMode) {
		if (chromeWindowOrBackgroundMode) {
			var pollingInterval = getPollingInterval();
			var selectedCalendars = getSelectedCalendars();
			
			// Update context menus on the hour and atleast every hour
			if (!contextMenuLastUpdated || ((today().getMinutes() == 0 || today().getMinutes() == 30) && contextMenuLastUpdated.diffInMinutes() <= -30)) {
				updateContextMenuItems();
			}
			
			// SKIP because interval to short
			if (params.source == "interval" && (now() - lastCheckEventsTime) < CHECK_EVENTS_INTERVAL) {
				console.log("skip checkevents");
				return;
			}
			lastCheckEventsTime = now();
			console.log("checkEvents");
			
			if (!loggedOut) {
				var nextEvent = null;
				var badgeText = "";
				var badgeColor = null;
				var title = "";
				var previousNextEvent = null;
				var unitOfTimeLeftOnBadge;
				var oldestEventDateToFetch = getStartDateBeforeThisMonth();
				$.each(events, function(a, event) {
					
					if (!isInArray(event.calendar.id, excludedCalendars)) {
						
						
						/*
						var allAttendeesDeclined = false;		
						if (event.attendees) {
							// search for atleast one attendee who did NOT decline
							var oneAttendeeDidNotDecline = false;
							$.each(event.attendees, function(index, attendee) {
								if (attendee.responseStatus != "declined") {
									oneAttendeeDidNotDecline = true;
									return false;
								}
							});
							if (!oneAttendeeDidNotDecline) {
								allAttendeesDeclined = true;
							}
						}
						*/
						
						if (event.startTime.isAfter(oldestEventDateToFetch) && passedShowDeclinedEventsTest(event, storage)) {
							
							var nextEventMin = Math.ceil((event.startTime.getTime() - now()) / ONE_MINUTE);
							
							var passedDoNotShowNotificationsForRepeatingEvents = true;
							// if a recurring event (aka. 'originalEvent' because it points to the recurring event) and user set to exclude recurring events then fail this test
							if (event.recurringEventId && pref("doNotShowNotificationsForRepeatingEvents")) {
								passedDoNotShowNotificationsForRepeatingEvents = false
							}
							
							// created this flag to skip this part because it is a CPU intensive loop when there are many events or eventsShown particularly the method isEventShownOrSnoozed()
							if ((params.ignoreNotifications == undefined || !params.ignoreNotifications) && passedDoNotShowNotificationsForRepeatingEvents) {
								var reminders;
								
								if (event.reminders) {
									if (event.reminders.useDefault) {
										reminders = event.calendar.defaultReminders;
									} else {
										reminders = event.reminders.overrides;
									}
								} else {
									// other calendars like holidays or sports don't actually have any reminders or defaultReminders in their feed so add them articifially here to get reminders
									reminders = [{method:"popup", minutes:0}];
								}
								
								var eventHasAPopupReminder = false;
								if (reminders) {
									$.each(reminders, function(index, reminder) {
										
										if (reminder.method == "popup") {
											eventHasAPopupReminder = true;
										}
										
										var reminderTime = new Date(event.startTime.getTime());
										if (event.allDay) {
											reminderTime.setHours(5);
										}
										reminderTime = new Date(reminderTime.getTime() - (reminder.minutes * ONE_MINUTE));
										if (reminder.method == "popup" && !isEventShownOrSnoozed(event, reminderTime)) {
											//log(event.summary + " NOT isEventShownOrSnoozed", "showConsoleMessagesEventsSnoozes");
											if (isTimeToShowNotification(event, reminderTime)) {
												console.log(new Date() + " " + event.summary);
												notificationsQueue.push({event:event, reminderTime:reminderTime});
											}
										}
									});
								}
								
								if (!eventHasAPopupReminder && !pref("onlyPopups")) { // ie. NOT Only show notifications for events with a 'pop-up' reminder
									//log("not ONLYPOPUPS!!", "showConsoleMessagesEventsSnoozes");
									if (!isEventShownOrSnoozed(event)) {
										if (isTimeToShowNotification(event, event.startTime)) {
											notificationsQueue.push({event:event});
										}
									}
								}
							}
							
							//if (!isGadgetCalendar(event.calendar)) {
								
								var passedExcludeRecurringEventsButtonIcon = true;
								// if a recurring event (aka. 'originalEvent' because it points to the recurring event) and user set to exclude recurring events then fail this test
								if (event.recurringEventId && pref("excludeRecurringEventsButtonIcon")) {
									passedExcludeRecurringEventsButtonIcon = false
								}
								
								var passedHiddenCalendarsFromButtonTest = true;
								var selected = isCalendarSelectedInExtension(event.calendar, email, selectedCalendars);
								
								if (event.calendar && !selected && pref("excludeHiddenCalendarsFromButton", true)) {
									passedHiddenCalendarsFromButtonTest = false;
								}
								
								if (passedExcludeRecurringEventsButtonIcon && passedHiddenCalendarsFromButtonTest && (event.startTime.getTime() - now() >= 0 || event.allDay && isToday(event.startTime)) && nextEventMin < 60*24*pref("maxDaysAhead", 2)) {
									if (!nextEvent) {					
										if (event.allDay) {
											if (!isToday(event.startTime)) {
												nextEvent = event;
												var startOfToday = today();
												startOfToday.setHours(0);
												startOfToday.setMinutes(0);
												startOfToday.setSeconds(0);
												var eventDay = new Date(event.startTime);
												eventDay.setHours(0);
												eventDay.setMinutes(0);
												eventDay.setSeconds(0);
												var daysAway = Math.ceil((eventDay.getTime() - startOfToday.getTime()) / ONE_MINUTE / 60 / 24);
												
												if (pref("showDaysLeftInBadge", true)) {
													badgeText = daysAway + getMessage("d");
													badgeColor = GRAY;
												}
												
												unitOfTimeLeftOnBadge = "d";
											}
										} else {
											if (nextEventMin < 60) {
												if (pref("showMinutesLeftInBadge", true)) {
													badgeText = nextEventMin + getMessage("m");
													badgeColor = RED;
												} else {
													badgeText = $.trim(formatTimeForBadge(event.startTime));
													badgeColor = BLUE;
												}
												unitOfTimeLeftOnBadge = "m";
											} else if (nextEventMin < 60*12) {
												if (pref("showHoursLeftInBadge")) {
													badgeText = Math.round(nextEventMin/60) + getMessage("h");
												} else {
													badgeText = $.trim(formatTimeForBadge(event.startTime));
												}
												badgeColor = BLUE;
												unitOfTimeLeftOnBadge = "h";
											} else if (nextEventMin < 60*24) {
												if (pref("showHoursLeftInBadge")) {
													badgeText = Math.round(nextEventMin/60) + getMessage("h");
												} else {
													badgeText = $.trim(formatTimeForBadge(event.startTime));
												}			
												badgeColor = GRAY;
											} else {
												if (pref("showDaysLeftInBadge", true)) {
													badgeText = event.startTime.diffInDays() + getMessage("d");
													badgeColor = GRAY;
												}
												unitOfTimeLeftOnBadge = "d";
											}
											nextEvent = event;
										}
									}
									if (event.summary) {
										if (!previousNextEvent || event.startTime.toDateString() != previousNextEvent.startTime.toDateString()) {
											if (title != "") {
												title += "\n\n";
											}
											if (isToday(event.startTime)) {
												title += getMessage("today") + ":";
											} else if (isTomorrow(event.startTime)) {
												title += getMessage("tomorrow") + ":";
											} else {
												title += dateFormat.i18n.dayNames[event.startTime.getDay()] + ":";
											}
										}
										title += "\n";
										if (event.allDay) {
											title += event.summary;
										} else {
											title += event.startTime.formatTime() + " " + event.summary;
										}
										title = title.replace(/&amp;/ig, "&");
										previousNextEvent = event;
									}
								}
							//}
						}
					}
				});
				
				// Check snoozers
				$.each(snoozers, function(b, snoozer) {
					if ((!snoozer.email || snoozer.email == email) && snoozer.time && snoozer.time.getTime() < now()) {
						if (!isCurrentlyDisplayed(snoozer.event)) {
							notificationsQueue.push({event:snoozer.event, reminderTime:snoozer.reminderTime});
						}
					}
				});
				
				if (pref("showDayOnBadge")) {
					if (!unitOfTimeLeftOnBadge || (unitOfTimeLeftOnBadge == "m" && !pref("showDayOnBadgeExceptWhenMinutesLeft", true)) || (unitOfTimeLeftOnBadge == "h" && !pref("showDayOnBadgeExceptWhenHoursLeft")) || (unitOfTimeLeftOnBadge == "d" && !pref("showDayOnBadgeExceptWhenDaysLeft"))) {
						var forceEnglish = isAsianLangauge(); 
						badgeText = today().format("ddd", {forceEnglish:forceEnglish});
						badgeColor = [0,0,0,120];
					}		
				}
				
				chrome.browserAction.getBadgeText({}, function(previousBadgeText) {
					if (pref("showEventTimeOnBadge", true) || pref("showDayOnBadge")) {
						// badgetext stays the same
					} else {
						badgeText = "";
					}
					
					updateBadge({badgeText:badgeText});

					if (pref("showButtonTooltip", true)) {
						chrome.browserAction.setTitle({title:title});
					} else {
						chrome.browserAction.setTitle({title:""});
					}
					
					if (badgeColor) {
						chrome.browserAction.setBadgeBackgroundColor({color:badgeColor});
					}

				});

				// must be done before sound and desktop notifications
				filterNotificationsByPopupRules(notificationsQueue);

				$.each(notificationsQueue, function(a, notification) {
					if (!notification.audioPlayedCount) {
						playNotificationSound(notification);					
					}
				});
				
				if (pref("desktopNotification", true) && notificationsQueue.length >= 1) {
					showNotifications();
				}
			}
			
			if (pokerListenerLastPokeTime.diffInDays() > -5) {
				refreshWidgetData();
			}

			var elapsedTime = now() - lastPollTime;
			if (elapsedTime >= pollingInterval) { // (online && elapsedTime >= pollingInterval) || (!online && elapsedTime >= POLL_INTERVAL_WHEN_OFFLINE)
				
				// logic here: make sure any events added between the 30 min intervals get loaded so idle time should be larger than 30min+buffer
				// because pollinginterval is in MILLIseconds and idle uses seconds!
				var pollingIntervalInSeconds = pollingInterval / ONE_SECOND;
				var idleBuffer = 5 * 60; // 5 minutes;
				var idleSeconds = pollingIntervalInSeconds + idleBuffer
				
				chrome.idle.queryState(idleSeconds, function(state) {
					if (state == "active") {
						pollServer();
					} else {
						console.log("state: " + state + " don't poll");
					}
				});

			}
		} else {
			console.log("NO chromeWindowOrBackgroundMode - so do not checkevents");
		}
	});
}

function filterNotificationsByPopupRules(notifications) {
	for (var a=0; notification=notifications[a], a<notifications.length; a++) {
		if (!pref("onlyPopupsForOwner") || (pref("onlyPopupsForOwner") && (notification.event.calendar.accessRole == "owner"))) {
			var allDayEventRulesPassed = false;
			if (!pref("doNotShowNotificationsForAlldayEvents") || (pref("doNotShowNotificationsForAlldayEvents") && !notification.event.allDay)) {
				allDayEventRulesPassed = true;
			}
			if (!allDayEventRulesPassed) {
				// when splicing in a for loop must a-- the index or else it will skip the item after the deleted item
				notifications.splice(a, 1);
				a--;
			}
		} else {
			notifications.splice(a, 1);
			a--;
			log("didn't pass the onlyPopupsForOwner test: " + notification.event.summary + " _ " + notification.reminderTime, "showConsoleMessagesEventsSnoozes");
		}
	}
}

function serializeEventsShown() {
	// put a timer because this process freezes UI because of the size of eventsShown in localstorage
	setTimeout(function() {
		localStorage["eventsShown"] = JSON.stringify(eventsShown);
	}, 2000);
}

function initOAuth() {
	tokenResponses = localStorage["tokenResponses"];
	if (tokenResponses) {
		
		function replacer(key, value) {
		    if (key == "expiryDate") {		
		        return new Date(value);
		    } else {
		    	return value;
		    }
		}
		
		tokenResponses = JSON.parse(tokenResponses, replacer);
	} else {
		tokenResponses = [];
	}
	
	oAuthForDevices = new OAuthForDevices(tokenResponses);
	oAuthForDevices.setOnTokenChange(function(params, allTokens) {
		tokenResponses = allTokens;
		localStorage["tokenResponses"] = JSON.stringify(allTokens);
	});
	oAuthForDevices.setOnTokenError(function(tokenResponse, response) {
		logout();
	});
}

function initCalendarSettings(settings) {
	storage.calendarSettings.calendarLocale = getSetting(settings, "locale", "en");
	storage.calendarSettings.showDeclinedEvents = getSetting(settings, "showDeclinedEvents", true);
	storage.calendarSettings.hideWeekends = getSetting(settings, "hideWeekends");
	storage.calendarSettings.weekStart = getSetting(settings, "weekStart", 0);
	storage.calendarSettings.timeZone = getSetting(settings, "timezone", "America/Montreal");
	storage.calendarSettings.format24HourTime = getSetting(settings, "format24HourTime", false);
	storage.calendarSettings.dateFieldOrder = getSetting(settings, "dateFieldOrder");
	storage.calendarSettings.defaultEventLength = getSetting(settings, "defaultEventLength");
	
	// sync "my" 24 hour format extension option from calendar setting
	if (localStorage["24hourMode"] == undefined && storage.calendarSettings.format24HourTime) { //Tools.is24HourDefault()
		localStorage["24hourMode"] = true;
	}
}

function openUnstableWarningPage() {
	chrome.tabs.create({ url: "http://jasonsavard.com/wiki/Unstable_channel_of_Chrome" });
}

function removeLastEventsShown() {
	eventsShown.splice(0, 5);
	localStorage["eventsShown"] = JSON.stringify(eventsShown);
	pollServer();
}

// Had to move onInstalled here - outside of any async callbacks because the "update" event would not trigger for testing when reloading extension
chrome.runtime.onInstalled.addListener(function(details) {
	console.log("onInstalled: " + details.reason);
	
	if (details.reason == "install") {
		// Note: Install dates only as old as implementation of this today, April 11th 2011
		localStorage["installDate"] = new Date();
		localStorage["installVersion"] = chrome.runtime.getManifest().version;
		chrome.tabs.create({url: "options.html?install=true"});
	} else if (details.reason == "update") {
		// seems that Reloading extension from extension page will trigger an onIntalled with reason "update"
		// so let's make sure this is a real version update by comparing versions
		if (details.previousVersion != chrome.runtime.getManifest().version) {
			console.log("version changed");
			// extension has been updated to let's resync the data and save the new extension version in the sync data (to make obsolete any old sync data)
			// but let's wait about 60 minutes for (if) any new settings have been altered in this new extension version before saving syncing them
			chrome.alarms.create("extensionUpdatedSync", {delayInMinutes:60});						
		}
		
		var previousVersionObj = parseVersionString(details.previousVersion)
		var currentVersionObj = parseVersionString(chrome.runtime.getManifest().version);
		if (!localStorage.disabledExtensionUpdateNotifications && (previousVersionObj.major != currentVersionObj.major || previousVersionObj.minor != currentVersionObj.minor)) {
			var options = {
					type: "basic",
					title: getMessage("extensionUpdated"),
					message: "Checker Plus for Google Calendar " + chrome.runtime.getManifest().version,
					iconUrl: "images/icons/icon-128_whitebg.png",
					buttons: [{title: getMessage("seeUpdates"), iconUrl: "images/exclamation.png"}, {title: getMessage("doNotNotifyMeOfUpdates"), iconUrl: "images/cancel.png"}]
			}
			
			chrome.notifications.create("extensionUpdate", options, function(notificationId) {
				if (chrome.runtime.lastError) {
					console.error(chrome.runtime.lastError.message);
				} else {
					lastExtensionUpdateNotificationShownDate = new Date();
				}
			});
		}
		
	}
	sendGA(['_trackEvent', "extensionVersion", chrome.runtime.getManifest().version, details.reason]);
});

$(document).ready(function() {
	
	try {
		if (!localStorage.detectedChromeVersion) {
			localStorage.detectedChromeVersion = true;
			Tools.detectChromeVersion(function(result) {
				if (result && result.channel != "stable") {
					var title = "You are not using the stable channel of Chrome";
					var body = "Click for more info. Bugs might occur, you can use this extension, however, for obvious reasons, these bugs and reviews will be ignored unless you can replicate them on stable channel of Chrome.";
					var notification = webkitNotifications.createNotification("images/icons/icon-48.png", title, body);
					notification.onclick = function () {
						openUnstableWarningPage();
						this.close();
					};
					notification.show();
				}
			});
		}
	} catch (e) {
		logError("error detecting chrome version: " + e);
	}
	
	var lang = pref("lang", window.navigator.language);
	loadLocaleMessages(lang, function() {		
		init();
	});
});