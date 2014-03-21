// Copyright 2014 Jason Savard

var localeMessages;
var email;
var itemID = "GmailChecker";
var img_notLoggedInSrc = "not_logged_in";
var iconSet = "default";
var iconFormat = ".png";
var accounts = new Array();
var ignoredAccounts = new Array();
var previousAccounts = new Array();
var pollingAccounts = false;

var unreadCount;
var accountWithNewestMail;
var lastShowNotificationDates = new Array();

var canvas;
var canvasContext;
var gfx;
var rotation = 1;
var factor = 1;
var animTimer;
var loopTimer;
var animDelay = 40;

var notificationAudio;
var lastNotificationAudioSource;

var oAuthForEmails;
var oAuthForContacts;

var subjects = new Array();
var notification;
var unreadCountWhenShowNotificationWhileActive;
var lastPollAccounts = new Date(1);
var loadedSettings = false;
var pokerListenerLastPokeTime = new Date(1);
var checkEmailTimer;
var signedIntoAccounts;
var richNotifId;
var richNotifMails = [];
var richNotifButtonsWithValues;
var lastShowNotifParams;
var lastExtensionUpdateNotificationShownDate = new Date(1);
var unauthorizedAccounts;
var checkingEmails = false;

// init objects once in this background page and read them from all other views (html/popup/notification pages etc.)
ChromeTTS();
Tools();
Controller();
var detectSleepMode = new DetectSleepMode(function() {
	// wakeup from sleep mode action...
	if (hasAtleastOneSuccessfullAccount(accounts)) {
		console.log("hasAtleastOneSuccessfullAccount - so don't check")
	} else {
		checkEmails("wakeupFromSleep");
	}
});

function getSettings() {
   return Settings;
}

