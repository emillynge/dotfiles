var TEST_REDUCED_DONATION = false;

if (typeof(bg) == "undefined") {
	bg = window;
}

function EventEntry(summary, startTime, description, calendar)
{
	this.summary = summary;
	if (startTime) {
		this.startTime = startTime;
	} else {
		// commented out because it was prefixing my quickadd "details" attribute with the date ex. 2011/01/02 + title
		//this.startTime = today();
	}
	this.description = description;
	//this.allDay = true;
	this.calendar = calendar	
	// legacy..
	if (calendar) {
		this.calendarURL = calendar.url;
	}
	
	this.quickAdd = true;
}

function saveEvent(eventEntry, callback) {
	// If today then processing quick add entry for min or hours etc..
	if (eventEntry.quickAdd && (!eventEntry.startTime || eventEntry.startTime.isToday())) {
		var processedEventEntry = getEventEntryFromQuickAddText(eventEntry.summary);
		eventEntry.summary = processedEventEntry.summary;
		eventEntry.startTime = processedEventEntry.startTime;
		console.log("saveEvent allday: " + eventEntry.allDay)
		console.log("saveEvent starttime: " + eventEntry.startTime)
		
	}

	_postContent(eventEntry, function(response) {
		console.log(response);
		// User may have accidentally entered an event for the past (ie. before the now) so ask to push it to tomorrow
		if (eventEntry.eid && !eventEntry.allDay && eventEntry.startTime.getTime() < now()) {
			var flag = confirm(getMessage("addedTimedEventInThePast"));
			if (flag) {						
				//var eid = getUrlValue(response.item.data.alternateLink, "eid");
				var newStartTime = today();
				newStartTime.setDate(newStartTime.getDate()+1);						
				newStartTime.setHours(eventEntry.startTime.getHours());
				newStartTime.setMinutes(eventEntry.startTime.getMinutes());
				newStartTime.setSeconds(eventEntry.startTime.getSeconds());
				var newEndTime = calculateNewEndTime(eventEntry.startTime, eventEntry.endTime, newStartTime);
				eventEntry.startTime = newStartTime;
				eventEntry.endTime = newEndTime;
				console.log("_postconte:" + callback)
				updateEvent(eventEntry, function(response) {
					console.log("_postconte2:" + callback)
					callback(response);
				});
			} else {
				callback(response);
			}
		} else {
			callback(response);
		}
	});
}

function _postContent(eventEntry, callback) {
	postToGoogleCalendar(eventEntry, callback);
} 

// Seems when adding all day event to the current day - Google api would register the event as a timed event (saved to the current time) - so let's update the event to save it as an all day event
function ensureQuickAddPatchWhenAddingAllDayEvent(params, callback) {
	if (params.originalEventEntry.allDay && params.originalEventEntry.summary == params.eventEntry.summary && params.eventEntry.startTime && Math.abs(params.eventEntry.startTime.diffInMinutes()) <= 2) {
		
		params.eventEntry.allDay = true;
		params.patchFields = generateGoogleCalendarEvent(params.eventEntry);
		
		updateEvent(params, function(response) {
			response.secondPass = true;
			callback(response);
		});
	} else {
		callback(params.response);
	}
}

function ensureEventStartTimeIsNotInThePast(calendarId, eventEntry, response, callback) {
	if (!eventEntry.allDay && eventEntry.startTime.getTime() < now()) {
		var flag = confirm(getMessage("addedTimedEventInThePast"));
		if (flag) {
			var newStartTime = today();
			newStartTime.setDate(newStartTime.getDate()+1);						
			newStartTime.setHours(eventEntry.startTime.getHours());
			newStartTime.setMinutes(eventEntry.startTime.getMinutes());
			newStartTime.setSeconds(eventEntry.startTime.getSeconds());
			var newEndTime = calculateNewEndTime(eventEntry.startTime, eventEntry.endTime, newStartTime);
			eventEntry.startTime = newStartTime;
			eventEntry.endTime = newEndTime;
			
			var patchFields = {};
			patchFields.start = {};
			patchFields.start.dateTime = eventEntry.startTime.toRFC3339();
			if (eventEntry.endTime) {
				patchFields.end = {};
				patchFields.end.dateTime = eventEntry.endTime.toRFC3339();
			}
			
			var params = {calendarId:calendarId, eventEntry:eventEntry, googleCalendarEvent:response.data, patchFields:patchFields};
			
			updateEvent(params, function(response) {
				response.secondPass = true;
				callback(response);
			});
		} else {
			callback(response);
		}
	} else {
		callback(response);
	}
}

// since we couldn't add a description with the quickadd method let's pass a 2nd time to add the description by updating the recently created event
function ensureAllEventDetailsSavedAfterQuickAdd(params, callback) { //calendarId, eventEntry, response
	console.log("ensurequickadd details allday: " + params.eventEntry.allDay)
	console.log("ensurequickadd details startt: " + params.eventEntry.startTime)
	if (params.eventEntry.description || params.nonEnglishWithStartTime) {
		console.log("second pass", params.eventEntry);
		
		//var params = {calendarId:calendarId, eventEntry:eventEntry, googleCalendarEvent:response.data, patchFields:generateGoogleCalendarEvent(eventEntry)};
		params.patchFields = generateGoogleCalendarEvent(params.eventEntry);
		
		updateEvent(params, function(response) {
			response.secondPass = true;
			callback(response);
		});
	} else {
		callback(params.response);
	}				
}

// in minutes
function getDefaultEventLength() {
	if (bg.storage.calendarSettings.defaultEventLength) {
		return parseInt(bg.storage.calendarSettings.defaultEventLength);
	} else {
		return 60; // 60 minutes
	}
}

