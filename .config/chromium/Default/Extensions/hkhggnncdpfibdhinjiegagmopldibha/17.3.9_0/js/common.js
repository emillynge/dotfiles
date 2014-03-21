// Copyright 2014 Jason Savard
// Becareful because this common.js file is loaded on websites for content_scripts and we don't want errors here

if (!window.bg) {
	if (document.location.href.indexOf("chrome-extension://") == 0) {
		try {
			window.bg = chrome.extension.getBackgroundPage();
		} catch (e) {
			console.error("JError: " + e);
		}
	}
} 

window.onerror = function(msg, url, line) {
	
	if (url.indexOf("chrome-extension://") != -1) {
	
		// if in notification then log error in background page because we cannot see logged messages within notifications
		if (typeof onerrorInNotificationFlag != "undefined") {
			bg.console.error("error in notification: " + msg + " " + url + "_" + line);
		}
		
		var thisUrl = url.replace("chrome-extension://hkhggnncdpfibdhinjiegagmopldibha/", "");
		var thisLine;
		if (line) {
			thisLine = " (" + line + ") ";
		} else {
			thisLine = " ";
		}
		
		var category = "JS Errors"; 
		var GAError = thisUrl + thisLine + msg;
		
		if (typeof sendGA != "undefined") {
			var userIdentifier = getUserIdentifier();
			if (userIdentifier) {
				sendGA(['_trackEvent', category, GAError, userIdentifier]);
			} else {
				sendGA(['_trackEvent', category, GAError]);
			}
		}
		//return false; // false prevents default error handling.
	}
};

function getUserIdentifier() {
	var attribute = "email";
	if (window[attribute]) {
		return window[attribute];
	} else if (window.bg && window.bg[attribute]) {
		return window.bg[attribute];
	}
}

function logError(msg, o) {
	try {
		var onErrorMessage;
		if (o) {
			console.error(msg, o);
			onErrorMessage = msg + " " + o;
		} else {
			console.error(msg);
			onErrorMessage = msg;
		}
		window.onerror(onErrorMessage, location.href);
	} catch (e) {
		console.error("error in onerror?", e);
	}
}

var ONE_SECOND = 1000;
var ONE_MINUTE = 60000;
var ONE_HOUR = ONE_MINUTE * 60;
var ONE_DAY = ONE_HOUR * 24;
var ORIGINS_MESSAGE_PREFIX = "origins_";
var origConsoleLog = null;
var origConsoleWarn = null;
var origConsoleDebug = null;
Calendar = function () {};

// copy all the fields (not a clone, we are modifying the target so we don't lose a any previous pointer to it
function copyObj(sourceObj, targetObj) {
    for (var key in sourceObj) {        
    	targetObj[key] = sourceObj[key];
    }
}

if (typeof(jQuery) != "undefined") {
	jQuery.fn.exists = function(){return jQuery(this).length>0;}
	jQuery.fn.textNodes = function() {
		var ret = [];
	
		(function(el){
			if (!el) return;
			if ((el.nodeType == 3)||(el.nodeName =="BR"))
				ret.push(el);
			else
				for (var i=0; i < el.childNodes.length; ++i)
					arguments.callee(el.childNodes[i]);
		})(this[0]);
		return $(ret);
	}
	jQuery.fn.hasHorizontalScrollbar = function() {
	    var divnode = this.get(0);
	    if (divnode.scrollWidth > divnode.clientWidth) {
	        return true;
	    } else {
	    	return false;
	    }
	}
	
	jQuery.fn.hasVerticalScrollbar = function() {
	    var divnode = this.get(0);
	    if (divnode.scrollHeight > divnode.clientHeight) {
	        return true;
	    } else {
	    	return false;
	    }
	}
}

function seconds(seconds) {
	return seconds * ONE_SECOND;
}

function minutes(minutes) {
	return minutes * ONE_MINUTE;
}

function hours(hours) {
	return hours * ONE_HOUR;
}

function removeHTML(html) {
   var tmp = document.createElement("DIV");
   tmp.innerHTML = html;
   return tmp.textContent||tmp.innerText;
}

function loadLocaleMessages(lang, callback) {
	// only load locales from files if they are not using their navigator langauge 
	if (lang == window.navigator.language) {
	//if (/en/i.test(lang) && /en/i.test(window.navigator.language)) {
		// for english just use native calls to get i18n messages
		bg.localeMessages = null;
		callback();
	} else {
		console.log("loading locale: " + lang);
		$.ajax({
			url: './_locales/' + lang.replace("-", "_") + '/messages.json',
			type: "GET",
			timeout: 5000,
			complete: function(request, textStatus) {
				var status = getStatus(request, textStatus);
				if (status == 200) {
					bg.localeMessages = JSON.parse(request.responseText);					
				}
				callback();
			}
		});		
		/*
		var xhr = new XMLHttpRequest();
		xhr.onload = function() {
		};
		xhr.open('GET', './_locales/' + lang.replace("-", "_") + '/messages.json', true);
		xhr.timeout = 5000;
		xhr.send(null);
		*/
	}
}

function getMessage(messageID, args, localeMessages) {
	// if localeMessage null because english is being used and we haven't loaded the localeMessage
	if (!localeMessages) {
		try {
			localeMessages = bg.localeMessages;
		} catch (e) {
			// might be in content_script and localMessages not defined because it's in english
			return chrome.i18n.getMessage(messageID, args);
		}				
	}
	if (localeMessages) {
		var messageObj = localeMessages[messageID];	
		if (messageObj) { // found in this language
			var str = messageObj.message;
			
			// patch: replace escaped $$ to just $ (because chrome.i18n.getMessage did it automatically)
			if (str) {
				str = str.replace(/\$\$/g, "$");
			}
			
			if (args) {
				if (args instanceof Array) {
					for (var a=0; a<args.length; a++) {
						str = str.replace("$" + (a+1), args[a]);
					}
				} else {
					str = str.replace("$1", args);
				}
			}
			return str;
		} else { // default to default language
			return chrome.i18n.getMessage(messageID, args);
		}
	} else {
		// patch: chrome.i18n.getMessage does pass parameter if it is a numeric - must be converted to str
		if (args && $.isNumeric(args)) {
			args = args + "";
		}
		return chrome.i18n.getMessage(messageID, args);
	}
}

function getUniqueId() {
	return Math.floor(Math.random() * 100000);
}

var dateFormat = function () {
	var	token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
		timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
		timezoneClip = /[^-+\dA-Z]/g,
		pad = function (val, len) {
			val = String(val);
			len = len || 2;
			while (val.length < len) val = "0" + val;
			return val;
		};

	// Regexes and supporting functions are cached through closure
	return function (date, mask, options) { //utc, forceEnglish
		if (!options) {
			options = {};
		}
		
		var dF = dateFormat;
		var i18n = options.forceEnglish ? dF.i18nEnglish : dF.i18n;

		// You can't provide utc if you skip other args (use the "UTC:" mask prefix)
		if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
			mask = date;
			date = undefined;
		}

		// Passing date through Date applies Date.parse, if necessary
		date = date ? new Date(date) : new Date;
		if (isNaN(date)) throw SyntaxError("invalid date");

		mask = String(dF.masks[mask] || mask || dF.masks["default"]);

		// Allow setting the utc argument via the mask
		if (mask.slice(0, 4) == "UTC:") {
			mask = mask.slice(4);
			options.utc = true;
		}

		var	_ = options.utc ? "getUTC" : "get",
			d = date[_ + "Date"](),
			D = date[_ + "Day"](),
			m = date[_ + "Month"](),
			y = date[_ + "FullYear"](),
			H = date[_ + "Hours"](),
			M = date[_ + "Minutes"](),
			s = date[_ + "Seconds"](),
			L = date[_ + "Milliseconds"](),
			o = options.utc ? 0 : date.getTimezoneOffset(),
			flags = {
				d:    d,
				dd:   pad(d),
				ddd:  i18n.dayNamesShort[D],
				dddd: i18n.dayNames[D],
				m:    m + 1,
				mm:   pad(m + 1),
				mmm:  i18n.monthNamesShort[m],
				mmmm: i18n.monthNames[m],
				yy:   String(y).slice(2),
				yyyy: y,
				h:    H % 12 || 12,
				hh:   pad(H % 12 || 12),
				H:    H,
				HH:   pad(H),
				M:    M,
				MM:   pad(M),
				s:    s,
				ss:   pad(s),
				l:    pad(L, 3),
				L:    pad(L > 99 ? Math.round(L / 10) : L),
				t:    H < 12 ? "a"  : "p",
				tt:   H < 12 ? "am" : "pm",
				T:    H < 12 ? "A"  : "P",
				TT:   H < 12 ? "AM" : "PM",
				Z:    options.utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
				o:    (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
				S:    ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
			};

		var ret = mask.replace(token, function ($0) {
			return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
		});

		if (options.noZeros) {
			ret = ret.replace(":00", "");
		}
		
		return ret;
	};
}();

// Some common format strings
dateFormat.masks = {
	"default":      "ddd mmm dd yyyy HH:MM:ss",
	shortDate:      "m/d/yy",
	mediumDate:     "mmm d, yyyy",
	longDate:       "mmmm d, yyyy",
	fullDate:       "dddd, mmmm d, yyyy",
	shortTime:      "h:MM TT",
	mediumTime:     "h:MM:ss TT",
	longTime:       "h:MM:ss TT Z",
	isoDate:        "yyyy-mm-dd",
	isoTime:        "HH:MM:ss",
	isoDateTime:    "yyyy-mm-dd'T'HH:MM:ss",
	isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
};

// Internationalization strings
dateFormat.i18n = {
	dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
	dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
	monthNamesShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
	monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
};

dateFormat.i18nEnglish = $.extend(true, {}, dateFormat.i18n);
dateFormat.i18nCalendarLanguage = $.extend(true, {}, dateFormat.i18n);

Date.prototype.addSeconds = function(seconds, cloneDate) {
	var date;
	if (cloneDate) {
		date = new Date(this);		
	} else {
		date = this;
	}
	date.setSeconds(date.getSeconds() + seconds, date.getMilliseconds());
	return date;
}

Date.prototype.subtractSeconds = function(seconds, cloneDate) {
	return this.addSeconds(-seconds, cloneDate);
}

Date.prototype.addDays = function(days) {
	var newDate = new Date(this);
	newDate.setDate(newDate.getDate()+days);
	return newDate;
}

Date.prototype.subtractDays = function(days) {
	return this.addDays(days*-1);
}

// For convenience...
Date.prototype.format = function (mask, options) {
	return dateFormat(this, mask, options);
};

Date.prototype.formatTime = function(removeTrailingZeroes) {
	if (localStorage["24hourMode"] == "true") {
		return pad(this.getHours(), 2, '0') + ":" + pad(this.getMinutes(), 2, '0');
	} else {
		var time = "";
		if (this.getHours() >= 12) {
			if (this.getHours() == 12) {
				time = 12;
			} else {
				time = this.getHours() - 12;
			}
			time = time + ":" + pad(this.getMinutes(), 2, '0') + "pm";
		} else if (this.getHours() == 0) {
			time = "12:" + pad(this.getMinutes(), 2, '0') + "am";
		} else {
			time = this.getHours() + ":" + pad(this.getMinutes(), 2, '0') + "am";
		}
		if (removeTrailingZeroes) {
			time = time.replace(":00", "");
		}
		return time;
	}
}