// seems alert()'s can stop the oninstalled from being called
chrome.runtime.onInstalled.addListener(function(details) {
	console.log("onInstalled: " + details.reason);
	
	if (details.reason == "install") {
		// Note: Install dates only as old as implementation of this today, Dec 14th 2013
		Settings.store("installDate", new Date());
		Settings.store("installVersion", chrome.runtime.getManifest().version);
		chrome.tabs.create({url: "options.html?install=true"});
	} else if (details.reason == "update") {
		// seems that Reloading extension from extension page will trigger an onIntalled with reason "update"
		// so let's make sure this is a real version update by comparing versions
		if (details.previousVersion != chrome.runtime.getManifest().version) {
			console.log("real version changed");
			// extension has been updated to let's resync the data and save the new extension version in the sync data (to make obsolete any old sync data)
			// but let's wait about 60 minutes for (if) any new settings have been altered in this new extension version before saving syncing them
			chrome.alarms.create("extensionUpdatedSync", {delayInMinutes:60});
			
			// LEGACY - Let's sync old users data before i implemented the current syncing logic upon on storage change events etc.
			//if (localStorage["installVersion"] <= 13.10 && !localStorage.lastSyncOptionsSave) {
				//syncOptions.save("sync old users data");
			//}
		}
		
		var previousVersionObj = parseVersionString(details.previousVersion)
		var currentVersionObj = parseVersionString(chrome.runtime.getManifest().version);
		if (!localStorage.disabledExtensionUpdateNotifications && (previousVersionObj.major != currentVersionObj.major || previousVersionObj.minor != currentVersionObj.minor)) {

			if (details.previousVersion != "16.5") { // details.previousVersion != "16.2" && details.previousVersion != "16.3" && details.previousVersion != "16.4"
				var options = {
						type: "basic",
						title: getMessage("extensionUpdated"),
						message: "Checker Plus for Gmail " + chrome.runtime.getManifest().version,
						iconUrl: "images/icons/icon_128_whitebg.png",
						buttons: [{title: getMessage("seeUpdates"), iconUrl: "images/notifButtons/exclamation.png"}, {title: getMessage("doNotNotifyMeOfUpdates"), iconUrl: "images/notifButtons/cancel.png"}]
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

	}
	
	sendGA(['_trackEvent', "extensionVersion", chrome.runtime.getManifest().version, details.reason]);
});

$(document).ready(function() {
	init();
});

function startAnimate() {
	if (Settings.read("animateButtonIcon") === true) {
		gfx.src = "images/browserButtons/" + iconSet + "/new" + iconFormat;
		stopAnimateLoop();
		animTimer = setInterval(doAnimate, animDelay);
		setTimeout(stopAnimate, 2000);
		loopTimer = setTimeout(startAnimate, 20000);
	}
}

function stopAnimate() {
   if (animTimer != null) {
      clearInterval(animTimer);
   }      
   setIcon(currentIcon);
   rotation = 1;
   factor = 1;
}

function stopAnimateLoop() {
   if (loopTimer != null) {
      clearTimeout(loopTimer);
   }
   stopAnimate();
}

function doAnimate() {
   canvasContext.save();
   canvasContext.clearRect(0, 0, canvas.width, canvas.height);
   canvasContext.translate(Math.ceil(canvas.width / 2), Math.ceil(canvas.height / 2));
   canvasContext.rotate(rotation * 2 * Math.PI);
   canvasContext.drawImage(gfx, -Math.ceil(canvas.width / 2), -Math.ceil(canvas.height / 2));
   canvasContext.restore();

   rotation += 0.03 * factor;

   if (rotation <= 0.9 && factor < 0)
      factor = 1;
   else if (rotation >= 1.1 && factor > 0)
      factor = -1;

   chrome.browserAction.setIcon({
      imageData: canvasContext.getImageData(0, 0, canvas.width, canvas.height)
   });
}

// make sure atleast one email in this group of unread has the setting to be shown in a notification
function oneMailHasThisSetting(settingsName, defaultObj) {
	for (var a=0; a<accounts.length; a++) {
		var account = accounts[a];
		var emails = account.getMail();
		for (var b=0; b<emails.length; b++) {
			var accountMail = emails[b];
			var settingValue = getSettingValueForLabels(account.getSetting(settingsName), accountMail.labels, defaultObj);
			if (settingValue) {
				return true;
			}
		}
	}
}

function maybeAppendAllMsg(msg, emails) {
	if (emails.length == 1) {
		return msg;
	} else {
		return msg + " (" + getMessage("all") + ")";
	}
}

function generateNotificationButton(buttons, buttonsWithValues, value, emails) {
	if (value) {
		var button;
		
		if (value == "markAsRead") {
			button = {title:maybeAppendAllMsg(getMessage("readLink"), emails), iconUrl:"images/notifButtons/checkmark.png"};
		} else if (value == "delete") {
			button = {title:maybeAppendAllMsg(getMessage("delete"), emails), iconUrl:"images/notifButtons/trash.png"};
		} else if (value == "archive") {
			button = {title:maybeAppendAllMsg(getMessage("archiveLink"), emails), iconUrl:"images/notifButtons/archive.png"};
		} else if (value == "spam") {
			button = {title:maybeAppendAllMsg(getMessage("spamLinkTitle"), emails), iconUrl:"images/notifButtons/spam.png"};
		} else if (value == "star") {
			button = {title:maybeAppendAllMsg(getMessage("starLinkTitle"), emails), iconUrl:"images/star-hover4.png"};
		} else if (value == "open") {
			button = {title:getMessage("open"), iconUrl:"images/notifButtons/open.png"};
		} else if (value == "openInNewTab") {
			button = {title:getMessage("open"), iconUrl:"images/notifButtons/open.png"};
		} else if (value == "openInPopup") {
			button = {title:getMessage("open"), iconUrl:"images/notifButtons/open.png"};
		} else if (value == "reply") {
			button = {title:getMessage("reply"), iconUrl:"images/notifButtons/reply.png"};
		} else if (value == "replyInPopup") {
			button = {title:getMessage("reply"), iconUrl:"images/notifButtons/reply.png"};
		} else if (value == "reducedDonationAd") {
			button = {title:getMessage("reducedDonationAd_notification", "50¢")};
		}

		if (button) {
			buttons.push(button);
			
			var buttonWithValue = clone(button);
			buttonWithValue.value = value;
			buttonsWithValues.push(buttonWithValue);
		}
	}
}

function clearRichNotification(notificationId, callback) {
	if (notificationId) {
		if (!callback) {
			callback = function() {};
		}
		chrome.notifications.clear(notificationId, function() {
			richNotifMails = [];
			callback();
		});
	}
}

// watch out for returns here, we don't want to callback twice or not callback at all!
function fetchEmailImagePreview(options, mail, callback) {
	if (Settings.read("showNotificationEmailImagePreview")) {
		if (mail.messages && mail.messages.last()) {
			var $messageContent = $("<div>" + mail.messages.last().content + "</div>");
			fixRelativeLinks($messageContent);
			var $firstImage = $messageContent.find("img").first();			
			var src = $firstImage.attr("src");
			//src = $messageContent.find("imghidden").first().attr("src");
			
			// .vcf icon = https://mail.google.com/mail/u/0/images/generic.gif
			// .wav icon = https://mail.google.com/mail/u/0/images/sound.gif
			
			console.log("firstimage: ", $firstImage, src);
			
			// image domain host must be in permissions manifest or else notifications.create gives me download image errors and notification does not appear!
			
			var imageRemovedBySender = false;
			if ($firstImage.attr("alt") && $firstImage.attr("alt").indexOf("Image removed by sender") != -1) {
				imageRemovedBySender = true;
			}			 
			
			if (src && src.parseUrl().hostname.indexOf(".google.com") != -1 && src.indexOf("/images/") == -1 && !imageRemovedBySender) {
				
				options.type = "image";
				// assign default low res embedded image
				options.imageUrl = src;
				
				// see if we can change that default image with hig res image
				if (src.indexOf("disp=thd") != -1) {
					chrome.permissions.contains({
						origins: ["*://*.googleusercontent.com/*"]
					}, function(result) {
						if (result) {
							var fullImageImage = new Image();
							var fullImageSrc = src.replace("disp=thd", "disp=inline");
							//fullImageSrc = "http://l.yimg.com/rz/d/yahoo_frontpage_en-CA_s_f_p_101x50_frontpage.png";
							
							$.ajax(fullImageSrc)
								.done(function(data, textStatus, jqXHR) {
									options.imageUrl = fullImageSrc;
									callback();
								})
								.fail(function(jqXHR, textStatus) {
									logError("could not load preview image: " + textStatus, jqXHR);
									callback();
								})
							;
							/*
							$(fullImageImage).on("load", function() {
								//fullImageSrc= "https://mail-attachment.googleusercontent.com/attachment/u/0/?view=att&th=142595dfa23b60f0&attid=0.1&disp=inline&realattid=f_ho0qx1l20&safe=1&zw&saduie=AG9B_P8W9dfiN6DB7FhUGrvwjbTz&sadet=1384522175671&sads=PL7GYhhC5Lezy7Qye-WMJhH1VQY";
								fullImageSrc = "http://abc.comm";
								console.log("full image src: " + fullImageSrc)
								options.imageUrl = fullImageSrc;
								callback();
							}).on("error", function(e) {
								logError("could not load preview image: " + e);
								callback();
							});
							fullImageImage.src = fullImageSrc;
							*/							
						} else {
							callback();
						}
					});
					// because we return here, make sure we call callback everywhere before this line
					return;
				}
			}
		}
	}
	callback();
}

function showNotification(params, callback) {
	
	var notificationDisplay = Settings.read("notificationDisplay");
	
	if (!params) {
		params = {};
	}

	if (!callback) {
		callback = function () {};
	}

	if (Settings.read("desktopNotification")) {

		var firstEmail;
		if (params.emails) {
			firstEmail = params.emails.first();
		}
		if (!firstEmail) {
			logError("called showNotif but could not find any emails?");
			callback();
			return;
		}
		
		// not notification handle
		if (notification) {
			chrome.runtime.sendMessage({name:"addNewNotifications"}, function(response) {});
			callback();
		} else {
			var NOTIFICATION_DISABLE_WARNING = "Normally a notification for this email or some of these emails will not appear because you unchecked the notification in your Accounts/Labels settings for this particular email/label";
			
			var notificationFlagForLabelsOfNewestEmail;
			if (firstEmail) {
				notificationFlagForLabelsOfNewestEmail = getSettingValueForLabels(firstEmail.account.getSetting("notifications"), firstEmail.labels, Settings.read("desktopNotification"));
			}			

			var textNotification = params.testType == "text" || (params.testType == undefined && Settings.read("notificationWindowType") == "text");
			var richNotification = params.testType == "rich" || (params.testType == undefined && Settings.read("notificationWindowType") == "rich");

			if (textNotification || !chrome.notifications) {
				// text window
				if (notificationFlagForLabelsOfNewestEmail || params.testType) {					
					var fromName = generateNotificationDisplayName(firstEmail);
					
					var $div = $("<div/>");
					
					$div.html(firstEmail.title);
					var subject = $div.text();
					
					$div.html(firstEmail.getLastMessageText());
					var body = $div.text().summarize(101);
	
					if (window.webkitNotifications) {
						
						var title = "";
						
						if (accounts.length >= 2) {
							title = firstEmail.account.getEmailDisplayName() + "\n";
						}
						
						if (notificationDisplay == "newEmail") {
							title += getMessage("newEmail");
							body = "";
						} else if (notificationDisplay == "from") {
							title += fromName;
							body = "";
						} else if (notificationDisplay == "from|subject") {
							title += fromName
							body = subject;
						} else {
							title += getMessage("textNotificationTitle", [fromName, subject]);
						}
						
						notification = webkitNotifications.createNotification("/images/icons/icon_48.png", title, body);
						notification.mail = firstEmail;
						notification.onclick = function() {
							firstEmail.open();
							if (notification) {
								notification.cancel();
							}
						}
						
						var notificationCloseTimeout = Settings.read("dn_timeout");
						if (notificationCloseTimeout != 0) {
							setTimeout(function () {
								if (notification) {
									notification.cancel();
								}
							}, notificationCloseTimeout);
						}
					} else {
						console.warn("webkitNotifications does not exist");
						callback();
						return;
					}
				} else {
					console.warn("Notification disabled for this email");
					callback();
					return;
				}
			} else if (richNotification) {
				// rich notif
				
				console.log("rich params: ", params);

				var iconUrl = "images/icons/icon_128_whitebg.png";
				
				var buttons = [];
				var buttonsWithValues = []; // used to associate button values inside notification object
				var buttonValue;
				
				buttonValue = Settings.read("notificationButton1");
				generateNotificationButton(buttons, buttonsWithValues, buttonValue, params.emails);
				
				var buttonValue;
				if (shouldShowReducedDonationMsg()) {
					buttonValue = "reducedDonationAd";
				} else {
					buttonValue = Settings.read("notificationButton2");
				}				
				generateNotificationButton(buttons, buttonsWithValues, buttonValue, params.emails);
				
				var options;

				if (params.emails.length == 1) {
					// single email
					
					if (notificationFlagForLabelsOfNewestEmail || params.testType) {
						var fromName = generateNotificationDisplayName(firstEmail);
	
						var $div = $("<div/>");
						
						var subject = "";
						if (firstEmail.title) {
							subject = firstEmail.title.htmlToText();
						}
	
						var title = "";
						var message = firstEmail.getLastMessageText({maxSummaryLetters:170, htmlToText:true, EOM_Message:" [" + getMessage("EOM") + "]"});
						if (!message) {
							message = "";
						}
						
						if (accounts.length >= 2) {
							title = firstEmail.account.getEmailDisplayName() + "\n";
						}
						
						if (notificationDisplay == "newEmail") {
							title += getMessage("newEmail");
							message = "";
						} else if (notificationDisplay == "from") {
							title += fromName;
							message = "";
						} else if (notificationDisplay == "from|subject") {
							title += fromName
							message = subject;
						} else {
							title += getMessage("textNotificationTitle", [fromName, subject]);
						}
						
						options = {
								type: "basic",
								title: title, //"Jason - Soccer tonight", 
								message: message, //"Meet me at the field before the game because we are playing against a very good team.",
								buttons: buttons,
								iconUrl: iconUrl
						}
						
						fetchEmailImagePreview(options, firstEmail, function() {
							preloadProfilePhotos(params.emails, function () {
								var email = params.emails.first();
								if (email.contactPhoto && email.contactPhoto.src) {
									console.log("iconUrl: " + email.contactPhoto.src);
									options.iconUrl = email.contactPhoto.src;
								}
								openNotification(options, buttonsWithValues, params.emails);
								
								if (notificationFlagForLabelsOfNewestEmail) {
									callback();
								} else {
									callback({warning:NOTIFICATION_DISABLE_WARNING});
								}
							});
						});
					} else {
						console.warn("Notification disabled for this email");
						callback();
						return;
					}
				} else {
					// multiple emails

					// seems linux user are getting empty notifications when using the type='image' (refer to denis sorn) so force them to use type="basic"
					//var patchForLinuxUsers = navigator.userAgent.toLowerCase().indexOf("linux") != -1;

					if (true) { // list notification
						var items = [];
						
						$.each(params.emails, function(index, email) {
							
							console.log("item.push:", email);
							
							var subject = email.title;
							if (subject) {
								subject = subject.htmlToText();
							}
							if (!subject) {
								subject = "";
							}
							
							var item = {};
							
							if (notificationDisplay == "from") {
								item.title = generateNotificationDisplayName(email);
								item.message = "";
							} else if (notificationDisplay == "from|subject") {
								item.title = generateNotificationDisplayName(email);
								item.message = subject;
							} else {
								item.title = getMessage("textNotificationTitle", [generateNotificationDisplayName(email), subject])
								var message = email.getLastMessageText();
								if (message) {
									message = message.htmlToText();
								}
								if (!message) {
									message = "";
								}
								item.message = message;
							}
							
							items.push(item);
						});
						
						if (notificationDisplay == "newEmail") {
							options = {
									type: "basic",
									title: getMessage("XNewEmails", [params.emails.length]),
									message: "",
									buttons: buttons,
									iconUrl: iconUrl
							}
						} else {
							options = {
									type: "list",
									title: getMessage("XNewEmails", [params.emails.length]),
									message: "test",
									buttons: buttons,
									iconUrl: iconUrl,
									items: items
							}
						}
						
						openNotification(options, buttonsWithValues, params.emails);
						callback();

					} else { // image notification
						var tempCanvas = document.getElementById("tempCanvas");
						var notificationCanvas = document.getElementById("notificationCanvas");
						var context = notificationCanvas.getContext("2d");
						
						var MAX_NOTIFICATION_WIDTH = 360;
						var MAX_NOTIFICATION_HEIGHT = 160;
						var EVENT_X_LEFT_BUFFER = 6;
						var EVENT_X_LEFT_BUFFER_WITH_DASHES = 8;
						var EVENT_X_RIGHT_BUFFER = 8;
						var EVENT_Y_SPACING = 2;
						var SMALL_FONT_X_BUFFER = 7;
						var BOTTOM_BUFFER = 2;
						var TITLE_FONT = "14px Georgia";
						var BODY_FONT = "12px Arial";
						var MAX_EMAILS = 5;
						
						var MAX_TITLE_WIDTH_PERCENT = 0.88; // with no time elapsed
						var MAX_TITLE_WITH_TIME_ELAPSED_WIDTH_PERCENT = 0.75; // with time elapsed
						
						var x;
						var y = -4;
						
						// note: changing width/height after will blank out the canvas
						notificationCanvas.width = tempCanvas.width = MAX_NOTIFICATION_WIDTH;
						notificationCanvas.height = tempCanvas.height = 2000;
						
						// filter out any emails that don't have a notification flag
						var someEmailsDidNotPassTheNotificationFlag;						
						for (var a=0; a<params.emails.length; a++) {
							var notificationFlagEnabled = getSettingValueForLabels(params.emails[a].account.getSetting("notifications"), params.emails[a].labels, Settings.read("desktopNotification"));
							if (!notificationFlagEnabled) {
								if (!params.testType) {
									console.warn("Disable notification for this email: " + params.emails[a].title);
									params.emails.splice(a, 1);
									a--;
								}
								someEmailsDidNotPassTheNotificationFlag = true;
							}
						}

						if (params.emails.length) {
							preloadProfilePhotos(params.emails, function () {
								console.log("after preload: ", params.emails);

								$.each(params.emails, function(index, email) {
	
									x = EVENT_X_LEFT_BUFFER;
	
									if (index >= MAX_EMAILS) {
										context.fillStyle = "black";
										context.fillText(params.emails.length - index + " " + getMessage("more") + " ...", x+38, y+2);
										y += 25;
										return false;
									}
									
									console.log("item.push:", email);
									
									if (Settings.read("showContactPhoto")) {
										var contactPhoto = new Image();
										
										if (email.contactPhoto) {
											notificationCanvas.getContext('2d').drawImage(email.contactPhoto, x, y, 32, 32);
										} else {
											notificationCanvas.getContext('2d').drawImage($("#noPhoto").get(0), x, y+4, 32, 32);
										}
										x += 41;
									} else {
										x += 10;
									}
									
									// calculate how much text we can fit on the line
	
									var message = email.title;
									if (message) {
										message = message.htmlToText();
									}
									
									// if subject is empty use email body
									if (!message) {
										message = email.getLastMessageText();
										if (message) {
											message = message.htmlToText();
										}
									}
									
									context.textBaseline = "top";
									context.font = TITLE_FONT;
									context.fillStyle = "black";

									var notificationEmailLine;
									
									var body = email.getLastMessageText();
									if (body) {
										body = body.htmlToText();
									}
									if (body) {
										body = body.summarize(55);
									} else {
										body = "";
									}
									
									if (notificationDisplay == "from") {
										notificationEmailLine = generateNotificationDisplayName(email);
										body = "";
									} else if (notificationDisplay == "from|subject") {
										notificationEmailLine = generateNotificationDisplayName(email)
										body = message;
									} else {
										notificationEmailLine = getMessage("textNotificationTitle", [generateNotificationDisplayName(email), message]);
									}

									var maxLetters = notificationEmailLine.length * (MAX_NOTIFICATION_WIDTH / (context.measureText(notificationEmailLine).width + x));
									if (x + context.measureText(notificationEmailLine).width >= MAX_NOTIFICATION_WIDTH * MAX_TITLE_WIDTH_PERCENT) {
										notificationEmailLine = notificationEmailLine.substring(0, maxLetters * MAX_TITLE_WIDTH_PERCENT) + "…";
									}
									
									context.fillText(notificationEmailLine, x, y+1);
	
									context.font = BODY_FONT;
									context.fillStyle = "gray";
									context.fillText(body, x, y+18);
	
									x += context.measureText(notificationEmailLine).width + EVENT_X_RIGHT_BUFFER;
	
									y += getTextHeight(TITLE_FONT).height;
								});
								
								// save canvas to temp (because changing width/height after will blank out the canvas)
								tempCanvas.getContext('2d').drawImage(notificationCanvas, 0, 0);
								
								// resize new canvas
								notificationCanvas.height = y + BOTTOM_BUFFER;
								
								// copy temp canvas to new canvas
								notificationCanvas.getContext('2d').drawImage(tempCanvas, 0, 0, tempCanvas.width, notificationCanvas.height, 0, 0, notificationCanvas.width, notificationCanvas.height);
								var imageUrl = notificationCanvas.toDataURL("image/png");
								
								if (notificationDisplay == "newEmail") {
									options = {
											type: "basic",
											title: getMessage("XNewEmails", [params.emails.length]),
											message: "",
											buttons: buttons,
											iconUrl: iconUrl
									}									
								} else {
									options = {
											type: "image",
											title: getMessage("XNewEmails", [params.emails.length]),
											message: "",
											buttons: buttons,
											iconUrl: iconUrl,
											imageUrl: imageUrl
									}
								}
								
								openNotification(options, buttonsWithValues, params.emails);
								
								if (someEmailsDidNotPassTheNotificationFlag && params.testType) {
									callback({warning:NOTIFICATION_DISABLE_WARNING});
								} else {
									callback();									
								}
							});
						} else {
							if (someEmailsDidNotPassTheNotificationFlag) {
								console.warn("Notification disabled for these email");
							}								
							callback();
							return;
						}
					}

				}
			} else {
				logError("html notif does not exit anymore");
				callback();
				return;
			}				
			
			if (notification) {
				notification.onclose = function() {
					console.log("onclose notification");
					notification = null;
				}
				notification.show();
				callback();
			}
		}
	} else {
		callback();
	}
}

function openNotification(options, buttonsWithValues, newEmails) {
	// remove previous notifications
	clearRichNotification(richNotifId);
	
	// default is 0 if none below are matched...
	if (Settings.read("showNotificationDuration") == 7) {
		options.priority = 0;
	} else if (Settings.read("showNotificationDuration") > 7) {
		options.priority = 1;
	}
	
	if (Settings.read("notificationBehaviour") == "removeFromTray") {
		var notificationCloseTimeout = Settings.read("showNotificationDuration") * 1000;
		if (notificationCloseTimeout != 0) {
			setTimeout(function () {
				if (richNotifId) {
					console.log("timeout close notif");
					clearRichNotification(richNotifId);
				}
			}, notificationCloseTimeout);
		}
	}

	console.log("show notif", options);
	chrome.notifications.create("", options, function(notificationId) {
		if (chrome.extension.lastError) {
			logError("create error: " + chrome.extension.lastError.message);
		}
		richNotifId = notificationId;
		richNotifMails = newEmails;
		richNotifButtonsWithValues = buttonsWithValues;
	});
}

function getChromeWindowOrBackgroundMode(callback) {
	if (Settings.read("runInBackground")) {
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
}

function checkEmails(source, callback) {
	if (!callback) {
		callback = function() {};
	}
	
	getChromeWindowOrBackgroundMode(function(chromeWindowOrBackgroundMode) {
		if (chromeWindowOrBackgroundMode) {
			var intervalStopped = false;
			if (source == "wentOnline" || source == "wakeupFromSleep") {
				if (checkingEmails) {
					console.log("currently checking emails so bypass instant check");
					callback();
					return;
				} else {
					intervalStopped = true;
					console.log("check now for emails");
					// stop checking interval
					clearInterval(checkEmailTimer);
				}
			}
			
			checkingEmails = true;
			getAllEmails(accounts, function(allEmailsCallbackParams) {
				mailUpdate({showNotification:true, allEmailsCallbackParams:allEmailsCallbackParams});
				
				if (accounts.length) {
					previousAccounts = accounts;
				}

				checkingEmails = false;

				if (intervalStopped) {
					// resume checking interval
					restartCheckEmailTimer();
				}
				
				callback();
			});			
		} else {
			console.log("NO chromeWindowOrBackgroundMode - so do not check emails");
			callback();
		}
	});
}

function startCheckEmailTimer() {
	var pollIntervalTime = Settings.read("poll");
	
	// make sure it's not a string or empty because it will equate to 0 and thus run all the time!!!
	if (isNaN(pollIntervalTime)) {
		pollIntervalTime = 30 * ONE_SECOND;
	} else if (parseInt(pollIntervalTime) < (10 * ONE_SECOND)) { // make sure it's not too small like 0 or smaller than 10 seconds
		pollIntervalTime = 30 * ONE_SECOND;
	}
	
	checkEmailTimer = setInterval(function() {
		checkEmails("interval");
	}, pollIntervalTime);
}

function restartCheckEmailTimer() {
	console.log("restarting check email timer")
	clearInterval(checkEmailTimer);
	
	// wait a little bit before restarting timer to let it's last execution run fully
	setTimeout(function() {
		startCheckEmailTimer();
	}, 30 * ONE_SECOND)
}

function shortcutNotApplicableAtThisTime(title) {
	var notif = webkitNotifications.createNotification("/images/icons/icon_48.png", title, "Click here to remove this shortcut.");
	notif.onclick = function() {
		chrome.tabs.create({ url: "http://jasonsavard.com/wiki/Checker_Plus_for_Gmail#Keyboard_shortcuts" });
		this.cancel();
	}
	notif.show();
}

// execute action on all mails
function executeAction(mails, actionName) {

	var error;
	if (mails.length <= MAX_EMAILS_TO_ACTION) {
		$.each(mails, function(index, mail) {
			mail[actionName](function(cbParams) {
				if (cbParams.error) {
					error = true;
					alert("Sorry, problem completing action (" + cbParams.error + ")");
					logError("error in execute Action: " + cbParams.error);
				}
			});
			
			// break out of loop
			if (error) {
				return false;
			}
		});

		if (actionName != "star") {
			if ((unreadCount-mails.length) >= 0) {
				updateBadge(unreadCount-mails.length);
			}
		}
		
	} else {
		alert("Too many emails to " + actionName + " , please use the Gmail webpage!");
		mails.first().account.openInbox();
	}
}

function openInPopup(params) {
	var url = "popup.html?externalPopupWindow=true";
	if (params.richNotifMails.length == 1) {
		url += "&previewMailId=" + params.richNotifMails.first().id;
	}

	//openWindowInCenter(url, "_blank", "resizable=0,scrollbars=no", 860, 564);
	params.width = 860;
	params.height = 564;
	var specs = getPopupWindowSpecs(params);
	if (!params.window) {
		params.window = window;
	}
	params.window.open(url, "openInPopup", specs);

	clearRichNotification(params.notificationId);
}

function performButtonAction(params) {
	console.log("notificationButtonValue: " + params.notificationButtonValue);
	
	// actions...
	if (params.notificationButtonValue == "markAsRead") {
		executeAction(params.richNotifMails, "markAsRead");
		clearRichNotification(params.notificationId);
	} else if (params.notificationButtonValue == "delete") {
		executeAction(params.richNotifMails, "deleteEmail");
		clearRichNotification(params.notificationId);
	} else if (params.notificationButtonValue == "archive") {
		executeAction(params.richNotifMails, "archive");
		clearRichNotification(params.notificationId);
	} else if (params.notificationButtonValue == "spam") {
		executeAction(params.richNotifMails, "markAsSpam");
		clearRichNotification(params.notificationId);
	} else if (params.notificationButtonValue == "star") {
		executeAction(params.richNotifMails, "star");
		clearRichNotification(params.notificationId);
	} else if (params.notificationButtonValue == "open" || params.notificationButtonValue == "openInNewTab") {
		
		var openParams = {};
		if (params.notificationButtonValue == "openInNewTab") {
			openParams.openInNewTab = true;
		}
		
		if (params.richNotifMails.length == 1) {
			params.richNotifMails.first().open(openParams);
		} else {
			params.richNotifMails.first().account.openInbox(openParams);
		}
		clearRichNotification(params.notificationId);
	} else if (params.notificationButtonValue == "openInPopup") {
		openInPopup(params);
	} else if (params.notificationButtonValue == "replyInPopup") {
		openInPopup(params);
	} else if (params.notificationButtonValue == "reply") {
		if (params.richNotifMails.length == 1) {
			params.richNotifMails.first().reply();
		} else {
			params.richNotifMails.first().account.openInbox();
		}
		clearRichNotification(params.notificationId);
	} else if (params.notificationButtonValue == "reducedDonationAd") {
		localStorage.reducedDonationAdClicked = true;
		createTab("donate.html?ref=reducedDonationFromNotif");
		clearRichNotification(params.notificationId);
	} else {
		logError("action not found for notificationButtonValue: " + params.notificationButtonValue);
	}
	
	sendGA(['_trackEvent', "richNotification", params.notificationButtonValue]);
}

function processOAuthUserResponse(tab, oAuthForMethod, callback) {
	if (tab.title.match(/success/i)) {
		var code = tab.title.match(/code=(.*)/i);
		if (code && code.length != 0) {
			code = code[1];
			chrome.tabs.remove(tab.id);
			
			oAuthForMethod.getAccessToken(code, function(params) {
				if (params.tokenResponse) {
					callback(params);
				} else {
					if (params.warning) {
						// ignore: might by re-trying to fetch the userEmail for the non default account									
					} else {
						alert("Error getting access token: " + params.error);
					}
				}
			});
		}
	} else {
		var error = "Error getting code: " + tab.title;
		logError(error);
		callback({error:error});
	}
}

function refreshWidgetData() {
	var widgetAccounts = [];
	$.each(accounts, function(index, account) {
		var widgetAccount = {}
		
		widgetAccount.id = account.id;
		widgetAccount.email = account.getAddress();
		widgetAccount.unreadCount = account.getUnreadCount();
		
		var emails = account.getMail()
		var widgetEmails = [];
		$.each(emails, function(emailIndex, email) {
			if (email.lastAction != "markAsRead") {
				var widgetEmail = {};
				widgetEmail.id = email.id;
				widgetEmail.frontendMessageId = email.frontendMessageId;
				widgetEmail.title = email.title;
				widgetEmail.dateFormatted = email.issued.displayDate(true);
				widgetEmail.summary = email.summary;
				widgetEmail.authorName = email.authorName;
				
				widgetEmails.push(widgetEmail);
			}
		});
		widgetAccount.emails = widgetEmails;
		
		widgetAccounts.push(widgetAccount);
	});
	localStorage["widgetAccounts"] = JSON.stringify(widgetAccounts);
}

function init() {

	try {
		if (!localStorage.detectedChromeVersion) {
			localStorage.detectedChromeVersion = true;
			Tools.detectChromeVersion(function(result) {
				console.log("browser detection", result);
				if (result && result.channel != "stable") {
					
					var title = "You are not using the stable channel of Chrome";
					var body = "Click for more info. Bugs might occur, you can use this extension, however, for obvious reasons, these bugs and reviews will be ignored unless you can replicate them on stable channel of Chrome.";
					var notification = webkitNotifications.createNotification("/images/icons/icon_48.png", title, body);
					notification.onclick = function () {
						chrome.tabs.create({ url: "http://jasonsavard.com/wiki/Unstable_channel_of_Chrome" });
						this.close();
					};
					notification.show();
					
					/*
			         showTemplateNotification("Reminder: You are not using the stable channel of Chrome", "You can use this extension, however, bugs might occur. For obvious reasons, these bugs and reviews will be ignored unless you can replicate them on stable channel of Chrome. <a href='#' style='white-space:nowrap'>More info</a>...", function () {
			            chrome.tabs.create({ url: "http://jasonsavard.com/wiki/Unstable_channel_of_Chrome" });
			         });
			         */
				}
			});
		}
	} catch (e) {
		logError("error detecting chrome version: " + e);
	}
	
	if (!chrome.runtime.onMessage) {
		chrome.tabs.create({url:"http://jasonsavard.com/wiki/Old_Chrome_version"});
	}

	canvas = document.getElementById('canvas');
	canvasContext = canvas.getContext('2d');
	gfx = document.getElementById('gfx');

	//setIcon(img_notLoggedInSrc);
	//chrome.browserAction.setBadgeBackgroundColor({ color: [190, 190, 190, 255] });
	chrome.browserAction.setBadgeBackgroundColor({color:[255, 255, 255, 1]});
	chrome.browserAction.setBadgeText({ text: "..." });
	chrome.browserAction.setTitle({ title: getMessage("loadingSettings") + "..." });

	var syncExcludeList = ["lastCompose", "lastCheckedEmail", "customSounds", "widgetAccounts", "paypalInlineResponse", "contactsData", "signedInGmailEmails"];
	syncOptions.init(syncExcludeList);
	
	Settings.load(function () {

		if (!Settings.read("installDate")) {
			// patch for chrashing Chrome dev: if you add a Date object to the indexeddb it crashes
			Settings.store("installDate", new Date().toString());
		}

		var lang = pref("language", window.navigator.language);
		loadLocaleMessages(lang, function() {
			
			initCommon();			
			unreadCount = 0;

			iconSet = Settings.read("icon_set");
			
			// check to see notifications are supported by browser			
			// legacy
			if (pref("notificationWindowType") == "standard" || pref("notificationWindowType") == "advanced") {
				Settings.store("notificationWindowType", "rich");
			}			
			
			if (/set1|set8/.test(iconSet)) {
				iconSet = "blue";
				Settings.store("icon_set", iconSet);
			} else if (/set2|set3|set10|set11|set12/.test(iconSet)) {
				iconSet = "native";
				Settings.store("icon_set", iconSet);
			} else if (/set4/.test(iconSet)) {
				iconSet = "green";
				Settings.store("icon_set", iconSet);
			} else if (/set5/.test(iconSet)) {
				iconSet = "yellow";
				Settings.store("icon_set", iconSet);
			} else if (/set6|set7|set13/.test(iconSet)) {
				iconSet = "osx";
				Settings.store("icon_set", iconSet);
			} else if (/set9/.test(iconSet)) {
				iconSet = "mini";
				Settings.store("icon_set", iconSet);
			}
			// END legacy
			
			setIcon(img_notLoggedInSrc);
				
			if (chrome.notifications) {
				
				// clicked anywhere
				chrome.notifications.onClicked.addListener(function(notificationId) {
					console.log("notif onclick", notificationId, richNotifMails);
					
					if (notificationId == "extensionUpdate") {
						createTab("http://jasonsavard.com/wiki/Checker_Plus_for_Gmail_changelog");
						chrome.notifications.clear(notificationId, function() {});
						sendGA(['_trackEvent', "extensionUpdateNotification", "clicked notification"]);
					} else {
						ChromeTTS.stop();
						
						var notificationButtonValue = Settings.read("notificationClickAnywhere");
						performButtonAction({notificationButtonValue:notificationButtonValue, notificationId:notificationId, richNotifMails:richNotifMails});
					}
				});

				// buttons clicked
				chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
					if (notificationId == "extensionUpdate") {
						if (buttonIndex == 0) {
							createTab("http://jasonsavard.com/wiki/Checker_Plus_for_Gmail_changelog");
							chrome.notifications.clear(notificationId, function() {});
							sendGA(['_trackEvent', "extensionUpdateNotification", "clicked button - see updates"]);
						} else if (buttonIndex == 1) {
							localStorage.disabledExtensionUpdateNotifications = "true";
							chrome.notifications.clear(notificationId, function(wasCleared) {
								if (lastExtensionUpdateNotificationShownDate.diffInSeconds() < -7) { // 25 seconds is approx. the time it takes for the notification to hide, after that let's use the window technique
									// open a window to take focus away from notification and there it will close automatically
									var win = window.open("about:blank", "emptyWindow", "width=1, height=1, top=-500, left=-500");
									win.close();
								}				
							});
							sendGA(['_trackEvent', "extensionUpdateNotification", "clicked button - do not show future notifications"]);
						}
					} else {
						ChromeTTS.stop();
						var notificationButtonValue = richNotifButtonsWithValues[buttonIndex].value;
						performButtonAction({notificationButtonValue:notificationButtonValue, notificationId:notificationId, richNotifMails:richNotifMails});
					}
				});
				
				// closed notif
				chrome.notifications.onClosed.addListener(function(notificationId, byUser) {
					console.log("notif onclose", notificationId, byUser);
					
					if (notificationId == "extensionUpdate") {
						if (byUser) {
							sendGA(['_trackEvent', "extensionUpdateNotification", "closed notification"]);
						}
					} else {
						richNotifId = null;
						
						// byUser happens ONLY when X is clicked ... NOT by closing browser, NOT by clicking action buttons, NOT by calling .clear
						if (byUser) {
							ChromeTTS.stop();
							//lastNotificationAction = "dismiss";
						}
					}
				});
			}
			
			// LEGACY code
			
			// patch for saving new Date() objects from locales such as german which have umlates creates indexedb corruption refer to Martin Stamm
			/*
			var tokenResponsesFromIndexedDB = Settings.read("tokenResponses");
			if (tokenResponsesFromIndexedDB) {
				// copy them to localstorage
				localStorage["tokenResponses"] = JSON.stringify(tokenResponsesFromIndexedDB);
				
				// remove them
				Settings.store("tokenResponses");
			}
			*/
			
			// rename tokenResponses to tokenResponseContacts
			if (localStorage["tokenResponses"]) {
				localStorage["tokenResponsesContacts"] = localStorage["tokenResponses"];
				localStorage.removeItem("tokenResponses");
			}
			
			// deprecated open_tabs, replaced with openComposeReplyAction
			var openTabs = Settings.read("open_tabs");
			if (openTabs != null) {				
				if (openTabs) {
					Settings.store("openComposeReplyAction", "tab");
				}
				// remove old
				Settings.store("open_tabs");
			}
			
			if (Settings.read("sn_audio") == "custom") {
				
				var customFilename = "file1";
				Settings.store("sn_audio", "custom_" + customFilename);
				
				try {
					var sounds = [];
					sounds.push( {name:customFilename, data:Settings.read("sn_audio_raw")} );
					
					// remove it before re-storeing (because we might run out of space)
					Settings.store("sn_audio_raw");
					
					Settings.store("customSounds", sounds);
				} catch (e) {
					logError(e);
					Settings.store("sn_audio", "chime.ogg");
				}
			}
			
			// deprecating old settings       "hearSubject": true, "hearMessage": true
			// insteading use "voiceHear"
			if (Settings.read("voiceHear") == null) {
				if (!Settings.read("hearSubject") && !Settings.read("hearMessage")) {
					Settings.store("voiceHear", "");
				} else if (Settings.read("hearSubject") && !Settings.read("hearMessage")) {
					Settings.store("voiceHear", "subject");
				} else if (!Settings.read("hearSubject") && Settings.read("hearMessage")) {
					Settings.store("voiceHear", "message");
				} else {
					Settings.store("voiceHear", "from|subject|message");
				}
			}
			
			// convert associative javascript array to object (better for tojson)
			var emailSettings = Settings.read("emailSettings");
			if (emailSettings && $.isArray(emailSettings)) {
				console.log("convert email setttings");
				emailSettings = emailSettings.toObject();
				Settings.store("emailSettings", emailSettings);
			}
			
			// END LAGACY
				
			// save default language to localstorage
			var voiceInputDialectPref = localStorage.voiceInputDialect;
			if (!voiceInputDialectPref) {
				localStorage.voiceInputDialect = navigator.language;
			}
			
			var tokenResponsesEmails = localStorage["tokenResponsesEmails"];
			if (tokenResponsesEmails) {
				tokenResponsesEmails = JSON.parse(tokenResponsesEmails, dateReviver);
			}
			oAuthForEmails = new OAuthForDevices({
				tokenResponses:tokenResponsesEmails,
				scope:"https://www.googleapis.com/auth/userinfo.email https://mail.google.com",
				state:"GmailCheckerEmails"
			});
			oAuthForEmails.setOnTokenChange(function(params, allTokens) {
				console.log("bg setOnTokenChange", params, allTokens)
				if (params && params.tokenResponse) {
					localStorage["tokenResponsesEmails"] = JSON.stringify(allTokens);
				}
			});
			
			var tokenResponsesContacts = localStorage["tokenResponsesContacts"];
			if (tokenResponsesContacts) {
				tokenResponsesContacts = JSON.parse(tokenResponsesContacts, dateReviver);
			}
			// params.state // roundtrip param use to identify correct code response window (because both gmail and calendar other extensions might popup this window also
			oAuthForContacts = new OAuthForDevices({
				tokenResponses:tokenResponsesContacts,
				scope:"https://www.google.com/m8/feeds",
				state:"GmailCheckerContacts",
				getUserEmail: function(tokenResponse, sendOAuthRequest, callback) {
					// were using the contacts url because it's the only one we request permission to and it will give us the email id (so only fetch 1 result)
					// send token response since we don't have the userEmail
					sendOAuthRequest({tokenResponse:tokenResponse, url: "https://www.google.com/m8/feeds/contacts/default/thin", data:{alt:"json", "max-results":"1"}}, function(response) {
						if (response.error) {
							logError("failed: you might by re-trying to fetch the userEmail for the non default account")
							response.warning = "failed: you might by re-trying to fetch the userEmail for the non default account";
							callback(response);
						} else {
							var data = JSON.parse(response.jqXHR.responseText);
							response.userEmail = data.feed.id.$t;
							callback(response);
						}
					});
				}
			});
			oAuthForContacts.setOnTokenChange(function(params, allTokens) {
				if (params && params.tokenResponse) {
					localStorage["tokenResponsesContacts"] = JSON.stringify(allTokens);
				}
			});
			
			initPopup(unreadCount);
			// Add listener once only here and it will only activate when browser action for popup = ""
			chrome.browserAction.onClicked.addListener(function(tab) {
				var ret = openInbox();
				
				// means not signed in so open gmail.co for user to sign in
				if (ret == -1) {
					chrome.tabs.create({url:"https://mail.google.com"});
				}
			});
			
			chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
				if (message.command == "getMailUrl" && accounts != null && accounts.length > 0) {
					sendResponse({ mailUrl: accounts[0].getMailUrl(), openComposeReplyAction: Settings.read("openComposeReplyAction"), popupWindowSpecs:getPopupWindowSpecs() });
				} else if (message.command == "indexedDBSettingSaved") {
					syncOptions.storageChanged({key:message.key});
				} else if (message.command == "openTab") {
					chrome.tabs.create({url:message.url});
				} else if (message.command == "getVoiceInputSettings") {
					sendResponse({voiceInputDialect:Settings.read("voiceInputDialect")});
				} else if (message.command == "findOrOpenGmailTab") {
					
					// must use this getaccountsbyemail because can't use message.account (because of onMessage transfer in json so function are lost from account object
					var account = getAccountByEmail(message.account.email);
					
					if (message.email) { // opening an email
						var foundEmail = false;
						var emails = account.getMail();						
						$.each(emails, function(emailIndex, email) {
							if (email.id == message.email.id) {
								foundEmail = true;
								var params = {};
								// used only if no matching tab found
								params.noMatchingTabFunction = function(url) {
									sendResponse({noMatchingTab:true, url:url})
								};
								email.open(params);
								return false;
							}
						});
						if (!foundEmail) {
							// then try opening inbox
							var params = {};
							// used only if no matching tab found
							params.noMatchingTabFunction = function(url) {
								sendResponse({noMatchingTab:true, url:url})
							};
							account.openInbox(params);
						}
					} else { // opening an inbox
						var params = {};
						// used only if no matching tab found
						params.noMatchingTabFunction = function(url) {
							sendResponse({noMatchingTab:true, url:url})
						};
						account.openInbox(params);
					}
					return true;
				} else if (message.command == "chromeTTS") {
					if (message.stop) {
						ChromeTTS.stop();
					} else {
						ChromeTTS.queue(message.text);
					}
				}
			});
				    
			chrome.runtime.onMessageExternal.addListener(function(message, sender, sendResponse) {
				if (sender.id == "blacklistedExtension") {
					//sendResponse({});  // don't allow this extension access
				} else {
					// used for calendar extension "look for references to 'installed' in calendar code to find out why"
					sendResponse({installed:true});
				}
			});
			
			if (chrome.alarms) {
				chrome.alarms.onAlarm.addListener(function(alarm) {
					if (alarm.name == "extensionUpdatedSync") {
						syncOptions.save("extensionUpdatedSync");
					}
				});
			}
			
			chrome.idle.onStateChanged.addListener(function(newState) {
				// returned from idle state
				console.log("onstatechange: " + newState + " " + now().toString());
				if (newState == "active") {
					console.log("unreadacount: " + unreadCount + " while active it was: " + unreadCountWhenShowNotificationWhileActive);
					if (unreadCount != 0 && unreadCount > unreadCountWhenShowNotificationWhileActive) {
						
						if (Settings.read("doNotShowNotificationIfGmailTabActive")) {
							chrome.windows.getLastFocused(function(window) {
								// check for this because a user was getting this... Error during windows.getLastFocused: No last-focused window sendRequest:21 AND Uncaught TypeError: Cannot read property 'focused' of undefined 
								if (chrome.extension.lastError) {
									showNotification(lastShowNotifParams);
								} else {
									if (window.focused) {
										console.log("window is focused");
										// url: must be URL pattern like in manifest ex. http://abc.com/* (star is almost mandatory)
										// if gmail NOT already focused then show notification
										if (accountWithNewestMail) {
											chrome.tabs.query({windowId:window.id, 'active': true, url:accountWithNewestMail.getMailUrl() + "*"}, function(tabs) {
												console.log("active tab is the gmail account?: " + tabs);
												if (!tabs) {
													showNotification(lastShowNotifParams);
												}
											});
										} else {
											showNotification(lastShowNotifParams);
										}
									} else {
										showNotification(lastShowNotifParams);
									}
								}
							});
						} else {
							showNotification(lastShowNotifParams);
						}
					}
				}
			});
			
			// for adding mailto links (note: onUpdated loads twice once with status "loading" and then "complete"
			chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
				if (changeInfo.status == "loading") {
					
					var alreadyDetectedInbox = false;
					if (accounts) {
					    $.each(accounts, function (i, account) {
							if (tab.url.indexOf(account.getMailUrl()) == 0 || tab.url.indexOf(account.getMailUrl().replace("http:", "https:")) == 0 || tab.url.indexOf(account.getMailUrl().replace("https:", "http:")) == 0) {
								console.log("Gmail webpage changed: " + tab.url);
								alreadyDetectedInbox = true;
								
								// only fetch emails if user is viewing an email ie. by detecting the email message id ... https://mail.google.com/mail/u/0/?shva=1#inbox/13f577bf07878472
								if (tab.url.match(/\#.*\/[a-z0-9]{16}/)) {
									account.getEmails({}, function() {
										mailUpdate();
									});
								}
								
								return false;
							}
					    })
					}
					
					
					if (tab.url.indexOf("https://mail.google.com/mail/") == 0) {
						localStorage["lastCheckedEmail"] = now().toString();
					}
					
					if (tab.url.indexOf("https://mail.google.com/mail/") == 0 && !alreadyDetectedInbox) {
						console.log("newly signed in")
						pollAccounts({noEllipsis:true, forceResyncAccounts:true});
					}
					
					/*
					 	old order when logging out of gmail...
					 	
					  	https://mail.google.com/mail/u/0/?logout&hl=en&loia
						https://accounts.google.com/Logout?service=mail&continue=http://www.google.com/mail/help/intl/en/logout.html%23hl%3Den&hl=en
						https://accounts.youtube.com/accounts/Logout2?hl=en&service=mail&ilo=1&ils=s.youtube&ilc=0&continue=http%3A%2F%2Fwww.google.com%2Fmail%2Fhelp%2Fintl%2Fen%2Flogout.html%23hl%3Den&zx=640039438
						https://accounts.youtube.com/accounts/ClearSID?zx=593429634
						http://www.google.com/mail/help/intl/en/logout.html#hl=en
					 */
					
					/* new order...
					 * 
					 * https://mail.google.com/mail/u/0/?logout&hl=en&hlor
					 * https://accounts.youtube.com/accounts/Logout2?hl=en&service=mail&ilo=1&ils=…s%3D1%26scc%3D1%26ltmpl%3Ddefault%26ltmplcache%3D2%26hl%3Den&zx=2053747305 
					 * http://www.google.ca/accounts/Logout2?hl=en&service=mail&ilo=1&ils=s.CA&ilc…%3D1%26scc%3D1%26ltmpl%3Ddefault%26ltmplcache%3D2%26hl%3Den&zx=-1690400221
					 * https://accounts.google.com/ServiceLogin?service=mail&passive=true&rm=false…=https://mail.google.com/mail/&ss=1&scc=1&ltmpl=default&ltmplcache=2&hl=en    
					 */
					if (tab.url.match(/.*google\..*\/accounts\/Logout*/i)) { //if (tab.url.indexOf("://www.google.com/accounts/Logout") != -1) {
						if (Settings.read("accountAddingMethod") == "autoDetect") {
							accounts = new Array();
							setSignedOut();
						} else if (Settings.read("accountAddingMethod") == "oauth") {
							// reset signed in emails
							Settings.store("signedInGmailEmails");
							
							// reset account id
							$.each(accounts, function(index, account) {
								account.setAccountId(UNSYNCHED_ACCOUNT_ID);
							});
						}
					}

					//console.log("loading: " + tab.url);

					chrome.permissions.contains({origins: [getMessage("origins_mailtoLinks")]}, function(result) {
						// cannot call executeScript on extensions gallery pages: https://chrome.google.com/webstore
						
						// when "reloading" a page that was "already" an error page from being offline the title happens to contain blahblah is not available, so parse for and don't execute the script on it
						var available = true;
						if (tab.title && tab.title.indexOf("is not available") != -1) {
							available = false;
						}
						//console.log(tab.title + " tab: ", tab)
						if (result && available && tab.url.indexOf("http") == 0 && tab.url.indexOf("https://chrome.google.com/webstore") == -1 && tab.url.indexOf("chrome://chromewebdata/") == -1) { // make sure it's standard webpage and not extensions:// or ftp:// because errors are generated
							chrome.tabs.executeScript(tabId, {file:"js/mailto.js", allFrames:true});
						}
					});					
					
				} else if (changeInfo.status == "complete") {

					// find code window and make sure its from this extension by matching the state
					if (tab.url.indexOf("https://accounts.google.com/o/oauth2/approval") != -1) {
						
						if (tab.title.hasWord("state=" + oAuthForEmails.getStateParam())) {
							processOAuthUserResponse(tab, oAuthForEmails, function(params) {
								console.log("after user response: ", params);
								chrome.runtime.sendMessage({command: "grantPermissionToEmails", result:params});
								if (params.error) {
									alert(params.error);
									logError(params.error);
								}
							});
						} else if (tab.title.hasWord("state=" + oAuthForContacts.getStateParam())) {
							processOAuthUserResponse(tab, oAuthForContacts, function(params) {
								console.log("add contacts");
								if (params.error) {
									alert(params.error);
									logError(params.error);
								} else {
									fetchContacts(params.tokenResponse.userEmail, function(params) {
										if (params.contactDataItem) {
											var contactsData = Settings.read("contactsData");
											if (!contactsData) {
												contactsData = new Array();
											}
											var foundContactsDataItem = false;
											for (var a=0; a<contactsData.length; a++) {
												if (contactsData[a] && contactsData[a].userEmail == params.contactDataItem.userEmail) {
													foundContactsDataItem = true;
													console.log('found: updating existing contactsDataItem')
													contactsData[a] = params.contactDataItem;
													break;
												}
											}
											if (!foundContactsDataItem) {
												console.log("creating new contactsDataItem");
												contactsData.push(params.contactDataItem);
											}
											console.log("contactdata: ", contactsData);
											Settings.store("contactsData", contactsData);
											chrome.runtime.sendMessage({command: "grantPermissionToContacts", contactDataItem:params.contactDataItem}); 
										} else {
											//if (params.warning) {
												// ignore: might by re-trying to fetch the userEmail for the non default account
											//}
											alert(params.error);
											logError(params.error);
										}
									});
								}
							});
						}
						
					}
					
				}				
			});
			
			// called for urls matching method=oauth to prevent the cookies from being sent to mail.google.com/mail/atom/...
			// ...because when doing an oauth send to mail.googl.com i could get the wrong email from mail.google.com/mail/atom/... even though i was request the authorization with a particular email
			// the interesting this is that i could fetch any email inbox simply by sending an oauth to mail.google/u/0.... ???
			chrome.webRequest.onBeforeSendHeaders.addListener(
				function (details) {
					console.log("onBeforeSendHeaders:", details);
					for (var i = 0; i < details.requestHeaders.length; ++i) {
						if (details.requestHeaders[i].name === 'Cookie') {
							details.requestHeaders.splice(i, 1);
						}
					}
					return {requestHeaders: details.requestHeaders};
				},
				/* match all this...
				 * feed/atom
				 * feed/atom/
				 * feed/atom/unread
				 * feed/atom/unread?timestamp=123
				 * feed/atom/unread?timestamp=123&method=oauth
				*/
				{urls: ["https://mail.google.com/mail/feed/atom*method=oauth*"]},
				["blocking", "requestHeaders"]
			);
			
			chrome.webRequest.onCompleted.addListener(
				function(details) {
					if (pref("voiceInput")) {
						console.log("oncomplete webrequest:", details);
						
						// added timeout because in compose popup window it seems the inserts were not working
						setTimeout(function() {
							insertSpeechRecognition(details.tabId);
						}, 200)
					}
				},
				{types:["main_frame"], urls: ["*://mail.google.com/*"]}
			);
		
			chrome.tabs.onActiveChanged.addListener(function(tabId, selectInfo) {
				chrome.tabs.get(tabId, function(tab) {
					if (tab) {
						if (tab.url.indexOf("https://mail.google.com") != -1) {
							if (notification) {
								notification.cancel();
							}
						}
					}
				});
			});
			
			if (chrome.storage) {
				chrome.storage.onChanged.addListener(function(changes, areaName) {
					console.log("storage changes " + new Date() + " : ", changes, areaName);
				});
			}
			
			if (chrome.commands) {
				chrome.commands.onCommand.addListener(function(command) {
					var errorFlag;
					var errorMsg;
					if (command == "markAsReadInNotificationWindow") {
						errorMsg = "Cannot mark email as read because there are no email notifications visible";
						if (Settings.read("notificationWindowType") != "rich") {
							if (notification) {
								if (notification.mail) {
									// for when only one email ie. text or notify.html
									notification.mail.markAsRead();
									notification.cancel();
									if (unreadCount >= 1) {
										updateBadge(unreadCount-1);
									}
								}
							} else {
								errorFlag = true;
							}
						} else {
							// rich notif
							if (richNotifId) {
								performButtonAction({notificationButtonValue:"markAsRead", notificationId:richNotifId, richNotifMails:richNotifMails});
							} else {
								errorFlag = true;
							}
						}
					} else if (command == "openEmailDisplayedInNotificationWindow") {
						errorMsg = "Cannot open email because there are no email notifications visible";
						if (Settings.read("notificationWindowType") != "rich") {
							if (notification) {
								if (notification.mail) {
									// for when only one email ie. text or notify.html
									notification.mail.open();
									notification.cancel();
									if (unreadCount >= 1) {
										updateBadge(unreadCount-1);
									}
								}
							} else {
								errorFlag = true;
							}
						} else {
							// rich notif
							if (richNotifId) {
								performButtonAction({notificationButtonValue:"open", notificationId:richNotifId, richNotifMails:richNotifMails});
							} else {
								errorFlag = true;
							}
						}
					}
					
					if (errorFlag) {
						shortcutNotApplicableAtThisTime(errorMsg);
					}
					
				});
			}

			// call poll accounts initially then set it as interval
			pollAccounts({showNotification:true}, function() {
				// set check email interval here
				startCheckEmailTimer();
			});
			
			// set widgtet defaults
			
			// set default widget background color
			if (!localStorage.widgetBackgroundColor) {
				localStorage.widgetBackgroundColor = "#1B84C6";
			}
			
			if (!localStorage.widgetShowEmailAddresses) {
				localStorage.widgetShowEmailAddresses = "true";
			}
			
			if (!localStorage.widgetShowEmailPreview) {
				localStorage.widgetShowEmailPreview = "true";
			}
			
			if (!localStorage.widgetShowEmailSummary) {
				localStorage.widgetShowEmailSummary = "true";
			}
			
			var info = {
			  "poke"    :   2,              // poke version 2
			  "width"   :   1,              // 406 px default width
			  "height"  :   1,              // 200 px default height
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
			// note, new method name did not work, "onMessageExternal", so still using deprecated onRequestExternal
			// note: maybe same for sendMessage vs sendRequest below
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

				  refreshWidgetData();

			  }
			});
			// Above is the required poke listener
			// DO NOT MODIFY ANY OF THE ABOVE CODE
					
			setInterval(function() {
				// every 10 seconds or if not signed in to any accounts
				if (accounts.length == 0) { //|| lastPollAccounts.diffInMinutes() <= -10
					pollAccounts({showNotification:true});
				}
			}, seconds(10));
			
			// refresh AT every hour (for possible mark as read bug)
			setInterval(function() {
				if (Settings.read("accountAddingMethod") == "autoDetect") {
					$.each(accounts, function(i, account) {
						if (!account.error) {
							account.getNewAt();
						}
					});
				}
			}, minutes(30));
			
			// if iselibigable for reduced donations than make sure user hasn't contributed before, if so do not display this eligable notice
			setInterval(function() {
				if (!pref("donationClicked") && !localStorage["verifyPaymentRequestSentForReducedDonation"] && accounts.length) {

					// check sometime within 7 days (important *** reduce the load on my host)
					if (passedRandomTime("randomTimeForVerifyPayment", 7)) {
						verifyPayment(accounts, function(response) {
							if (response && response.unlocked) {
								Controller.processFeatures();
							}
						});
						localStorage["verifyPaymentRequestSentForReducedDonation"] = true;
					}
				}
			}, minutes(5));

			$(window).on("offline online", function(e) {
				console.log("detected: " + e.type + " " + new Date());
				if (e.type == "online") {
					console.log("navigator: " + navigator.onLine + " " + new Date());
					setTimeout(function() {
						if (!hasAtleastOneSuccessfullAccount(accounts)) {
							console.log("navigator: " + navigator.onLine);
							checkEmails("wentOnline");
						}
					}, seconds(3))
				}
			});

			
		});

		loadedSettings = true;
		
	});
	
	$(window).on("storage", function(e) {
		syncOptions.storageChanged({key:e.originalEvent.key});
	});
	
}