function generateGoogleCalendarEvent(eventEntry) {
	var data = {};
	
	data.summary = eventEntry.summary;
	data.description = eventEntry.description; //.replace(/&/ig, "&amp;")
	data.source = eventEntry.source;
	
	// if string form is passed then push direction to object (this is used for facebook event add from ics file
	// startTimeStr from ics can equal... DTSTART:20121004 or DTSTART:20121014T003000Z
	var formatStr;
	if (eventEntry.allDay) {
		formatStr = "yyyy-mm-dd";
		data.start = {
			date: eventEntry.startTime.format(formatStr),
			dateTime: null
		}
		if (!eventEntry.endTime) {
			eventEntry.endTime = new Date(eventEntry.startTime);
			eventEntry.endTime.setDate(eventEntry.endTime.getDate()+1);
		}
		data.end = {
			date: eventEntry.endTime.format(formatStr),
			dateTime: null
		}
	} else {
		data.start = {
			date: null,
			dateTime: eventEntry.startTime.toRFC3339()
			// 2012-12-17T17:54:00Z
		}
		// if none set must put it's duration atleast an 1 long
		if (!eventEntry.endTime) {
			eventEntry.endTime = new Date(eventEntry.startTime);
			eventEntry.endTime.setMinutes(eventEntry.endTime.getMinutes() + getDefaultEventLength());
		}
		data.end = {
			date: null,
			dateTime: eventEntry.endTime.toRFC3339()
		}
	}
	
	data.location = eventEntry.location;
	return data;
}

function postToGoogleCalendar(eventEntry, callback) {
	
	if (eventEntry.quickAdd) {
		var title;
		// if no date set and it's all day then we must push the date into the quickadd to force to be an all day event
		if (!eventEntry.startTime && eventEntry.allDay) {
			eventEntry.startTime = today();
		}
		
		var nonEnglishWithStartTime = false;
		var originalEventEntry = clone(eventEntry);
		
		// if not today than skip this if statement because if a user types "tomorrow" or "tuesday" we can't add also the date to the quick add statement ie. conflicting statement... (tomorrow test 12/12/20012
		if (eventEntry.startTime && !eventEntry.startTime.isToday()) {
			// it seems that if we are no in english than quickAdd can only save the time or the date but not both! so let's quick add the event so quickadd recognizes the time string and then pass a 2nd time to update it to the proper date
			if (bg.storage.calendarSettings.calendarLocale == "en") {
				format = "m/d/yyyy";
				// german: format = "yyyy/m/d";
				title = eventEntry.summary + " " + eventEntry.startTime.format(format);
			} else {
				nonEnglishWithStartTime = true;
				title = eventEntry.summary;
			}				
		} else {
			title = eventEntry.summary;
		}
		
		var calendarId = getCalendarId(eventEntry)
		
		console.log("allday", eventEntry.allDay)
		
		bg.oAuthForDevices.send({userEmail:email, type:"POST", url: "/calendars/" + encodeURIComponent(calendarId) + "/events/quickAdd", data:{text:title}}, function(response) {
			if (response.error) {
				callback(response);
			} else {
				initEventObj(response.data);
				copyObj(response.data, eventEntry);
				console.log("start", eventEntry)
				if (nonEnglishWithStartTime) {
					console.log("non english with time")
					// determine if time was matched in the text sent to quickadd: it would be extracted from the summary in the result and thus means time was once present
					if (originalEventEntry.summary != eventEntry.summary) {
						// timed event
						eventEntry.allDay = false;
						eventEntry.startTime.setDate(originalEventEntry.startTime.getDate());
						eventEntry.startTime.setMonth(originalEventEntry.startTime.getMonth());
						eventEntry.startTime.setFullYear(originalEventEntry.startTime.getFullYear());
						if (originalEventEntry.endTime) {
							eventEntry.endTime.setDate(originalEventEntry.endTime.getDate());
							eventEntry.endTime.setMonth(originalEventEntry.endTime.getMonth());
							eventEntry.endTime.setFullYear(originalEventEntry.endTime.getFullYear());
						} else {
							eventEntry.end = null;
							eventEntry.endTime = null;
						}
					} else {
						// allday event
						eventEntry.allDay = true;
						eventEntry.startTime = originalEventEntry.startTime;
						eventEntry.endTime = originalEventEntry.endTime;
					}
					console.log("re-evententry:", eventEntry)
				} else {
					/*
					if (originalEventEntry.summary == eventEntry.summary) {
						console.log("force all day");
						// allday event
						eventEntry.allDay = true;
						eventEntry.startTime = originalEventEntry.startTime;
						eventEntry.endTime = originalEventEntry.endTime;
					}
					*/
				}
				
				ensureQuickAddPatchWhenAddingAllDayEvent({originalEventEntry:originalEventEntry, calendarId:calendarId, eventEntry:eventEntry, response:response, googleCalendarEvent:response.data}, function(response) {
					ensureEventStartTimeIsNotInThePast(calendarId, eventEntry, response, function(response) {
						ensureAllEventDetailsSavedAfterQuickAdd({calendarId:calendarId, eventEntry:eventEntry, response:response, googleCalendarEvent:response.data, nonEnglishWithStartTime:nonEnglishWithStartTime}, function(response) {
							if (response.secondPass) {
								if (response.error) {
									logError("error in ensures", response.error);
								} else {
									initEventObj(response.data);
									copyObj(response.data, eventEntry);
								}
							}
							callback(response);
						});
					});
				});
			}
		});
		
	} else {
		
		var data = generateGoogleCalendarEvent(eventEntry);
		var calendarId = getCalendarId(eventEntry)

		bg.oAuthForDevices.send({userEmail:email, type:"POST", contentType:"application/json; charset=utf-8", url: "/calendars/" + encodeURIComponent(calendarId) + "/events", data:JSON.stringify(data)}, function(response) {
			if (response.error) {
				callback({error:response.error});
			} else {
				initEventObj(response.data);
				copyObj(response.data, eventEntry);
				
				callback(response);
			}
		});

	}
	
}

