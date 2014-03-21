var MAX_EMAILS_TO_ACTION = 10;
var UNSYNCHED_ACCOUNT_ID = 99;
var TEST_REDUCED_DONATION = false;

/*
function formatSummary(mail, maxSummaryLetters) {
	if (Settings.read("showEOM") && summary) {
		var elipsisIndex = summary.lastIndexOf("...");
		if (elipsisIndex != -1 && elipsisIndex == summary.length-3) { 
			return summary;
		} else {
			return summary + " <span class='eom' title=\"" + getMessage("EOMToolTip") + "\">[" + getMessage("EOM") + "]</span>";
		}
	} else {
		return summary;
	}
}
*/

function getAllEmails(accounts, callback) {
	var getEmailsCallbackParams = new Array();
	var deferreds = new Array();
	$.each(accounts, function (i, account) {
		var deferred = account.getEmails(null, function(params) {
			getEmailsCallbackParams.push(params);
		});
		deferreds.push(deferred);
	});
	$.when.apply($, deferreds).always(function() {
		callback(getEmailsCallbackParams);
	});
}

function hasAtleastOneSuccessfullAccount(accounts) {
	var atleastOneSuccessfullAccount = false;
	$.each(accounts, function(i, account) {
		if (!account.error) {
			atleastOneSuccessfullAccount = true;
			return false;
		}
		return true;
	});
	return atleastOneSuccessfullAccount;
}

function updateBadge(totalUnread) {
	var bg;
	if (window.bg) {
		bg = window.bg;
	} else {
		bg = window;
	}
	
	var img_noNewSrc = "no_new";
	var img_newSrc = "new";

	var accounts = bg.accounts;
	var atleastOneSuccessfullAccount = false;
	$.each(accounts, function(i, account) {
		if (!account.error) {
			atleastOneSuccessfullAccount = true;
			return false;
		}
		return true;
	});
	
	if (!hasAtleastOneSuccessfullAccount(bg.accounts)) {
		bg.setIcon(bg.img_notLoggedInSrc);		
	} else if (accounts && accounts.length >= 1) {
		var hideCount = Settings.read("hide_count");
		if (hideCount || totalUnread < 1) {
			chrome.browserAction.setBadgeText({ text: "" });
		} else {
			chrome.browserAction.setBadgeText({ text: totalUnread.toString() });
		}
	
		if (!totalUnread || totalUnread <= 0) {
			bg.setIcon(img_noNewSrc);
			chrome.browserAction.setBadgeBackgroundColor({ color: [110, 140, 180, 255] });
			chrome.browserAction.setTitle({ title: getMessage('noUnreadText') });
		} else if (totalUnread == 1) {
			bg.setIcon(img_newSrc);
			//chrome.browserAction.setBadgeBackgroundColor({ color: [200, 0, 0, 255] });
			chrome.browserAction.setBadgeBackgroundColor({ color: [232, 76, 61, 255] });
			chrome.browserAction.setTitle({ title: totalUnread + " " + ((getMessage('oneUnreadText')) ? getMessage('oneUnreadText') : getMessage('severalUnreadText')) });
		} else {
			bg.setIcon(img_newSrc);
			chrome.browserAction.setBadgeBackgroundColor({ color: [232, 76, 61, 255] });
			chrome.browserAction.setTitle({ title: totalUnread + " " + getMessage('severalUnreadText') });
		}
	}
}

function initPopup(unreadCount) {
	var previewSetting = Settings.read("preview_setting");
	
	if (previewSetting == 0) {
		// Preview setting set to "Always off" =
		// Go to first mail inbox with unread items
		//openInbox(0);
		chrome.browserAction.setPopup({popup:""});
	} else if (previewSetting == 1 && unreadCount === 0) {
		// Preview setting set to "Automatic" + no unread mail =
		// Go to first mail inbox
		//openInbox(0);
		chrome.browserAction.setPopup({popup:""});
	} else {
		chrome.browserAction.setPopup({popup:"popup.html"});
	}
}