function initMailAccount(accountNumber, callback) {
	var MAX_ACCOUNTS = 50;
	
    stopAnimateLoop();
    
    /*
    // exit when looped through all tokenresponesemail
    if (Settings.read("accountAddingMethod") == "oauth" && !oAuthForEmails.findTokenResponseByIndex(accountNumber)) {
    	console.log("exit loop");
    	callback();
    	return;
    }
    */
    if (Settings.read("accountAddingMethod") == "oauth" && accounts.length >= oAuthForEmails.getUserEmails().length) {
    	console.log("found all accounts - exit loop");
    	callback();
    	return;
    }
    
    var tokenResponse = oAuthForEmails.findTokenResponseByIndex(accountNumber);
    var mailAddress;
    if (tokenResponse && tokenResponse.userEmail) {
    	mailAddress = tokenResponse.userEmail;
    }
    
    // when using auto-detect use the accountnumber and eventually the mailaddress will get populated with the fetch
    // when using oauth use the mailaddress passed in here to fetch the appropriate data
    var account = new MailAccount({ accountNumber: accountNumber, mailAddress:mailAddress});
    
    account.getEmails({restorePreviousMails:Settings.read("rememeberReadEmails") == "show", previousAccounts:previousAccounts}, function(cbParams) {
    	
    	// maximum accounts, if over this we might be offline and just gettings errors for each account
    	if (accountNumber <= MAX_ACCOUNTS && navigator.onLine) {
    		// cbParams.ignored was the old way of putting ignore email in a free textarea, getSettings("ignore") is new way of checking it on/off in per email settings
    		if (cbParams.ignored || account.getSetting("ignore")) {
    			// do not add, ignore this one and try next
    			console.log("mailaccount - ignored");
    			ignoredAccounts.push(account);
    		} else if (cbParams.error && (cbParams.error.toLowerCase() == "unauthorized" || (cbParams.jqXHR && cbParams.jqXHR.status == 401))) { // not signed in
    			console.log("mailaccount - error/unauth");
    			unauthorizedAccounts++;
    			
    			if (Settings.read("accountAddingMethod") == "autoDetect") {
	    			// if offline then watch out because all accounts will return error, but not unauthorized, so must stop from looping too far
	    			
    				account = null;
	    			delete account;
	    			
	    			// if too many unauthorized results than assume they are all signed out and exit loop, else continue looping
	    			var maxUnauthorizedAccount = parseInt(pref("maxUnauthorizedAccount", 1, localStorage));
	    			if (unauthorizedAccounts >= maxUnauthorizedAccount) {
	    				callback();
	    				return;
	    			}
    			} else {
    				accounts.push(account);
    			}
    		} else {
    			
    			if (Settings.read("accountAddingMethod") == "autoDetect") {
	    			// if duplicate email found then let's stop before it repeats
	    			for (var a=0; a<accounts.length; a++) {
	    				if (account.getAddress() == accounts[a].getAddress()) {
	    					console.error("duplicate email account found so stop finding accounts");
	    					account = null;
	    					delete account;
	    					callback();
	    					return;
	    				}
	    			}

	    			// if consecutive accounts with errors let's quit - trying to avoid the locked account condition
	    			if (accounts.length && accounts.last().error) {
	    				console.error("consecutive accounts with errors so not looking for anymore");
						account = null;
						delete account;
	    				callback();
	    				return;
	    			}
    			}
    			
    			accounts.push(account);
    		}
    		initMailAccount(accountNumber+1, callback);
    	} else {
    		if (cbParams.error) {
    			// Error on last one most probably they were all errors ie. timeouts or no internet so reset all accounts to 0
    			accounts = new Array();
    			console.log("mailaccount - probably they were all errors");
    		} else {
    			if (navigator.onLine) {
    				logError("jmax accounts reached");
    			} else {
    				console.warn("Not online so not detecting accounts");
    			}
    		}
    		callback();
    		return;
    	}
    });
}