// old way of using udpatevent was just passing an eventEntry
// new way is passing the google calendar event object and passing fields to change
function updateEvent(eventEntryOrNewParams, callback) {
	
	var eventEntry;
	var googleCalendarEvent;
	if (eventEntryOrNewParams.googleCalendarEvent) {
		eventEntry = eventEntryOrNewParams.eventEntry;
		googleCalendarEvent = eventEntryOrNewParams.googleCalendarEvent;
	} else {
		eventEntry = eventEntryOrNewParams;
	}

	if (true && (googleCalendarEvent || eventEntry.event)) { // pref("oauth")
		
		if (googleCalendarEvent) {
			calendarId = eventEntryOrNewParams.calendarId;
			eventId = googleCalendarEvent.id;
			data = eventEntryOrNewParams.patchFields;
			console.log("googleCalendarEvent", googleCalendarEvent);
		} else {		
			calendarId = eventEntry.event.calendar.id;
			eventId = eventEntry.event.id;
			console.log("eventEntry", eventEntry);
			
			var data = generateGoogleCalendarEvent(eventEntry);			
		}
		
		if (!calendarId) {
			console.warn("no calenadrId, default to primary");
			calendarId = "primary";
		}

		bg.oAuthForDevices.send({userEmail:email, type:"PATCH", contentType:"application/json; charset=utf-8", url: "/calendars/" + encodeURIComponent(calendarId) + "/events/" + eventId, data:JSON.stringify(data)}, function(response) {
			if (response.error) {
				callback({error:response.error});
			} else {
				initEventObj(response.data);
				// copy new updated times/dates to event which was passed in the eventEntry
				if (googleCalendarEvent) {
					// just return respnse
				} else {
					copyObj(response.data, eventEntry.event);
				}
				callback(response);
			}
		});
		
	} else {
		// to update the title must use text=
		// to update description must use details=
		submitActionLink("EDIT", eventEntry, "&sf=true" + "&eid=" + eventEntry.eid, function(response) {
			callback(response);
		});
	}
}

