var ls;
var tries = 0;
var hasWeekends = false;
var daysInWeek = 7;
var processingDOM = false;
var originalElement;
var dragging = false;
var draggedElement;
var lastHoverRowNode;
var lastHoverRow;
var lastHoverCol;
var squareWidth;
var dragStartColRow;
var dragStartDate;
var lastEventClicked;
var localeMessages;
var myDateRegexs = new Array();
var processGmailInterval;
var processGmailErrors = 0;

function clearCSSForButton(id, action) {
	var button = document.getElementById(id);
	if (button) {
		if (!action) {
			action = "click";
		}
		button.addEventListener(action, function() {
			removeNode("GCCP");
		}, false);
	}
}

function setCSSForButton(id) {
	var button = document.getElementById(id);
	if (button) {
		button.addEventListener("click", function() {
			highlight();
		}, false);
	}
}

function getRowIndex(o) {
	return o.parents(".month-row").index();
}

function highlight() {
	var css = "@namespace url(http://www.w3.org/1999/xhtml); ";
	var days = document.evaluate("//td[contains(@class, 'st-bg')]", document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
	
	if (days && days.snapshotLength > 25) {
		hasWeekends = true;
		daysInWeek = 7;
	} else {
		daysInWeek = 5;
	}

	if (pref("highlightWeekends", false, ls)) {
		// Month view
		// Check that weekends are in calendar view (its user cusomizable)
		if (hasWeekends) {
			var todayClass = "st-bg-today";
			var node = document.evaluate("//td[contains(@class, '" + todayClass + "')]//parent::tr/td", document, null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
			if (node) {
				var todayDayOfWeek;
				for (todayDayOfWeek=0; todayDayOfWeek<node.snapshotLength; todayDayOfWeek++) {
					if (node.snapshotItem(todayDayOfWeek).className && node.snapshotItem(todayDayOfWeek).className.indexOf(todayClass) != -1) {
						var dayOfWeek = new Date().getDay();
						if (dayOfWeek == todayDayOfWeek) {
							// Starts Sunday
							css += " .st-bg:first-child, .st-bg:last-child {background:#eee} ";
						} else if (dayOfWeek == todayDayOfWeek+1 || dayOfWeek == 0 && todayDayOfWeek == 6) {
							// Starts Monday
							css += " .st-bg:nth-last-child(-n+2) {background:#eee} ";
						} else {
							// Starts Saturday
							css += " .st-bg:first-child, .st-bg:nth-child(+2) {background:#eee} ";
						}
						break;
					}
				}
			}
		}
		// Week view
		css += " .tg-weekend {background:#eee} ";
	}

	var pastDays = false;
	
	if (pref("pastDays", false, ls) && window.location.href.indexOf("userReloaded") == -1) {
		pastDays = true;
		css += " .st-bg.gccpPastDay {background:#e4e4e4 !important;opacity:0} ";
		css += " #tgTable .tg-col.gccpPastDay {background:#e4e4e4 !important} ";
		var todayOffset = $(".st-bg-today").offset();		
		var todayRow = getRowIndex($(".st-bg-today"));
		
		if (todayOffset) {
			// Month view
			$(".st-dtitle, .st-bg").each(function(index) {
				if ($(this).offset().top < todayOffset.top || $(this).offset().top == todayOffset.top && $(this).offset().left < todayOffset.left) {
					$(this).addClass("gccpPastDay");
				}
			});
			$(".st-c").each(function(index) {
				var row = getRowIndex($(this));
				if ($(this).offset().top < todayOffset.top || row == todayRow && $(this).offset().left < todayOffset.left) {
					$(this).addClass("gccpPastEvent");
				}
			});
		}
			
		// Week view
		$("#tgTable td[class*='tg-col']").each(function(index) {
			if ($(this).hasClass("tg-col-today")) {
				return false;
			} else {
				$(this).addClass("gccpPastDay");
				// .chip is an event div
				$(this).find(".chip").addClass("gccpPastEvent");
			}
		});
	}
	
	if (pref("highlightCurrentDay", true, ls) && window.location.href.indexOf("userReloaded") == -1) {
		if (isInsidePopupCalendar()) {
			$('.mv-container .st-dtitle-today, .mv-container .st-bg-today').animate({
			    opacity: 0.5
			  }, "fast", function() {
				  $(this).animate({opacity: 1.0}, "fast", function() {});
			  }
			);
			
			// Disabled for now because of issue with "GPU Accelerated Compositing"
			css += " .mv-container .st-dtitle-today, .mv-container .st-bg-today { ";
			//css += " 	-webkit-animation-name: GCCP_pop; ";
			//css += " 	-webkit-animation-duration: 1000ms; ";
			//css += " 	-webkit-animation-timing-function: ease-in-out; "
			css += " } ";
		}
	}
	
	addCSS('GCCP', css);
	if (pastDays) {
		$('.st-dtitle.gccpPastDay, #tgTable .tg-col .gccpPastEvent, .gccpPastEvent').animate({
		    opacity: 0.2
		  }, "slow", function() {}
		);
		$('.st-bg.gccpPastDay, #tgTable .tg-col.gccpPastDay').animate({
		    opacity: 1.0
		  }, "slow", function() {}
		);
	}
}

function hookButtons() {
	if (document.getElementById("todayButton:0") || document.getElementById("todayButton1")) {
		//console.log("hooked");
		clearCSSForButton("dp_0_tbl", "mousemove");

		setCSSForButton("todayButton:0");

		clearCSSForButton("navBack:0");
		clearCSSForButton("navForward:0");

		clearCSSForButton("topRightNavigation");

		//nav1
		setCSSForButton("todayButton1");
		clearCSSForButton("navBack1");
		clearCSSForButton("navForward1");
		clearCSSForButton("dateEditableBox1");
		clearCSSForButton("dateMenuArrow1");
	} else if (tries++ < 5) {
		setTimeout(function () { hookButtons(); }, 500);
	}
}

function processGoogleCalendar() {
	
	$(document).ready(function() {
		
		// send this to background and save it for later for such things as deleteEvent etc.
		var secid = getCookie("secid");
		if (secid) {
			chrome.runtime.sendMessage({name:"contentScriptParams", key:"secid", value:secid});
		}

		if (isInsidePopupCalendar()) {
			// Analytics on Google Calendar BUT let's only measure clicks with ga
			$(document).on("click", "a, input, button", function() {
				var id = $(this).attr("ga");
				if (id) {
					chrome.runtime.sendMessage({name:"gaq", value:['_trackEvent', id, 'click']});
				}
			});
	
			var SHOW_AGENDA_OPTIONS_CSS_ID = "GCCP_AGENDA_OPTIONS";
			if (pref("showAgendaOptions", false, ls)) {
				removeNode(SHOW_AGENDA_OPTIONS_CSS_ID);
			} else {
				addCSS(SHOW_AGENDA_OPTIONS_CSS_ID, "#gadgetFooter1 #toolbar1 #optionsLink1 {display:none}");
			}
		}
		
		setTimeout(function() {
			highlight();
		}, 1000);
	
		if (pref("pastDays", false, ls)) {
			setTimeout(function () { hookButtons(); }, 500);
		}
	});
}

function getDateByMonthViewColumn(params) {
	var o = params.o;
	var rowNode;
	if (params.rowNode) {
		rowNode = params.rowNode;
	} else {
		rowNode = $(o).closest(".month-row");
	}
	console.log("rownode: ", rowNode);
	var e = params.e; // not used yet
	var row = params.row;
	var col = params.col;
	if (!row) {
		row = getRowIndex($(o));
	}
	var dayOfMonth = rowNode.find(".st-dtitle:eq(" + col + ")").find("span").text();
	console.log("dayofmonth: " + dayOfMonth);
	//dayOfMonth = dayOfMonth.match("[\\d]?[\\d]");
	dayOfMonth = dayOfMonth.match(/\d?\d/g);
	// Use the last # found because such locales as ko, zh_cn, zh_tw have a # number in the month name ie. 8月 1日日 and 8is the month and 1 is the day
	dayOfMonth = dayOfMonth[dayOfMonth.length-1];
	var monthYearStr = $("#currentDate1").text();
	var year = monthYearStr.match("[\\d]?[\\d]?[\\d]?[\\d]");
	var month = null;	
	/*
	$.each(dateFormat.i18n.monthNames, function(a, m) {
		// check if begins with the month OR has a 'w'hitespace before
		var regexStr = "^" + dateFormat.i18nCalendarLanguage.monthNames[a] + "|\\s" + dateFormat.i18nCalendarLanguage.monthNames[a]; // can't use "\\b" because it does not support unicode languages more info http://blog.stevenlevithan.com/archives/javascript-regex-and-unicode
		console.log("searching: " + regexStr + " " + dateFormat.i18nCalendarLanguage.monthNames[a] + " " + a);
		var matches = new RegExp(regexStr, "i").exec(monthYearStr);
		if (matches) {
			console.log("month found: " + regexStr + "***" + monthYearStr + "***" + dateFormat.i18nCalendarLanguage.monthNames[a] + "***" + a);
			month = a;
			return false;
		} else {
			regexStr = "\\b" + dateFormat.i18nEnglish.monthNames[a] + "\\b";
			matches = new RegExp(regexStr, "i").exec(monthYearStr);
			if (matches) {
				console.log("month found2: " + monthYearStr + " " + dateFormat.i18nCalendarLanguage.monthNames[a] + " " + a);
				month = a;
				return false;
			}
		}
		console.log("not found: " + regexStr + " " + monthYearStr + " " + dateFormat.i18nCalendarLanguage.monthNames[a] + " " + a);
		return true;
	});
	*/
	
	// must go backwards because in languages like japanse because or else we'll match 2月  in 12月  when it should match only 2月
	var foundMonth = false;
	for (var a=dateFormat.i18n.monthNames.length-1; a>=0; a--) {
		if (monthYearStr.toLowerCase().indexOf(dateFormat.i18nCalendarLanguage.monthNames[a].toLowerCase()) != -1 || monthYearStr.toLowerCase().indexOf(dateFormat.i18nCalendarLanguage.monthNamesShort[a].toLowerCase()) != -1 || monthYearStr.toLowerCase().indexOf(dateFormat.i18nEnglish.monthNames[a].toLowerCase()) != -1) {
			foundMonth = true;
			month = a;
			//console.log("month found: " + monthYearStr + " " + dateFormat.i18nCalendarLanguage.monthNames[a] + " " + a);
			break;
		}
	}	
	
	if (!foundMonth) {
		return null;
	}

	if (row == 0 && parseInt(dayOfMonth) >= 20) {
		month--;
	} else if (row >= 3 && parseInt(dayOfMonth) <= 10) {
		month++;
	}
	return new Date(year, month, dayOfMonth);
}

function getDateByWeekViewColumn(o, e, col) {
	var monthYearStr = $("#currentDate1").text();
	var year = monthYearStr.match("[\\d][\\d][\\d][\\d]");
	var regexResult = null;
	var regexResults = new Array();
	var monthIndexInRegexResult = null;
	var numbers = new Array();
	// Finding the number that repeats in the sequence, should be the month ex. 2/15, 2/16, 2/17
	$(".wk-daynames th").each(function(index) {
		var monthDay = $(this).text();
		// 23/5
		if (monthDay.indexOf("/") != -1) {
			// 23/5 will result in ["23/5", "23", "5"]
			regexResult = monthDay.match("(\\b[\\d]?[\\d])?/([\\d]?[\\d]\\b)?");
			regexResults.push(regexResult);
			if (numbers[regexResult[1]]) {
				// Found: month is 1st #
				monthIndexInRegexResult = 1;
				return;
			} else if (numbers[regexResult[2]]) {
				// Found: monti is 2nd #
				monthIndexInRegexResult = 2;
				return;
			} else {
				numbers[regexResult[1]] = "blah";
				numbers[regexResult[2]] = "blah";
			}
		} else if (monthDay.indexOf(".") != -1) {
			regexResult = monthDay.match("(\\b[\\d]?[\\d])?\\.([\\d]?[\\d]\\b)?");
			regexResults.push(regexResult);
			if (numbers[regexResult[1]]) {
				// Found: month is 1st #
				monthIndexInRegexResult = 1;
				return;
			} else if (numbers[regexResult[2]]) {
				// Found: monti is 2nd #
				monthIndexInRegexResult = 2;
				return;
			} else {
				numbers[regexResult[1]] = "blah";
				numbers[regexResult[2]] = "blah";
			}
		}
	});	
	if (monthIndexInRegexResult) {
		var month = regexResults[col-1][monthIndexInRegexResult];
		var dayIndex = monthIndexInRegexResult == 1 ? 2 : 1;
		var dayOfMonth = regexResults[col-1][dayIndex];
		return new Date(year, month-1, dayOfMonth);
	} else {
		return null;
	}
}

function processCreateEventClick(date) {
	//var evt = event; // must save evt object here because it disappears in the sendMessage context
	
	if (date) {
		date = date.toJSON();
	}
	chrome.runtime.sendMessage({name:"showCreateBubble", date:date, pageX:event.pageX, pageY:event.pageY}, function(response) {
		// nothing to do on return
	});
}

function getColInfoFromMonthView(eventType, callback) {
	$("#viewContainer1").on(eventType, ".st-grid", function(e) {
		if (e.target.className.indexOf("st-grid") != -1 || e.target.className.indexOf("st-c") != -1) {
			// Sometimes it seems at the last week of month only the st-grid table can be clicked and therefore must calculate the date by mouse position
			var squareWidth = $(".st-dtitle").first().width() + 4;						
			col = parseInt(e.pageX / squareWidth);
			if ($("body").css("direction") == "rtl") {
				col = 6 - col;
			}
			callback({o:this, e:e, col:col});
		}
	});

	$("#viewContainer1").on(eventType, ".st-dtitle, .st-bg", function(e) {
		if (e.target.tagName != "TD") {
			return;
		}
		col = $(this).prevAll("td").length;
		callback({o:this, e:e, col:col});
	});
}

function hookCreateEvent() {
	// Month view: .mv-container == (m)onth (v)iew
	getColInfoFromMonthView("click", function(response) {
		var date = getDateByMonthViewColumn(response);
		if (date) {
			processCreateEventClick(date);
		} else {
			alert("I'm not able to create events in this 'old' look, try changing your calendar language or try the new look from the 'View' dropdown - Jason")
		}
	});
	
	// Week view
	// Top part
	$("#topcontainer1").on("click", ".wk-allday .st-c", function(e) {
		var leftMargin = $(".wk-tzlabel").first().width() - 10;
		var squareWidth = $(".wk-daynames th").first().width() + 1;						
		col = parseInt((leftMargin + e.pageX) / squareWidth);
		if (e.target.tagName != "TD") {
			return;
		}
		var date = getDateByWeekViewColumn(this, e, col);
		if (date) {
			processCreateEventClick(date);
		}
	});
	
	var lastTimeEventClicked = new Date(1);
	
	// Middle/hours part
	$("#scrolltimedevents1").on("click", "#tgTable *", function(e) {
		var className = $(this).attr("class");
		//console.log("classname; " + className);
		if (className && className.indexOf("chip") != -1) {
			lastTimeEventClicked = today();
		}
		if (className == "tg-col-eventwrapper") {
			
			// make sure we didn't bubble up to this event after clicking an event/detail bubble
			if (now() - lastTimeEventClicked.getTime() > 500) {
				col = $(this).parent().prevAll("td").length;
				var date = getDateByWeekViewColumn(this, e, col);
				if (date) {
					processCreateEventClick(date);
					//return false;
				}
			}
			
		} else {
			//return false;
		}
	});
}

function getDaySquare(rowNode) {
	return rowNode.find(".st-dtitle:eq(" + lastHoverCol + "), .st-bg:eq(" + lastHoverCol + ")");
}

function getColRow(o, e) {
	var col = parseInt(e.pageX / squareWidth);
	if ($("body").css("direction") == "rtl") {
		col = 6 - col;
	}
	var row = getRowIndex(o);
	return {col:col, row:row};
}

function processEmbedCalendar(e) {
	squareWidth = $(".st-dtitle").first().width() + 4;
	
	// Rememeber last event clicked (for deleting animation :)
	$("#viewContainer1").on("click", ".te, .rb-n", function() {
		lastEventClicked = $(this);
	});
	
	// Make double click on items open the details page
	//console.log("mvcontainer: " + $(".mv-container").length);
	//console.log("mvcontainer te: " + $(".mv-container .te").length);
	//console.log("mvcontainer rb: " + $(".mv-container .rb-n").length);
	$("#viewContainer1").on("dblclick", ".te, .rb-n", function() {
		// Get "more details" link from popup
		var url = $(".links a").first().attr("href");
		var eid = getUrlValue(url, "eid");
		if (eid) {
			//chrome.tabs.create({url:url});
			chrome.runtime.sendMessage({name: "openTab", url:url});			
		}
	});
	
	// Drag drop events...
	var css = "";
	css += " .originalEventDragged {opacity:0.5} ";
	css += " .draggingOverDay {background:#FAF0F2} ";
	css += " .draggingEvent {position:absolute;font-weight:normal;font-family:Verdana} ";	
	addCSS("CheckerPlus", css);
	
	$(".mv-container .te, .mv-container .rb-n").attr("draggable", "true");
	
	$("#viewContainer1").on("dragstart", ".te, .rb-n", function(e) {	
		if (!dragging) {
			dragging = true;
			console.log("dragstart");
			
			originalElement = $(this);
			var fontSize = originalElement.css("font-size");			
			draggedElement = originalElement.clone();
			draggedElement.addClass("draggingEvent");
			draggedElement.css("font-size", fontSize);
			draggedElement.css("min-width", squareWidth + "px");
			originalElement.addClass("originalEventDragged");
			$("body").append(draggedElement);
			dragStartColRow = getColRow($(this), e.originalEvent);
			console.log("colrow: " + dragStartColRow.col);
			console.log("event: ", e);
			dragStartDate = getDateByMonthViewColumn({o:$(this), col:dragStartColRow.col});
			console.log("dragStartDate: " + dragStartDate);
			
			//$("#currentDate1").text(dragging + " " + draggedElement);
		}
	});
	
	$("body").on("dragover", function(e) {
		//$("#calendarTitle").text("mousemove: " + dragging + " " + draggedElement + " " + e.pageX + " " + e.pageY);
		//$("#currentDate1").text(dragging + " " + draggedElement);
		if (dragging && draggedElement) {
			// Move dragged element
			draggedElement.css("left", (e.originalEvent.pageX - 30) + "px");
			draggedElement.css("top", (e.originalEvent.pageY - 20) + "px");
		}
	});
	
	$("body").on("dragend", function(e) {
		dragging = false;
		if (draggedElement) {
			if (dragStartColRow.col != lastHoverCol || dragStartColRow.row != lastHoverRow) {
				//$.each(gEvents) 
				var title = draggedElement.find(".te-s").text();
				// not a timed event ie. 10am test intead it's an all day event ie. test
				if (!title) {
					title = draggedElement.text();
				}
				var dropDate = getDateByMonthViewColumn({rowNode:lastHoverRowNode, row:lastHoverRow, col:lastHoverCol});
				getDaySquare(lastHoverRowNode).removeClass("draggingOverDay");
				
				//draggedElement.css({transition: "all 200ms linear", webkit-transform: "translateZ(0)"});
		    	draggedElement.css({WebkitTransition: "all 100ms linear"});
			    rotate(0);
			    function rotate(degree) {
			    	if (draggedElement) {
				    	draggedElement.css({WebkitTransform: 'rotate(' + degree + 'deg) scale(0.4) translateZ(0)'});
				    	//draggedElement.css({ WebkitTransform: 'scale(0.7) translateZ(0)'});
				    	//draggedElement.css("width", "-=" + (degree));
				    	//draggedElement.css("zoom", (100-degree) + "%");
				    	//draggedElement.css("left", "+=" + (degree/3));
				    	//draggedElement.css("top", "+=" + (degree/3));
				        timer = setTimeout(function() {
				            rotate(degree+=2);
				        },2);
			    	}
			    }
				
				chrome.runtime.sendMessage({name: "moveEvent", dragStartDate:dragStartDate.toJSON(), title:title, dropDate:dropDate.toJSON()}, function(response) {
					if (response.error) {
						if (response.error == "404") {
							alert(getMessage("noPermissionOnEvent", null, localeMessages));
						} else if (response.error == "notfound") {
							if (dragStartDate.getTime() < now()) {
								alert(getMessage("cannotUpdateEventsInThePast", null, localeMessages));
							} else {
								alert(getMessage("recentlyAddedEvent", null, localeMessages));
							}
						}
						console.error("moveEvent error: " + response.error);
						originalElement.removeClass("originalEventDragged");
						getDaySquare(lastHoverRowNode).removeClass("draggingOverDay");
						draggedElement.remove();
					}
					draggedElement = null;
				});
			} else {
				originalElement.removeClass("originalEventDragged");
				getDaySquare(lastHoverRowNode).removeClass("draggingOverDay");
				draggedElement.remove();
				draggedElement = null;
			}
		}			
	});
	
	$("#viewContainer1").on("mousemove", ".month-row *", function(e) {
		if (dragging) {
			//$("#calendarTitle").text(e.pageX)
			// Highlight dragged over days			
			var colRow = getColRow($(this), e);
			var currentHoverRowNode = $(this).closest(".month-row");			
			if (lastHoverRowNode && (lastHoverRow != colRow.row || lastHoverCol != colRow.col)) {
				getDaySquare(lastHoverRowNode).removeClass("draggingOverDay");
			}
			if (currentHoverRowNode) {
				lastHoverRowNode = currentHoverRowNode;
			}
			lastHoverRow = colRow.row;
			lastHoverCol = colRow.col;
			getDaySquare(currentHoverRowNode).addClass("draggingOverDay");
		}			
	});	

	chrome.runtime.sendMessage({name: "getDateFormat"},
		function(response) {
			dateFormat.i18n = response.dateFormati18n;
			dateFormat.i18nCalendarLanguage = response.dateFormati18nCalendarLanguage;
			$(document).ready(function() {
				if (isInsidePopupCalendar()) {
					chrome.runtime.sendMessage({name:"contentScriptParams", key:"lastEmbedHref", value:document.location.href});
					try {
						hookCreateEvent();
					} catch (e) {
						console.error("Error in hookCreateEvent(): " + e);
					}
					$("#timezone").fadeTo("slow", 0.15);
					$(".subscribe-image").fadeTo("slow", 0);
				}
				console.log("before bubble processingDOM: " + processingDOM);
				
				$("#calendarContainer1 .bubble").on("DOMNodeInserted", ".details", function(e) {
					console.log("subinserted: ", $(e.target))
					$(e.target).find(".links").each(function(index) {
						if ($(e.target).find("#gccpDeleteEvent").length == 0) {
							console.log("no delete link found...");
							var eid = getUrlValue($(this).find("a").first().attr("href"), "eid");
							if (eid) {
								console.log("adding link...");
								$(this).append($("<a id='gccpDeleteEvent' ga='deleteEventFromEmbed' style='margin-left:5px;margin-right:5px' href='javascript:;'>" + getMessage("delete", null, localeMessages) + "</a>").click({eid:eid, noReload:true, ls:ls}, function(event) {
									$(this).closest(".bubble").hide();
									initDeleteEvent(event, function(response) {
										if (response && response.error) {
											chrome.runtime.sendMessage({name: "reloadEventsAndShowMessage", message:"Error: " + response.error});											
										} else {
											// If NOT in month view than reload
											if (!lastEventClicked || lastEventClicked.closest(".mv-container").length == 0) {
												window.location.href = setUrlParam(window.location.href, "userReloaded", "true");
											}
											chrome.runtime.sendMessage({name: "reloadEventsAndShowMessage", message:getMessage("eventDeleted"), delay:1000});
										}
									});
								}));
								console.log("close any possible floating existing create buble");
								chrome.runtime.sendMessage({name:"closeBubble"});
							}
						}
					});
				});
				/*
				$("#calendarContainer1 .bubble").on("DOMSubtreeModified", "*", function(e) {
					console.log("submodif: ", $(e.target))
				});
				$("#calendarContainer1 .bubble").on("DOMSubtreeModified", ".links", function(e) {
					// Used because the .find below was creating recursive maximum errors in logs
					if (!processingDOM) {
						processingDOM = true;
						alert($(e.target).html())
						console.log("DOMSubtreeModified - find links...");
						$(e.target).find(".links").each(function(index) {
							if ($(e.target).find("#gccpDeleteEvent").length == 0) {
								console.log("no delete link found...");
								var eid = getUrlValue($(this).find("a").first().attr("href"), "eid");
								if (eid) {
									console.log("adding link...");
									$(this).append($("<a id='gccpDeleteEvent' ga='deleteEventFromEmbed' style='margin-left:5px;margin-right:5px' href='javascript:;'>" + getMessage("delete", null, localeMessages) + "</a>").click({eid:eid, noReload:true}, deleteEvent));
									console.log("close any possible floating existing create buble");
									chrome.runtime.sendMessage({name:"closeBubble"});
								}
							}
						});
						processingDOM = false;
					}
				});
				*/
			});
			
		}
	);
}

function processAgendaCalendar() {
	//chrome.tabs.insertCSS(null, {code:"abc"});
	//chrome.runtime.sendMessage({name: "insertCSS", details:{code:"#gadgetHeader1 .datepicker-rounder.t1, #gadgetHeader1 .datepicker-rounder.t2 {display:none !important}"}});
	$(document).ready(function() {
		//$("#gadgetHeader1 .datepicker-rounder.t1, #gadgetHeader1 .datepicker-rounder.t2").hide();
		$("#gadgetFooter1").on('DOMSubtreeModified', "*", function(e) {
			if (!processingDOM) {
				processingDOM = true;
				$(e.target).find(".event-links").each(function(index) {
					if ($(e.target).find("#gccpDeleteEvent").length == 0) {
						var eid = getUrlValue($(this).find("a").first().attr("href"), "eid");
						if (eid) {
							$(this).prepend($("<a id='gccpDeleteEvent' ga='deleteEventFromIG' style='float:right;margin-left:5px' href='javascript:;'>" + getMessage("delete", null, localeMessages) + "</a>").click({eid:eid}, deleteEvent));
						}
					}
				});
				processingDOM = false;
			}
		});
	});
}

processEmailBodiesInterval = 500;

/*
function processNode($node, title, description) {
	//$node.contents().filter(function() {
	  //return this.nodeType == 3; // && $(this).is(":contains('Some Label ')")
	//});
	$node.contents().each(function() {
		if (this.nodeType == 3) { // text node
			//$(this).replaceWith("aaa<span class='insert'>" + $(this).text() + "</span>bbb");
			var text = $(this).text();
			
			if (text.length >= 3) {
				console.log("processing: " + text);
				var highlightedHTML = DateTimeHighlighter.highlight( text, function(myDateRegex) {
					var generateActionParams = {title:title, description:description, startTime:myDateRegex.startTime, allDay:myDateRegex.allDay};
			
					if (myDateRegex.endTime) {
						generateActionParams.endTime = myDateRegex.endTime;
					}
			
					var actionLinkObj = generateActionLink("TEMPLATE", generateActionParams);
					var tagStart = '<a target="_blank" title="Add to your Google Calendar" href="' + actionLinkObj.url + "?" + actionLinkObj.data + '">';
					var tagEnd = '</a>';
			
					console.log( myDateRegex.match + " _ " +  myDateRegex.startTime + "__" + myDateRegex.endTime);
					return tagStart + myDateRegex.match + tagEnd;
				});
				
				if (highlightedHTML != text) {
					$(this).replaceWith( highlightedHTML );
				}
			} else {
				console.log("text too short, skip it")
			}
		} else {
			// do not process information inside Gmail's [...] / trimmed content
			if (!($(this).is('.yj6qo.ajU') || $(this).is(".adL") || this.nodeName == "A")) {
				processNode($(this), title, description);
			}
		}
	});
}
*/

function highlightNode(params, callback) {
	
	if (!callback) {
		callback = function() {};
	}
	
	var $node = params.$node;
	var textToHighlight;
	if (params.text) {
		textToHighlight = params.text;
	} else {
		textToHighlight = $node.html();
	}
	
	chrome.runtime.sendMessage({name: "startDateTimeWorker", text:textToHighlight}, function(response) {

		//console.log("FINISHED PROCESSING")
		if (response.onMessageResponse) {
			var highlighterDetails = response.onMessageResponse.data.highlighterDetails;
			
			if (highlighterDetails.matchCount) {

				if (params.content == "emailBody") {
					// had to put ellipsis code inside this function because the .replaceWith was simply not working and would lose the ellipsis node???
					// must save elipsis and reapply it after messing .html because the Gmail events attached it are lost
					var ELLIPSIS_SELECTOR = ".yj6qo.ajU";
					var $ellipsis = $node.find(ELLIPSIS_SELECTOR);
				}
				
				var textToOverwrite;
				if (params.textToAppend) {
					textToOverwrite = highlighterDetails.highlightedText + params.textToAppend;
				} else {
					textToOverwrite = highlighterDetails.highlightedText;
				}
				
				$node.html( textToOverwrite );
				
				if (params.content == "emailBody") {
					$node.find(ELLIPSIS_SELECTOR).replaceWith($ellipsis);
				}

				var title = $(".hP:visible").first().text();
				var description = $(".ii.gt:visible").html();
				var content = prepContentForCreateEvent(title, description, response.selectedTab.url);
				title = content.title;
				description = content.description;
				
				$node.find(".DTH").each(function() {
					var myDateRegex = $(this).attr("object");
					myDateRegex = decodeURIComponent(myDateRegex);
					myDateRegex = JSON.parse(myDateRegex);
					
					// restore dates that were turned into strings from json 
					myDateRegex.startTime = new Date(myDateRegex.startTime);
					
					var generateActionParams = {title:title, description:description, startTime:myDateRegex.startTime, allDay:myDateRegex.allDay};
	
					if (myDateRegex.endTime) {
						// restore dates that were turned into strings from json 
						myDateRegex.endTime = new Date(myDateRegex.endTime);
	
						generateActionParams.endTime = myDateRegex.endTime;
					}
	
					var actionLinkObj = generateActionLink("TEMPLATE", generateActionParams);
					
					$(this).attr("title", "Add to Google Calendar");
					$(this).click(function() {
						//chrome.tabs.create({url:actionLinkObj.url + "?" + actionLinkObj.data});
						chrome.runtime.sendMessage({name: "openTab", url:actionLinkObj.url + "?" + actionLinkObj.data});
					});
				});
			}
			
			callback();
		}
		
		if (response.onErrorResponse) {
			//alert("error in datetimeworker: " + response.onErrorResponse.message + " lineno: " + response.onErrorResponse.lineno);
			if (processGmailErrors++ > 5) {
				console.warn("too many errors, stopping processgmail to avoid a crash");
				clearInterval(processGmailInterval);
			}
			console.error("error in datetimeworker: ", response.onErrorResponse);
			callback({error:response.onErrorResponse});
		}
		
	});
}

function processEmailBody($emailBody) {

	var allText = $emailBody.html();
	var textToHighlight;
	var textToAppend;
	
	// do not parse trimmed text
	//var startOfTrimmedText = allText.indexOf("class=\"adL\"");
	//match(/class=\"[^\"]*\badl\"/g)

	// find trimmed text which has a class of    adL
	var regex = new RegExp(/class=\"[^\"]*\badL\"/g)
	var trimmedTextRegex = regex.exec(allText) //"abc class=\"blah adl\" \"adl\" \"adl\""
	
	if (trimmedTextRegex) {
		textToHighlight = allText.substring(0, trimmedTextRegex.index);
		textToAppend = allText.substring(trimmedTextRegex.index);
	} else {
		textToHighlight = allText;
	}
	
	textToHighlight = textToHighlight.replace(/\n/g, "");
	
	//console.log("highlight: " + textToHighlight)
	
	//console.log("START PROCESSING")
	
	highlightNode({$node:$emailBody, text:textToHighlight, textToAppend:textToAppend, content:"emailBody"}, function() {
		// nothing
	});

}

// used to encapsulate emailBody because of reptitive setinterval calls to this method
function processEmailBodies() {
	$(".ii.gt.adP.adO:visible").each(function(bodyIndex, element) {
		$emailBody = $(this);
		
		if (!$emailBody.attr("searchedForDates")) {
	
			$emailBody.attr("searchedForDates", "true");
	
			var MAX_EMAIL_BODIES_TO_PROCESS = 20;
			if (bodyIndex < MAX_EMAIL_BODIES_TO_PROCESS) {
				//console.log("EMAILBODY: " + $emailBody.html());
				
				//console.log("START PROCESSING")
				
				//processNode($emailBody, response.pageDetails.title, response.pageDetails.description);
	
				//var $ellipsis = $emailBody.find(".yj6qo.ajU");
				
				// encapsulated because of async sendMessage above
				processEmailBody($emailBody);
				
				/*
				var text = $emailBody.html();
				
				if (!DateTimeHighlighter.init) {
					DateTimeHighlighter();
				}
				var highlightedHTML = DateTimeHighlighter.highlight( text, function(myDateRegex) {
					
					var title = $(".hP:visible").first().text();
					var description = $(".ii.gt:visible").html();
					var content = prepContentForCreateEvent(title, description, response.tab.url);
					title = content.title;
					description = content.description;
					
					var generateActionParams = {title:title, description:description, startTime:myDateRegex.startTime, allDay:myDateRegex.allDay};
			
					if (myDateRegex.endTime) {
						generateActionParams.endTime = myDateRegex.endTime;
					}
			
					var actionLinkObj = generateActionLink("TEMPLATE", generateActionParams);
					var tagStart = '<a target="_blank" title="Add to Google Calendar" href="' + actionLinkObj.url + "?" + actionLinkObj.data + '">';
					var tagEnd = '</a>';
			
					console.log( myDateRegex.match + " " + myDateRegex.pattern + " _ " +  myDateRegex.startTime + "__" + myDateRegex.endTime);
					return tagStart + myDateRegex.match + tagEnd;
				});
				
				if (highlightedHTML != text) {
					$emailBody.html( highlightedHTML );
					$emailBody.find(".yj6qo.ajU").replaceWith($ellipsis);
				}
				*/
	
				//console.log("FINISHED PROCESSING")
			} else {
				console.warn("too many email bodies, skipping processEmailBody!");
			}
		}
	});
}

function processEmailSubject() {
	var $subject = $(".hP:visible").first();
	if ($subject.length && !$subject.attr("searchedForDates")) {		
		$subject.attr("searchedForDates", "true");
		
		highlightNode({$node:$subject}, function() {
			// nothing to process	
		});
	}
}

function processGmail() {

	$(document).ready(function() {

		processGmailInterval = setInterval(function() {
			processEmailSubject();
			processEmailBodies();
		}, processEmailBodiesInterval);
	});
}

function isInsidePopupCalendar() {
	var calledFrom = getUrlValue(location.href, "GCCP_calledFrom");
	return calledFrom == "popup.html";
}

// Had to use onConnect because i think they're were too many frames responding at the same time to the sendMessages etc..
chrome.runtime.onConnect.addListener(function(port) {
	if (port.name == "getEventDetails") {
		var subject = $(".hP:visible").first().text();
		var body = $(".ii.gt:visible").html()
		if (subject) {
			port.postMessage({title:subject, description:body});
		}
	}
});

chrome.runtime.sendMessage({name: "getGlobals"}, function(response) {
	if (response) {
		ls = response.ls;
		localeMessages = response.localeMessages;
		
		//chrome.runtime.sendMessage({name:"console", log:"in content script for: " + location.href});
		if (document.location.href.match("google.com/calendar")) {
			//chrome.runtime.sendMessage({name:"console", log:"process google calendar"});
			processGoogleCalendar();
			// test
			//hookCreateEvent();
		}
		
		// match edit event links (note: this url usually stays at the top even though user browses around calendar or to other events
		if (location.href.match("google.com/calendar.*eid=")) {
			// save or delete button clicked so presumeably they "reschedule" the event so let's remove it from the notification window
			$("div[id*='.save_top'].action-btn-wrapper, div[id*='.delete_top'].ep-ea-btn-wrapper").mouseup(function() {
				chrome.runtime.sendMessage({name:"savedButtonClickedFromEventPage", url:location.href});
			});
		}
		
		// regular user: google.com/calendar/embed
		// app user: google.com/calendar/hosted/.*/embed
		// multiple sigin user: calendar/.*/embed
		if (document.location.href.match("google.com/calendar/embed") || document.location.href.match("google.com/calendar/hosted/.*/embed") || (document.location.host.match("google.com") != null && document.location.pathname.match("calendar/.*/embed"))) {
			console.log("process emebed");
			processEmbedCalendar();
		}
		if (document.location.href.match("google.com/calendar/ig") || document.location.href.match("google.com/calendar/.*/ig")) {
			processAgendaCalendar();
		}
		
		/*
		// for finding date/time strings
		if (location.href.match("https?://mail.google.com")) {
			if (pref("highlightDateAndTimes", false, ls)) {
				processGmail();
			}
		}
		*/
	}
});