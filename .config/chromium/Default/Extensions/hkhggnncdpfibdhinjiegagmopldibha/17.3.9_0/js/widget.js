var inPopup;
var i18n = JSON.parse(localStorage.i18n);
var renderWidgetTimer;

window.onerror = function(msg, url, line) {
	//alert('error in wdiget: ', msg, url, line)
	//chrome.extension.getBackgroundPage().console.error("error in widget: " + msg + " " + url + "_" + line);
	//return false; // false prevents default error handling.
};

$(document).ready(function() {
	
	if (location.href.indexOf("source=popup") != -1) {
		inPopup = true;
	}
	
	renderWidget();
	
	if (!inPopup) {
		renderWidgetTimer = setInterval(function() {
			$(".account:visible").remove();
			renderWidget();
		}, 10000);
	}
	
	updateTime();
	setInterval(function() {
		updateTime();
	}, 60000);
	
});

function updateTime() {
	$("#time").text(new Date().formatTime());
}

function renderWidget() {
	
	if (inPopup) {
		$("html").addClass("popup");
	} else {
		$("html").addClass("ANTP");
		$("body").css({"background-color":localStorage.widgetBackgroundColor, "background-image":"-webkit-gradient(linear, left top, left bottom, from(rgba(0, 0, 0, 0)), to(rgba(255,255,255,0.5)))"});
	}
	
	if (localStorage.widgetShowLogo == "true" && !inPopup) {
		$("#logoCanvas").show();
		$("#logoCanvas").click(function() {
			top.location.href = "https://www.google.com/calendar"
		});
		
		var image = new Image();
		image.src = "images/icons/icon-32_default.png";
		image.onload = function() {
			canvas = document.getElementById('logoCanvas');
			// the onload loads again after changing badeicon and document.body is empty, weird, so check for canvas
			if (canvas) {
				canvas.width = image.width;
				canvas.height = image.height;
				context = canvas.getContext('2d');
				context.drawImage(image, 0, 0);
				
				//context.font = 'bold 11px "helvetica", sans-serif';
				//context.font = "20px Times New Roman";
				context.shadowOffsetX = 1;
				context.shadowOffsetY = 1;
				context.shadowBlur = 1;
				context.shadowColor = "rgba(0, 0, 0, 0.2)";
				context.font = 'bold 18px "arial", sans-serif';
				context.fillStyle = '#fff'
				context.textAlign = "center";
				var day = (new Date).getDate(); 
				//if (day.length == 1) day = '0' + day;
				//context.fillText(day, 2, 12);
				context.fillText(day, (canvas.width / 2) - 3, 22);
				//chrome.browserAction.setIcon({imageData: context.getImageData(0, 0, 19, 19)});
			}
		}
	} else {
		$("#logoCanvas").hide();
	}
	
	var dayNamesMin = i18n.dayNamesShort;
	$.each(dayNamesMin, function(index, dayName) {
		// don't cut day names in asian languages because they change the meaning of the word
		if (!isAsianLangauge()) {
			dayNamesMin[index] = dayName.substring(0, 2);
		}
	});
	
	if (localStorage.widgetShowCalendar == "true") {
		$("#calendar").show();
		
		$("#calendar").datepicker({firstDay:localStorage.widgetWeekStart, monthNames:i18n.monthNames, dayNames:i18n.dayNames, dayNamesShort:i18n.dayNamesShort, dayNamesMin:dayNamesMin,
			onSelect:function(dateText, inst) {
				var eventEntry = {};
				eventEntry.allDay = true;
				eventEntry.startTime = new Date(inst.selectedYear, inst.selectedMonth, inst.selectedDay).toJSON();
				chrome.runtime.sendMessage({name:"generateActionLink", eventEntry:eventEntry}, function(response) {
					if (inPopup) {
						//chrome.tabs.create({url:response.url});
						chrome.runtime.sendMessage({name:"showCreateBubble", date:eventEntry.startTime}, function(response) {
							//displayEvents(response.events);
						});
					} else {
						top.location.href = response.url;						
					}
				});
			},
			onChangeMonthYear: function(year, month, inst) {
				clearInterval(renderWidgetTimer);
				//$("#betaLoading", top.document).show();
				$(".events").text("Loading...");
				chrome.runtime.sendMessage({name:"fetchEvents", year:year, month:month-1}, function(response) {
					if (response.error) {
						alert(response.error);
						//setStatusMessage({message:"Error fetching, try reload button or sign in to Google Calendar!", errorFlag:true});
					} else {
						displayEvents(response.events);
						//$("#betaLoading", top.document).hide();
					}
				});
			}
		});
		$("#calendar").datepicker( "show" );
		//$(".widget").css("margin-top", "210px");
	} else {
		$("#calendar").hide();
	}
	
	if (localStorage.widgetShowTime == "true") {
		$("#time").show();
	} else {
		$("#time").hide();
	}
	
	var events;
	if (inPopup) {
		// must clone array because we modify
		events = top.bg.filterEventsForDisplayingInAgenda(999); 
	} else if (localStorage.widgetEvents) {
		events = JSON.parse(localStorage.widgetEvents);
	}
	if (events) {
		displayEvents(events);
	}
}