function submitActionLink(action, eventEntry, extraParams, callback) {
	console.log("submitActionLink");
	var actionLinkObj = generateActionLink(action, eventEntry);
	actionLinkObj.data += extraParams;
	chrome.cookies.getAll({name:"secid"}, function(cookies) {
		if (cookies) {
			var lastEmbedHref = bg.contentScriptParams["lastEmbedHref"];
			/*
				https://www.google.com/calendar/b/0/embed?src=blah@gmail.com&gsessionid=mDioJSIv9a9GAeqGIuh8Fw
				https://www.google.com/calendar/b/1/embed?src=blah@esimpleit.com&gsessionid=iU559FX84KZ_Ri7zLUsZJA
				https://www.google.com/calendar/embed?src=blah@gmail.com&gsessionid=hqFMGqM4z4dCACv0f43Iww
			*/
			if (lastEmbedHref) { // if found
				var embedPath = lastEmbedHref.substring(lastEmbedHref.indexOf("/calendar"), lastEmbedHref.indexOf("/embed"));
				var secid = null;
				$.each(cookies, function(i, cookie) {
					if (cookie.path == embedPath) {
						secid = cookie.value;
						return false;
					}
					return true;
				});
			} else { // not found, might be trying add via the omnibox and never have loaded the popup window
				secid = cookies[0].value;
			}
			//url = "https://www.google.com/calendar/event";
			//data = "action=CREATE&dates=20110810/20110811&ctext=Bus_Times_for_Google_ChromePurchase%20Receipt%20for%20Order%20%23263859900865316&details=oh%20ok%20thanks-%20Show%20quoted%20text%20-On%20Wed%2C%20Aug%2010%2C%202011%20at%209%3A05%20AM%2C%20Jason%20%3Cjasonsavard%40gmail.com%3E%20wrote%3A%0Athanks%20for%20the%20info%2C%20however%2C%20these%20transit%20agencies%20must%20explicitly%20release%20a%20public%20GTFS%20feed%20of%20their%20data%2C%20or%20else%20I%20cannot%20obtain%20the%20bus%20routes%2C%20it%20seems%20that%20MARTA%20for%20instance%20refuses%20to%20participate%2C%20i%20randomly%20googled%20this%20article%C2%A0http%3A%2F%2Fmartarocks.com%2F2010%2F08%2F19%2Fmarta-fail%2F%0A%0Ayou%20can%20also%20refer%20to%20my%20faq%20however%20if%20you%20wish%20to%20follow%20through%20with%20these%20transit%20agencies%20to%20have%20them%20create%20a%20public%20GTFS%20feed%C2%A0http%3A%2F%2Fjasonsavard.com%2Fmediawiki%2Findex.php%2FBus_Times_for_Google_Chrome%23Where_is_my_transit_agency_or_city_or_country.3F%0A%0AJasonOn%20Wed%2C%20Aug%2010%2C%202011%20at%204%3A43%20AM%2C%20timothy%20sanford%20%3Csanfordtimothy81%40gmail.com%3E%20wrote%3A%0A%0Ahi%2C%20i%22m%20from%20Atlanta%20Georgia%20USA%20and%20noticed%20today%20while%20browsing%2C%20that%20you%20dont%20have%20any%20Ga%20Buses%2C%20i'll%20list%20the%20transit%20agencies%20and%20their%20sites%C2%A0%0A%0Ahttp%3A%2F%2Fwww.itsmarta.com%2F%C2%A0metropolitan%C2%A0atlanta%20rapid%20transit%20authority%20aka%20MARTA%0Ahttp%3A%2F%2Fdot.cobbcountyga.gov%2Fcct%2F%20%C2%A0%20Cobb%20Community%20Transithttp%3A%2F%2Fwww.xpressga.com%2F%20%C2%A0%20%C2%A0Georgia%20xpress%0A%0Ahttp%3A%2F%2Fwww.gwinnettcounty.com%2Fportal%2Fgwinnett%2FDepartments%2FTransportation%2FGwinnettCountyTransit%20%C2%A0%C2%A0GwinnettCountyTransit%0A%0A%0A%C2%A0%20these%20are%20the%204%20transits%20in%20atlanta%20Georgia%20United%20states%20of%20america%20USA%0A%0A--%20timothy%206785254166%0A%0A%0AHello%20%20jasonsavard%40gmail.com%2C%20%20%20marko.laving%40gmail.com%20has%20just%20completed%20a%20purchase%20from%20your%20store.%20Below%20is%20the%20summary%20of%20the%20transaction.%0ANext%20step...%0AProcess%20this%20order%0Ain%20your%20Google%20Checkout%20account.%0AThis%20cart%20is%20unsigned%0A%0A%C2%A0Order%20date%3A%20Aug%2010%2C%202011%204%3A22%20AM%20EDT%0A%0A%C2%A0Google%20order%20number%3A%20263859900865316%0A%0A%0A%C2%A0Shipping%20Status%C2%A0%0A%C2%A0Qty%C2%A0%0AItem%0A%C2%A0%C2%A0Price%0A%C2%A0%C2%A0%C2%A0Digital%20delivery%0A%C2%A01%0AChecker%20Plus%20for%20Google%20Calendar%0A%0A%0A%0A%0A%0A%242.00%0A%C2%A0Tax%20%3A%0A%240.00%0A%C2%A0%0A%0ATotal%3A%0A%242.00%0A%C2%A0%0A%0ANeed%20help%3F%20Visit%20the%20%20Google%20Checkout%20help%20center.%0APlease%20do%20not%20reply%20to%20this%20message.%0A%0A%C2%A92011%C2%A0Google&src=jasonsavard%40gmail.com&pprop=HowCreated:DRAG&qa-src=month-grid&sf=true&hl=en-US" + "&secid=" + secid;
			if (secid) {
				//url += "&secid=" + secid;
				//showSavingMessage();
				$.ajax({
					url: actionLinkObj.url,
					data: actionLinkObj.data + "&secid=" + secid,
					type: "GET", // getting for 403 when I used to use POST but it used to work??? will also have to change the deleteevent get/post
					timeout: 10000,
					complete: function(request, textStatus) {
						//clearSavingMessage();
						var status = getStatus(request, textStatus);
						//403
						//404
						//414 too large
						if (status == 200) {
							console.log(request);
							try {
								// XML sample resopnse:
								// <eid><value>MDVoaWs0MGkyYWUwYnA1NGU3bGJtNHBlY3MgamFzb25zYXZhcmRAbQ</value></eid>
								// <summary access="editable" editing="false"><value>test</value></summary>
								// <dates> <value>20110802/20110803</value><display>Tue Aug 2 - Tue Aug 2</display><start-date>8/2/2011</start-date><end-date>8/2/2011</end-date> </dates>
								//var dateStr = request.responseXML.getElementsByTagName('dates')[0].getElementsByTagName('value')[0].textContent;
								//var dateResult = rfc3339StringToDate(dateStr.split("/")[0]);
								eventEntry.eid = request.responseXML.getElementsByTagName('eid')[0].getElementsByTagName('value')[0].textContent;
								eventEntry.summary = request.responseXML.getElementsByTagName('summary')[0].getElementsByTagName('value')[0].textContent;
								eventEntry.htmlLink = "https://www.google.com/calendar/event?eid=" + eventEntry.eid;
								var datesNode = request.responseXML.getElementsByTagName('dates')[0];
								var dateValue = datesNode.getElementsByTagName('value')[0].textContent;
								var startEndDate = dateValue.split("/");
								var startDate = startEndDate[0].parseDate();
								var endDate = startEndDate[1].parseDate();
								//var startDate = new Date(datesNode.getElementsByTagName('start-date')[0].textContent);
								//var endDate = new Date(datesNode.getElementsByTagName('end-date')[0].textContent);
								var startTimeNode = datesNode.getElementsByTagName('start-time');
								var withTime = startTimeNode && startTimeNode.length >= 1 ? true : false;
								eventEntry.startTime = startDate;
								eventEntry.endTime = endDate;
								eventEntry.allDay = !withTime;
								// must return atleast an empty object or will get problems when trying to ready [object=null].error etc..
								console.log("callback: " + callback)
								callback({});
								//callback({eid:eid, title:title, startTime:startDate, endTime:endDate, allDay:!withTime});
							} catch (e) {
								logError("Error trying to display event message: " + e);
								callback({error:"Error trying to display event message: " + e});
							}
						} else {
							//alert("Error: " + status);
							callback({error: status});
						}																	
					}
				});
			} else {
				logError("Error: Could not find mathing secid cookie: " + lastEmbedHref + " " + embedPath);
			}
		} else {
			alert("Error: 'secid' not found!");
		}
	});			
}

function deleteEvent(eid, secid, event, callback) {
	if (true && event && event.id) { //pref("oauth")

		var calendarId = getCalendarId(event)
		
		bg.oAuthForDevices.send({userEmail:email, type:"DELETE", url: "/calendars/" + encodeURIComponent(calendarId) + "/events/" + event.id}, function(response) {
			if (response.error) {
				callback({status:response.error});
			} else {
				callback({status:200});
			}
		});
		
	} else {
		var url = "https://www.google.com/calendar/deleteevent";
		if (!secid) {
			secid = bg.contentScriptParams["secid"]; //getCookie("secid");
		}
		$.ajax({
			url: url,
			type: "GET",
			data: "eid=" + eid + "&secid=" + secid,
			dataType: "text",
			timeout: 8000,
			complete: function(request, textStatus) {
				var status = getStatus(request, textStatus);
				console.log("status: " + status + " textStatus: " + textStatus + " " + this.data);
				callback({status : status});
			}
		});
	}
}

