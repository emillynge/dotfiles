var storageManager;
var storage;
var rotationInterval;
var inANTP;
var lastAction;
var displayedFiles;

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	if (message.action == "accessGranted") {
		location.reload(true);
	}
});

function removeFile(files, file, action, $item) {
	files.splice(file.indexInArray, 1);
	
	if (action != "search") {
		storageManager.set("files", files);
	}
	
	$item.slideUp();
}

function displayFiles(files, action) {
	
	displayedFiles = files;
	
	var $filesDiv = $("#files");
	$filesDiv
		.empty()
		.scrollTop(0)
	;
	if (files && files.length) {
		$.each(files, function(index, file) {
			
			file.indexInArray = index;
			//console.log("file: ", file);
			
			var fileInfo = getIconInfoFromFile(file);
			
			var dateStr = "";
			
			$.each(files, function(index, folder) {
				if (folder && file.parents && file.parents.length && folder.id == file.parents[0].id) {
					file.folderName = folder.title;
					return false;
				}				
			});
			
			var folderName = "";
			if (file.folderName) {
				folderName = file.folderName;
			}
			
			var $fileDiv = $("<div class='item' draggable='true'><img class='icon' src='" + fileInfo.iconSrc + "'/> <span class='title'>" + file.title + "</span><span class='folderName'>" + folderName + "</span><span class='date' style='display:none'>" + dateStr + "</span><div class='fileCommands'><span class='markAsViewed' title='Mark as Viewed'><img src='/images/markAsViewed.png'/></span> <span class='delete' title='Remove'><img src='/images/delete.png'/></span></div></div>");
			
			if (action == "recent" && file.mimeType == MIME_TYPE_FOLDER) {
				$fileDiv.css("display", "none");
			}			
			
			$fileDiv.find("img").on("error", function(){
				$(this).attr("src", "/images/driveIcons/generic.png");
			});
			
			$fileDiv.addClass(fileInfo.fileType);
			
			if (isModifiedAndUnviewedByMe(storage, file)) {
				//console.log("unviewed:", file)
				$fileDiv.addClass("unviewed");
			}
			
			$fileDiv.data("file", file);
			$fileDiv.find(".icon, .title").click({file:file}, function(e) {
				if (e.data.file.mimeType == MIME_TYPE_FOLDER) {
					getStorageItems(function(storageItems) {
						params = storageItems;
						params.lastCommand = "openFolder";
						params.lastAlternateLink = e.data.file.alternateLink;
						params.q = " '" + e.data.file.id + "' in parents ";
						params.sortByName = true;
						performCommand(params, function() {
							
						});			
					});
				} else {					
					e.data.file.lastViewedByMeDate = new Date();
					
					if (localStorage.leftNavItemActive == "recent" || localStorage.leftNavItemActive == "starred") {
						var fileToMovePosition = files.splice(e.data.file.indexInArray, 1);
						files.splice(0,0, fileToMovePosition[0]);
						storageManager.set("files", files);
					}
					
					var url;
					// pixlr was giving me errors
					if (false && e.data.file.defaultOpenWithLink) {
						url = e.data.file.defaultOpenWithLink;
					} else {
						url = e.data.file.alternateLink;
					}
						
					if (inANTP) {
						if (isOpenInBackgroundEvent(e)) {
							window.open(url, '_blank');
						} else {
							top.location.href = url;
						}
					} else {
						chrome.tabs.create({url:url});
					}
				}
			});
			
			$fileDiv.find(".delete").click({file:file}, function(e) {
				$(".statusMessageWrapper").show();
				var $item = $(this).closest(".item");
				initOAuth();
				oAuthForDevices.send({userEmail:"default", type:"post", url: "files/" + e.data.file.id + "/trash"}, function(result) {
					if (result.data) {
						removeFile(files, e.data.file, action, $item);
						$(".statusMessageWrapper").hide();
					} else {
						// returns for 403 if this is a file that we don't have access to but want to remove it from our recent list
						// so we must use the "delete" command instead of the "trash" command
						if (result.jqXHR.status == 403) {
							oAuthForDevices.send({userEmail:"default", type:"DELETE", url: "files/" + e.data.file.id}, function(result) {
								if (result.data) {
									removeFile(files, e.data.file, action, $item);
								} else {
									alert(result.error);
									console.log("Error", result);
								}
								$(".statusMessageWrapper").hide();
							});
						} else {
							alert(result.error);
							console.log("Error", result);
						}
					}					
				});
				
			});

			$fileDiv.find(".markAsViewed").click({file:file}, function(e) {
				$(".statusMessageWrapper").show();
				var $item = $(this).closest(".item");
				initOAuth();
				try {
					var data = {lastViewedByMeDate:new Date().toJSON()};
					oAuthForDevices.send({userEmail:"default", type:"patch", contentType:"application/json; charset=utf-8", url: "files/" + e.data.file.id + "?fields=lastViewedByMeDate", data:JSON.stringify(data)}, function(result) {
						if (result.error) {
							alert(result.jqXHR.responseText);
						} else {
							$item.removeClass("unviewed");
							
							// update files
							getStorageItems(function(storageItems) {
								fetchFiles(storageItems);
							});

						}
						$(".statusMessageWrapper").hide();
					});
				} catch (e) {
					alert("error with send: " + e);
				}
				
			});

			$filesDiv.append($fileDiv);
		});
	} else {
		$filesDiv.text("No files!")
	}
}