function getAccountByEmail(email) {
	var accounts = chrome.extension.getBackgroundPage().accounts;
	for (var a=0; a<accounts.length; a++) {
		if (email == accounts[a].getAddress()) {
			return accounts[a];
		}
	}
}

function openInbox(accountId, params) {	
	var mailAccounts = chrome.extension.getBackgroundPage().accounts;
	if (accountId == null) {
		accountId = 0;
		// Open first inbox with unread items
		$.each(mailAccounts, function (i, account) {
			if (account.getUnreadCount() > 0) {
				accountId = account.id;
				return false;
			}
			return true;
		});
	}

	if(mailAccounts == null || mailAccounts[accountId] == null) {
		console.error("No mailaccount(s) found with account id " + accountId);		
		return -1;
	}

	mailAccounts[accountId].openInbox(params);
	return accountId;
}

function fetchContacts(userEmail, callback) {
	var contactDataItem = {}
	contactDataItem.userEmail = userEmail;
	contactDataItem.lastFetch = now().toString();
	chrome.extension.getBackgroundPage().oAuthForContacts.send({userEmail:userEmail, url: "https://www.google.com/m8/feeds/contacts/" + userEmail + "/thin", data:{alt:"json", "max-results":"2000"}}, function(response) {
		if (response.error || !response.jqXHR) {
			callback({error:"error getting contacts: " + response.error});
		} else {
			var data = JSON.parse(response.jqXHR.responseText);
			if (data && data.feed) {
				contactDataItem.contacts = data.feed.entry;
				callback({contactDataItem:contactDataItem});
			} else {
				var error = "contacts feed missing 'feed' node";
				logError(error, data)
				callback({error:error + data});
			}
		}			
	});
}

function getContacts(params, callback) {
	var contactsData = Settings.read("contactsData");
	if (contactsData) {
		// maybe update
		for (var a=0; a<contactsData.length; a++) {
			if (contactsData[a] && contactsData[a].userEmail == params.account.getAddress()) {
				//console.log(new Date(contactsData[a].lastFetch).diffInHours() + " __ " + -parseInt(Settings.read("fetchContactsInterval")))
				if (params.forceUpdate || new Date(contactsData[a].lastFetch).diffInHours() <= -parseInt(Settings.read("fetchContactsInterval"))) {
					// update contacts
					console.log("updating contacts: " + params.account.getAddress());					
					fetchContacts(params.account.getAddress(), function(params) {
						if (params.contactDataItem) {
							contactsData[a] = params.contactDataItem;
							Settings.store("contactsData", contactsData);
							callback({contacts:params.contactDataItem.contacts});
						} else {
							callback(params);
						}
					});
				} else {
					callback({contacts:contactsData[a].contacts});
					console.log("contacts from cache: " + params.account.getAddress());
				}
				return;
			}
		}
		callback({error:"Not found in cache"});
		console.log("not found")		
	} else {
		callback({error:"No cache created yet for contactsData"});
		console.log("no contactsdata; might have not been given permission");
	}
}

function getContact(params, callback) {
	var emailToFind;
	if (params.email) {
		emailToFind = params.email;
	} else {
		emailToFind = params.mail.authorMail;
	}	
	
	var found = false;
	getContacts({account:params.mail.account}, function(params) {
		if (params.contacts) {
			$.each(params.contacts, function(index, contact) {
				if (contact.gd$email) {
					$.each(contact.gd$email, function(index, contactEmail) {
						if (contactEmail.address && emailToFind && contactEmail.address.toLowerCase() == emailToFind.toLowerCase()) {
							found = true;
							callback(contact);
							return false;
						}
						return true;
					});
					if (found) {
						return false;
					}
				}
				return true;
			});
		}
		if (!found) {
			if (typeof console != "undefined") {
				console.log("not found: " + emailToFind);
			}
			callback();
		}
	});
}

function getContactPhoto(params, callback) {
	getContact(params, function(contact) {
		if (contact) {
			generateContactPhotoURL(contact, params.mail.account, callback);
		} else {
			callback({});
		}
	});
}