function pollAccounts(params, cb) {
	var callback;
	if (cb) {
		callback = cb;
	} else {
		// params might be the callback (if no 2nd parameter passed)
		if ($.isFunction(params)) {
			callback = params;
			params = {};
		} else {
			callback = function() {};
		}
	}

	if (pollingAccounts) {
		console.log("currently polling; quit polling me!")
		callback();
		return;
	}
	lastPollAccounts = now();	
	pollingAccounts = true;
	
	if (!params || !params.noEllipsis) { 
		chrome.browserAction.setBadgeText({ text: "..." });
	}	
	chrome.browserAction.setTitle({ title: getMessage("pollingAccounts") + "..." });

	console.log("poll accounts...");
	if (accounts != null) {
		$.each(accounts, function (i, account) {
			account = null;
			delete account;
		});
	}
	
	accounts = new Array();
	ignoredAccounts = new Array();	
	unauthorizedAccounts = 0; 
	
	initMailAccount(0, function() {
		signedIntoAccounts = 0;		
		$.each(accounts, function(i, account) {
			if (!account.error) {
				signedIntoAccounts++;
			}
		});
		
		if (signedIntoAccounts == 0) {
			setSignedOut();
		} else {
			// save default email for payment stuff
			email = accounts.first().getAddress();
			
			// see if i should unlock this user...
			if (!localStorage["verifyPaymentRequestSent"]) {
				
				verifyPayment(accounts, function(response) {
					if (response && response.unlocked) {
						Controller.processFeatures();
					}
				});
				
				localStorage["verifyPaymentRequestSent"] = true;
			}
			
			mailUpdate(params);
		}
		
		unreadCountWhenShowNotificationWhileActive = unreadCount;
		
		if (Settings.read("accountAddingMethod") == "oauth") {
			syncSignedInAccountNumbers(params, function(params) {
				pollingAccounts = false;
			});
		} else {
			pollingAccounts = false;
		}
		
		callback();
	});
}