Date.prototype.clearTime = function () {
	this.setHours(0);
	this.setMinutes(0);
	this.setSeconds(0); 
	this.setMilliseconds(0);
}

Date.prototype.toRFC3339 = function() {
	//var gmtHours = -d.getTimezoneOffset()/60;
	return this.getUTCFullYear() + "-" + pad(this.getUTCMonth()+1, 2, '0') + "-" + pad(this.getUTCDate(), 2, '0') + "T" + pad(this.getUTCHours(), 2, '0') + ":" + pad(this.getUTCMinutes(), 2, '0') + ":00Z";
}

function now() {
	return today().getTime();
}

function today() {
	var offsetToday = null; //localStorage["today"]; // because localStorage would be null (or lost) after being calling agenda/widget and then doing a checkEvents(true) ???
	if (offsetToday) {
		return new Date(offsetToday);
	} else {
		return new Date();
	}
}

function yesterday() {
	// could not use same variable name as function ie. var today = today();
	var yest = today();
	yest.setDate(yest.getDate()-1);
	return yest;
}

function tomorrow() {
	var tomorrow = today();
	tomorrow.setDate(tomorrow.getDate()+1);
	return tomorrow;
}

function isToday(date) {
	return date.getFullYear() == today().getFullYear() && date.getMonth() == today().getMonth() && date.getDate() == today().getDate();
}

function isTomorrow(date) {
	var tom = tomorrow();
	return date.getFullYear() == tom.getFullYear() && date.getMonth() == tom.getMonth() && date.getDate() == tom.getDate();
}

function isYesterday(date) {
	var yest = yesterday();
	return date.getFullYear() == yest.getFullYear() && date.getMonth() == yest.getMonth() && date.getDate() == yest.getDate();
}

Date.prototype.isToday = function () {
	return isToday(this);
};

Date.prototype.isTomorrow = function () {
	return isTomorrow(this);
};

Date.prototype.isYesterday = function () {
	return isYesterday(this);
};

Date.prototype.isSameDay = function (otherDay) {
	return this.getFullYear() == otherDay.getFullYear() && this.getMonth() == otherDay.getMonth() && this.getDate() == otherDay.getDate();
};

Date.prototype.isBefore = function(otherDate) {
	var paramDate;
	if (otherDate) {
		paramDate = new Date(otherDate);
	} else {
		paramDate = today();
	}	
	var thisDate = new Date(this);
	return thisDate.getTime() < paramDate.getTime();
};

Date.prototype.isEqualOrBefore = function(otherDate) {
	return this.isBefore(otherDate) || (otherDate && this.getTime() == otherDate.getTime());
};

Date.prototype.isAfter = function(otherDate) {
	return !this.isEqualOrBefore(otherDate);
};

Date.prototype.isEqualOrAfter = function(otherDate) {
	return !this.isBefore(otherDate);
};

Date.prototype.diffInSeconds = function(otherDate) {
	var d1;
	if (otherDate) {
		d1 = new Date(otherDate);
	} else {
		d1 = today();
	}	
	var d2 = new Date(this);
	return Math.round(Math.ceil(d2.getTime() - d1.getTime()) / ONE_SECOND);
};

Date.prototype.diffInMinutes = function(otherDate) {
	var d1;
	if (otherDate) {
		d1 = new Date(otherDate);
	} else {
		d1 = today();
	}	
	var d2 = new Date(this);
	return Math.round(Math.ceil(d2.getTime() - d1.getTime()) / ONE_MINUTE);
};

Date.prototype.diffInHours = function(otherDate) {
	var d1;
	if (otherDate) {
		d1 = new Date(otherDate);
	} else {
		d1 = today();
	}	
	var d2 = new Date(this);
	return Math.round(Math.ceil(d2.getTime() - d1.getTime()) / ONE_HOUR);
};

Date.prototype.diffInDays = function(otherDate) {
	var d1;
	if (otherDate) {
		d1 = new Date(otherDate);
	} else {
		d1 = today();
	}	
	d1.setHours(1);
	d1.setMinutes(1);
	var d2 = new Date(this);
	d2.setHours(1);
	d2.setMinutes(1);
	return Math.round(Math.ceil(d2.getTime() - d1.getTime()) / ONE_DAY);
};

Array.prototype.clone = function() {
	return this.slice(0);
};

//Usage: array.forEach(item, index)
Array.prototype.forEach = function(action) {
    for (var i = 0, l = this.length; i < l; ++i) {
        var ret = action(this[i], i);
        // breaks if returns false or true but not just return;
        if (ret != undefined) {
        	break;
        }
    }
};
Array.prototype.first = function() {
	return this[0];
};
Array.prototype.last = function() {
	return this[this.length-1];
};
Array.prototype.isEmpty = function() {
	return this.length == 0;
};
Array.prototype.find = function(func) {
	for (var i = 0, l = this.length; i < l; ++i) {
		var item = this[i];
		if (func(item))
			return item;
	}
	return null;
};
Array.prototype.swap = function (x,y) {
	var b = this[x];
	this[x] = this[y];
	this[y] = b;
	return this;
}

Array.prototype.addItem = function(key, value) {
	for (var i=0, l=this.length; i<l; ++i) {
		if (this[i].key == key) {
			// found key so update value
			this[i].value = value;
			return;
		}
	}
	this.push({key:key, value:value});
}
Array.prototype.getItem = function(key) {
	for (var i=0, l=this.length; i<l; ++i) {
		if (this[i].key == key) {			
			return this[i].value;
		}
	}
}

String.prototype.replaceAll = function(find, replace) {
	var findEscaped = escapeRegExp(find);
	return this.replace(new RegExp(findEscaped, 'g'), replace);
}

String.prototype.chunk = function(size) {
    return [].concat.apply([],
        this.split('').map(function(x,i){ return i%size ? [] : this.slice(i,i+size) }, this)
    )
}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

String.prototype.startsWith = function (str) {
	return this.indexOf(str) == 0;
};

String.prototype.endsWith = function (str){
	return this.slice(-str.length) == str;
};

String.prototype.summarize = function(maxLength, EOM_Message) {
	if (!maxLength) {
		maxLength = 101;
	}
	var summary = this;
	if (summary.length > maxLength) {
		summary = summary.substring(0, maxLength);
		var lastSpaceIndex = summary.lastIndexOf(" ");
		if (lastSpaceIndex != -1) {
			summary = summary.substring(0, lastSpaceIndex);
			summary = $.trim(summary);
		}
		summary += "...";
	} else {
		if (EOM_Message) {
			summary += EOM_Message;
		}
	}
	
	// patch: do not why: but it seem that unless i append a str to summary, it returns an array of the letters in summary?
	return summary + "";
}

// match only url and path (NOT query parameters)
String.prototype.urlOrPathContains = function(str) {
	var strIndex = this.indexOf(str);
	if (strIndex != -1) {		
		var queryParamsStart = this.indexOf("?");
		// if query make sure that we don't match the str inside query params
		if (queryParamsStart != -1) {
			if (strIndex < queryParamsStart) {
				return true;
			} else {
				return false;
			}
		} else {
			return true;
		}
	} else {
		return false;
	}
}

String.prototype.parseTime = function() {
	var d = new Date();
	//var pieces = this.match(/(\d+)([:|\.](\d\d))\s*(p?)/i);
	var pieces = this.match(/(\d+)([:|\.](\d\d))?\s*(p?)/i);
	if (pieces && pieces.length >= 5) {
		// patch: had to use parseFloat instead of parseInt (because parseInt would return 0 instead of 9 when parsing "09" ???		
		var hours = parseFloat(pieces[1]);
		var pm = pieces[4];
		
		// patch for midnight because 12:12am is actually 0 hours not 12 hours for the date object
		if (hours == 12) {
			if (pm) {
				hours = 12;
			} else {
				hours = 0;
			}
		} else if (pm) {
			hours += 12;
		}
		d.setHours(hours);		
		//d.setHours( parseFloat(pieces[1]) + ( ( parseFloat(pieces[1]) < 12 && pieces[4] ) ? 12 : 0) );
		d.setMinutes( parseFloat(pieces[3]) || 0 );
		d.setSeconds(0, 0);
		return d;
	}
}

String.prototype.parseDate = function() {
	/*
	// bug patch: it seems that new Date("2011-09-21") return 20th??? but if you use slashes instead ie. 2011/09/21 then it works :)
	if (this.length <= 10) {
		return new Date(Date.parse(this.replace("-", "/")));
	} else {
		return new Date(Date.parse(this));
	}
	*/
	var DATE_TIME_REGEX = /^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(\.\d+)?(\+|-)(\d\d):(\d\d)$/;
	var DATE_TIME_REGEX_Z = /^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)\.\d+Z$/;
	var DATE_TIME_REGEX_Z2 = /^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)+Z$/;
	var DATE_MILLI_REGEX = /^(\d\d\d\d)(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)$/;
	var DATE_REGEX = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
	var DATE_NOSPACES_REGEX = /^(\d\d\d\d)(\d\d)(\d\d)$/;

	/* Convert the incoming date into a javascript date
	 * 2012-09-26T11:42:00-04:00
	 * 2006-04-28T09:00:00.000-07:00
	 * 2006-04-28T09:00:00.000Z
	 * 2010-05-25T23:00:00Z (new one from jason)
	 * 2006-04-19
	 */

	  var parts = DATE_TIME_REGEX.exec(this);
	  
	  // Try out the Z version
	  if (!parts) {
	    parts = DATE_TIME_REGEX_Z.exec(this);
	  }
	  if (!parts) {
		parts = DATE_TIME_REGEX_Z2.exec(this);
	  }
	  
	  if (exists(parts) && parts.length > 0) {
	    var d = new Date();
	    d.setUTCFullYear(parts[1], parseInt(parts[2], 10) - 1, parts[3]);
	    d.setUTCHours(parts[4]);
	    d.setUTCMinutes(parts[5]);
	    d.setUTCSeconds(parts[6]);
		d.setUTCMilliseconds(0);

	    var tzOffsetFeedMin = 0;
	    if (parts.length > 8) {
	      tzOffsetFeedMin = parseInt(parts[9],10) * 60 + parseInt(parts[10],10);
	      if (parts[8] != '-') { // This is supposed to be backwards.
	        tzOffsetFeedMin = -tzOffsetFeedMin;
	      }
	    }
	    return new Date(d.getTime() + tzOffsetFeedMin * ONE_MINUTE);
	  }
	  
	  parts = DATE_MILLI_REGEX.exec(this);
	  if (exists(parts)) {
			var d = new Date();
			d.setFullYear(parts[1], parseInt(parts[2], 10) - 1, parts[3]);
		    d.setHours(parts[4]);
		    d.setMinutes(parts[5]);
		    d.setSeconds(parts[6]);
			d.setMilliseconds(0);
			return d;
	  }
	  if (!parts) {
		  parts = DATE_REGEX.exec(this);
	  }
	  if (!parts) {
		  parts = DATE_NOSPACES_REGEX.exec(this);
	  }
	  if (exists(parts) && parts.length > 0) {
	    return new Date(parts[1], parseInt(parts[2],10) - 1, parts[3]);
	  }
	  if (!isNaN(this)) {
		  return new Date(this);
	  }
	  return null;
}

