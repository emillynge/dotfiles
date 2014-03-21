var MIME_TYPE_FOLDER = "application/vnd.google-apps.folder";

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
	}
	
	var params = {};
	params.API = {"installed":{"auth_uri":"https://accounts.google.com/o/oauth2/auth","client_secret":"NX0fDwV8VGDoWIBRx-jZcg59","token_uri":"https://accounts.google.com/o/oauth2/token","client_email":"","redirect_uris":["urn:ietf:wg:oauth:2.0:oob","oob"],"client_x509_cert_url":"","client_id":"305496705996.apps.googleusercontent.com","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs"}}
	params.SCOPE = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.apps.readonly"; // full access
	params.STATE = "CheckerPlusForGoogleDrive"; // roundtrip param use to identify correct code response window (because both gmail and calendar other extensions might popup this window also
	params.BASE_URI = "https://www.googleapis.com/drive/v2/";
	params.UPLOAD_URI = "https://www.googleapis.com/upload/drive/v2/files";
	
	oAuthForDevices = new OAuthForDevices(params, tokenResponses);
	oAuthForDevices.setOnTokenChange(function(params, allTokens) {
		if (params.tokenResponse) {
			//Settings.store("tokenResponses", allTokens);
			localStorage["tokenResponses"] = JSON.stringify(allTokens);
		} else {
			//alert("Error getting access token: " + params.error);
		}
	});
}

function getStorageItems(callback) {
	var storageManager = new StorageManager();
	
	var storageDefaults = {};
	storageDefaults.lastChangeFetchDate = new Date(1);
	storageDefaults.maxItemsToDisplay = 100;
	
	storageManager.get(storageDefaults, function(items) {
		callback({storageManager:storageManager, storage:items});
	});
}

function getAbout(params, callback) {
	var storageManager = params.storageManager;
	var storage = params.storage;

	if (params.force || !storage.about) {
		oAuthForDevices.send({userEmail:"default", url: "about"}, function(result) {
			if (result.data) {
				storage.about = result.data;
				storageManager.set("about", storage.about);
				console.log("about", result.data);
			} else {
				console.warn("Could not fetch 'about' info", result);
			}
			callback(result);
		});	
	} else {
		callback();
	}
}

function refreshFiles(callback) {
	if (!callback) {
		callback = function() {};
	}
	
	getStorageItems(function(response) {
		initOAuth();
		
		var params = response;
		params.lastCommand = localStorage.lastCommand;
		params.q = localStorage.q
		params.sortByName = localStorage.sortByName;

		fetchFiles(response, function(files) {
			callback();
		});
	});
}

function fetchFiles(params, callback) {
	var storageManager = params.storageManager;
	var storage = params.storage;
	
	if (!callback) {
		callback = function() {};
	}
	
	getAbout(params, function(result) {
		var excludeFoldersStr = "";
		
		if (storage.excludeFolders) {
			excludeFoldersStr = " and mimeType != '" + MIME_TYPE_FOLDER + "' ";
		}
		
		if (!params.q) {
			params.q = " hidden = false " + excludeFoldersStr;
		}
		
		params.q += " and trashed = false ";		
		
		oAuthForDevices.send({userEmail:"default", url: "files", data:{maxResults:storage.maxItemsToDisplay, q:params.q}}, function(result) {
			//and lastViewedByMeDate > '1955-11-19T18:20:51.664Z'
			if (result.data && result.data.items) {
				storage.files = result.data.items;
				
				if (params.sortByName) {
					storage.files.sort(function(a, b) {
						
						if (a.mimeType == MIME_TYPE_FOLDER && b.mimeType != MIME_TYPE_FOLDER) {
							return -1;
						} else if (a.mimeType != MIME_TYPE_FOLDER && b.mimeType == MIME_TYPE_FOLDER) {
							return +1;
						} else {
							if (a.title.toLowerCase() > b.title.toLowerCase()) {
								return +1;
							} else {
								return -1;
							}
						}
					});
				} else {
					storage.files.sort(function(a, b) {
						if (!a.lastViewedByMeDate) {
							a.lastViewedByMeDate = "1955-11-19T18:20:51.664Z";
						}
						if (!b.lastViewedByMeDate) {
							b.lastViewedByMeDate = "1955-11-19T18:20:51.664Z";
						}
						if (a.lastViewedByMeDate < b.lastViewedByMeDate) {
							return +1;
						} else {
							return -1;
						}
					});
				}
				storageManager.set("files", storage.files);
				console.log(result.data);
				callback(storage.files);
			} else {
				callback();
			}
		});
	});
}