var currentIcon;
function setIcon(iconName) {
	currentIcon = iconName;
	var iconPath = "images/browserButtons/" + iconSet + "/" + iconName + iconFormat;
	var iconPathRetina = "images/browserButtons/" + iconSet + "/" + iconName + "_retina" + iconFormat;
	
	if (iconSet == "default") {
		// supports retina
		chrome.browserAction.setIcon({ path: {
				"19": iconPath,
				"38": iconPathRetina
			}
		});
	} else {
		chrome.browserAction.setIcon({ path: iconPath });		
	}
	
}

function getSettingValueForLabels(settings, labels, defaultObj) {
	if (!settings) {
		settings = {};
	}
	
	var settingValue;
	if (labels) {
		for (var a=labels.length-1; a>=0; a--) {
			var label = labels[a];
			settingValue = settings[label];
			if (typeof settingValue != "undefined") {
				return settingValue;
			}
		}
	}
	
	// if we get here then return default value
	return defaultObj;
}

// Called when an account has received a mail update
function mailUpdate(params) {
	if (!params) {
		params = {};
	}
	
	stopAnimateLoop();
	
	updateNotificationTray();

	// if this mailUpdate is called from interval then let's gather newest emails ELSE we might gather later in the code
	var newEmails = [];
	if (params.allEmailsCallbackParams) {
		$.each(params.allEmailsCallbackParams, function(index, allEmailsCallback) {
			if (allEmailsCallback.newestMailArray && allEmailsCallback.newestMailArray.length) {
				console.log("allEmailsCallback.newestMailArray:", allEmailsCallback.newestMailArray);
				newEmails = newEmails.concat(allEmailsCallback.newestMailArray);
			}
		});
	}

	var totalUnread = 0;
	var lastMailUpdateAccountWithNewestMail;
	$.each(accounts, function(i, account) {

		if (!account.error) {
			if (account.getUnreadCount() > 0) {
				totalUnread += account.getUnreadCount();
			}
		}

		if (account.getNewestMail()) {
			if (!lastMailUpdateAccountWithNewestMail || !lastMailUpdateAccountWithNewestMail.getNewestMail() || account.getNewestMail().issued > lastMailUpdateAccountWithNewestMail.getNewestMail().issued) {
				lastMailUpdateAccountWithNewestMail = account;
			}

			if (!params.allEmailsCallbackParams) {
				newEmails = newEmails.concat(account.getAllNewestMail());
			}
		}
	});
	
	updateBadge(totalUnread);
	
	newEmails.sort(function (a, b) {
	   if (a.issued > b.issued)
		   return -1;
	   if (a.issued < b.issued)
		   return 1;
	   return 0;
	});
	
	if (newEmails.length) {
		var mostRecentNewEmail = newEmails.first();
		accountWithNewestMail = mostRecentNewEmail.account;
		
		var passedDateCheck = false;
		if (Settings.read("showNotificationsForOlderDateEmails")) {
			if (accountWithNewestMail.getMail().length < 20) {
				passedDateCheck = true;
			} else {
				console.warn("more than 20 emails so bypassing check for older dated emails");
				if (mostRecentNewEmail.issued > lastShowNotificationDates[accountWithNewestMail.id]) {
					passedDateCheck = true;
				}
			}
		} else {
			if (mostRecentNewEmail.issued > lastShowNotificationDates[accountWithNewestMail.id]) {
				passedDateCheck = true;
			}
		}
		
		if (!lastShowNotificationDates[accountWithNewestMail.id] || passedDateCheck) {
			
			lastShowNotificationDates[accountWithNewestMail.id] = mostRecentNewEmail.issued;

			var mailIdHash = $.md5(mostRecentNewEmail.id);
			var addressHash = $.md5(accountWithNewestMail.getAddress());
	
			if (mailIdHash != localStorage[addressHash + "_newest"]) {
				
				startAnimate();

				var soundSource = getSettingValueForLabels(accountWithNewestMail.getSetting("sounds"), mostRecentNewEmail.labels, Settings.read("sn_audio"));

				// show notification, then play sound, then play voice
				if (params.showNotification) {
					// save them here for the next time i call showNotification when returning from idle
					params.emails = newEmails;
					lastShowNotifParams = params;
					showNotification(params, function() {
						if (Settings.read("soundNotification")) {
							playNotificationSound(soundSource, function() {
								playVoiceNotification(accountWithNewestMail);
							});
						} else {
							playVoiceNotification(accountWithNewestMail);
						}
					});
				} else if (Settings.read("soundNotification")) {
					playNotificationSound(soundSource, function() {
						playVoiceNotification(accountWithNewestMail);
					});
				} else {
					playVoiceNotification(accountWithNewestMail);
				}
				
				localStorage[addressHash + "_newest"] = mailIdHash;
			}
		}
	}
	
	// if new emails or mail count different (meaning some emails might have been marked as read)
	if (newEmails.length || unreadCount != totalUnread) {
		if (pokerListenerLastPokeTime.diffInDays() > -5) {
			refreshWidgetData();
		}
	}
	
	unreadCount = totalUnread;
	initPopup(unreadCount);
	
	chrome.idle.queryState(120, function(newState) {
		if (newState == "active") {
			console.log("unreadcount while: " + newState);
			unreadCountWhenShowNotificationWhileActive = unreadCount;
		}
	});

}