function getEventDateMessage(eventEntry, onClick, onUndo) {
	var msgHTML;
	if (eventEntry.startTime) {
		var addedFor = null;
		var atStr = "";
		if (!eventEntry.allDay) {
			atStr = "At";
		}
		var titleNode = "<a class='eventTitle' href='javascript:;'>" + $.trim(eventEntry.summary) + "</a>";
		if (eventEntry.startTime.isToday()) {
			addedFor = getMessage("addedForToday" + atStr, [titleNode, eventEntry.startTime.formatTime()]);
		} else if (eventEntry.startTime.isTomorrow()) {
			addedFor = getMessage("addedForTomorrow" + atStr, [titleNode, eventEntry.startTime.formatTime()]);
		} else {
			addedFor = getMessage("addedForSomeday" + atStr, [titleNode, eventEntry.startTime.format("dddd, mmm d"), eventEntry.startTime.formatTime()]);
		}
		msgHTML = "<span class='eventTitleWrapper'>" + addedFor + "</span>";
	} else {
		msgHTML = getMessage("eventAdded");
	}
	
	if (onUndo) { 
		msgHTML += ". <a class='eventUndo' href='javascript:;'>" + getMessage("undo") + "</a>";
	}
	
	var $msg = $("<span>" + msgHTML + "</span>");
	
	if (onClick) {
		$msg.find(".eventTitle").click(function() {
			onClick();
		});
	}
	
	if (onUndo) {
		$msg.find(".eventUndo").click(function() {
			onUndo();
		});	
	}
	
	return $msg;
}

function calculateNewEndTime(oldStartTime, oldEndTime, newStartTime) {
	if (oldEndTime) {
		var duration = oldEndTime.getTime() - oldStartTime.getTime();
		var newEndTime = new Date(newStartTime.getTime() + duration);
		return newEndTime;
	} else {
		return null;
	}
}

function getEventEntryFromQuickAddText(text) {
	// look for 'cook in 10 min' etc...
	var eventEntry = timeFilter(text, "min(ute)?s?", 1);
	if (!eventEntry || !eventEntry.summary) {
		eventEntry = timeFilter(text, "hours?", 60);
		if (!eventEntry || !eventEntry.summary) {
			var regex = new RegExp("^" + getMessage("tom") + ":")
			var matches = regex.exec(text);
			if (matches) {
				// remove the tom: etc.
				eventEntry = new EventEntry(text.replace(regex, ""), tomorrow());
			} else {
				eventEntry = new EventEntry(text);
			}
		}
	}
	return eventEntry;
}

function timeFilter(str, timeRegex, timeMultiplierForMinutes) {
	//var matches = title.match(/\b(in )?(\d*) ?min(ute)?s?\b/)
	var regexStr = "\\b ?(in |for )?(\\d*) ?" + timeRegex + "\\b";
	var matches = new RegExp(regexStr).exec(str)
	// look for a match and that not just the word 'min' was found without the number of minutes (##)etc..
	if (matches != null && matches[2]) {
		if (matches[1] == "for ") {
			// skip formatting title because this a quick add with a duration ie. dinner at 7pm for 30min
		} else {
			var time = matches[2];
			var extractedTitle = str.replace(matches[0], "");
			return formatTitle(extractedTitle, time * timeMultiplierForMinutes);
		}
	}
}

// returns the date and title object
function formatTitle(title, minutesToGo) {
	var newDate = new Date(now() + 1000 * 60 * minutesToGo);
	var time = "";
	
	// patch for zh-cn and zh-tw because putting 2:00am or pm do not work, must use the chinese am/pm ie. 上午6:00 or 下午6:30
	if (pref("lang", window.navigator.language).indexOf("zh") != -1) {		
		if (newDate.getHours() < 12) {
			time = "上午"
		} else {
			time = "下午";
		}
		time += dateFormat(newDate, "h:MM")
	} else {
		time = dateFormat(newDate, "h:MMtt");
	}
	
	return new EventEntry(time + " " + title, newDate);
}

function cleanTitle(title) {
	// gmail email title ex. "Gmail - emailSubject - abc@def.com"
	// use this regex to get emailsubject from title				
	var matches = title.match(/^Gmail - (.*) - .*@.*/i);
	if (matches) {
		return matches[1];
	} else {
		return title;
	}
}

function prepContentForCreateEvent(title, description, url) {
	title = cleanEmailSubject(title);
	
	if (description) {
		description = removeHTML(description);
		description = $.trim(description);
		// trim line breaks
		description = trimLineBreaks(description);
		description = $.trim(description);
	}

	// Add link to email
	if (/\/\/mail.google.com/.test(url)) {
		var matches = url.match(/([0-9]*[a-z]*)*$/); // this will match the 133c67b2eadf9fff part of the email
		var emailLink;
		if (matches && matches[0].length >= 10) {
			emailLink = url;
		} else {
			emailLink = "https://mail.google.com/mail/#search/subject%3A+" + encodeURIComponent(title);
		}
		description = emailLink + "\n\n" + description;
	}
	
	return {title:title, description:description};
}

// if no "tab" passed then default to this page
function getEventDetailsFromPage(tab, callback) {

	var title, description;
	
	if (tab) {
		// Try pinging the page for details
		var port = chrome.tabs.connect(tab.id, {name: "getEventDetails"});						
	    port.onMessage.addListener(function(response) {
	    	// If title found from within webpage (like in a Gmail email)...
	    	if (response.title) {
	    		var content = prepContentForCreateEvent(response.title, response.description, tab.url);
	    		title = content.title;
	    		description = content.description;
	    	}
	    });
	    
	    setTimeout(function() {
	        // if page not responding or no details found then just spit out title and url
	    	if (!title) {
	    		title = cleanEmailSubject(cleanTitle(tab.title));
	    		description = tab.url;
	    	}
	    	callback({title:title, description:description});
	    }, 100);
	} else {
		title = $(".hP:visible").first().text();
		description = $(".ii.gt:visible").html();
		var content = prepContentForCreateEvent(title, description, location.href);
		callback(content);
	}
}

