var events;

var eventsShown = bg.eventsShown;
var snoozers = bg.snoozers;
var notificationsQueue = bg.notificationsQueue;

function receiveMessage(e) {
	console.log("receivemessage", e);
	if (event.origin.indexOf(chrome.runtime.id) != -1) {
		events = e.data.events;
		console.log("data: ", events);
		
		if (events.length >= 2) {
			$("header").show();
		}

		$(document).ready(function () {
			
			sortNotifications(events);
			
			var $events = $("#events");	
			$.each(events, function(index, notificationOpened) {
				var $event = $(".eventTemplate").clone();
				$event
					.removeClass("eventTemplate")
					.addClass("event")
					.data("notification", notificationOpened)
				;
				
				var eventSource = getEventSource(notificationOpened.event);
				if (eventSource) {
					var sourceTitle;
					// if event source has same title as event then let's use the link url instead
					if (getSummary(notificationOpened.event) == eventSource.title) {
						sourceTitle = eventSource.url;
					} else {
						sourceTitle = eventSource.title;
					}
					$event.find(".source")
						.text(sourceTitle)
						.attr("title", eventSource.url)
						.attr("href", eventSource.url)
						.css("display", "inline-block")
					;						
				}
				
				$event.find(".title")
					.text(getSummary(notificationOpened.event))
					.css("color", getEventColor(notificationOpened.event))
					.attr("title", getSummary(notificationOpened.event))
					.click(function() {
						createTab({url:notificationOpened.event.htmlLink, urlToFind:notificationOpened.event.id}, function() {});
					})
				;
				
				if (notificationOpened.event.recurringEventId) {
					$event.find(".repeating")
						.click(function() {
							alert("This is a recurring event")
						})
						.show()
					;
				}				
				
				$event.find(".dismiss")			
					.click({notification:notificationOpened}, function(e) {
						bg.console.log("dismissing: ", e.data);
						bg.closeNotifications([e.data.notification]);
						hideNotification($event);
					})
				;
				
				$events.append($event);
				$event.show();
			});
			
			updateTimeElapsed();
			
			setInterval(updateTimeElapsed, minutes(1));
			
			
			$(window).keydown(function(e) {
				if (e.ctrlKey) {
					$(".button, #dateTimeSnoozeButton").addClass("ctrlKey");
				}
			}).keyup(function(e) {
				//if (e.ctrlKey) {
					$(".button, #dateTimeSnoozeButton").removeClass("ctrlKey");
				//}
			});
			
			if (events.length >= 2) {
				$("#snoozeButtons .button, #dateTimeSnoozeButton").each(function() {
					$(this).attr("title", "Hold Ctrl to snooze all notifications");
				});
			}
			
			if (!pref("donationClicked")) {
				$(".button[snoozeInDays], .more, #dateTimeSnoozeWrapper *").each(function() {
					$(this)
						.addClass("mustDonate")
						.attr("title", getMessage("donationRequired"))
					;
				});
			}
			
			$(".button, #dateTimeSnoozeButton").mouseenter(function() {
				$(this).addClass("selected");
			}).mouseleave(function() {
				$(this).removeClass("selected");
			})
			
			$(".button[snoozeInMinutes], .button[snoozeInDays]").click(function() {
				var $event = get$Event($(this));
				var snoozeParams = {$event:$event, inMinutes:$(this).attr("snoozeInMinutes"), inDays:$(this).attr("snoozeInDays")};
				if (snoozeParams.inMinutes || (snoozeParams.inDays && donationClicked("snooze"))) {
					snoozeAndClose(snoozeParams, $(".button").hasClass("ctrlKey"));
				}
			});
			
			$(".more").click(function() {
				var $event = get$Event($(this));
				
				var CALENDAR_OFFSET_TOP = 49;
				var CALENDAR_HEIGHT = 256;
				var CALENDAR_MARGIN_BOTTOM = 10;
				var spaceNeededToFit = $(window).height() - (CALENDAR_OFFSET_TOP + CALENDAR_HEIGHT + CALENDAR_MARGIN_BOTTOM); 
				if (spaceNeededToFit < 0) {
					window.resizeBy(0, Math.abs(spaceNeededToFit));
				} 
				$("body").addClass("more");
				$("#dateTimeSnoozeWrapper").data("$event", $event);
			});
			
			$(".closeButton").click(function() {
				$("body").removeClass("more");
			});
			
			$("#dateTimeSnoozeButton").click(function() {

				if (donationClicked("snoozeDateTime")) {
					
					if (!$("#dateSnooze").val().trim() && !$("#timeSnooze").val().trim()) {
						niceAlert("Must enter either a date and/or time!");
						return;
					}
					
					var snoozeTime = $("#dateSnooze").datepicker( "getDate" );
					if (!snoozeTime) {
						snoozeTime = today();
					}
					
					if ($("#timeSnooze").val().trim()) {
						var time;
						
						// see if ie. 24min was entered
						var eventEntry = getEventEntryFromQuickAddText($("#timeSnooze").val());
						if (eventEntry.startTime) {
							time = eventEntry.startTime;
						} else { // else get time from dropdown
							time = $('#timeSnooze').timepicker('getTime');
						}
						snoozeTime.setHours(time.getHours());
						snoozeTime.setMinutes(time.getMinutes());
						snoozeTime.setSeconds(time.getSeconds());
					} else {
						snoozeTime.setHours(5);
						snoozeTime.setMinutes(0);
						snoozeTime.setSeconds(0);
					}
			
					var snoozeParams = {$event:$("#dateTimeSnoozeWrapper").data("$event"), snoozeTime:snoozeTime};
					snoozeAndClose(snoozeParams, $("#dateTimeSnoozeButton").hasClass("ctrlKey"));
					$("body").removeClass("more");
				}
			});
			
			var dayNamesMin = dateFormat.i18n.dayNamesShort;
			$.each(dayNamesMin, function(index, dayName) {
				// don't cut day names in asian languages because they change the meaning of the word
				if (!isAsianLangauge()) {
					dayNamesMin[index] = dayName.substring(0, 2);
				}
			});

			var dateFormatStr;
			if (bg.storage.calendarSettings.dateFieldOrder == "MDY") {
				dateFormatStr = "mm/dd/yy";
			} else if (bg.storage.calendarSettings.dateFieldOrder == "DMY") {
				dateFormatStr = "dd/mm/yy";
			} else if (bg.storage.calendarSettings.dateFieldOrder == "YMD") {
				dateFormatStr = "yy/mm/dd";
			}
			
			$("#dateSnooze").datepicker({
				showButtonPanel: false, closeText: "Close", dateFormat: dateFormatStr, monthNames:dateFormat.i18n.monthNames, dayNames:dateFormat.i18n.dayNames, dayNamesShort:dateFormat.i18n.dayNamesShort, dayNamesMin:dayNamesMin,
				onSelect: function() {
				}
			});
			
			var timeFormatStr;
			if (pref("24hourMode")) {
				timeFormatStr = 'H:i';
			} else {
				timeFormatStr = 'g:i a';
			}
			
			$('#timeSnooze').timepicker({ scrollDefaultNow:true, timeFormat:timeFormatStr});	
			$('#timeSnooze').off("keydown").on("keydown", function(e) {
				if (e.keyCode == 13) {
					console.log("enter");
					e.preventDefault();
					$('#timeSnooze').timepicker('hide');
					$("#dateTimeSnoozeButton").click();
					return false;
				} else if (e.keyCode == 27) {
					$('#timeSnooze').timepicker('hide');
					return false;
				}
			});
			
			$("#dateTimeSnoozeButton").text(getMessage("snooze"));
			
			$("#dismissAll").click(function() {
				$("#events .dismiss").each(function() {
					$(this).click();
				});
			});
			
		});
		
	}
}