function getIconInfoFromFile(file) {
	/*
	//mimeType: "application/vnd.google-apps.spreadsheet"
	var lastPeriod = file.mimeType.lastIndexOf(".");
	var fileType = file.mimeType.substring(lastPeriod+1);
	
	if (file.mimeType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileType == "application/msword") {
		fileType = "word";
	} else if (file.mimeType == "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
		fileType = "powerpoint";
	} else if (fileType && fileType.startsWith("audio/")) {
		fileType = "audio";
	} else if (fileType == "application/zip" || fileType == "application/octet-stream") {
		fileType = "generic";
	} else if (fileType && fileType.startsWith("image/")) {
		fileType = "image";
	}
	
	var iconSrc = "/images/driveIcons/" + fileType + ".png";
	
	return {iconSrc:iconSrc, fileType:fileType};
	*/
	
	return {iconSrc:file.iconLink, fileType:file.mimeType};
}

function isModifiedAndUnviewedByMe(storage, file) {
	var signedInUser;
	if (storage.about) {
		signedInUser = storage.about.name;						 
	}
	// not modified by me and change not see by me then bold it
	return signedInUser != file.lastModifyingUserName && file.modifiedByMeDate != file.modifiedDate && new Date(file.modifiedDate).getTime() > new Date(file.lastViewedByMeDate).getTime();
}

function getImageDataURL(url, success, error) {
    var data, canvas, ctx;
    var img = new Image();
    img.onload = function(){
        // Create the canvas element.
        canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        // Get '2d' context and draw the image.
        ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        // Get canvas data URL
        try{
            data = canvas.toDataURL();
            success({image:img, data:data});
        }catch(e){
        	console.error(e);
        }
    }
    // Load image URL.
    try{
        img.src = url;
    }catch(e){
        console.error(e);
    }
}

function buildView(baseContent, newContent, viewType) {
    var base = difflib.stringAsLines(baseContent);
    var newtxt = difflib.stringAsLines(newContent);

    // create a SequenceMatcher instance that diffs the two sets of lines
    var sm = new difflib.SequenceMatcher(base, newtxt);

    // get the opcodes from the SequenceMatcher instance
    // opcodes is a list of 3-tuples describing what changes should be made to the base text
    // in order to yield the new text
    var opcodes = sm.get_opcodes();
    
    var diffNode = diffview.buildView({
        baseTextLines: base,
        newTextLines: newtxt,
        opcodes: opcodes,
        // set the display titles for each resource
        baseTextName: "Last",
        newTextName: "Current",
        contextSize: null,
        viewType: viewType
    });
    
    return diffNode;
}

function compareContent(last, current) {
	// get the baseText and newText values from the two textboxes, and split them into lines
    //var base = difflib.stringAsLines("aa\nabc\ndef\nghi");
    //var newtxt = difflib.stringAsLines("abc\ndeef\nghi\nanother one baby");
	
	var diffNode = buildView(last, current, 0);
    
    console.log(diffNode)
    
    var $diffview = $(diffNode);
    
    var items = [];
    
    $diffview.find("tr").each(function() {
    	var $TDs = $(this).find("td");
    	var $firstTD = $TDs.first();
    	var $lastTD = $TDs.last();
    	
    	var item;
    	if ($lastTD.hasClass("replace")) {
    		item = {title: $lastTD.text(), message: " (changed)"};
    	} else if ($lastTD.hasClass("insert")) {
    		item = {title: $lastTD.text(), message: ""};
    	} else if ($firstTD.hasClass("delete")) {
    		item = {title: $firstTD.text(), message: " (removed)"};
    	}
    	
    	if (item) {
    		item.title = item.title.replace(/\* /, "");
    		if (item.title) {
    			items.push(item);
    		}
    	}
    });
    
    return items;
}