function generateContactPhotoURL(contact, account, callback) {
	var photoFound = false;
	
	var cbParams = {};
	cbParams.contact = contact;
	
	$.each(contact.link, function(a, link) {
		if (link.rel && link.rel.indexOf("#photo") != -1) {
			photoFound = true;
			bg.oAuthForContacts.generateURL(account.getAddress(), link.href, function(params) {
				cbParams = params;
				cbParams.contact = contact;
				callback(cbParams);
			});
			return false;
		}
		return true;
	});
	
	if (!photoFound) {
		cbParams.error = "photoNotFound";
		callback(cbParams);
	}
}

function convertGmailPrintHtmlToText($node) {
	// removing font tags because Gmail usuaully uses them for the footer/signature and/or the quoted text in the gmail print html 
	$node.find("font[color]").each(function() {
		$(this).remove();
	});
	
	var html = $node.html();
	
	// replace br with space
	html = html.replace(/<br\s*[\/]?>/gi, " ");
	
	// replace <p> and </p> with spaces
	html = html.replace(/<\/?p\s*[\/]?>/gi, " ");
	
	// add a space before <div>
	html = html.replace(/<\/?div\s*[\/]?>/gi, " ");
	
	// this is usually the greyed out footer/signature in gmail emails, so remove it :)
	//html = html.replace(/<font color=\"#888888\">.*<\/font>/gi, "");
	
	// this is apparently the quoted text
	//html = html.replace(/<font color=\"#550055\">.*<\/font>/gi, "");
	
	var text = html.htmlToText();
	
	// repace new lines with space
	text = text.replace(/\n/g, " ");
	
	// remove 2+ consecutive spaces
	text = text.replace(/\s\s+/g, " ");
	
	return $.trim(text);
}

// parse a string...
// english Wed, Jan 25, 2012 at 1:53 PM
// danish 10. mar. 2012 13.00
// slovak 26. júna 2012 14:07
// english (UK) 22 July 2012 12:16
function parseGoogleDate(dateStr) {
	var d = new Date();

	var pieces = dateStr.match(/(\d\d?).*(\d\d\d\d)/);
	if (pieces) {
		var dateOfMonth = pieces[1];
		var year = pieces[2];
		d.setDate(dateOfMonth);
		
		// try to get month
		var monthFound = false;
		//var pieces2 = dateStr.match(/([A-Z][a-z][a-z]) \d/);
		var pieces2 = dateStr.match(/([^ 0-9]{3}[^ 0-9]*) \d/); // atleast 3 non digits ie. letters or more ie. Feb OR  Feb. OR February
		if (pieces2 && pieces2.length >= 2) {
			var shortMonthName = pieces2[1];
			shortMonthName = shortMonthName.replace(".", "").substring(0, 3).toLowerCase();
			
			for (var a=0; a<dateFormat.i18n.monthNamesShort.length; a++) {
				if (dateFormat.i18n.monthNamesShort[a].toLowerCase().substring(0, 3) == shortMonthName) {
					d.setMonth(a);
					monthFound = true;
					break;
				}
			}
			
			/*
			var monthIndex = dateFormat.i18n.monthNamesShort.indexOf(shortMonthName);
			if (monthIndex != -1) {
				d.setMonth(monthIndex);
				monthFound = true;
			}
			*/
		}
		
		if (!monthFound) {
			// since couldn't detect the month str we assume it's this month but if the dateof the month is larger than today let's assume it's last month
			if (year == d.getFullYear() && dateOfMonth > d.getDate()) {
				d.setMonth(d.getMonth()-1);
			}
		}
		d.setFullYear(year);
		
		// now get the time
		var timeObj = dateStr.parseTime();
		if (timeObj) {		
			// merge date and time
			d.setHours(timeObj.getHours());
			d.setMinutes(timeObj.getMinutes());
			d.setSeconds(timeObj.getSeconds());
			return d;
		} else {
			// could not find time in str
			return null;
		}
	}	
	return null;
}