window.addEventListener("message", receiveMessage, false);

function snoozeAndClose(snoozeParams, allNotificationsFlag) {
	if (allNotificationsFlag) {
		snoozeNotifications(snoozeParams, events);
	} else {
		snoozeNotifications(snoozeParams, [snoozeParams.$event.data("notification")]);
	}
	hideNotification(snoozeParams.$event, allNotificationsFlag);
}

function hideNotification($event, allNotificationsFlag) {
	
	var hidingAll = false;
	
	if (allNotificationsFlag) {
		$event = $(".event");
	}
	
	if ($(".event").length - $event.length == 0) {
		hidingAll = true;
	}
	
	var transitionType = hidingAll ? "fadeOut" : "slideUp";
	
	$event[transitionType]("fast", function() {
		$(this).remove();
		if ($(".event").length == 0) {
			window.close();
		}
	});
}

function get$Event(o) {
	return o.closest(".event");
}

function updateTimeElapsed() {
	//$("#currentDate").text(today().format(getMessage("notificationDateFormat")));
	
	$(".event").each(function(index, event) {
		var notification = $(this).data("notification");
		
		var timeElapsedMsg = getTimeElapsed(notification.event);
		
		var $timeElapsed = $(this).find(".timeElapsed");
		if (timeElapsedMsg) {
			$timeElapsed.html("(" + timeElapsedMsg + ")");
		}
	});
}