function formatDateTo8Digits(date, withTime) {
	var str = date.getFullYear() + "" + pad((date.getMonth()+1),2, "0") + "" + pad(date.getDate(), 2, "0");
	if (withTime) {
		str += "T" + pad(date.getHours(), 2, "0") + "" + pad(date.getMinutes(), 2, "0") + "" + pad(date.getSeconds(), 2, "0");
	}
	return str;
}

function getCalendarId(eventEntry) {
	var calendarId;
	if (eventEntry.calendar) {
		calendarId = eventEntry.calendar.id;
	} else {
		calendarId = "primary";
	}
	return calendarId;
}

function getCalendarIDFromURL(url) {
	if (url) {
		var str = "/feeds/";
		var idx = url.indexOf(str);
		if (idx != -1) {
			id = url.substring(idx+str.length);
			idx = id.indexOf("/");
			if (idx != -1) {
				return id.substring(0, idx);
			}
		}
	}
	return null;
}

function generateActionLink(action, eventEntry) {
	var description = eventEntry.description;
	// when using GET must shorten the url length so let's shorten the desctiption to not get 414 errors
	var MAX_DESCRIPTION_LENGTH = 600;
	if (description && description.length > MAX_DESCRIPTION_LENGTH) {
		description = description.substring(0, MAX_DESCRIPTION_LENGTH) + "...";						
	}
	var datesStr = "";
	
	// if no starttime must have one for this url to work with google or else it returns 404
	if (!eventEntry.startTime) {
		eventEntry.startTime = today();
	}
	if (eventEntry.startTime) {
		var startTime = eventEntry.startTime ? new Date(eventEntry.startTime) : new Date();
		var endDate;
		var withTime = !eventEntry.allDay;
		var startTimeStr = formatDateTo8Digits(startTime, withTime);
		if (eventEntry.endTime) {
			endDate = new Date(eventEntry.endTime);
		} else {
			endDate = new Date(startTime);
			if (eventEntry.allDay) {
				endDate.setDate(startTime.getDate()+1);
			} else {
				// should fetch this from Google Calendar setting but couldn't find in this API version feed: "default meeting length"
				endDate.setMinutes(endDate.getMinutes() + getDefaultEventLength());
			}
		}					
		var endDateStr = formatDateTo8Digits(endDate, withTime);
		datesStr = "&dates=" + startTimeStr + "/" + endDateStr;
	}
	
	var cText = eventEntry.summary ? "&ctext=" + encodeURIComponent(eventEntry.summary) : "";
	var textParam = eventEntry.summary ? "&text=" + encodeURIComponent(eventEntry.summary) : "";
	//output=js CRASHES without specifying return type in .ajax
	//https://www.google.com/calendar/event?hl=de&dates=20110124/20110125&ctext=tet&pprop=HowCreated:DRAG&qa-src=month-grid&sf=true&action=CREATE&output=js&secid=AmobCPSNU1fGgh1zQp9oPzEaMhA
	var detailsParam = description ? "&details=" + encodeURIComponent(description) : "";
	
	var src;
	var srcParam
	if (eventEntry.calendar) {
		src = eventEntry.calendar.id;
	} else {
		src = getCalendarIDFromURL(eventEntry.calendarURL);
	}
	srcParam = src ? "&src=" + src : "";
	
	var url = "https://www.google.com/calendar/event";
	var data = "action=" + action + datesStr + cText + textParam + detailsParam + srcParam;
	return {url:url, data:data};
}

function daysElapsedSinceFirstInstalled() {
	return Math.abs(new Date(localStorage.installDate).diffInDays());
}

function processFeatures() {
	localStorage["donationClicked"] = "true";
	localStorage["removeDonationLink"] = "true";
	chrome.runtime.sendMessage({command: "featuresProcessed"}, function(response) {});
	if (typeof afterUnlock != "undefined") {
		afterUnlock();
	}
}

var IGNORE_DATES = false;

function isEligibleForReducedDonation() {

	if (TEST_REDUCED_DONATION) {
		return true;
	}
	
	// not eligable if we already d or we haven't verified payment
	if (pref("donationClicked") || !localStorage["verifyPaymentRequestSentForReducedDonation"]) {
		return false;
	} else {
		// must be older than 50 days + 10 (because we want this ad after the gmail ad)
		if (IGNORE_DATES || daysElapsedSinceFirstInstalled() >= 60) {
			
			// stamp this is as first time eligibility shown
			var daysElapsedSinceEligible = localStorage.daysElapsedSinceEligible;
			if (!daysElapsedSinceEligible) {
				localStorage.daysElapsedSinceEligible = new Date();				
			}
			
			return true;
		} else {
			return false;
		}
	}
}

// only display eligible special for 1 week after initially being eligiable (but continue the special)
function isEligibleForReducedDonationAdExpired() {

	if (TEST_REDUCED_DONATION) {
		return false;
	}
	
	if (localStorage.reducedDonationAdClicked) {
		return true;
	} else {
		var daysElapsedSinceEligible = localStorage.daysElapsedSinceEligible;
		if (daysElapsedSinceEligible) {
			daysElapsedSinceEligible = new Date(daysElapsedSinceEligible);
			if (IGNORE_DATES || Math.abs(daysElapsedSinceEligible.diffInDays()) <= 7) {
				return false;
			} else {
				return true;
			}
		}
		return false;
	}
}

