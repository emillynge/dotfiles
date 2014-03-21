var storageManager;
var storage;
var lastOnUpdateInfo;
var POLLING_INTERVAL = 30; // minutes
var lastNotificationShownDate = new Date(1);

// Below is the required poke listener
chrome.runtime.onMessageExternal.addListener(function(message, sender, sendResponse) {
  if (message === "mgmiemnjjchgkmgbeljfocdjjnpjnmcg-poke") {
	  pokerListenerLastPokeTime = new Date();

	  var info = {
			  "poke"    :   3,              // poke version 2
			  "width"   :   1,              // 406 px default width
			  "height"  :   2,              // 200 px default height
			  "path"    :   "popup.html?source=ANTP",
			  "v2"      :   {
			      "resize"    :   true,  // Set to true ONLY if you create a range below.
			      "min_width" :   1,     // 200 px min width
			      "max_width" :   3,     // 406 px max width
			      "min_height":   1,     // 200 px min height
			      "max_height":   3      // 200 px max height
			                },
			   "v3"     :   {
			      "multi_placement": false // Allows the widget to be placed more than once
			    }
			};
	  
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

chrome.runtime.onConnect.addListener(function(port) {
	port.onMessage.addListener(function(message) {

		if (message.action == "performCommand") {
			getStorageItems(function(response) {
				
				storage = response.storage;
				storageManager = response.storageManager;
				
				message.params.storage = response.storage;
				message.params.storageManager = response.storageManager;
				
				performCommand(message.params, function(response) {
					port.postMessage(response);
				});
			});
		}
		
	});
});

function performCommand(storageItems, callback) {
	$(".statusMessageWrapper").show();
	initOAuth();
	fetchFiles(storageItems, function(files) {
		callback({files:files});
	});
	localStorage.lastCommand = storageItems.lastCommand;
	localStorage.lastAlternateLink = storageItems.lastAlternateLink;
	localStorage.q = storageItems.q;
	localStorage.sortByName = storageItems.sortByName;	
}

function checkForModifiedFiles(force, force2) {
	console.log("called checkForModifiedFiles");
	// check for modified files...
	
	getStorageItems(function(response) {
		var storageManager = response.storageManager;
		var storage = response.storage;
		if (storage.desktopNotifications) {
			if (force || new Date(storage.lastChangeFetchDate).diffInMinutes() <= -POLLING_INTERVAL) { // 30 minutes interval
				chrome.idle.queryState(60 * 30, function(state) { // only poll if not idling for 30 minutes of more
					if (state == "active") {
						processChanges(storageManager, storage, force2);
					}
				});
			}
		}		
	});
	
}

chrome.tabs.onUpdated.addListener(function onTabUpdated(tabId, changeInfo, tab) {
	// patch for Chrome bug, because onupdated is called 4 times (twice for on loading and twice for complete)
	var thisOnUpdateInfo = JSON.stringify(changeInfo) + " " + JSON.stringify(tab);
	if (lastOnUpdateInfo != thisOnUpdateInfo) {
		
		if (changeInfo.status == "complete") {
			// find code window and make sure its from this extension by matching the state
			if (tab.url.indexOf("https://accounts.google.com/o/oauth2/approval") != -1) {
				initOAuth();
				if (tab.title.indexOf("state=" + oAuthForDevices.getStateParam()) != -1) {
					if (tab.title.match(/success/i)) {
						var code = tab.title.match(/code=(.*)/i);
		
						if (code && code.length != 0) {
							code = code[1];
							chrome.tabs.remove(tabId);
							
							oAuthForDevices.getAccessToken(code, function(params) {
								if (params.tokenResponse) {
									
									getStorageItems(function(response) {
										fetchFiles(response, function() {
											chrome.runtime.sendMessage({action:"accessGranted"}, function() {
												// do nothing
											});
										});
									});
									
									// send message to my ANTP widget to reload itself
									//chrome.runtime.sendMessage("mgmiemnjjchgkmgbeljfocdjjnpjnmcg", {action:"accessGranted"});
								} else {
									if (params.warning) {
										// ignore: might by re-trying to fetch the userEmail for the non default account									
									} else {
										alert("Error getting access token: " + params.error);
									}
								}
							});
						}
					} else if (tab.title.match(/error=/i)) {
						if (tab) {
							if (tab.title.indexOf("access_denied") == -1) {
								alert("Error getting code: " + tab.title);
							}
						}
					}
				}
			}
		}

		lastOnUpdateInfo = thisOnUpdateInfo;
	}
});

chrome.alarms.onAlarm.addListener(function(alarm) {
	console.log("onAlarm: " + alarm.name + " " + new Date());
	if (alarm.name == "checkForModifiedFiles") {
		checkForModifiedFiles();
	}
});

function resetModifiedFiles() {
	getStorageItems(function(response) {
		var storage = response.storage;
		var storageManager = response.storageManager;
		
		storage.allFilesModified = []
		storageManager.set("allFilesModified", storage.allFilesModified);
		chrome.browserAction.setBadgeText({text:""});
		chrome.browserAction.setTitle({title:""})
	});
}

chrome.notifications.onClicked.addListener(function(notificationId) {
	if (notificationId == "extensionUpdate") {
		createTab("http://jasonsavard.com/wiki/Checker_Plus_for_Google_Drive_changelog");
		chrome.notifications.clear(notificationId, function() {});
		sendGA("extensionUpdateNotification", "clicked notification");
	} else {
		var file = JSON.parse(notificationId);
		chrome.tabs.create({url:file.alternateLink});
		chrome.notifications.clear(notificationId, function() {});
	}
});

chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
	if (notificationId == "extensionUpdate") {
		if (buttonIndex == 0) {
			createTab("http://jasonsavard.com/wiki/Checker_Plus_for_Google_Drive_changelog");
			chrome.notifications.clear(notificationId, function() {});
			sendGA("extensionUpdateNotification", "clicked button - see updates");
		} else if (buttonIndex == 1) {
			localStorage.disabledExtensionUpdateNotifications = "true";
			chrome.notifications.clear(notificationId, function(wasCleared) {
				if (lastNotificationShownDate.diffInSeconds() < -7) { // 25 seconds is approx. the time it takes for the notification to hide, after that let's use the window technique
					// open a window to take focus away from notification and there it will close automatically
					var win = window.open("about:blank", "emptyWindow", "width=1, height=1, top=-500, left=-500");
					win.close();
				}				
			});
			sendGA("extensionUpdateNotification", "clicked button - do not show future notifications");
		}
	} else {	
		var file = JSON.parse(notificationId);
		if (buttonIndex == 0) {
			
			var revisionWindow = openWindowInCenter("revisions.html", "revisions", "", 700, 600);
			revisionWindow.onload = function () {
				revisionWindow.postMessage({file:file}, location.href);
		    }
	
			chrome.notifications.clear(notificationId, function(wasCleared) {
				if (localStorage.lastNotificationShownDate && new Date(localStorage.lastNotificationShownDate).diffInSeconds() < -7) { // 25 seconds is approx. the time it takes for the notification to hide, after that let's use the window technique
					// open a window to take focus away from notification and there it will close automatically
					var win = window.open("about:blank", "emptyWindow", "width=1, height=1, top=-500, left=-500");
					win.close();
				}				
			});
		}
	}
});

chrome.notifications.onClosed.addListener(function(notificationId, byUser) {
	if (notificationId == "extensionUpdate") {
		if (byUser) {
			sendGA("extensionUpdateNotification", "closed notification");
		}
	} else {
		resetModifiedFiles();		
	}
});

chrome.idle.onStateChanged.addListener(function(newState) {
	if (newState == "active") {
		checkForModifiedFiles();
	}
});

chrome.runtime.onInstalled.addListener(function(details) {
	
	if (!localStorage["installDate"]) {
		// Note: Install dates only as old as implementation of this today, Dec. 21st 2012
		localStorage["installDate"] = new Date();
		localStorage["installVersion"] = chrome.runtime.getManifest().version;
	}
	
	// create/recreate this alarm on install AND update
	// note: calling it again simply cancels the first one
	chrome.alarms.create("checkForModifiedFiles", {periodInMinutes:POLLING_INTERVAL});

	//chrome.alarms.create("refreshFiles", {periodInMinutes:60*24}); // once per day

	// call it the first time, the rest will be handled by the alarm 
	checkForModifiedFiles();
	
	if (details.reason == "update") {
		var previousVersionObj = parseVersionString(details.previousVersion)
		var currentVersionObj = parseVersionString(chrome.runtime.getManifest().version);
		if (!localStorage.disabledExtensionUpdateNotifications && (previousVersionObj.major != currentVersionObj.major || previousVersionObj.minor != currentVersionObj.minor)) {
			var options = {
					type: "basic",
					title: "Extension updated!",
					message: "Checker Plus for Google Drive " + chrome.runtime.getManifest().version,
					iconUrl: "images/icon128-whitebg.png",
					buttons: [{title: "See updates", iconUrl: "images/exclamation.png"}, {title: "Do not notify me of updates", iconUrl: "images/cancel.png"}]
			}
			
			chrome.notifications.create("extensionUpdate", options, function(notificationId) {
				if (chrome.runtime.lastError) {
					console.error(chrome.runtime.lastError.message);
				} else {
					lastNotificationShownDate = new Date();
				}
			});
		}
	}

});

if (chrome.runtime.setUninstallURL) {
	chrome.runtime.setUninstallURL("http://jasonsavard.com/uninstalled?app=drive");
}