function initButtons(buttons) {
	if (!buttons) {
		buttons = Settings.read("buttons");
	}
	
	$("html").removeClass("buttonsoriginal");
	$("html").removeClass("buttonsgreen");
	$("html").removeClass("buttonsdark");
	$("html").removeClass("buttonscustom");
	
	$("html").addClass("buttons" + buttons);
	
	if (buttons == "custom") {
		var $images = $('.button div:empty');
		var $text = $('.button div:not(:empty)');
		
		$images.css('-webkit-filter', Settings.read("buttonFilter"));
		$text.css('-webkit-filter', Settings.read("buttonFilter").replace(/drop-shadow.*?\)/, ""));
	} else {
		$(".button div").css('-webkit-filter', "");
	}

}

function showHideButtons() {
	
	var buttonCount = 0;
	
	// show/hide buttons
	if (Settings.read("showStar")) {
		// not a button so don't count
	} else {
		$(".mail .star, .basicNotificationWindow .star").hide();
	}
	if (Settings.read("showArchive")) {
		buttonCount++;
	} else {
		$(".mail .archive, .basicNotificationWindow .archive").hide();
	}
	if (Settings.read("showSpam")) {
		buttonCount++;
	} else {
		$(".mail .spam, .basicNotificationWindow .spam").hide();
	}
	if (Settings.read("showDelete")) {
		buttonCount++;
	} else {
		$(".mail .delete, .basicNotificationWindow .delete").hide();
	}
	if (Settings.read("showReply")) {
		buttonCount++;
	} else {
		$(".mail .reply, .basicNotificationWindow .reply").hide();
	}
	if (Settings.read("showOpen")) {
		buttonCount++;
	} else {
		$(".mail .open, .basicNotificationWindow .open").hide();
	}
	if (Settings.read("showMarkAsRead")) {
		buttonCount++;
	} else {
		$(".mail .markAsRead").addClass("alwaysHide");
	}
	if (Settings.read("showMarkAsUnread")) {
		// don't count this one
	} else {
		$(".mail .markAsUnread").addClass("alwaysHide");
	}
	
	if (Settings.read("showStar") || buttonCount >= 5) {
		$("html").addClass("lotsOfButtons");
	}
}

function setAccountGradient($node, colorStart, colorEnd) {
	$node.css("background-image", "-webkit-gradient( linear, left bottom, right bottom, color-stop(0.28, " + colorStart + "), color-stop(0.64, " + colorEnd + "))");
}

function isMutedByDuration() {
	return localStorage.muteVoiceEndTime && nowInMillis() < new Date(localStorage.muteVoiceEndTime).getTime();
}

function getPopupWindowSpecs(params) {
	params = initUndefinedObject(params);
	if (!params.window) {
		params.window = window;
	}
	var specs = "";
	if (Settings.read("setPositionAndSize") || params.testingOnly) {
		specs += "left=" + (params.window.screen.availLeft+parseInt(Settings.read("popupLeft"))) + ",";
		specs += "top=" + (params.window.screen.availTop+parseInt(Settings.read("popupTop"))) + ",";
		specs += "width=" + Settings.read("popupWidth") + ",";
		specs += "height=" + Settings.read("popupHeight") + ",";
	} else {
		if (!params.width) {
			params.width = 640; 
		}
		if (!params.height) {
			params.height = 580; 
		}
	   
		specs += "left=" + (params.window.screen.availLeft+(params.window.screen.width/2)-(params.width/2)) + ",";
		specs += "top=" + (params.window.screen.availTop+(params.window.screen.height/2)-(params.height/2)) + ",";
		specs += "width=" + params.width + ",";
		specs += "height=" + params.height + ",";
	}
	return specs;
}

function openTabOrPopup(params) {
	if (params.account && params.account.id == UNSYNCHED_ACCOUNT_ID) {
		chrome.tabs.create({url:params.account.getMailUrl()});
	} else {
		if (Settings.read("openComposeReplyAction") == "tab") {
			chrome.tabs.create({url:params.url});
		} else {
			var specs = getPopupWindowSpecs(params);
			if (!params.window) {
				params.window = window;
			}
			params.window.open(params.url, params.name, specs);
		}
	}
} 