if (location.href.indexOf("source=ANTP") != -1) {
	inANTP = true;
	$("html").addClass("antp");
	$("#googleAccounts").attr("target", "_top");
}

function searchFiles(searchStr, callback) {
	
	lastAction = "search";
	
	if (!callback) {
		callback = function() {};
	}
	
	$(".statusMessageWrapper").show();
	initOAuth();
	oAuthForDevices.send({userEmail:"default", url: "files", data:{maxResults:storage.maxItemsToDisplay, q:" trashed = false and title contains '" + encodeURIComponent(searchStr) + "'"}}, function(result) {
		if (result.data) {
			console.log("result", result);
			var files = result.data.items;
			files.sort(function(a, b) {
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
			
			displayFiles(files, "search");			
			callback(files);
		} else {
			callback();
		}
		$(".statusMessageWrapper").hide();
	});
}

function performCommand(storageItems, callback) {
	$(".statusMessageWrapper").show();
	
	port = chrome.runtime.connect();
	port.postMessage({action:"performCommand", params:storageItems});
	port.onMessage.addListener(function(message) {
		$(".statusMessageWrapper").hide();
		console.log("response", message);
		displayFiles(message.files, storageItems.lastCommand);
		callback();
	});
}

$(document).ready(function() {
	
	if (inANTP) {		
		$(window).resize(function() {
			$("#files").css("max-height", ($(window).height()-4)-$("#files").offset().top + "px");
		});
		$(window).resize();
	}
	
	getStorageItems(function(storageItems) {
		storageManager = storageItems.storageManager;
		storage = storageItems.storage;
		
		storage.allFilesModified = [];
		storageManager.set("allFilesModified", storage.allFilesModified);
		
		if (!inANTP) { 
			chrome.browserAction.setBadgeText({text:""});
			chrome.browserAction.setTitle({title:""});
		}
		
		if (localStorage["tokenResponses"]) {
			displayFiles(storage.files, localStorage.leftNavItemActive);

			$("#refresh").click(function() {
				$("#refresh img").addClass("rotate");
				params = storageItems;
				
				params.lastCommand = localStorage.lastCommand;
				params.q = localStorage.q;
				params.sortByName = localStorage.sortByName == "true";

				performCommand(params, function() {
					$("#refresh img").removeClass("rotate");
				});			
			})
			
		} else {
			$("#refresh").hide();
			$("#searchWrapper").hide();
			$("#leftNav").hide();
			$("#permissionIsRequired").show();
			$("#grantPermission").click(function() {
				initOAuth();
				oAuthForDevices.openPermissionWindow();
				$(".statusMessageWrapper").show();
				// the onmessage will listen for the response now...
			})
		}
		
		// mac patch
		if (navigator.platform.toLowerCase().indexOf("mac") != -1 || navigator.platform.toLowerCase().indexOf("linux") != -1 || navigator.platform.toLowerCase().indexOf("unix") != -1) {
			/*
			var totalHeight = 0;
			$("body > :visible").each(function() {
				console.log($(this).attr("id") + ": " + $(this).outerHeight(true));
				totalHeight += $(this).outerHeight(true);
			})
			console.log("totalheight: " + totalHeight)
			*/
			
			// apparently just have to change the height for it to resize correctly
			setTimeout(function() {
				$("body").height( $("body").height() + 1);				
			}, 100)
		}

	});
	
	$("#search").keyup(function(e) {
		if (e.keyCode == 13) {
			searchFiles($(this).val());
		} else if (e.keyCode == 27) {
			window.close();
		} else {
			
			$("#searchAll").fadeIn();
			
			if (lastAction == "search") {
				lastAction = null;
				displayFiles(storage.files);
			}
			
			var searchStr = $(this).val();
			$.each(storage.files, function(index, file) {
				if (file.title.toLowerCase().indexOf(searchStr.toLowerCase()) != -1) {
					console.log("found: ", file);
					$(".item").eq(index).show();
				} else {
					$(".item").eq(index).hide();
				}
			});
			/*
			$(".title").each(function(index, item) {
				if ($(item).text().toLowerCase().indexOf(searchStr.toLowerCase()) != -1) {
					$(this).closest(".item").show();
				} else {
					$(this).closest(".item").hide();
				}
			});
			*/
		}
	});
	
	$("#search").on("search", function(e) {
		if ($(this).val() == "") {
			$("#search").keyup();
		}
	})
	
	$("#search").click(function() {
		$(this).attr("placeholder", "");
	});
	
	$("#searchAll").click(function() {
		searchFiles($("#search").val());
	});
	
	$(".leftNavItem").click(function() {
		var $navItem = $(this);
		var id = $(this).attr("id");
		
		sendGA("leftNavItem", id);
		
		function selectedActiveNav() {
			localStorage.leftNavItemActive = id;
			$("html").attr("leftNavItem", localStorage.leftNavItemActive);
			$(".leftNavItem").removeClass("active");
			$navItem.addClass("active");
		}
		
		if (id == "myDrive") {
			getStorageItems(function(storageItems) {
				params = storageItems;
				params.lastCommand = "myDrive";
				params.q = " 'root' in parents ";
				params.sortByName = true;
				performCommand(params, function() {
					selectedActiveNav()
				});			
			});
		} else if (id == "sharedWithMe") {
			getStorageItems(function(storageItems) {
				params = storageItems;
				params.lastCommand = "sharedWithMe";
				params.q = " sharedWithMe ";
				performCommand(params, function() {
					selectedActiveNav()
				});
			});
		} else if (id == "starred") {
			getStorageItems(function(storageItems) {
				params = storageItems;
				params.lastCommand = "starred";
				params.q = " starred = true ";
				performCommand(params, function() {
					selectedActiveNav()
				});
			});
		} else if (id == "recent") {
			getStorageItems(function(storageItems) {
				params = storageItems;
				params.lastCommand = "recent";
				var lastViewedByMeDate = new Date().subtractDays(60).toJSON();
				params.q = " lastViewedByMeDate > '" + lastViewedByMeDate + "' ";
				performCommand(params, function() {
					selectedActiveNav()
				});
			});
		}
	});
	
	if (localStorage.leftNavItemActive) {
		$("#" + localStorage.leftNavItemActive).addClass("active");
	}
	
	$("#create").click(function() {
		if ($("#createOptions").is(":visible")) {
			$("#createOptions").slideUp();
		} else {
			$("#createOptions").slideDown();
		}
		return false;
	});
	
	$(".createOption").click(function() {
		chrome.tabs.create({url:$(this).attr("link")});
		window.close();
	})
	
	$("#upload").click(function() {
		$("#uploadInputTag").trigger('click');
	});
	
	$("#uploadInputTag").change(function() {
		const boundary = '-------314159265358979323846';
		const delimiter = "\r\n--" + boundary + "\r\n";
		const close_delim = "\r\n--" + boundary + "--";
		
		var files = this.files;
		console.log(files);
		var file = files[0];
		var fileReader = new FileReader();

		$(".statusMessageWrapper").show();
		
		fileReader.onloadend = function() {
			console.log(file);
			var contentType = file.type || 'application/octet-stream';
		    var metadata = {
		      'title': file.name,
		      'mimeType': contentType
		    };

		    var base64Data = btoa(fileReader.result);
		    var multipartRequestBody =
		        delimiter +
		        'Content-Type: application/json\r\n\r\n' +
		        JSON.stringify(metadata) +
		        delimiter +
		        'Content-Type: ' + contentType + '\r\n' +
		        'Content-Transfer-Encoding: base64\r\n' +
		        '\r\n' +
		        base64Data +
		        close_delim;

		    initOAuth();
			oAuthForDevices.send({userEmail:"default", upload:true, type:"post", contentType:'multipart/mixed; boundary="' + boundary + '"', processData:false, url: "?uploadType=multipart", data:multipartRequestBody}, function(result) {
				if (result.data) {
					console.log("response", result);
				} else {
					alert('error: ' + result.error);
				}
				$(".statusMessageWrapper").hide();
				$("#myDrive").click();
			});
			
			/*
		    var request = gapi.client.request({
		        'path': '/upload/drive/v2/files',
		        'method': 'POST',
		        'params': {'uploadType': 'multipart'},
		        'headers': {
		          'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
		        },
		        'body': multipartRequestBody});
		    if (!callback) {
		      callback = function(file) {
		        console.log(file)
		      };
		    }
		    request.execute(callback);
		    */
		}

		fileReader.onabort = fileReader.onerror = function() {
			switch (this.error.code) {
			case FileError.NOT_FOUND_ERR:
				alert("File not found!");
				break;
			case FileError.SECURITY_ERR:
				alert("Security error!");
				break;
			case FileError.NOT_READABLE_ERR:
				alert("File not readable!");
				break;
			case FileError.ENCODING_ERR:
				alert("Encoding error in file!");
				break;
			default:
				alert("An error occured while reading the file!");
				break;
			}

		}

		fileReader.readAsBinaryString(file);
		//fileReader.readAsDataURL(file);
	});

	
	$("#maximize").click(function() {
		var DRIVE_DOMAIN = "https://drive.google.com/";
		if (localStorage.lastCommand == "myDrive") {
			chrome.tabs.create({url:DRIVE_DOMAIN + "#my-drive"});
		} else if (localStorage.lastCommand == "sharedWithMe") {
			chrome.tabs.create({url:DRIVE_DOMAIN + "#shared-with-me"});
		} else if (localStorage.lastCommand == "starred") {
			chrome.tabs.create({url:DRIVE_DOMAIN + "#starred"});
		} else if (localStorage.lastCommand == "recent") {
			chrome.tabs.create({url:DRIVE_DOMAIN + "#recent"});
		} else if (localStorage.lastCommand == "openFolder") {
			chrome.tabs.create({url:localStorage.lastAlternateLink});
		} else {
			chrome.tabs.create({url:DRIVE_DOMAIN});
		}
		window.close();
	})
	
	$("#close").click(function() {
		window.close();
	});
	
	$("body").click(function() {
		$("#createOptions").hide();
	});
	
	var DROPPABLE_ITEM = ".item[class*='folder']";
	var draggedItem; 
	
	$("#files")
		.on("dragstart", ".item", function(e) {
			console.log("dragstart", e);
			draggedItem = e;
			//$(this).addClass("dragging");
		})
		.on("dragenter", DROPPABLE_ITEM, function(e) {
			$(this).addClass("dragging");
		})
		.on("dragleave", DROPPABLE_ITEM, function(e) {
			$(this).removeClass("dragging");
		})
		.on("dragover", DROPPABLE_ITEM, function(e) {
			// we need to prevent the browser's default behavior, which is to navigate to that link
			if (e.preventDefault) {
				e.preventDefault(); // Necessary. Allows us to drop.
			}
			e.originalEvent.dataTransfer.dropEffect = 'move';
			return false;
		})
		.on("drop", DROPPABLE_ITEM, function(e) {
			console.log("drop", draggedItem, e);
			var $draggedItem = $(draggedItem.currentTarget);
			var draggedFile = $draggedItem.data("file");
			var targetFolder = $(e.currentTarget).data("file");
			console.log("source/target", draggedFile, targetFolder);
			
			$(this).removeClass("dragging");
			
			if (e.stopPropagation) {
				e.stopPropagation(); // stops the browser from redirecting.
			}
			
			$(".statusMessageWrapper").show();
			initOAuth();
			
			// to move a file in google drive you must delete the parent and add a parent
			// let's remove parent
			oAuthForDevices.send({userEmail:"default", type:"DELETE", url: "files/" + draggedFile.id + "/parents/" + draggedFile.parents.first().id}, function(result) {
				if (result.error) {
					alert("error: " + result.error);
					$(".statusMessageWrapper").hide();
				} else {
					// let's add parent
					oAuthForDevices.send({userEmail:"default", type:"post", contentType:"application/json; charset=utf-8", url: "files/" + draggedFile.id + "/parents", data:JSON.stringify({id:targetFolder.id})}, function(result) {
						if (result.data) {
							removeFile(displayedFiles, draggedFile, "moved", $draggedItem);
							//$draggedItem.hide();
						} else {
							alert(result.error);
							console.log("Error", result);
						}
						$(".statusMessageWrapper").hide();
					});
				}
				
			});
			
			return false;
		})
		.on("dragend", DROPPABLE_ITEM, function(e) {
			console.log("dragend", e);
			$(this).removeClass("dragging");
			return false;
		})
	;
	
	$("#options").click(function() {
		if ($("#optionsMenu").is(":visible")) {
			$("#optionsMenu").removeClass("visible");
			$("#optionsMenu").slideUp("fast");
		} else {
			$("#optionsMenu").removeClass("visible");
			$("#optionsMenu").slideDown("fast", function() {
				$(this).addClass("visible");
			});
		}
	});
	
	$("#optionsMenu li").click(function() {
		var value = $(this).attr("val");
		
		if (value == "SEP") {
			$("#optionsMenu").removeClass("visible");
			$("#optionsMenu").slideUp();
		} else {
			if (value == "extraFeatures") {
				chrome.tabs.create({url:"donate.html?ref=popup"});
			} else if (value == "optionsPage") {
				chrome.tabs.create({url:"options.html?ref=popup"});
			} else if (value == "changelog") {
				chrome.tabs.create({url:"http://jasonsavard.com/wiki/Checker_Plus_for_Google_Drive_changelog?ref=DriveCheckerOptionsMenu"});				
			} else if (value == "discoverMyApps") {
				chrome.tabs.create({url:"http://jasonsavard.com?ref=DriveCheckerOptionsMenu"});
			} else if (value == "aboutMe") {
				chrome.tabs.create({url:"http://jasonsavard.com/bio?ref=DriveCheckerOptionsMenu"});
			} else if (value == "help") {
				chrome.tabs.create({url:"http://jasonsavard.com?ref=DriveChecker"});
			}			
		}
	});

	$(document).click(function(e) {
		if ($(e.target).attr("id") != "options" && $(e.target).closest("#options").length == 0 && $(e.target).closest("#optionsMenu").length == 0) {
			if ($("#optionsMenu").is(":visible")) {
				$("#optionsMenu").removeClass("visible");
				$("#optionsMenu").slideUp("fast");
			}
		}
	});	
	
});