function updateNotificationTray() {
	
	var allUnreadMail = getAllUnreadMail(accounts);
	
	// if any of the rich notif mails do not exist anymore than assume one has been read/deleted and therefore remove the notification from the tray

	var richNotifMailsStillUnreadCount = 0;
	for (var a=0; a<richNotifMails.length; a++) {
		for (var b=0; b<allUnreadMail.length; b++) {
			if (richNotifMails[a] && allUnreadMail[b] && richNotifMails[a].id == allUnreadMail[b].id) {
				richNotifMailsStillUnreadCount++;
			}
		}
	}

	if (richNotifMails.length != richNotifMailsStillUnreadCount) {
		console.log("remove tray because some rich notif mails have been read: " + richNotifMails.length + " | " + richNotifMailsStillUnreadCount);
		clearRichNotification(richNotifId);
	}
}

function setSignedOut() {
	setIcon(img_notLoggedInSrc);
	//chrome.browserAction.setBadgeBackgroundColor({ color: [190, 190, 190, 255] });
	chrome.browserAction.setBadgeBackgroundColor({color:[255, 255, 255, 1]});
	chrome.browserAction.setBadgeText({ text: "X" });
	chrome.browserAction.setTitle({ title: getMessage("notSignedIn") });
	unreadCount = 0;
	email = null;
}