function analytics() {
	var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
	ga.src = '/js/analytics.js';
	var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
	$(document).ready(function() {
		$(document).on("click", "a, input, button", function() {
			var id = $(this).attr("ga");
			var label = null;
			if (id != "IGNORE") {
				if (!id) {
					id = $(this).attr("id");
				}
				if (!id) {
					id = $(this).attr("snoozeInMinutes");
					if (id) {
						label = "in minutes: " + id; 
						id = "snooze";
					}
					if (!id) {
						id = $(this).attr("snoozeInDays");
						if (id) {
							label = "in days: " + id; 
							id = "snooze";
						}
					}
					if (!id) {
						id = $(this).attr("msg");
					}
					if (!id) {
						id = $(this).attr("msgTitle");
					}
					if (!id) {
						id = $(this).attr("href");
						// don't log # so dismiss it
						if (id == "#") {
							id = null;
						}
					}
					if (id) {
						id = id.replace(/javascript\:/, "");
						// only semicolon so remove it and keep finding other ids
						if (id == ";") {
							id = "";
						}
					}
					if (!id) {
						id = $(this).parent().attr("id");
					}
					if (!id) {
						id = $(this).attr("class");
					}
				}
				if ($(this).attr("type") != "text") {
					if ($(this).attr("type") == "checkbox") {
						if (this.checked) {
							label = id + "_on";
						} else {
							label = id + "_off";
						}
					}
					var category = $(this).closest("*[gaCategory]");
					var action = null;
					// if gaCategory specified
					if (category.length != 0) {
						category = category.attr("gaCategory");
						action = id;
					} else {
						category = id;
						action = "click";
					}
					
					if (label != null) {
						sendGA(['_trackEvent', category, action, label]);
					} else {
						sendGA(['_trackEvent', category, action]);
					}
				}
			}
		});
	});
}

// usage: sendGA(['_trackEvent', category, action, label]);
function sendGA(o, ls) {
	var gaSendingOffName = "ga_sending_off";
	var gaSendingOff = false;
	if (ls) {
		gaSendingOff = ls[gaSendingOffName];
	} else if (localStorage) {
		gaSendingOff = localStorage[gaSendingOffName];
	}
	bg.console.log(o);
	if (!gaSendingOff) {
		// macbook users apparently getting _gaq undefined
		if (typeof _gaq != "undefined") {
			_gaq.push(o);
		}
	}		
}

function getPaypalLC() {
	var locale = pref("lang", window.navigator.language);
	var lang = null;
	if (locale) {
		if (locale.match(/zh/i)) {
			lang = "CN"; 
		} else if (locale.match(/_GB/i)) {
			lang = "GB";
		} else if (locale.match(/ja/i)) {
			lang = "JP";
		} else {
			lang = locale.substring(0,2);
		}
		return lang;
	}
}

function isAsianLangauge() {
	var lang = pref("lang", window.navigator.language);
	return /ja|zh|ko/.test(lang);
}

if (document.location.href.startsWith("chrome-extension://")) {
	// Console...
	origConsoleLog = console.log;
	origConsoleWarn = console.warn;
	origConsoleDebug = console.debug;
	initConsole();
	
	if (typeof($) != "undefined") {
		$(document).ready(function() {
			// For some reason including scripts for popup window slows down popup window reaction time, so only found that settimeout would work
			if (document.location.href.match("popup.html")) {
				setTimeout(function() {
					analytics();
				}, 1);
			} else {
				analytics();
			}
			initCalendarNames(dateFormat.i18n);
			initMessages();
		});
	}
}

function log(str, prefName) {
	if (pref(prefName)) {
		console.log(str);
	}
}

function getProtocol() {
	return pref("ssl2", true) ? "https" : "http";
}

function initOptions() {
	$("*[opensOptions]").each(function(index) {
		var optionsID = $(this).attr("opensOptions");
		// Show or hide options at startup
		var options = $("#" + optionsID);
		options.toggle(this.checked);
		// Bind function to show/hide options
		$(this).change(function() {
			options.slideToggle(this.checked);
		});
	});
}

function generateCheckPermissionsParams(checkbox) {
	var origins = $(checkbox).attr("origins");
	var permissions = $(checkbox).attr("permissions");
	var checkPermissionParams; 
	if (origins) {
		checkPermissionParams = {origins: [getMessage(ORIGINS_MESSAGE_PREFIX + origins)]}
	} else if (permissions) {
		checkPermissionParams = {permissions: [permissions]}
	}
	return checkPermissionParams;
}

// this wrapper method is required to keep the checkbox in scope with the callback
function checkPermissions(checkbox, callback) {
	var checkPermissionParams = generateCheckPermissionsParams(checkbox);
	chrome.permissions.contains(checkPermissionParams, function(result) {
		$(checkbox).prop("checked", result)
	});
}

function initPrefAttributes() {
	$("select[pref], input[pref], textarea[pref], input[origins], input[permissions]").each(function(index) {
		var origins = $(this).attr("origins");
		var permissions = $(this).attr("permissions");
		var prefValue;
		if ($(this).attr("default")) {
			if ($(this).attr("default") == "true") {
				prefValue = pref($(this).attr("pref"), true);
			} else {
				prefValue = pref($(this).attr("pref"), $(this).attr("default"));
			}
		} else {			
			if (getBrowserVersion() >= 16 && (origins || permissions)) {
				checkPermissions($(this), function(){});
			} else {
				prefValue = pref($(this).attr("pref"));
			}
		}
		if (this.tagName == "INPUT") {
			if ($(this).attr("type") == "checkbox") {
				if (origins || permissions) {
					$(this).change(function(event) {
						var checkbox = this;						
						var checkPermissionParams = generateCheckPermissionsParams(checkbox);
						if (this.checked) {
							if (getBrowserVersion() < 16) {
								alert("You must first upgrade Chrome to the latest version!");
								checkbox.checked = false;
							} else {								
								chrome.permissions.request(checkPermissionParams, function(granted) {
									checkbox.checked = granted;
								});
							}
						} else {			
							chrome.permissions.remove(checkPermissionParams, function(removed) {
								if (removed) {
									checkbox.checked = false;
								} else {
									// The permissions have not been removed (e.g., you tried to remove
									// required permissions).
									alert("error removing permission");
									checkbox.checked = true;
								}
							});
						}
					});
				} else {
					$(this).attr("checked", prefValue);
					$(this).change(function(event) {
						changePref(this, this.checked, event);
					});
				}
			} else if ($(this).attr("type") == "radio") {
				if ($(this).val() == prefValue) {
					$(this).attr("checked", "true");
				}				
				$(this).change(function(event) {
					changePref(this, $(this).val(), event);
				});
			} else if ($(this).attr("type") == "text") {
				$(this).keyup(function() {
					changePref(this, $(this).val(), event);
				});
			} else if ($(this).attr("type") == "range") {
				$(this).val(prefValue);
				$(this).change(function() {
					changePref(this, $(this).val(), event);
				});
			}
		} else if (this.tagName == "SELECT") {
			$(this).val(prefValue);
			$(this).change(function() {
				changePref(this, $(this).val(), event);
			});
		} else if (this.tagName == "TEXTAREA") {
			if (prefValue) {
				$(this).val(prefValue);
			}
			$(this).blur(function() {
				changePref(this, $(this).val(), event);
			});
		}
		
		$(this).click(function(event) {
			if ($(this).attr("mustDonate") && !pref("donationClicked")) {
				event.preventDefault();
			}
		});
	});
}

function changePref(node, value, event) {
	if (!$(node).attr("mustDonate") || ($(node).attr("mustDonate") && donationClicked($(node).attr("pref")))) {
		localStorage[$(node).attr("pref")] = value;
		return true;
	} else {
		// preventDefault() does not work on the "change" event, only the "click" event so revert checkbox state instead
		//event.preventDefault();		
		/*
		if (node.tagName == "INPUT") {
			node.checked = !node.checked;
		}
		*/
		return false;
	}	
}

function showTooltip(content) {
	$("#tooltip").html(content);
	var mouseX = event.pageX;
	var mouseY = event.pageY;
	$("#tooltip").css({left:mouseX+24, top:mouseY+8});
	$("#tooltip").show();
}

function initToolTips() {
	
	var $tooltip = $("<div id='tooltip' style='color:black;box-shadow:4px 4px 10px #555;display:none;z-index:5;max-width:500px;position:absolute;border-radius:5px;border:1px solid #555;background:lightyellow;padding:4px;font-size:100%'/>");
	$("body").append($tooltip);
	
	$(document).on("mousemove mouseleave", "*[mustDonate], *[msg], *[msgToolTip]", function(event) {
		// for labels mainly
		var msgName;
		
		if ($(this).attr("msg") && !$(this).attr("msgToolTip")) {
			msgName = $(this).attr("msg") + "ToolTip";
		} else {
			msgName = $(this).attr("msgToolTip");
		}
		if (event.type == 'mousemove') {
			var donateHTML = " <span style='font-weight:bold;white-space:nowrap'>(" + getMessage("donationRequired") + ")</span>";
			if ((this.tagName == "INPUT" || this.tagName == "SELECT") && $(this).attr("mustDonate") == "true") {
				// for checkboxes mainly
				if (pref("donationClicked")) {
					if (msgName) {
						var msgValue = getMessage(msgName);
						if (msgValue) {
							showTooltip(msgValue);
						}
					}
				} else {
					showTooltip(donateHTML);
				}
			} else {
				if (msgName) {
					var msgValue = getMessage(msgName);
					if (msgValue) {
						if (!pref("donationClicked") && ($(this).attr("mustDonate") || $(this).parent().find("input, select").first().attr("mustDonate"))) {
							showTooltip(msgValue + donateHTML);
						} else {
							showTooltip(msgValue);
						}						
					}
				}
			}
		} else if (event.type == 'mouseleave') {
			$("#tooltip").hide();				
		}
	});	
}

function initConsole() {
	if (pref("console_messages")) {
		console.log = origConsoleLog;
		console.warn = origConsoleWarn;
		console.debug = origConsoleDebug;
	} else {
		try {
			bg.console.log = bg.console.warn = bg.console.debug = console.warn = console.info = console.log = function(msg){};
		} catch (e) {
			console.log("Error in initConsole", e);
		}
	}
}

function initCalendarNames(obj) {
	/*
	var s = document.createElement('script');
	s.setAttribute('type', 'text/javascript');
	s.setAttribute('src', "js/calendar/calendar-" + lang + ".js");
	(document.getElementsByTagName('head')[0] || document.documentElement).appendChild(s);
	*/
	
	obj.dayNames = getMessage("daysArray").split(",");
	obj.dayNamesShort = getMessage("daysArrayShort").split(",");
	obj.monthNames = getMessage("monthsArray").split(",");
	obj.monthNamesShort = getMessage("monthsArrayShort").split(",");
	
}