function shouldShowReducedDonationMsg() {
	return isEligibleForReducedDonation() && !isEligibleForReducedDonationAdExpired();
}

function getSummary(o) {
	return o.summary;
}

function getEventID(event) {
	if (event.id) {
		return event.id
	} else {
		return event.eid;
	}
}

function isSameEvent(event1, event2) {
	return event1.id == event2.id;
}

function darkenColor(color) {
	// patch: google calendar colors are not matching api colors they are lighter - so let's map some to their correct values
	if (color == "#9a9cff") {
		return "#373AD7";
	} else if (color == "#9fc6e7") { // first default calendar color
		return "#1587BD";
	} else {
		return lightenDarkenColor(color, -40);
	}
}

function initEventObj(event) {
	if (event.start.date) {
		event.allDay = true;
		event.startTime = event.start.date.parseDate();
		event.endTime = event.end.date.parseDate();
	} else {
		event.allDay = false;
		event.startTime = event.start.dateTime.parseDate();
		event.endTime = event.end.dateTime.parseDate();
	}
}

function isGadgetCalendar(calendar) {
	if (calendar) {
		var id = calendar.id;
		if (id && (
				decodeURIComponent(id).indexOf("#weather@group.v.calendar.google.com") != -1 || // weather
				decodeURIComponent(id).indexOf("#weeknum@group.v.calendar.google.com") != -1 || // week numbers 
				decodeURIComponent(id).indexOf("#daynum@group.v.calendar.google.com") != -1 || // day of the year
				decodeURIComponent(id).indexOf("ht3jlfaac5lfd6263ulfh4tql8@group.calendar.google.com") != -1 // moon phases
				)) {
					return true;
		} else {
			return false;
		}
	} else {
		return false;
	}
}

function updateEventsShown(notifications, eventsShown, lastAction) {
	$.each(notifications, function(index, notification) {
		var event = notification.event;
		var reminderTime = notification.reminderTime;
		// mark event as shown
		var strippedEvent = $.extend(true, {}, event);
		strippedEvent.title = "";
		strippedEvent.location = "";
		strippedEvent.attendeeStatus = "";
	
		// Update eventsShown with stripped event
		var eventToModify = findEvent(event, eventsShown);
		
		if (eventToModify) {
			markReminderTimeAsShown(event, reminderTime, eventToModify);
		} else {
			markReminderTimeAsShown(event, reminderTime, strippedEvent);
			eventsShown.push(strippedEvent);
		}
		
	});

	if (lastAction != "snooze") {
		removeSnoozers(notifications);
	}

	bg.serializeEventsShown();
}

function findEvent(event, eventsShown) {
	for (var a=0; a<eventsShown.length; a++) {
		if (isSameEvent(eventsShown[a], event)) {
			bg.console.log("find events");
			return eventsShown[a];
		}
	}
}

function markReminderTimeAsShown(event, reminderTime, eventToModify) {
	eventToModify.startTime = event.startTime;
	if (reminderTime) {
		//log(getSummary(event) + " remindertime", "showConsoleMessagesEventsSnoozes");
		if (!eventToModify.reminderTimes) {
			eventToModify.reminderTimes = [];
		}
		eventToModify.reminderTimes.push({time:reminderTime, shown:true});
	}
}

function removeSnoozers(notifications) {
	$.each(notifications, function(index, notification) {
		// Remove IF from Snoozers
		var event = notification.event;
		for (var a=0; a<snoozers.length; a++) {
			var snoozer = snoozers[a];
			bg.console.log("snooze found")
			if (isSameEvent(event, snoozer.event)) {
				bg.console.log("remove snooze")
				snoozers.splice(a, 1);
				a--;
				break;
			}
		}
	});

	bg.storage.snoozers = snoozers;
	bg.storageManager.set("snoozers", bg.storage.snoozers);
}

function SnoozeObj(time, currentEvent, reminderTime) {
	this.time = time;
	this.event = currentEvent;
	this.reminderTime = reminderTime;
	this.email = bg.email;
}

function setSnoozeInMinutes(notifications, units) {
	setSnoozeDate(notifications, new Date(now() + minutes(units)));
}

function setSnoozeInHours(notifications, units) {
	setSnoozeDate(notifications, new Date(now() + hours(units)));
}

function setSnoozeDate(notifications, time) {
	
	// remove first then add again
	removeSnoozers(notifications);
	
	// patch: because events from calendars like holidays or sports don't really have remindertimes so let's put it into the object
	//if (!notification.reminderTime) {
		//notification.reminderTime = time;
	//}
	
	$.each(notifications, function(index, notification) {
		var snooze = new SnoozeObj(time, notification.event, notification.reminderTime); // last # = minutes
		snoozers.push(snooze);
	});
	
	bg.storage.snoozers = snoozers;
	bg.storageManager.set("snoozers", bg.storage.snoozers);
}

function snoozeNotifications(snoozeParams, notifications) {
	if (snoozeParams.snoozeTime) {
		setSnoozeDate(notifications, snoozeParams.snoozeTime);
	} else if (snoozeParams.inMinutes) {
		if (pref("testMode") && snoozeParams.inMinutes == 5) {
			snoozeParams.inMinutes = 1;
		}
		setSnoozeInMinutes(notifications, snoozeParams.inMinutes);
	} else if (snoozeParams.inHours) {
		setSnoozeInHours(notifications, snoozeParams.inHours);
	} else { // in days
		var daysToSnooze = snoozeParams.inDays;
		var snoozeToThisDay = today();
		snoozeToThisDay.setDate(snoozeToThisDay.getDate()+parseInt(daysToSnooze));
		snoozeToThisDay.setHours(5);
		snoozeToThisDay.setMinutes(0);
		snoozeToThisDay.setSeconds(0);
    	setSnoozeDate(notifications, snoozeToThisDay);
	}

	var closeNotificationsParams = {};
	closeNotificationsParams.lastAction = "snooze";
	if (snoozeParams.source == "notificationButton") {
		closeNotificationsParams.source = "notificationButton";
	}
	
	bg.closeNotifications(notifications, closeNotificationsParams);
}