function ensureUserHasUnreadEmails(callback) {
	if (bg.unreadCount) {
		callback({hasUnreadEmails:true});
	} else {
		bg.pollAccounts(function() {
			callback({hasUnreadEmails:bg.unreadCount});
		});
	}
}

function getAnyUnreadMail() {
	var unreadMail;
	$.each(bg.accounts, function(i, account) {
		if (!account.error) {
			if (account.getUnreadCount() > 0) {
				unreadMail = account.getMail().first();
				// exit loop
				return false;
			}
		}
	});
	return unreadMail;
}

function showNotificationTest(params, callback) {
	params = initUndefinedObject(params);
	
	ensureUserHasUnreadEmails(function(response) {
		if (response.hasUnreadEmails) {
			
			if (params.showAll) {
				// fetch all unread emails
				params.emails = getAllUnreadMail(bg.accounts);
			} else {
				// first only one unread email			
				var email;
				if (bg.accountWithNewestMail) {
					email = bg.accountWithNewestMail.getNewestMail();			
					if (!email) {
						// else get most recent mail (not the newest because it might not have been fetch recently, this shwnotif could be done after a idle etc.)
						email = bg.accountWithNewestMail.getMail().first();
					}
				}
				if (!email) {
					email = getAnyUnreadMail();
				}
				
				// put one email into array to pass to shownotification
				params.emails = [email];
			}
			
			function showNotificationNow() {
				bg.showNotification(params, function(response) {
					if (response && response.warning) {
						niceAlert(response.warning);
					}
					callback();
				});
			}
			
			if (bg.notification) {
				bg.notification.cancel();
				setTimeout(function() {
					showNotificationNow();
				}, 500);
			} else {
				showNotificationNow();				
			}
		} else {
			niceAlert(params.requirementText, callback);
		}
	});
}

function insertSpeechRecognition(tabId) {
	chrome.tabs.insertCSS(tabId, {file:"css/speechRecognition.css"}, function() {
		chrome.tabs.executeScript(tabId, {file:"js/jquery.min.js"}, function() {
			chrome.tabs.executeScript(tabId, {file:"js/speechRecognition.js", allFrames:false});
		});
	});
}

function daysElapsedSinceFirstInstalled() {
	var installDate = bg.Settings.read("installDate");
	if (installDate) {
		try {
			installDate = new Date(installDate);
		} catch (e) {}
		if (installDate) {
			return Math.abs(installDate.diffInDays());
		}
	}
	return -1;
}