function initMessages(node) {

	// options page only for now..
	if (location.href.indexOf("options.html") != -1) {		
		$("html").attr("dir", getMessage("dir"));
	}
	
	var selector;
	if (node) {
		selector = node;
	} else {
		selector = "*";
	}
	$(selector).each(function() {
		//var parentMsg = $(this);
		var attr = $(this).attr("msg");
		if (attr) {
			var msgArg1 = $(this).attr("msgArg1");
			if (msgArg1) {
				$(this).text(getMessage( $(this).attr("msg"), msgArg1 ));
			} else {
				// look for inner msg nodes to replace before...
				var innerMsg = $(this).find("*[msg]");
				if (innerMsg.exists()) {
					initMessages(innerMsg);
					var msgArgs = new Array();
					innerMsg.each(function(index, element) {
						msgArgs.push( $(this).get(0).outerHTML );
					});
					$(this).html(getMessage(attr, msgArgs));
				} else {
					$(this).text(getMessage(attr));
				}
			}
		}
		attr = $(this).attr("msgTitle");
		if (attr) {
			$(this).attr("title", getMessage(attr));
		}
		attr = $(this).attr("msgSrc");
		if (attr) {
			$(this).attr("src", getMessage(attr));
		}
		attr = $(this).attr("msgValue");
		if (attr) {
			$(this).attr("value", getMessage(attr));
		}
		attr = $(this).attr("msgPlaceholder");
		if (attr) {
			$(this).attr("placeholder", getMessage(attr));
		}
		attr = $(this).attr("msgHTML");
		if (attr) {
			$(this).html(getMessage(attr));
		}
	});
}

function donationClicked(action, ls) {
	if (pref("donationClicked", null, ls)) {
		return true;
	} else {
		var url = "donate.html?action=" + action;
		chrome.runtime.sendMessage({name: "openTab", url:url});
		return false;
	}
}

function getChromeWindows(callback) {
	chrome.windows.getAll({}, function(windowList) {
		// keep only normal windows and not app windows like debugger etc.
		var normalWindows = new Array();
		for (var a=0; a<windowList.length; a++) {
			if (windowList[a].type == "normal") {
				normalWindows.push(windowList[a]);
			}
		}
		callback({windowList:windowList, normalWindows:normalWindows});
	});
}

// params: url or {url, urlToFind}
function createTab(params, callback) {
	var url;
	
	// Determine if object passed as param
	if (params.url) {
		url = params.url;
	} else {
		url = params;
	}
	getChromeWindows(function(windowsParams) {
		if (windowsParams.normalWindows.length == 0) {
			chrome.windows.create({url:url, focused:true}, function(window) {
				chrome.windows.getAll({populate:true}, function(windowList) {
					if (windowList) {
						for (var a=0; a<windowList.length; a++) {
							if (windowList[a].id == window.id) {
								for (var b=0; b<windowList[a].tabs.length; b++) {
									if (windowList[a].tabs[b].url == url) {										
										// force focus window cause it doesn't awlays happen when creating window with url
										chrome.windows.update(windowList[a].id, {focused:true}, function() {
											bg.console.log("force window found")
											chrome.tabs.update(windowList[a].tabs[b].id, {selected:true}, callback);
										});
										break;
									}
								}
								break;
							}
						}
					}
				});
			});
		} else {
			selectOrCreateTab(params, callback);
		}		
	});
}

// params: findUrlStr, urlToOpen
function selectOrCreateTab(params, callback) {
	var url;
	
	if (!callback) {
		callback = function() {};
	}
	
	// Determine if object passed as param
	if (params.url) {
		url = params.url;
	} else {
		url = params;
	}
	
	if (params.urlToFind) {
		chrome.windows.getAll({populate:true}, function (windows) {
			for(var a=0; a<windows.length; a++) {
				var tabs = windows[a].tabs;
				for(var b=0; b<tabs.length; b++) {
					if (tabs[b].url.indexOf(params.urlToFind) != -1) {
						// window focused bug fixed yay!
						chrome.windows.update(windows[a].id, {focused:true}, function() {
							chrome.tabs.update(tabs[b].id, { active: true });
							callback({found:true, tab:tabs[b]});
						});
						return true;
					}
				}
			}
			createTabAndFocusWindow(url, function(response) {
				callback({found:false, tab:response.tab});
			});
			return false;
		});
	} else {
		createTabAndFocusWindow(url, function(response) {
			callback({found:false, tab:response.tab});
		});
	}
}

function createTabAndFocusWindow(url, callback) {
	chrome.tabs.create({url: url}, function(tab) {
		chrome.windows.update(tab.windowId, {focused:true}, function() {
			if (callback) {
				callback(tab);
			}
		});						
	});
}

function removeNode(id) {
	var o = document.getElementById(id);
	if (o) {
		o.parentNode.removeChild(o);
	}
}

function addCSS(id, css) {
	removeNode(id);
	var s = document.createElement('style');
	s.setAttribute('id', id);
	s.setAttribute('type', 'text/css');
	s.appendChild(document.createTextNode(css));
	(document.getElementsByTagName('head')[0] || document.documentElement).appendChild(s);
}

function pad(str, times, character) { 
	var s = str.toString();
	var pd = '';
	var ch = character ? character : ' ';
	if (times > s.length) { 
		for (var i=0; i < (times-s.length); i++) { 
			pd += ch; 
		}
	}
	return pd + str.toString();
}

function getBrowserVersion() {
	// Browser name = Chrome, Full version = 4.1.249.1064, Major version = 4, navigator.appName = Netscape, navigator.userAgent = Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US) AppleWebKit/532.5 (KHTML, like Gecko) Chrome/4.1.249.1064 Safari/532.5
	//																															  Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US) AppleWebKit/533.4 (KHTML, like Gecko) Chrome/5.0.375.38 Safari/533.4
	var agent = navigator.userAgent;
	var offset = agent.indexOf("Chrome");
	var version = null;
	if (offset != -1) {
		version = agent.substring(offset+7);
		offset = version.indexOf(";");
		if (offset != -1) {
			version = version.substring(0, offset);
		}
		offset = version.indexOf(" ");
		if (offset != -1) {
			version = version.substring(0, offset);
		}
	}
	if (version) {
		return parseFloat(version);
	}
}

function toBool(str) {
	if ("false" === str || str == undefined) {
		return false;
	} else if ("true" === str) {
		return true;
	} else {
		return str;
	}
}

// This pref function is different*** we pass either just the param to localStorage[param] or the value of localStorage["example"]
function pref(param, defaultValue, ls) {
	var value;
	if (ls) {
		value = ls[param];
	} else {
		value = localStorage[param];
	}
	if (defaultValue == undefined) {
		defaultValue = false;
	}
	return value == null ? defaultValue : toBool(value);
}

function getUrlValue(url, name, unescapeFlag) {
	if (url) {
	    var hash;
	    var hashes = url.slice(url.indexOf('?') + 1).split('&');
	    for(var i=0; i<hashes.length; i++) {
	        hash = hashes[i].split('=');
			if (hash[0] == name) {
				if (unescapeFlag) {
					return unescape(hash[1]);
				} else {
					return hash[1];
				}
			}
	    }
	    return null;
	}
}

function setUrlParam(url, param, value) {
	var params = url.split("&");
	for (var a=0; a<params.length; a++) {
		var idx = params[a].indexOf(param + "=");
		if (idx != -1) {
			var currentValue = params[a].substring(idx + param.length + 1);
			return url.replace(param + "=" + currentValue, param + "=" + value);
		}
	}
	if (url.indexOf("?") == -1) {
		url += "?";
	} else {
		url += "&";
	}
	return url + param + "=" + value;
	
	/*
	if (url.indexOf(param + "=") != -1) {
		//var regex = new RegExp(param + "=.*", "ig");
		//return url.replace(regex, param + "=" + value);
	} else {
		if (url.indexOf("?") == -1) {
			url += "?";
		} else {
			url += "&";
		}
		return url + param + "=" + value;
	}
	*/
}

function getCookie(c_name) {
	if (document.cookie.length>0) {
	  c_start=document.cookie.indexOf(c_name + "=");
	  if (c_start!=-1) {
	    c_start=c_start + c_name.length+1;
	    c_end=document.cookie.indexOf(";",c_start);
	    if (c_end==-1) c_end=document.cookie.length;
	    return unescape(document.cookie.substring(c_start,c_end));
	    }
	  }
	return "";
}

function exists(o) {
	if (o) {
		return true;
	} else {
		return false;	
	}	
}

function getExtensionIDFromURL(url) {
	//"chrome-extension://dlkpjianaefoochoggnjdmapfddblocd/options.html"
	return url.split("/")[2]; 
}

function getStatus(request, textStatus) {
	var status; // status/textStatus combos are: 201/success, 401/error, undefined/timeout
	try {
		status = request.status;
	} catch (e) {
		status = textStatus;
	}
	return status;
}

function setTodayOffsetInDays(days) {
	var offset = today();
	offset.setDate(offset.getDate()+parseInt(days));
	localStorage["today"] = offset;
}

function clearTodayOffset() {
	localStorage.removeItem("today");
}

function addToArray(str, ary) {
	for (var a=0; a<ary.length; a++) {
		if (ary[a] == str) {
			return false;
		}
	}
	ary.push(str);
	return true;
}

function removeFromArray(str, ary) {
	for (var a=0; a<ary.length; a++) {
		if (ary[a] == str) {
			ary.splice(a, 1);
			return true;
		}
	}
	return false;
}

function isInArray(str, ary) {
	for (var a=0; a<ary.length; a++) {
		if (isSameUrl(ary[a], str)) {
			return true;
		}
	}
	return false;
}

function isSameUrl(url1, url2) {
	return removeProtocol(url1) == removeProtocol(url2);
}