function playNotificationSound(source, callback) {
	
	callback = initUndefinedCallback(callback);
	
	try {
		// must try catch this because of "Uncaught ReferenceError: Audio is not defined" for some users
		// false alarm: user had removed this file ffmpegsumo.dll in Chrome folder which caused the error.
		if (!notificationAudio) {
			notificationAudio = new Audio();
		}

		var audioEventTriggered = false;
		
		$(notificationAudio).off().on("ended abort error", function(e) {
			console.log("sound event", e);		
			if (!audioEventTriggered) {
				audioEventTriggered = true;
				callback();
			}
		});
		
		if (isMutedByDuration() || source == "") {
			callback();
		} else {
			if (!source) {
				source = Settings.read("sn_audio");
			}
		
			// patch for ogg might be crashing extension
			// patch linux refer to mykhi@mykhi.org
			if (navigator.platform.toLowerCase().indexOf("linux") != -1 || lastNotificationAudioSource != source) {
				if (source.indexOf("custom_") == 0) {
					var sounds = Settings.read("customSounds");
					if (sounds) {
						// custom file selectd
						$.each(sounds, function(index, sound) {
							if (source.replace("custom_", "") == sound.name) {
								console.log("loadin audio src")
								notificationAudio.src = sound.data;
							}
						});
					}					
				} else {
					console.log("loadin audio src")
					notificationAudio.src = "sounds/" + source;
				}
		   }
		   lastNotificationAudioSource = source;
		   notificationAudio.volume = pref("notificationSoundVolume") / 100;
		   notificationAudio.play();
		}
	} catch (e) {
		logError(e);
		callback();
	}
}