// similar to method in common by i'm not using the pref here
function isAsianLangauge() {
	var lang = localStorage.lang;
	if (!lang) {
		lang = window.navigator.language;
	}
	return /ja|zh|ko/.test(lang);
}

function displayEvents(events) {
	var eventsShown = 0;
	var $eventsNode = $(".events");
	$eventsNode.empty();

	var previousEvent;

	var colors;
	if (localStorage.cachedFeeds) {
		var cachedFeeds = JSON.parse(localStorage.cachedFeeds);
		colors = cachedFeeds["colors"];
	}
	
	var selectedCalendars = getSelectedCalendars();
	
	$.each(events, function(index, event) {
		
		// restore Date object from serialization
		if (inPopup) {
			// must create new Date() from parent page because apparently the localStorage context is lost in the background.js afterwards. This is error was occuring on checkinterval... Uncaught TypeError: Cannot read property '24hourMode' of null
			event.startTime = new top.bg.Date(event.startTime);
		} else {
			event.startTime = new Date(event.startTime);
		}		
		
		var eventTitle;
		var eventColor;
		var calendarSelected;
		eventTitle = event.summary;
		
		if (localStorage.eventColors == "true" && event.colorId && colors) {
			eventColor = darkenColor(colors.event[event.colorId].background);
		} else {
			eventColor = darkenColor(colors.calendar[event.calendar.colorId].background);
		}
		
		calendarSelected = isCalendarSelectedInExtension(event.calendar, localStorage.currentEmail, selectedCalendars);
			
		if (eventTitle && calendarSelected) {
			
			eventsShown++;
			
			if (!previousEvent || event.startTime.toDateString() != previousEvent.startTime.toDateString()) {
				var dayHeaderTitle;
				if (isToday(event.startTime)) {
					dayHeaderTitle = localStorage.widgetToday;
				} else if (isTomorrow(event.startTime)) {
					dayHeaderTitle = localStorage.widgetTomorrow;
				} else {
					dayHeaderTitle = i18n.dayNames[event.startTime.getDay()] + ", " + i18n.monthNamesShort[event.startTime.getMonth()] + " " + event.startTime.getDate();
				}
				var $dayHeader = $("<div class='dayHeader'>" + dayHeaderTitle + "</div>");
				$eventsNode.append($dayHeader);
			}
			
			if (event.allDay) {
				eventTitle = "-<span class='eventTitle'>" + eventTitle + "</span>";
			} else {
				eventTitle = "<span class='time'>" + event.startTime.formatTime(true) + "</span>&nbsp;<span class='eventTitle'>" + eventTitle + "</span>";
			}

			var $eventNode = $("<div class='event'>" + eventTitle + "</div>");
			$eventNode.find(".eventTitle").css("color", eventColor);
			$eventNode.click(function() {
				if (inPopup) {
					chrome.tabs.create({url:event.htmlLink});
				} else {
					top.location.href = event.htmlLink;
				}
			})
			
			$eventsNode.append($eventNode);
			
			previousEvent = event;
		}
	});
	
	if (!eventsShown) {
		$(".events").text("No events or not signed in!");
	}
}