function isEligibleForReducedDonation(mightBeShown) {
	
	if (TEST_REDUCED_DONATION) {
		return true;
	}
	
	// not eligable if we already d or we haven't verified payment
	if (pref("donationClicked") || !localStorage["verifyPaymentRequestSentForReducedDonation"]) {
		return false;
	} else {
		// must be older than 50 days
		if (daysElapsedSinceFirstInstalled() >= 50) {
			
			// when called from shouldShowReducedDonationMsg then we can assume we are going to show the ad so let's initialize the daysElapsedSinceEligible
			if (mightBeShown) {
				// stamp this is as first time eligibility shown
				var daysElapsedSinceEligible = localStorage.daysElapsedSinceEligible;
				if (!daysElapsedSinceEligible) {
					localStorage.daysElapsedSinceEligible = new Date();				
				}
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
			if (Math.abs(daysElapsedSinceEligible.diffInDays()) <= 7) {
				return false;
			} else {
				return true;
			}
		}
		return false;
	}
}

function shouldShowReducedDonationMsg() {
	return isEligibleForReducedDonation(true) && !isEligibleForReducedDonationAdExpired();
}

function verifyPayment(accounts, callback) {
	var emails = new Array();
	$.each(accounts, function(i, account) {
		emails.push(account.getAddress());
	});

	bg.Controller.verifyPayment(bg.itemID, emails, callback);
}

function parseAddresses(addresses) {
	var parsedAddresses = [];
	
	if (addresses) {
		var addressesArray = addresses.split(",");
		$.each(addressesArray, function(index, address) {
			address = address.replace(/\n/g, "")
			
			var fromName = address.split("<")[0];
			fromName = fromName.split("@")[0];
			
			fromName = fromName.replace(/\"/g, "");
			fromName = fromName.replace(/</g, "");
			fromName = fromName.replace(/>/g, "");
			fromName = fromName.replace("&quote;", "");
			fromName = $.trim(fromName);
	
			var fromEmail = extractEmails(address);
			if (fromEmail) {
				// returns array so convert to string
				fromEmail = fromEmail.first();
			}
			
			parsedAddresses.push({name:fromName, email:fromEmail});
		});
	}
	
   	return parsedAddresses;
}

function pretifyRecipientDisplay(recipientObj, meEmailAddress) {
	// it's this account's email so put 'me' instead
	if (recipientObj.email && recipientObj.email.equalsIgnoreCase(meEmailAddress)) {
		return getMessage("me");
	} else {
		if (!recipientObj.name) {
			recipientObj.name = recipientObj.email;
		}
		var firstName = $.trim(recipientObj.name).split(" ")[0].split("@")[0];
		return firstName;
	}
}

function fullRecipientDisplay(recipientObj) {
	var str = "";
	if (recipientObj.name) {
		str = recipientObj.name + " ";
	}
	
	str += "&lt;" + recipientObj.email + "&gt;";
	return str;
}

function getSignedInGmailEmails(params, callback) {
	
	var signedInGmailEmails = Settings.read("signedInGmailEmails");
	if (!params.forceResyncAccounts && signedInGmailEmails) {
		console.log("getSignedInGmailEmails [from cache]");
		callback({emails:signedInGmailEmails});
		return;
	} else {
		console.log("getSignedInGmailEmails");
	}
	
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
					   	// patch because <title> tag could contain a label with a '@' that is not an email address ie. Gmail - Label '@test@' for blah@gmail.com
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
						Settings.store("signedInGmailEmails", params.emails);
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

function syncSignedInAccountNumbers(params, callback) {	
	console.log("syncSignedInAccountNumbers");
	getSignedInGmailEmails(params, function(params) {
		if (params.error) {
			callback(params);
		} else {
			console.log("gmail emails: ", params.emails);
			
			$.each(accounts, function(index, account) {
				var accountMatchedSignedInEmail = false;
				console.log("account", account);
				$.each(params.emails, function(signedInEmailIndex, signedInEmail) {
					console.log("signedInEmail", signedInEmail);
					if (account.getAddress().equalsIgnoreCase(signedInEmail)) {
						console.log("signedInEmailIndex", signedInEmailIndex);
						account.setAccountId(signedInEmailIndex);
						accountMatchedSignedInEmail = true;
					}
				});
				if (!accountMatchedSignedInEmail) {
					// this is account is not detected so set an unmatch index to force google's sign in page
					account.setAccountId(UNSYNCHED_ACCOUNT_ID);
				}
			});
			
			callback(params);
		}
	});
}

function generateNotificationDisplayName(mail) {
	var fromName = mail.authorNameUnsafeForHtml;
	if (Settings.read("notificationDisplayName") == "firstNameOnly") {		
		return fromName.split(" ")[0];
	} else {
		return fromName;
	}
}

// point relative links ONLY to gmail.com
function fixRelativeLinks($node) {
	$node.find("a, img, imghidden").each(function() {
		var href = $(this).attr("href");
		var src = $(this).attr("src");
		if (href && href.indexOf("/") == 0) {
			$(this).attr("href", "https://mail.google.com" + href);
			// these are hosted on mail.google.com so the are safe to show
			if ($(this).get(0).tagName == "IMGHIDDEN") {
				$(this).changeNode("img");
			}
		} else if (src && src.indexOf("/") == 0) {
			$(this).attr("src", "https://mail.google.com" + src);
			// these are hosted on mail.google.com so the are safe to show
			if ($(this).get(0).tagName == "IMGHIDDEN") {
				$(this).changeNode("img");
			}
		}
	});
}

function getAllUnreadMail(accounts) {
	var allUnreadMails = [];
	$.each(accounts, function(index, account) {
		allUnreadMails = allUnreadMails.concat(account.getMail());
	});
	return allUnreadMails;
}