function getTimeElapsed(event) {
	var timeElapsedMsg = "";
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
		} else if (diff <= -1) {
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
	
	return timeElapsedMsg;
}

function getSelectedCalendars() {
	var selectedCalendars = localStorage.selectedCalendars;
	if (selectedCalendars) {
		selectedCalendars = JSON.parse(selectedCalendars);
	}
	if (!selectedCalendars) {
		selectedCalendars = {};
	}
	return selectedCalendars;
}

function isCalendarSelectedInExtension(calendar, email, selectedCalendars) {
	if (calendar) {
		// new added because we were fetching events for weather, week numbers etc. which were never used in the display of new looks (or old looks for that matter because they don't use the feed data- just the embed calendar)
		if (!isGadgetCalendar(calendar)) {
			if (selectedCalendars && selectedCalendars[email]) {
				var selected = selectedCalendars[email][calendar.id];
				
				// if previously defined than return that setting
				if (typeof selected != "undefined") {
					return selected;
				} else { // never defined so use default selected flag from google calendar settings
					return calendar.selected;
				}
			} else {
				// // never defined so use default selected flag from google calendar settings
				return calendar.selected;
			}			
		}
	}
}

function getCalendarName(calendar) {
	// see if user renamed the original calendar title
	if (calendar.summaryOverride) {
		return calendar.summaryOverride;
	} else {
		return calendar.summary;
	}
}

function getCurrentUserAttendeeDetails(event) {
	var currentUserAttendeeDetails;
	
	if (event.attendees) {
		$.each(event.attendees, function(index, attendee) {
			if (attendee.self) {
				currentUserAttendeeDetails = attendee;
				return false;
			} else {
				// continue loop
				return true;
			}
		});
	}
	
	return currentUserAttendeeDetails;
}

function passedShowDeclinedEventsTest(event, storage) {
	var currentUserAttendeeDetails = getCurrentUserAttendeeDetails(event);
	if (currentUserAttendeeDetails) {
		return storage.calendarSettings.showDeclinedEvents || storage.calendarSettings.showDeclinedEvents == undefined || (storage.calendarSettings.showDeclinedEvents == false && currentUserAttendeeDetails.responseStatus != "declined");
	} else {
		// no attendees so make it a pass
		return true;
	}
}

function getEventSource(event) {
	if (event.source) {
		return event.source;
	} else {
		// look for link in description and use it as source
		if (event.description) {
			var matches = event.description.match(/(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/i);
			if (matches) {
				var link = $.trim(matches[0]);
				if (link) {
					var title;
					if (link.match("https?://mail.google.com")) {
						title = event.summary;
					} else {
						title = link.replace(/(www.)?/g, "");
					}
					return {url:link, title:title};
				}
			}
		}
	}
}

function getNotification(notificationsOpened, notificationId) {
	for (var a=0; a<notificationsOpened.length; a++) {
		if (notificationsOpened[a].id == notificationId) {
			return notificationsOpened[a];
		}
	}
}

function isGroupedNotificationsEnabled() {
	return pref("notificationGrouping", "groupNotifications") == "groupNotifications";
}

function getEventColor(event) {
	var colors = bg.cachedFeeds["colors"];
	var color;
	if (pref("eventColors") && event.colorId && colors) {				
		color = colors.event[event.colorId].background;
	} else {
		if (event.calendar.colorId) {
			color = colors.calendar[event.calendar.colorId].background;
		} else {
			console.log("no color for event calendar default to black: ", event);
			color = "black";
		}
	}
	
	color = darkenColor(color);
	
	// if anyhing close to white then change it to black (because we can't see it on a white background snoozePopup and notification window
	if (!color || color == "white" || color == "#fff" || color == "#ffffff") {
		color = "black";
	}
	
	return color;
}

// must be declared in global file because when called from bg.openSnoozePopup (the context of the window/screen might be skewed because it takes debugger settings like mobile resolution etc.)
function openSnoozePopup(events) {
	
	// default is notifications opened
	if (!events) {
		events = bg.notificationsOpened;
	}
	
	var TOP_TITLE_SPACE = 28;
	var HEADER_HEIGHT = 19; // for dismiss all button
	var NOTIFICATION_HEIGHT = 88;
	var MARGIN = 10;
	var MAX_NOTIFICATIONS = 7
	var notificationCount = Math.min(events.length, MAX_NOTIFICATIONS);
	var height = (notificationCount * NOTIFICATION_HEIGHT) + TOP_TITLE_SPACE + ((notificationCount+1) * MARGIN);
	
	// more than 2 show dismiss all and so make popup higher
	if (events.length >= 2) {
		height += HEADER_HEIGHT;
	}
	
	if (bg.snoozePopup) {
		bg.snoozePopup.close();
	}
	
	var width = 494;
	
	// enlarge if using zoom
	width *= window.devicePixelRatio;
	height *= window.devicePixelRatio;
	
	bg.snoozePopup = openWindowInCenter("snoozePopup.html", 'snoozePopup', 'toolbar=0,scrollbars=0,menubar=0,resizable=0,status=0', width, height);
	bg.snoozePopup.onload = function () {
		// seems window object doesn't exist when called from popup etc. so let's use the bg.window 
        bg.snoozePopup.postMessage({events:events}, bg.window.location.href);
    }
}

function sortNotifications(notifications) {
	notifications.sort(function(a,b) {
		if (a.event.startTime.getTime() < b.event.startTime.getTime()) {
			return +1;
		} else {
			return -1;
		}
	});
}