function compareRevisions(fileId, callback) {
	oAuthForDevices.send({userEmail:"default", url: "files/" + fileId + "/revisions"}, function(result) {
		if (result.data) {
			
			var lastRevisionUrl = result.data.items[result.data.items.length-2].exportLinks["text/plain"];
			var currentRevisionUrl = result.data.items[result.data.items.length-1].exportLinks["text/plain"];
			if (currentRevisionUrl) {				
				$.ajax({
					url: currentRevisionUrl,
					complete: function(jqXHR, textStatus) {
						console.log("file1", jqXHR, textStatus)
						var currentRevision = jqXHR.responseText;
						$.ajax({
							url: lastRevisionUrl,
							complete: function(jqXHR, textStatus) {
								console.log("file2", jqXHR, textStatus)
								var lastRevision = jqXHR.responseText;
								callback({currentRevision:currentRevision, lastRevision:lastRevision, revisions:result.data});
							}
						});
					}
				});
			} else {
				callback({notComparable:true});
			}
		} else {
			console.error(result);
		}
	});
}

function ensureFilesRefreshed(filesModifiedFlag, callback) {
	if (filesModifiedFlag) {
		refreshFiles(callback);
	} else {
		callback();
	}
}

function processChanges(storageManager, storage, force2) {
	var lastChangeFetchDate = new Date(storage.lastChangeFetchDate);
	
	initOAuth();
	oAuthForDevices.send({userEmail:"default", url: "changes", data:{startChangeId:storage.largestChangeId}}, function(changesResponse) {
		if (changesResponse.data) {
			
			var filesModified = [];
			
			// logging
			var filesModifiedFlag = false;
			$.each(changesResponse.data.items, function(index, item) {
				var file = item.file;
				if (file && file.modifiedDate) {
					var modifiedDate = new Date(file.modifiedDate);					
					if (modifiedDate.isAfter(lastChangeFetchDate)) {
						filesModifiedFlag = true;
						return false;
						//localStorage[new Date() + "_" + index] = file.title + " " + item.deleted + " " + new Date(item.modificationDate);
					}
				} else {
					//localStorage[new Date() + "_" + index] = file.title + " file.modifiedDate not exist " + item.deleted + " " + new Date(item.modificationDate);
				}
			});
			
			ensureFilesRefreshed(filesModifiedFlag, function() {
				$.each(changesResponse.data.items, function(index, item) {
					// make sure it has been atleast modified once by me (because it is blank when a document is first shared)
					var file = item.file;
					if (file && file.modifiedByMeDate) {
						console.log("modified atleast once by me")
						
						// make it has not been modified by me
						if (force2 || isModifiedAndUnviewedByMe(storage, file)) {
							console.log("has been modified by someone")
							var modifiedDate = new Date(file.modifiedDate);
							console.log("modified date: " + modifiedDate)
							console.log("last fet date: " + lastChangeFetchDate)
							if (force2 || modifiedDate.isAfter(lastChangeFetchDate)) {
								
								compareRevisions(file.id, function(response) {
									
									var items;
									if (response.currentRevision) {								
										items = compareContent(response.lastRevision, response.currentRevision);
									} else {
										items = null;
									}
									
									/*
									// update file in array for bolding purposes etc.
									if (storage.files) {
										$.each(storage.files, function(index, fileInArray) {
											if (fileInArray.id == file.id) {
												console.log("update in array")
												copyObj(file, fileInArray);
												storageManager.set("files", storage.files);
												return false;
											}
										});
									}
									*/
									
									var fileInfo = getIconInfoFromFile(file);
									var dateStr;
									if (modifiedDate.isToday()) {
										dateStr = "at " + modifiedDate.format("h:mmtt");
									} else if (modifiedDate.isYesterday()) {
										dateStr = "yesterday at " + modifiedDate.format("h:mmtt");
									} else {
										dateStr = modifiedDate.format(" - ddd. h:mmtt");
									}
									
									var options = {
											priority: 2,
											title: file.title + " (modified) by " + file.lastModifyingUserName + " " + dateStr,
											iconUrl: fileInfo.iconSrc.replace("_list", "_xl128") // do this to pull large icon 128px
											// iconSrc is originally https://ssl.gstatic.com/docs/doclist/images/icon_11_document_list.png
											// but we are converting it to https://ssl.gstatic.com/docs/doclist/images/icon_11_document_xl128.png
									}

									if (items && items.length) {
										options.type = "list";
										options.message = items.length + " changes";
										options.items = items;
									} else {
										options.type = "basic";
									}

									if (response.currentRevision) {
										options.buttons = [{title:"See revisions"}];
									}
									
									console.log("options: ", options);
									
									chrome.notifications.getAll(function(notifications) {
										var notifAlreadyOpened = false;
										var notificationId = JSON.stringify(file);
										console.log(notifications);
										for (openNotificationId in notifications) {
											var notificationFile = JSON.parse(openNotificationId);
											if (notificationFile.id == file.id) {
												notifAlreadyOpened = true;
												chrome.notifications.update(notificationId, options, function(wasUpdated) {
													if (chrome.runtime.lastError) {
														console.error(chrome.runtime.lastError.message);
													}
													console.log("updated: " + wasUpdated);
												});
											}
										}
										if (!notifAlreadyOpened) {
											chrome.notifications.create(notificationId, options, function(notificationId) {
												if (chrome.runtime.lastError) {
													console.error(chrome.runtime.lastError.message);
												} else {
													localStorage.lastNotificationShownDate = new Date();
												}
												console.log("created");
											});															
										}
									});
								});
								
								/*
								var notification = webkitNotifications.createNotification(fileInfo.iconSrc, file.title + " (modified)", "by " + file.lastModifyingUserName + " " + dateStr);
								notification.file = file;
								notification.onclick = function() {
									chrome.tabs.create({url:this.file.alternateLink});
									storage.allFilesModified = []
									storageManager.set("allFilesModified", storage.allFilesModified);
									chrome.browserAction.setBadgeText({text:""});
									chrome.browserAction.setTitle({title:""})
									this.close();
								}
								notification.ondisplay = function() {
									// do this because this is lost in settimeout
									var thisNotification = this;
									setTimeout(function() {
										thisNotification.close();											
									}, 15 * ONE_SECOND);
								}
								notification.show();
								*/
								
								filesModified.push(file);							
							}
						}
					}
				});
				
				if (filesModified.length) {
					
					// merge these modified files with all previous
					if (!storage.allFilesModified) {
						storage.allFilesModified = [];
					}
					
					$.each(filesModified, function(index, fileModified) {
						var alreadyAdded = false;
						$.each(storage.allFilesModified, function(index2, allFileModified) {
							if (allFileModified.id == fileModified.id) {
								// already modified previous so don't re-add it
								alreadyAdded = true;
								return false;
							}
						});
						if (!alreadyAdded) {
							storage.allFilesModified.push(fileModified);
						}
					});

					
					var filesModifiedStr = "";
					$.each(storage.allFilesModified, function(index, fileModified) {
						filesModifiedStr = "\n" + fileModified.title;
					});
					
					storageManager.set("allFilesModified", storage.allFilesModified);
					chrome.browserAction.setBadgeText({text:storage.allFilesModified.length.toString()});
					chrome.browserAction.setTitle({title:"File(s) modified..." + filesModifiedStr})
				}
				
				console.log("largestChangeId: " + changesResponse.data.largestChangeId)
				
				// comment for testing
				storage.largestChangeId = changesResponse.data.largestChangeId;
				storageManager.set("largestChangeId", storage.largestChangeId);

				storage.lastChangeFetchDate = new Date();
				// must set date to string or else on loading storage the value is an useless object???
				storageManager.set("lastChangeFetchDate", storage.lastChangeFetchDate.toString());

				console.log(changesResponse.data);
			});
			
		}
	});
}