function detectLanguage(text, callback) {
	chrome.permissions.contains({origins: [getMessage("origins_languageDetection")]}, function(result) {
		if (result) {
			$.ajax({
				type: "GET",
				url: "http://ws.detectlanguage.com/0.2/detect",
				data: {q: text, key:"b60a07acb3ed2701668c3b5d37d8f96c"},
				dataType: "json",
				timeout: 2000,
				complete: function(request, textStatus) {
					var status = getStatus(request, textStatus);
					if (status == 200) {
						var data;
						try {
							data = JSON.parse(request.responseText);
						} catch (e) {
							logError("could not parse detect lang response: " + request.responseText);
							callback();
							return;
						}
						if (data && data.data && data.data.detections && data.data.detections.length != 0) {
							lang = data.data.detections[0].language;
							console.log("lang detected: " + lang)
							if (lang == "eu" || lang == "et" || lang == "sq") { // estonia
								lang = "en";
							}
						}
						callback({lang:lang});
					} else {
						logError("error with detect: " + status + " " + textStatus)
						callback();
					}
				}
			});
		} else {
			callback();
		}
	});
}

function playVoiceNotification(accountWithNewestMail) {
	
	var passedMuteVoiceRules = true;
	
	// watch out 2 mute voice types...
	
	// this one is for temporarly muting voice from icon in the popup window
	if (isMutedByDuration()) {
		passedMuteVoiceRules = false;
	}
	
	// this one is for muting voice between certain hours set in the options
	if (Settings.read("muteVoice")) {
		
		var startMuteHour = parseInt(Settings.read("muteVoiceStart"));
		var endMuteHour = parseInt(Settings.read("muteVoiceEnd"));
		
		// Check is different depending on start/end time precedance
		if (startMuteHour < endMuteHour) { // this is for ie. 1am to 6am
			if (startMuteHour <= now().getHours() && now().getHours() < endMuteHour) {
				passedMuteVoiceRules = false;
			}
		} else {
			if (startMuteHour <= now().getHours() || now().getHours() < endMuteHour) {
				passedMuteVoiceRules = false;
			}
		}
	}
	
	if (Settings.read("voiceNotification") && passedMuteVoiceRules) {

		chrome.idle.queryState(parseInt(pref("voiceNotificationOnlyIfIdleInterval")), function(state) {
			// apparently it's state can be locked or idle
			if (!pref("voiceNotificationOnlyIfIdle") || (pref("voiceNotificationOnlyIfIdle") && state != "active" && !detectSleepMode.isWakingFromSleepMode())) {
				// put a bit of time between chime and voice
				setTimeout(function() {

					var newestEmail = accountWithNewestMail.getNewestMail();

					if (newestEmail) {
						
						var voiceHear = getSettingValueForLabels(accountWithNewestMail.getSetting("voices"), newestEmail.labels, Settings.read("voiceHear"));

						if (voiceHear) {
							
							var hearFrom = voiceHear.indexOf("from") != -1;
							var hearSubject = voiceHear.indexOf("subject") != -1;
							var hearMessage = voiceHear.indexOf("message") != -1;
							
							var fromName = newestEmail.authorName;
							fromName = fromName.split(" ")[0];
							
							// filter for speech
							
							if (newestEmail.authorMail && newestEmail.authorMail.indexOf("vonage.") != -1) {
								// put vonage instead because or elee the phone number is spoken like a long number ie. 15141231212 etc...
								fromName = "Vonage";
							}
		
							var subject = newestEmail.title;
							subject = subject.replace(/^re: ?/i, "");
							subject = subject.replace(/^fwd: ?/i, "");
		
							var introToSay = "";
							var introToSayEnglish = "";
							var afterfromSeparator = "";
							var messageToSay = "";
							
							if (hearFrom) {
								if (hearSubject || hearMessage) {
									// from plus something else...
									introToSay = getMessage("NAME_says", fromName);
									introToSayEnglish = fromName + " says";
									afterfromSeparator = ", ";
								} else {
									// only from
									introToSay = getMessage("emailFrom_NAME", fromName);
									introToSayEnglish = "Email from " + fromName;
								}
							} 
								
							if (hearSubject || hearMessage) {
								if (hearSubject && !subjects[subject] && !subject.match(/no subject/i) && !subject.match(/sent you a message/i)) {
									subjects[subject] = "ALREADY_SAID";
									messageToSay += subject;
								} else {
									console.log("omit saying the subject line")
								}
								console.log("message to say: " + subject)
								
								if (hearMessage) {
									// if 'from:' found ignore thereon
									// ex. Yes and yes... From: hamishw55@hotmail.com To: d_sinnig@encs.concor
									// blah blah Original Message
									var messageText = newestEmail.getLastMessageText();
									messageText = messageText.replace("&#39;", "'");
									
									var spokenWordsLimit = Settings.read("spokenWordsLimit");
									var spokenWordsLimitLength;
									if (spokenWordsLimit == "summary") {
										spokenWordsLimitLength = 101;
									} else if (spokenWordsLimit == "paragraph") {
										spokenWordsLimitLength = 500;
									} else {
										spokenWordsLimitLength = 30000;
									}
									messageText = messageText.summarize(spokenWordsLimitLength);
									
									messageToSay += ", " + messageText;
								}
							}
							
							console.log("message to say : " + introToSay + afterfromSeparator + messageToSay);					
							if (pref("voice").indexOf("Multilingual TTS Engine") != -1) {
								if (navigator.onLine) {
									// must you .off or .on's will queue
									var lang = pref("language", window.navigator.language);
									
									detectLanguage(messageToSay, function(detectLanguageResult) {
										// if intro and message are same lang then play them in one submit to google
										if (!detectLanguageResult || lang == detectLanguageResult.lang) {
											ChromeTTS.queue(introToSay + afterfromSeparator + messageToSay);
										} else {
											ChromeTTS.queue(introToSay);
											ChromeTTS.queue(messageToSay);
										}
									});
								} else {
									// fetch default machine voice by passing false as 2nd parameter to getDefaultVoice
									chrome.tts.getVoices(function(voices) {
										var voiceIndexMatched = getDefaultVoice(voices, false);
										if (voiceIndexMatched != -1) {
											var voice = voices[voiceIndexMatched];
											ChromeTTS.queue(introToSayEnglish + afterfromSeparator + messageToSay, voice);
										}
									});
									//ChromeTTS.queue(introToSayEnglish + afterfromSeparator + messageToSay, {voiceName:"native"});
								}
							} else {
								ChromeTTS.queue(introToSayEnglish + afterfromSeparator + messageToSay);
							}
						} else {
							console.log("voiceHear off for these labels");
						}
					} else {
						console.warn("in playVoiceNotification this returns null?? -> accountWithNewestMail.getNewestMail()");
					}
				}, 1000);
			}
		});
	}
}

function preloadProfilePhotos(mails, callback) {
	var timeoutReached = false;
	if (Settings.read("showContactPhoto")) {
		
		// gather unique emails
		var userEmails = mails.unique(function(mail) {
			return mail.account.getAddress();
		});
		
		console.log("useremails", userEmails);
		
		// let's ensure all tokens first before looping
		oAuthForContacts.ensureTokenForEmail(userEmails, function(cbParams) {
			if (cbParams.error) {
				callback(cbParams);
			} else {
				var deferreds = new Array();
				$.each(mails, function(index, mail) {
			
				   var dfd = $.Deferred();
				   deferreds.push(dfd);
					
				   var contactPhoto = new Image();
				   getContactPhoto({mail:mail}, function(params) {
						if (params.contact) {
							if (params.error) {
								console.log("contacterror: " + params.error, params);
								dfd.resolve(params);
							} else {
								$(contactPhoto).on("load", function() {
									mail.contactPhoto = contactPhoto;
									dfd.resolve("success");
								}).on("error", function(e) {
									var error = "could not image: " + e;
									console.log(error);
									dfd.resolve({error:error});
								});
								console.log("generatedurl: " + params.generatedURL);
								$(contactPhoto).attr("src", params.generatedURL);
							}
						} else {
							var error = "contact not found";
							console.log(error);
							dfd.resolve({error:error});
						}
					});
				   
				   	dfd.promise();
				});
			
				// wait for https images to load because even if the deferreds completed it seem the contact images woulnd't load at extension startup
				var preloadTimeout = setTimeout(function() {
					timeoutReached = true;
					console.log("preloadphotos timeoutEND");
					callback();
				}, seconds(3));
				
				$.when.apply($, deferreds).always(function() {
					console.log("preloadphotos always args", arguments);
					// cancel timeout
					clearTimeout(preloadTimeout);
					// make sure timeout did not already call the callback before proceeding (don't want to call it twice)
					if (!timeoutReached) {
						console.log("preloadphotos whenEND");
						callback();
					}
				});
			}
		});
		
	} else {
		callback();
	}
}