function removeProtocol(url) {
	if (url) {
		return url.replace(/https?:\/\//g, "");
	} else {
		return url;
	}
}

function findTag(str, name) {
	if (str) {
		var index = str.indexOf("<" + name + " ");
		if (index == -1) {
			index = str.indexOf("<" + name + ">");
		}
		if (index == -1) {
			return null;
		}
		var closingTag = "</" + name + ">";
		var index2 = str.indexOf(closingTag);
		return str.substring(index, index2 + closingTag.length);
	}
}

function isRockMelt() {
	return navigator.userAgent.match(/rockmelt/i);
}

function rotate(node, params) {
	// can't rotate <a> tags for some reason must be the image inside if so
	var rotationInterval;
	if (params && params.forever) {
		node.css({WebkitTransition: "all 10ms linear"});
		var degree = 0;
		rotationInterval = setInterval(function() {
	    	node.css({WebkitTransform: 'rotate(' + (degree+=2) + 'deg)'}); //scale(0.4) translateZ(0)
	    }, 2);
	} else {
		node.css({WebkitTransition: "all 1s ease-out"}); //all 1000ms linear
		node.css({WebkitTransform: "rotateZ(360deg)"}); //-webkit-transform: rotateZ(-360deg);
	}
	return rotationInterval;
}

function trimLineBreaks(str) {
	if (str) {
		str = str.replace(/^\n*/g, "");
		str = str.replace(/\n*$/g, "");
	}
	return str;
}

function cleanEmailSubject(subject) {
	if (subject) {
		subject = subject.replace(/^re: ?/i, "");
		subject = subject.replace(/^fwd: ?/i, "");
	}
	return subject;	
}

function getHost(url) {
	if (url) {
		var matches = url.match(/:\/\/([^\/?#]*)/);
		if (matches && matches.length >=2) {
			return matches[1];
		}
	}
}

function ellipsis(str, cutoffLength) {	
	if (str && str.length > cutoffLength) {
		str = str.substring(0, cutoffLength) + " ...";
	}
	return str;
}

function Tools() {
	
	Tools.is24HourDefault = function() {
		if (navigator.language) {
			if (navigator.language == "en") { // just english assume 12 hour
				return false;
			} else if (navigator.language.match(/us|hi/i)) { // these countries are 12 hour the rest... 24 hour
				return false;
			}
		}
		return true;
	}
	
	Tools.detectChromeVersion = function(callback) {
		$.getJSON("https://omahaproxy.appspot.com/all.json?callback=?", function(data) {
			var versionDetected;
			var stableDetected = false;
			for (var a=0; a<data.length; a++) {

				var osMatched = false;
				// patch because Chromebooks/Chrome OS has a platform value of "Linux i686" but it does say CrOS in the useragent so let's use that value
				if (navigator.userAgent.toLowerCase().indexOf("cros") != -1) {
					if (data[a].os == "cros") {
						osMatched = true;
					}
				} else { // the rest continue with general matching...
					if (navigator.platform.toLowerCase().indexOf(data[a].os) != -1) {
						osMatched = true;
					}
				}
				
				if (osMatched) {
					for (var b=0; b<data[a].versions.length; b++) {
						if (navigator.userAgent.indexOf(data[a].versions[b].prev_version) != -1 || navigator.userAgent.indexOf(data[a].versions[b].version) != -1) {
							// it's possible that the same version is for the same os is both beta and stable???
							versionDetected = data[a].versions[b];
							if (data[a].versions[b].channel == "stable") {
								stableDetected = true;
								callback(versionDetected);
								return;
							}
						}
					}
				}
			}

			// probably an alternative based browser like RockMelt because I looped through all version and didn't find any match
			if (data.length && !versionDetected) {
				callback({channel:"alternative based browser"});
			} else {
				callback(versionDetected);
			}
		});
	}
}

function DetectSleepMode(wakeUpCallback) {
	var PING_INTERVAL = 60; // 1 minute
	var PING_INTERVAL_BUFFER = 15;
	
	var lastPingTime = new Date();
	var lastWakeupTime = new Date(1); // make the last wakeup time really old because extension starting up does not equal a wakeup 
	
	function lastPingIntervalToolLong() {
		return lastPingTime.diffInSeconds() < -(PING_INTERVAL+PING_INTERVAL_BUFFER);
	}
	
	function ping() {
		if (lastPingIntervalToolLong()) {
			console.log("DetectSleepMode.wakeup time: " + new Date());
			lastWakeupTime = new Date();
			if (wakeUpCallback) {
				wakeUpCallback();
			}
		}
		lastPingTime = new Date();
	}
	
	setInterval(function() {
		ping();
	}, seconds(PING_INTERVAL));
	
	this.isWakingFromSleepMode = function() {
		console.log("DetectSleepMode.last ping: " + lastPingTime);
		console.log("last wakeuptime: " + lastWakeupTime);
		console.log("current time: " + new Date())
		// if last wakeup time was recently set than we must have awoken recently
		if (lastPingIntervalToolLong() || lastWakeupTime.diffInSeconds() >= -(PING_INTERVAL+PING_INTERVAL_BUFFER)) {
			return true;
		} else {
			return false;
		}
	}
}

function Controller() {

	// apps.jasonsavard.com server
	Controller.FULLPATH_TO_PAYMENT_FOLDERS = "https://apps.jasonsavard.com/";
	
	// jasonsavard.com server
	//Controller.FULLPATH_TO_PAYMENT_FOLDERS = "https://jasonsavard.com/apps.jasonsavard.com/";

	// internal only for now
	function callAjaxController(params) {
		$.ajax({
			type: "GET",
			url: Controller.FULLPATH_TO_PAYMENT_FOLDERS + "controller.php",
			headers: {"misc":location.href},
			data: params.data,
			dataType: "jsonp",
			jsonp: "jsoncallback",
			timeout: seconds(5),
			success: params.success,
			error: params.error						
		});
	}

	Controller.ajax = function(params, callback) {
		callAjaxController({
			data: params.data,
			success: function(data, textStatus, jqXHR) {
				callback({data:data, textStatus:textStatus, jqXHR:jqXHR});
			},
			error: function(jqXHR, textStatus, errorThrown) {
				callback({error: "jasonerror thrown from controller: " + textStatus + " " + errorThrown, jqXHR:jqXHR, textStatus:textStatus, errorThrown:errorThrown});
			}
		});
	}

	Controller.verifyPayment = function(itemID, emails, callback) {
		callAjaxController({
			data: {action:"verifyPayment", name:itemID, email:emails},
			success: function(data, textStatus, jqXHR) {
				callback(data);
			},
			error: function() {
				callback({error: "jasonerror thrown from controller"});
			}						
		});
	}
	
	Controller.email = function(params, callback) {
		
		if (!callback) {
			callback = function() {};
		}

		// append action to params
		params.action = "email";
		
		callAjaxController({
			data: params,
			success: function(data, textStatus, jqXHR) {
				callback(data);
			},
			error: function() {
				callback({error: "jasonerror thrown from controller"});
			}						
		});
	}
}

// return 1st active tab
function getActiveTab(callback) {
	chrome.tabs.query({'active': true}, function(tabs) {
		if (tabs && tabs.length >= 1) {
			callback(tabs[0]);
		} else {
			callback();
		}
	});
}

function ChromeTTS() {
	
	var chromeTTSMessages = new Array();
	var speaking = false;
	
	ChromeTTS.queue = function(msg, options, callback) {
		// this might have fixed the endless loop
		if (msg != null && msg != "") {
			if (!options) {
				options = {};
			}
			
			if (!callback) {
				callback = function() {};
			}
			
			options.utterance = msg;
			chromeTTSMessages.push(options);
			play(callback);
		}
	};

	ChromeTTS.stop = function() {
		chrome.tts.stop();
		chromeTTSMessages = new Array();
		speaking = false;
	};

	ChromeTTS.isSpeaking = function() {
		return speaking;
	}

	function play(callback) {
		if (!callback) {
			callback = function() {};
		}
		
		if (chromeTTSMessages.length) {
			chrome.tts.isSpeaking(function(speakingParam) {
				console.log(speaking + " _ " + speakingParam);
				if (!speaking && !speakingParam) {
					// decoded etity codes ie. &#39; is ' (apostrohpe)
					var ttsMessage = $("<div/>").html(chromeTTSMessages[0].utterance).text();
					
					var voiceParams = pref("voice", "native");
					
					var voiceName;
					var extensionID;
					// if specified use it instead of the default 
					if (chromeTTSMessages[0].voiceName) {
						voiceName = chromeTTSMessages[0].voiceName;
						extensionID = "";
					} else {
						voiceName = voiceParams.split("___")[0];
						extensionID = voiceParams.split("___")[1];
					}					

					console.log("speak: " + ttsMessage);
					
					speaking = true;
					
					chrome.tts.stop();
					
					setTimeout(function() {
						chrome.tts.speak(ttsMessage, {
							voiceName: voiceName,
							extensionId : extensionID,
							//enqueue : true,
							volume: pref("voiceSoundVolume", 100) / 100,
							pitch: parseFloat(pref("pitch", 1.0)),
							rate: parseFloat(pref("rate", 1.0)),
							onEvent: function(event) {
								console.log('event: ' + event.type);			
								if (event.type == 'error' || event.type == 'end') {
									//setTimeout(function() {
										chromeTTSMessages.shift();
										speaking = false;
										play(callback);
									//}, 400);
								}
							}
						}, function() {
							if (chrome.runtime.lastError) {
						        logError('speech error: ' + chrome.runtime.lastError.message);
							}
						});
					}, 150);
				} else {
					console.log("already speaking, wait before retrying...");
					setTimeout(function() {
						play(callback);
					}, 1000);
				}
			});
		} else {
			callback();
		}
	}
}

function initDeleteEvent(e, callback) {
	var lec;
	if (typeof(lastEventClicked) != "undefined") {
		lec = lastEventClicked;
	}
	
	if (donationClicked("deleteEvent", e.data.ls)) {
		if (lec) {
			lec.fadeOut("slow");
		}
		var secid = getCookie("secid");
		chrome.runtime.sendMessage({name: "actionMessage", message:"saving"});
		
		console.log("initDeleteEvent", e);
		
		var event;
		if (e.data && e.data.fcEvent) {
			event = e.data.fcEvent.jEvent;
		}
		
		console.log("event: ", event);
		
		traverse(event, traverseDateStringifier);
		chrome.runtime.sendMessage({name: "deleteEvent", eid:e.data.eid, secid:secid, event:event}, function(response) {
			if (response.status == 200 || response.status == 204) {
				if (callback) { // probably called from newLook
					callback();
				}
			} else {
				if (lec) {
					lec.show();
				}
				callback({error:"Error: " + response.status});
			}
		});
	}
}

function openWindowInCenter(url, title, specs, popupWidth, popupHeight) {
	var left = (screen.width/2)-(popupWidth/2);
	var top = (screen.height/2)-(popupHeight/2);
	return window.open(url, title, specs + ", width=" + popupWidth + ", height=" + popupHeight + ", top=" + top + ", left=" + left)
}

function OAuthForDevices(tokenResponses) {
	
	var GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/auth";
	var GOOGLE_TOKEN_URL = "https://accounts.google.com/o/oauth2/token";
	var GOOGLE_CLIENT_ID = "74919836968.apps.googleusercontent.com";
	var GOOGLE_CLIENT_SECRET = "hkBvpOo0XJFzpY3Zt-2PE31V";
	var GOOGLE_REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";
	var GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar";
	
	var BASE_URI = "https://www.googleapis.com/calendar/v3";

	var STATE = "CalendarChecker"; // roundtrip param use to identify correct code response window (because both gmail and calendar other extensions might popup this window also
	
	// Need this because 'this' keyword will be out of scope within this.blah methods like callbacks etc.
	var that = this;
	
	this.tokenResponses = tokenResponses;
	if (!this.tokenResponses) {
		this.tokenResponses = new Array();
	}
	this.params = null;
	this.callback = null;

	this.getStateParam = function() {
		return STATE;
	}

	// return array
	this.getUserEmails = function() {
		var userEmails = new Array();
		$.each(that.tokenResponses, function(index, tokenResponse) {
			userEmails.push(tokenResponse.userEmail);
		});
		return userEmails;
	}

	// return just the emailid
	this.getUserEmail = function(tokenResponse, callback) {
		// were using the contacts url because it's the only one we request permission to and it will give us the email id (so only fetch 1 result)
		// send token response since we don't have the userEmail
		sendOAuthRequest({tokenResponse:tokenResponse, url: "/calendars/primary"}, function(params) {			
			if (params.error) {
				console.error("failed: you might by re-trying to fetch the userEmail for the non default account")
				params.warning = "failed: you might by re-trying to fetch the userEmail for the non default account";
				callback(params);
			} else {
				var userEmail = params.data.id;
				params.userEmail = userEmail;
				callback(params);
			}
		});
	}

	function onTokenChangeWrapper(params) {
		// expires_in params is in seconds (i think)
		params.tokenResponse.expiryDate = new Date(Date.now() + (params.tokenResponse.expires_in * 1000));
		that.onTokenChange(params, that.tokenResponses);
	}	

	function onTokenErrorWrapper(tokenResponse, response) {
		// 400 is returned when refresing token and 401 when .send returns... // means user has problably revoked access: statusText = Unauthorized message = Invalid Credentials
		if ((response.oauthAction == "refreshToken" && response.jqXHR.status == 400) || response.jqXHR.status == 401) {
			console.error("user probably revoked access so removing token:", response);
			that.removeTokenResponse(tokenResponse);			
			that.onTokenError(tokenResponse, response);
		}
	}	

	// setup default functions...
	// params: changedToken, allTokens
	this.onTokenChange = function() {};
	this.onTokenError = function() {};
	
	this.openPermissionWindow = function() {
		return openWindowInCenter(GOOGLE_AUTH_URL + "?prompt=select_account&response_type=code&client_id=" + GOOGLE_CLIENT_ID + "&redirect_uri=" + GOOGLE_REDIRECT_URI + "&scope=" + encodeURIComponent(GOOGLE_SCOPE) + "&state=" + STATE, 'oauth', 'toolbar=0,scrollbars=0,menubar=0,resizable=0', 900, 700);
	}
	
	this.setOnTokenChange = function(onTokenChange) {
		this.onTokenChange = onTokenChange;
	}

	this.setOnTokenError = function(onTokenError) {
		this.onTokenError = onTokenError;
	}

	this.generateURL = function(userEmail, url, callback) {
		var tokenResponse = that.findTokenResponse({userEmail:userEmail});
		if (tokenResponse) {
			ensureToken(tokenResponse, function(response) {
				if (response.error) {
					console.error("error generating url", response);					
				} else {
					// before when calling refreshtoken we used to call this method, notice the tokenResponse came from the response and not that one passed in... params.generatedURL = setUrlParam(url, "access_token", params.tokenResponse.access_token);
					response.generatedURL = setUrlParam(url, "access_token", tokenResponse.access_token);
				}
				callback(response);
			});
		} else {
			callback({error:"No tokenResponse found!"});
		}
	}
	
	function sendOAuthRequest(params, callback) {
		// must append the access token to every request
		
		if (!params.type) {
			params.type = "GET";
		}
		
		var accessToken;
		if (params.tokenResponse) {
			accessToken = params.tokenResponse.access_token;
		} else if (params.userEmail) {
			var tokenResponse = that.findTokenResponse(params);
			accessToken = tokenResponse.access_token;
		}

		// the API wants the access_token to be passed always as a url parameter and not part of the data
		//if (params.type == "POST" || params.type == "DELETE") {
			params.url = setUrlParam(params.url, "access_token", accessToken);
		//}

		// if no data then add empty structure		
		if (params.type == "DELETE") {
			params.data = null;
		} else {
			//if (!params.data) {
				//params.data = {};
			//}

			//params.data.access_token = accessToken;
		}
		
		if (params.processData == undefined) {
			params.processData = true;
		}
		
		//console.log("params", params);

		//console.log("sending request: " + params.userEmail);
		$.ajax({
			type: params.type,
			url: BASE_URI + params.url,
			data: params.data,
			contentType: params.contentType,
			processData: params.processData,
			dataType: "json",
			timeout: 45000,
			complete: function(jqXHR, textStatus) {
				var status = getStatus(jqXHR, textStatus);
				if (status == 200 || status == 204) {
					var data;
					if (jqXHR.responseText) {
						data = JSON.parse(jqXHR.responseText);
					} else {
						// happens when user does a method like DELETE where this no content returned
						data = {};
					}
					callback({data:data});
				} else {
					console.error("error getting data", jqXHR);
					
					var dataCode;
					var dataError;
					try {
						 var data = JSON.parse(jqXHR.responseText);
						 dataCode = data.error.code;
						 dataError = data.error.message; 
					} catch (e) {					
					}
					
					if (dataError) {
						params.error = textStatus + " " + dataCode + " - " + dataError;
					} else {
						params.error = textStatus;
					}
					
					params.jqXHR = jqXHR;
					params.textStatus = textStatus;
					callback(params);
				}
			}
		});
	}
	
	function ensureToken(tokenResponse, callback) {
		if (isExpired(tokenResponse)) {
			console.log("token expired: ", tokenResponse);
			refreshToken(tokenResponse, function(response) {
				callback(response);
			});
		} else {
			callback({});
		}
	}
	
	function refreshToken(tokenResponse, callback) {
		// must refresh token
		console.log("refresh token: " + tokenResponse.userEmail + " " + now().toString());
		$.ajax({
			type: "POST",
			url: GOOGLE_TOKEN_URL,			
			data: {refresh_token:tokenResponse.refresh_token, client_id:GOOGLE_CLIENT_ID, client_secret:GOOGLE_CLIENT_SECRET, grant_type:"refresh_token"},
			dataType: "json",
			timeout: 5000,
			complete: function(jqXHR, textStatus) {
				var status = getStatus(jqXHR, textStatus);
				if (status == 200) {
					var refreshTokenResponse = JSON.parse(jqXHR.responseText);
					tokenResponse.access_token = refreshTokenResponse.access_token;
					tokenResponse.expires_in = refreshTokenResponse.expires_in;
					tokenResponse.token_type = refreshTokenResponse.token_type;					
					
					var callbackParams = {tokenResponse:tokenResponse};
					onTokenChangeWrapper(callbackParams);
					console.log("in refresh: " + tokenResponse.expiryDate.toString());
					callback(callbackParams);
				} else {
					var callbackParams = {tokenResponse:tokenResponse};
					callbackParams.error = "error getting new token via refresh token: " + jqXHR.statusText
					callbackParams.jqXHR = jqXHR;
					callbackParams.oauthAction = "refreshToken";
					console.error(callbackParams.error);
					callback(callbackParams);
				}
			}
		});
	}
	
	// private isExpired
	function isExpired(tokenResponse) {
		var SECONDS_BUFFER = -300; // 5 min. yes negative, let's make the expiry date shorter to be safe
		return !tokenResponse.expiryDate || today().isAfter(tokenResponse.expiryDate.addSeconds(SECONDS_BUFFER, true));
	}

	// public method, should be called before sending multiple asynchonous requests to .send
	this.ensureTokenForEmail = function(userEmail, callback) {
		var tokenResponse = that.findTokenResponse({userEmail:userEmail});
		if (tokenResponse) {
			ensureToken(tokenResponse, function(response) {
				callback(response);
			});
		} else {
			var error = "no token for: " + userEmail + ": might have not have been granted access";
			console.error(error);
			callback({error:error});
		}
	}		
	
	this.send = function(params, callback) {
		var dfd = new $.Deferred();
		// save all args in this sendrequet to call it back later
		that.params = params;
		if (!callback) {
			callback = function() {};
		}
		that.callback = callback;
		
		var tokenResponse = that.findTokenResponse(params);		
		if (tokenResponse) {
			ensureToken(tokenResponse, function(response) {
				if (response.error) {
					onTokenErrorWrapper(tokenResponse, response);						
					response.roundtripArg = params.roundtripArg;						
					callback(response);
					dfd.resolve(response);						
				} else {
					sendOAuthRequest(params, function(response) {
						if (response.error) {
							onTokenErrorWrapper(tokenResponse, response);
						}
						response.roundtripArg = params.roundtripArg;
						callback(response);
						dfd.resolve(response);						
					});
				}
			});			
		} else {
			var error = "no token response found for email: " + params.userEmail;
			console.warn(error, params);
			params.error = error;
			that.callback(params);
			dfd.resolve(params);
			/*
			that.getAccessToken(that.code, function(params) {
				console.log("response2: ", params);
				if (params.tokenResponse) {
					sendOAuthRequest(that.params, function(response) {
						response.roundtripArg = params.roundtripArg;
						that.callback(response);
						dfd.resolve(response);
					});
				} else {
					//response.roundtripArg = params.roundtripArg;
					console.log("params: ", params)
					that.callback(params);
					dfd.resolve(params);
				}
			});
			*/
		}
		return dfd.promise();
	}
	
	this.findTokenResponse = function(params) {
		for (var a=0; a<that.tokenResponses.length; a++) {
			if (that.tokenResponses[a].userEmail == params.userEmail) {
				return that.tokenResponses[a];
			}
		}
	}
	
	// removes token response and calls onTokenChange to propogate change back to client
	this.removeTokenResponse = function(params) {
		console.log("parms", params)
		for (var a=0; a<that.tokenResponses.length; a++) {
			if (that.tokenResponses[a].userEmail == params.userEmail) {
				that.tokenResponses.splice(a, 1);
				break;
			}
		}
		that.onTokenChange(null, that.tokenResponses);
	}

	this.removeAllTokenResponses = function() {
		that.tokenResponses = [];
		that.onTokenChange(null, that.tokenResponses);
	}

	this.getAccessToken = function(code, callback) {
		if (!code) {
			//alert("authorization code param is required: comes from opening the google grant permission popup");
		}
		that.code = code;
		console.log("get access token");
		$.ajax({
			type: "POST",
			url: GOOGLE_TOKEN_URL,
			data: {code:code, client_id:GOOGLE_CLIENT_ID, client_secret:GOOGLE_CLIENT_SECRET, redirect_uri:GOOGLE_REDIRECT_URI, grant_type:"authorization_code"},
			dataType: "json",
			timeout: 5000,
			complete: function(request, textStatus) {
				var status = getStatus(request, textStatus);
				if (status == 200) {
					var tokenResponse = JSON.parse(request.responseText);
					
					that.getUserEmail(tokenResponse, function(params) {
						if (params.userEmail) {
							// add this to response
							tokenResponse.userEmail = params.userEmail;
							
							var tokenResponseFromMemory = that.findTokenResponse(params);
							if (tokenResponseFromMemory) {
								// update if exists
								tokenResponseFromMemory = tokenResponse;
							} else {
								// add new token response
								that.tokenResponses.push(tokenResponse);
							}
							var callbackParams = {tokenResponse:tokenResponse};
							onTokenChangeWrapper(callbackParams);
							callback(callbackParams);
						} else {
							callback(params);
						}
					});
				} else {
					callback({error:request.statusText});
				}
			}
		});
	} 
}

function StorageManager() {
	
	var lastSetItems;
	var lastUpdate = new Date(1);
	var lastUpdateTimeout;
	var MINIMUM_TIME_REQUIRED_BETWEEN_UPDATES = -1; //2 * ONE_SECOND;
	
	StorageManager.prototype.get = function(storageDefaults, callback) {
		try {
			chrome.storage.local.get(null, function(items) {
				if (chrome.runtime.lastError){
					var error = "error getting storage lasterror: " + chrome.runtime.lastError.message;
					logError(error);
		            callback({error:error});
		        } else {
		        	// patch (part 2) because "chrome.storage.local.set" would not properly serialize dates
		        	for (itemKey in items) {
		        		items[itemKey] = JSON.parse(items[itemKey]);
		        	}
		        	
		        	if (storageDefaults) {
		        		for (defaultKey in storageDefaults) {
		        			if (items[defaultKey] == undefined) {
		        				items[defaultKey] = storageDefaults[defaultKey];
		        			}
		        		}
		        	}
		        	callback({items:items});
		        }
			});
		} catch (e) {
			var error = "error getting storage: " + e;
			logError(error);
            callback({error:error});			
		}
	}
	
	// set multiple items
	StorageManager.prototype.setItems = function(items, callback) {
		lastSetItems = items;
		if (Date.now() - lastUpdate.getTime() < MINIMUM_TIME_REQUIRED_BETWEEN_UPDATES) {
			console.log("delaying sync");
			clearTimeout(lastUpdateTimeout);
			lastUpdateTimeout = setTimeout(function() {
				saveItems();
			}, MINIMUM_TIME_REQUIRED_BETWEEN_UPDATES);
		} else {
			saveItems();
		}
	}

	// set one key/value
	StorageManager.prototype.set = function(key, value, callback) {
		var item = {};
		item[key] = value;
		this.setItems(item, callback);
	}	

	StorageManager.prototype.remove = function(key, callback) {
		chrome.storage.local.remove(key, callback);
	}	

	StorageManager.prototype.clear = function(callback) {
		if (!callback) {
			callback = function() {};
		}
		chrome.storage.local.clear(callback);
	}
	
	StorageManager.prototype.filterKeyName = function(key) {
		// patch (part 1): because dot notation was being interpreted ie. feed/http://googleblog.blogspot.com/atom.xml this would become feed/http://googleblog + subobject blogspot + subobject + com/atom et.c..
		key = key.replace(/\./g, "[D]");
		return key;
	}

	function saveItems() {
		console.log("synching", lastSetItems);
		
		var stringifiedItems = {};
		// patch because "chrome.storage.local.set" would not properly serialize dates
		for (lastSetItemKey in lastSetItems) {
			stringifiedItems[lastSetItemKey] = JSON.stringify(lastSetItems[lastSetItemKey]);
		}
		
		chrome.storage.local.set(stringifiedItems, function() {
			if (chrome.extension.lastError) {
				console.error("last set items", lastSetItems);
				console.error("chrome sync set error", chrome.extension.lastError.message);
				alert("Too many items/settings to sync, maybe? Error: " + chrome.extension.lastError.message)
			}
			lastUpdate = new Date();
		});
	}
	
}

function lightenDarkenColor(col, amt) {
	if (col) {
	    var usePound = false;
	    if ( col[0] == "#" ) {
	        col = col.slice(1);
	        usePound = true;
	    }
	
	    var num = parseInt(col,16);
	
	    var r = (num >> 16) + amt;
	
	    if ( r > 255 ) r = 255;
	    else if  (r < 0) r = 0;
	
	    var b = ((num >> 8) & 0x00FF) + amt;
	
	    if ( b > 255 ) b = 255;
	    else if  (b < 0) b = 0;
	
	    var g = (num & 0x0000FF) + amt;
	
	    if ( g > 255 ) g = 255;
	    else if  ( g < 0 ) g = 0;
	
	    var hex = (g | (b << 8) | (r << 16)).toString(16);
	    
	    // seems if color was already dark then making it darker gave us an short and invalid hex so let's make sure its 6 long
	    if (hex.length == 6) {
	    	return (usePound?"#":"") + hex;
	    } else {
	    	// else return same color
	    	return col;
	    }
	}
}

//see if the keypressed event equals the letter passed
function letterPressedEquals(e, letter) {
	if (e) {
		return letter.toUpperCase().charCodeAt(0) == e.which;
	} else {
		return null;
	}
}

// usage: object, function(object, key)
function traverse(o, func) {
    for (i in o) {
        //func.apply(this,[i,o[i]]);  
		func.apply(this,[o, i]);  
        if (typeof(o[i])=="object") {
            //going on step down in the object tree!!
            traverse(o[i], func);
        }
    }
}

function traverseDateParser(o, key) {
	// 2012-12-04T13:51:06.897Z
	if (typeof o[key] == "string" && o[key].length == 24 && /\d{4}-\d{2}-\d{2}T\d{2}\:\d{2}\:\d{2}\.\d{3}Z/.test(o[key])) {
		o[key] = new Date(o[key]);
	}
}

function traverseDateStringifier(o, key) {
	if (o[key] instanceof Date) {
		o[key] = o[key].toJSON();
	}
}

function clone(obj) {
	return $.extend(true, {}, obj);
}

//used to reduce load or requests: Will randomy select a date/time between now and maxdaysnfrom now and return true when this date/time has passed 
function passedRandomTime(name, maxDaysFromNow) {
	var randomTime = localStorage[name];
	
	// already set a random time let's if we passed it...
	if (randomTime) {
		randomTime = new Date(randomTime);
		// this randomtime is before now, meaning it has passed so return true
		if (randomTime.isBefore()) {
			return true;
		} else {
			return false;
		}
	} else {
		// set a random time
		if (!maxDaysFromNow) {
			maxDaysFromNow = 5; // default 5 days
		}
		var maxDate = new Date();
		maxDate = maxDate.addDays(maxDaysFromNow);
		
		var randomeMilliSecondsFromNow = parseInt(Math.random() * (maxDate.getTime() - Date.now()));
		randomTime = Date.now() + randomeMilliSecondsFromNow;
		randomTime = new Date(randomTime);
		
		console.log("Set randomtime: " + randomTime);
		localStorage[name] = randomTime;
		return false;
	}
}

var getTextHeight = function(font) {
	  var text = $('<span>Hg</span>').css({ fontFamily: font });
	  var block = $('<div style="display: inline-block; width: 1px; height: 0px;"></div>');

	  var div = $('<div></div>');
	  div.append(text, block);

	  var body = $('body');
	  body.append(div);

	  try {

	    var result = {};

	    block.css({ verticalAlign: 'baseline' });
	    result.ascent = block.offset().top - text.offset().top;

	    block.css({ verticalAlign: 'bottom' });
	    result.height = block.offset().top - text.offset().top;

	    result.descent = result.height - result.ascent;

	  } finally {
	    div.remove();
	  }

	  return result;
};

// usage: niceAlert(message, [params], [callback])
function niceAlert(message, params, callback) {
	if (arguments.length == 1) {
		params = {};
	} else if (arguments.length == 2) {
		// if 2nd param is function then assume it's
		if ($.isFunction(params)) {
			callback = params;
		}
	}
	if (!callback) {
		callback = function() {};
	}
	
	var $style = $("<style>" +
			" #jBackDrop {opacity:0;position: fixed;top: 0;right: 0;bottom: 0;left: 0;z-index: 1030;background-color: #000}" +
			" #jMessage {position: fixed;opacity:0;top:30%;right: 0;bottom: 0;left: 0;z-index: 1040}" +
			" #jMessageInner {border:1px solid black;text-align: center;box-shadow: 0 5px 15px rgba(0,0,0,0.5);right: auto;left: 50%;width:400px;z-index: 1050;background:white;border-radius:9px;padding:15px;margin-right: auto;margin-left: auto}" +
			" #jMessageClose {float:right;margin-right: -5px;margin-top: -6px;cursor:pointer;font-size: 21px;font-weight: bold;line-height: 1;color: #000;text-shadow: 0 1px 0 #fff;opacity: .2} " +
			" #jMessageClose:hover {opacity:0.5} " +
			" #jMessageText {color: black;text-align: left;margin: 15px 10px 20px 10px} " +
			" #jMessage .jMessageButton {color: #fff;background: #428bca;border-color: #357ebd;padding: 6px 12px;margin:0 0 0 10px;font-size: 14px;font-weight: normal;line-height: 1.428571429;text-align: center;white-space: nowrap;vertical-align: middle;cursor: pointer;border: 1px solid transparent;border-radius: 4px;-webkit-user-select: none} " +
			" #jMessage .jMessageButton:hover {background:#3276b1} " +
			" #jMessage .jMessageButton:focus {outline:none} " +
			" #jMessage #jMessageCancelButton {background:#aaa}" +
			" #jMessage #jMessageCancelButton:hover {background:#999} " +
			"</style>");
	
	var $backDrop = $("<div id='jBackDrop'></div>");
	$("head").append($style);
	$("body").append($backDrop);
	
	var $messageDiv;
	
	function closeAlert(action, callback) {
		$backDrop.animate({ opacity: 0 }, 200, function() {
			$messageDiv.remove();
			$(this).remove();
			$style.remove();
			callback(action);
		});
	}
	
	$backDrop.animate({ opacity: 0.5 }, 200, function() {
		$messageDiv = $("<div id='jMessage'><div id='jMessageInner'><div id='jMessageClose'>×</div><div id='jMessageText'></div><div id='jMessageButtonArea'><button id='jMessageOKButton' class='jMessageButton'>OK</button></div></div></div>");		
		$messageDiv.find("#jMessageText").html(message);
		
		if (params.cancelButton) {
			$messageDiv.find("#jMessageButtonArea").append( $("<button id='jMessageCancelButton' class='jMessageButton'>Cancel</button>") );
		}

		if (params.okButtonLabel) {
			$messageDiv.find("#jMessageOKButton").text( params.okButtonLabel );
		}

		$messageDiv.find("#jMessageOKButton")
			.click(function() {
				$messageDiv.hide();
				closeAlert("ok", callback);
			})
			.on('keyup', function (e) {
				if (e.which == 27) {
					$("#jMessageClose").click();
				}
			})
		;
		
		$messageDiv.find("#jMessageCancelButton, #jMessageClose")
			.click(function() {
				$messageDiv.fadeOut("fast");
				closeAlert("cancel", callback);
			})
		;		
		
		$backDrop.before($messageDiv);
		
		$messageDiv.animate({ opacity: 1 }, 200, function() {
			$messageDiv.find("#jMessageOKButton").focus();
		});
	});
}

function IconAnimation(iconUrl) {
	var animateCalled;
	var animateCallback;
	var iconLoaded;
	
	var icon = new Image();
	var that = this;
	icon.onload = function() {
		//console.log("icon onload");
		iconLoaded = true;
		if (that.animateCalled) {
			//console.log("this.animate called");
			that.animate(that.animateCallback);
		}
	}
	icon.src = iconUrl;
	
	var canvas = document.createElement('canvas');
	canvas.width = canvas.height = 19;
	//$(canvas).css("-webkit-filter", "grayscale(0.5) blur(10px);");
	var canvasContext = canvas.getContext('2d');

	var rotation = 1;
	var factor = 1;
	var animTimer;
	var animDelay = 40;
	
	this.stop = function() {
		if (animTimer != null) {
			clearInterval(animTimer);
		}
		rotation = 1;
		factor = 1;
	}

	this.animate = function(callback) {
		//console.log("in this.animate");
		that.stop();
		that.animateCalled = true;
		that.animateCallback = callback;
		if (iconLoaded) {
			//console.log("draw image");
			
			chrome.browserAction.getBadgeText({}, function(previousBadgeText) {					
				chrome.browserAction.setBadgeText({text : ""});
				//canvasContext.drawImage(icon, -Math.ceil(canvas.width / 2), -Math.ceil(canvas.height / 2));
				
				// start animation
				animTimer = setInterval(function() {
					canvasContext.save();
					canvasContext.clearRect(0, 0, canvas.width, canvas.height);
					canvasContext.translate(Math.ceil(canvas.width / 2), Math.ceil(canvas.height / 2));
					canvasContext.rotate(rotation * 2 * Math.PI);
					canvasContext.drawImage(icon, -Math.ceil(canvas.width / 2), -Math.ceil(canvas.height / 2));
					
					// inverts images
					/*
					var imageData = canvasContext.getImageData(0, 0, icon.width, icon.height);
			        var data = imageData.data;

			        for(var i = 0; i < data.length; i += 4) {
			          // red
			          data[i] = 255 - data[i];
			          // green
			          data[i + 1] = 255 - data[i + 1];
			          // blue
			          data[i + 2] = 255 - data[i + 2];
			        }

			        // overwrite original image
			        canvasContext.putImageData(imageData, 0, 0);
			        */
					
					canvasContext.restore();
					
					rotation += 0.05 * factor;
					
					if (rotation <= 0.8 && factor < 0) {
						factor = 1;
					}
					else if (rotation >= 1.2 && factor > 0) {
						factor = -1;
					}
					
					chrome.browserAction.setIcon({
						imageData: canvasContext.getImageData(0, 0, canvas.width, canvas.height)
				   	});
				}, animDelay);
				
				// stop animation
				setTimeout(function() {
					that.stop();
					callback(previousBadgeText);
				}, 2500);
			});
		}
	}
}

var syncOptions = (function() {
	var MIN_STORAGE_EVENTS_COUNT_BEFORE_SAVING = 4;
	var saveTimeout;
	return { // public interface
		init: function(excludeList) {
			if (!excludeList) {
				excludeList = [];
			}
			
			// append standard exclusion to custom ones
			excludeList = excludeList.concat(["version", "lastSyncOptionsSave", "lastSyncOptionsLoad", "detectedChromeVersion", "installDate", "installVersion"]);
			
			// all private members are accesible here
			syncOptions.excludeList = excludeList;
			
			$(window).on("storage", function(e) {
				if (excludeList.indexOf(e.originalEvent.key) != -1) {
					console.log("storage event ignored: " + e.originalEvent.key);
				} else {
					// we don't want new installers overwriting their synced data from previous installations - so only sync after certain amount of clicks by presuming their just going ahead to reset their own settings manually
					if (!localStorage._storageEventsCount) {
						localStorage._storageEventsCount = 0;
					}
					localStorage._storageEventsCount++;
					
					// if loaded upon new install then we can proceed immediately to save settings or else want for minium storage event
					if (localStorage.lastSyncOptionsLoad || localStorage.lastSyncOptionsSave || localStorage._storageEventsCount >= MIN_STORAGE_EVENTS_COUNT_BEFORE_SAVING) {
						console.log("storage event: " + e.originalEvent.key + " will sync it soon...");
						clearTimeout(saveTimeout);
						saveTimeout = setTimeout(function() {
							syncOptions.save("localStorage changed: " + e.originalEvent.key);
						}, seconds(45));
					} else {
						console.log("storage event: " + e.originalEvent.key + " waiting for more storage events before syncing");
					}
				}
			});
			
		},
		save: function(reason, callback) {
			
			if (!callback) {
				callback = function() {};
			}
			console.log("syncOptions: saving data reason: " + reason + "...");
			
			// process localStorage
			var localStorageItemsToSave = {};
			for (item in localStorage) {
				// don't incude storage options starting with _blah and use exclude list
				if (!item.startsWith("_") && syncOptions.excludeList.indexOf(item) == -1) {
					console.log(item + ": " + localStorage[item]);
					localStorageItemsToSave[item] = localStorage[item];
				}
			}
			localStorageItemsToSave = JSON.stringify(localStorageItemsToSave);
			
			// split it up because of max size per item allowed in Storage API
			// because QUOTA_BYTES_PER_ITEM is sum of key + value STRINGIFIED! (again)
			// watchout because the stringify adds quotes and slashes refer to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
			// so let's only use 80% of the max and leave the rest for stringification when the sync.set is called
			var MAX_CHUNK_SIZE = Math.floor(chrome.storage.sync.QUOTA_BYTES_PER_ITEM * 0.80);

			var localStorageChunks = localStorageItemsToSave.chunk(MAX_CHUNK_SIZE);
			
			try {
				// remove all items first because we might have less "chunks" of data so must clear the extra unsused ones now
				chrome.storage.sync.clear(function() {
					if (chrome.runtime.lastError) {
						var error = "sync error: " + chrome.runtime.lastError.message;
						logError(error);
						callback({error:error});
					} else {
						var deferreds = new Array();
						var deferred;
						
						var chunkId = getUniqueId();
						var details = {chunkId:chunkId, chunks:localStorageChunks.length, extensionVersion:chrome.runtime.getManifest().version, lastSync:new Date().toJSON(), syncReason:reason};
						
						// can we merge details + first AND only chunk into one .set operation (save some bandwidth)
						var setDetailsSeparateFromChunks;
						if (localStorageChunks.length == 1 && JSON.stringify(details).length + localStorageChunks.first().length < MAX_CHUNK_SIZE) {
							setDetailsSeparateFromChunks = false;
						} else {
							setDetailsSeparateFromChunks = true;

							// set sync header/details...
							deferred = $.Deferred(function(def) {
								chrome.storage.sync.set({details:details}, function() {
									console.log("saved details");
									def.resolve("success");
								});
							});
							deferreds.push(deferred);
						}
						
						
						$(localStorageChunks).each(function(index, chunk) {
							var itemToSave = {};
							
							// let's set details + chunk together
							if (!setDetailsSeparateFromChunks) {
								itemToSave["details"] = details;
							}
							
							itemToSave["chunk_" + index + "_" + chunkId] = chunk;
							deferred = $.Deferred(function(def) {
								
								// to avoid problems with MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE let's spread out the calls
								var delay;
								var SYNC_OPERATIONS_BEFORE = 2; // .clear .get (for details) were done before
								if (SYNC_OPERATIONS_BEFORE+localStorageChunks.length > chrome.storage.sync.MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE) {
									delay = index * seconds(10); // makes only 6 calls per minute
								} else {
									delay = 0;
								}
								setTimeout(function() {
									chrome.storage.sync.set(itemToSave, function() {
										if (chrome.runtime.lastError) {
											var error = "sync error: " + chrome.runtime.lastError.message;
											logError(error);
											def.reject(error);
										} else {											
											console.log("saved options_" + index);
											def.resolve("success");							
										}
									});
								}, delay);
							});
							deferreds.push(deferred);
						});
						
					   $.when.apply($, deferreds)
					   		.done(function() {
					   			localStorage.lastSyncOptionsSave = new Date();
					   			console.log("fetchfeeds end");
					   			callback({});
					   		})
					   		.fail(function(args) {
					   			console.log(args)
					   			console.log(arguments)
					   			
					   			// error occured so let's clear storage because we might have only partially written data
					   			chrome.storage.sync.clear();
					   			
					   			callback({error:"jerror"});
					   		})
					   	;
					}
				});
			} catch (e) {
				var error = "sync save error: " + e;
				logError(error);
				callback({error:error});
			}
		},
		fetch: function(callback) {
			console.log("syncOptions: fetch...");
			var response = {};
			try {
				chrome.storage.sync.get(null, function(items) {
					if (chrome.runtime.lastError) {
						var error = "sync last error: " + chrome.runtime.lastError.message;
						response.error = error;
						logError(error);
					} else {
						console.log("items", items);
						if (!$.isEmptyObject(items)) {
							response.items = items;
							var details = items["details"];
							if (details.extensionVersion != chrome.runtime.getManifest().version) {
								response.error = "Versions are different: " + details.extensionVersion + " and " + chrome.runtime.getManifest().version;
							}
						}
					}
					callback(response);
				});
			} catch (e) {
				var error = "sync fetch error: " + e;
				logError(error);
				response.error = error;
				callback(response);
			}
		},
		fetchAndLoad: function(callback) {
			syncOptions.fetch(function(response) {
				if (response.items && !response.error) {
					syncOptions.load(response.items, callback);
				} else {
					callback(response);
				}
			});
		},
		load: function(items, callback) {
			console.log("syncOptions: load...");
			if (items) {
				var details = items["details"]; 
				if (details) {
					// acculumate chunks together
					var data = "";
					for (var a=0; a<details.chunks; a++) {
						//console.log(items["options_" + a]);
						data += items["chunk_" + a + "_" + details.chunkId];
					}
					data = JSON.parse(data);
					
					for (item in data) {
						localStorage.setItem(item, data[item]);
					}
					
					localStorage.lastSyncOptionsLoad = new Date();
					console.log("done");
				}
			}
			callback({items:items});
		}
	};
})();

function downloadObject(data, filename) {
    if (!data) {
        console.error('No data')
        return;
    }

    if(!filename) filename = 'object.json'

    if(typeof data === "object"){
        data = JSON.stringify(data, undefined, 4)
    }

    var blob = new Blob([data], {type: 'text/json'}),
        e    = document.createEvent('MouseEvents'),
        a    = document.createElement('a')

    a.download = filename
    a.href = window.URL.createObjectURL(blob)
    a.dataset.downloadurl =  ['text/json', a.download, a.href].join(':')
    e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
    a.dispatchEvent(e)
}

function initUndefinedObject(obj) {
    if (obj) {
        return obj;
    } else {
        return {};
    }
}

function getDefaultVoice(voices, includeExternal) {
	
	function hasVoice(voices, voiceValue) {	
		for (var a=0; a<voices.length; a++) {
			// if extensiond id in value then match voicename and extension id
			if (voiceValue.indexOf("___") != -1 && includeExternal) {
				var voiceName = voiceValue.split("___")[0];
				var extensionId = voiceValue.split("___")[1];
				if (voices[a].voiceName == voiceName && voices[a].extensionId == extensionId) {
					return a;
				}
			} else if (voices[a].voiceName == voiceValue) {
				// no exension id so let's only match name
				return a;
			}
		}
		return -1;
	}
	
	var savedVoice = pref("voice", "native");
	var voiceIndexMatched = hasVoice(voices, savedVoice);
	if (voiceIndexMatched == -1) {
		// windows
		voiceIndexMatched = hasVoice(voices, "native");
		if (voiceIndexMatched == -1) {
			// linux
			voiceIndexMatched = hasVoice(voices, "default espeak");
		}
	}
	
	if (voiceIndexMatched == -1 && voices.length) {
		voiceIndexMatched = 0;
	}
	
	return voiceIndexMatched;
}

function parseVersionString(str) {
    if (typeof(str) != 'string') { return false; }
    var x = str.split('.');
    // parse from string or default to 0 if can't parse
    var maj = parseInt(x[0]) || 0;
    var min = parseInt(x[1]) || 0;
    var pat = parseInt(x[2]) || 0;
    return {
        major: maj,
        minor: min,
        patch: pat
    }
}

function openTemporaryWindowToRemoveFocus() {
	// open a window to take focus away from notification and there it will close automatically
	var win = window.open("about:blank", "emptyWindow", "width=1, height=1, top=-500, left=-500");
	win.close();
}

function escapeRegExp(str) {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}