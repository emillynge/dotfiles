var Settings = bg.getSettings();
var accounts = bg.accounts;
var inNotificationWindow = getUrlValue(location.href, "notificationWindow");
var simulateToolTips;
var mouseInPopup = false;
var mouseHasEnteredPopupAtleastOnce = false;

var totalUnreadCount = bg.unreadCount;
var totalVisibleMails;
var photosDisplayed;
var MAX_PHOTOS_TO_SHOW = 20; // so we don't do too many oauth calls
var initialInboxesWidth;
var squezedInboxesWidth;
var FIXED_RIGHT_MARGIN = 20;
var FIXED_RIGHT_MARGIN_IN_NOTIF = 15;
var fixedRightMargin = inNotificationWindow ? FIXED_RIGHT_MARGIN_IN_NOTIF : FIXED_RIGHT_MARGIN;
var closeTimeout;
var searchTimeout;
var contacts;
var contactsScrollHeight;
var hoveringInMuteVoiceDropDown;
var muteVoiceDropDownShowTimeout;
var $scrollingMail;
var scrollingMailInterval;
var scrollingDirection;

var emailCount;
var firstReadEmailPosition;
var lastUnreadEmailPosition;
var showReadEmails;
var previousSelectedLabelIndex = -1;
var lastKeyPressedEvent;
var emailPreviewed = false;
var animationDuration;
var $fixedArea;
var backToInboxClicked;

bg.ChromeTTS.stop();

if (false && !inNotificationWindow && accounts && accounts.length && accounts.first().getAddress() == atob("amFzb25zYXZhcmRAZ21haWwuY29t")) {
	chrome.tabs.query({active:true}, function(tabs) {
		var gmailTab = tabs[0];
		chrome.tabs.insertCSS(gmailTab.id, {file:"css/speechRecognition.css"}, function() {
			chrome.tabs.executeScript(gmailTab.id, {file: "js/jquery.min.js"}, function() {
				chrome.tabs.executeScript(gmailTab.id, {file:"js/speechRecognition.js", allFrames:false});
			});
		});
	});
}

function initShowTransitions() {
	if (Settings.read("showTransitions")) {
		animationDuration = 400;
		$.fx.off = false;
	} else {
		animationDuration = 0;
		$.fx.off = true;
	}
}

function temporailyDisableTransitions() {
	$.fx.off = true;
	setTimeout(function() {
		initShowTransitions();		
	}, 1000)
}

function showMessage(msg) {
	$("#statusMessage")
		.text(msg)
	;
	$(".statusMessageWrapper").show();
	setTimeout(function() {
		$(".statusMessageWrapper").fadeOut(function() {
			$("#statusMessage")
				.text( getMessage("loading") )
			;
		});
	}, 4000);
}

function showErrorMessage(msg) {
	$("#statusMessage")
		.addClass("error")
		.text(msg)
	;
	$(".statusMessageWrapper").show();
	setTimeout(function() {
		$(".statusMessageWrapper").fadeOut(function() {
			$("#statusMessage")
				.removeClass("error")
				.text( getMessage("loading") )
			;
		});
	}, 4000);
}

function stretchWindow() {
	if (location.href.indexOf("externalPopupWindow") == -1) {
		$("#stretcher").show();
		$("#stretcher").width( $("body").width() );
	}
}

function setCloseTimeout() {
	if (inNotificationWindow) {
		var timeout = Settings.read("dn_timeout");
		if (timeout != 0) {
			closeTimeout = setTimeout(function () {
				window.close();
			}, timeout);
		}
	}
}

function initFixedArea() {
    $fixedArea.addClass('fixed');
    var width = inNotificationWindow ? 18 : 19; // must balance with scrollbar width ie. :-webkit-scrollbar width:xx 
	$fixedArea.css("right", width + "px");
}

function hideFullEmail(callback) {
	if ($fixedArea) {
		$fixedArea.removeClass('fixed');
	}
	if (!callback) {
		callback = function() {};
	}
   	$("#fullEmail").slideUp();
   	
   	if (inNotificationWindow) {
   		$("#scrollArea").animate({
   		    left: 0
   		}, animationDuration, function() {
   			$("#inboxes").removeClass("squished");
   			callback();
   		});
   	} else {
   		$("#inboxes").animate({
   		    width: initialInboxesWidth
   		}, animationDuration, function() {
   			$("#inboxes").removeClass("squished");
   			callback();
   		});
   	}
	
	//$(".mail").removeClass("selected");
}

function setFixedWidth() {
	// set an exact width instead of 100%
	initialInboxesWidth = $("#inboxes").width();		
	$("#inboxes").css("width", initialInboxesWidth);
}

function getURLOrRedirectURL($node) {
	var url = $node.attr("href");
	
	// remove google redirection
	// ex. "http://www.google.com/url?q=http%3A%2F%2Fjasonsavard.com%2Fwiki"
	if (url) {
		var urlRedirect = url.match("^https?://www\.google\.com/url\\?q=(.*)");
		if (urlRedirect) {
			// only pull the q param because google redirect adds other params
			url = getUrlValue(url, "q");
			url = decodeURIComponent(url);
		}
	}
	return url;
}

function interceptClicks($node, mail) {
	console.log("intercept redirects");

	// add tooltip for links
	$node.each(function() {
		if (!$(this).attr("title")) {
			var url = getURLOrRedirectURL($(this));
			if (url) {
				$(this).attr("title", url.summarize(50));
			}
		}
	});
	
	// change links if necessary
	$node.off("click").on("click", {mail:mail}, function(event) {
		
		var url = getURLOrRedirectURL($(this));
		$(this).attr("href", url);
		
		// found relative link which used to be a mailto ex. ?&v=b&cs=wh&to=ebottini@gmail.com
		var mailto = url.match("^\\?.*&to=(.*)");
		if (mailto) {
			// Getting this value from Gmail (notice the 2 question marks! : ?&v=b&cs=wh&to=unsubscribe@salesforce.com?Subject=Opt+Out
			// let's replace all question mark
			url = url.replaceAll("?", "&");
			
			var params = {};
			params.to = getUrlValue(url, "to");
			params.subject = getUrlValue(url, "subject");
			params.body = getUrlValue(url, "body");
			//event.data.mail.account.compose({to:to});
			// https://mail.google.com/mail/u/0/?ui=2&view=btop&ver=1pxvtfa3uo81z#to%253Dunsubscribe%252540salesforce.com%2526cmid%253D8
			// ?&v=b&cs=wh&to=unsubscribe@salesforce.com?Subject=Opt+Out

			var composeObj = event.data.mail.account.generateComposeObject(params);
			openTabOrPopup(composeObj);
			
		    //var urlToOpen = event.data.mail.account.getMailUrl() + url;		    
		    //openTabOrPopup({url:urlToOpen, account:event.data.mail.account});
			
			event.preventDefault();
			event.stopPropagation();
		}

		// if user holds ctrl or middle click then open link in a tab while keeping popup window open
		if (event.ctrlKey || event.which == 2) {
			console.log(event);
			chrome.tabs.create({url:url, active:false});
			event.preventDefault();
			event.stopPropagation();
		} else {
			if (url) {
				$(this).attr("href", url);
			}
		}
	});
}

function showImages($node) {
	var html = $node.html();
	html = html.replace(/<imghidden/g, "<img");
	html = html.replace(/\/imghidden>/g, "/img>");
	$node.html( html );
}

function setFocusToComposeInput(scrollIntoView) {
	var $composeInput = $(".composeInput");
	$composeInput
		.click()
		.focus()
	;
	if (scrollIntoView) {
		$composeInput.get(0).scrollIntoView();
	}
}

function showFullEmail(params, callback) {
	
	if (!callback) {
		callback = function() {};
	}
	
	$(".statusMessageWrapper").show();
	
	var $mail = params.$mail;
	var mail = $mail.data("data");
	
	if (!initialInboxesWidth) {		
		setFixedWidth();

		var hideLeftColumnWhenPreviewingEmail = !Settings.read("showLeftColumnWhenPreviewingEmail") || inNotificationWindow || params.previewFromNotification;
		if (hideLeftColumnWhenPreviewingEmail) {
			squezedInboxesWidth = 0;
		} else {
			squezedInboxesWidth = initialInboxesWidth * 0.40;
		}
		//$("#scrollArea").css("width", "2200px");
	}	
	
	setTimeout(function() {

		var $fullEmail = $("#fullEmail");
		var currentlyOpenFullEmail = $("#fullEmail").data("data"); 
		
		if (!params.forceDisplayImages && currentlyOpenFullEmail && currentlyOpenFullEmail.id == mail.id && $fullEmail.is(":visible")) {
			hideFullEmail();
			$(".statusMessageWrapper").hide();
			callback();
		} else {
			$fullEmail.data("data", mail);
			
			if (!$("#inboxes").hasClass("squished")) {
				$("#inboxes").addClass("squished");
				
				if (inNotificationWindow) {
					$("#scrollArea").animate({
					    left: -298
					}, animationDuration, ["swing"], function() {
						initialInboxesWidth = $("#body").width();
						
						// because #inboxes has a margin-right:5px so remove it from here
						var marginRight;
						if (inNotificationWindow) {
							marginRight = 0;
						} else {
							marginRight = 6;
						}
						$("#fullEmailContent").css("width", initialInboxesWidth-squezedInboxesWidth-marginRight);
					});
				} else {
					// because #inboxes has a margin-right:5px so remove it from here
					var marginRight;
					if (inNotificationWindow) {
						marginRight = 0;
					} else {
						marginRight = 6;
					}
					
					stretchWindow();
					
					$("#fullEmailContent").css("width", initialInboxesWidth-squezedInboxesWidth-marginRight);
					
					$("#inboxes").animate({
					    width: squezedInboxesWidth
					}, animationDuration, ["swing"], function() {
						initialInboxesWidth = $("#body").width();
						$("#fullEmailContent").css("width", initialInboxesWidth-squezedInboxesWidth-marginRight);
					});
				}
			}

			if (inNotificationWindow) {
				// save height because the notification window sometimes gets smaller after removing the selected class, so prevent that
				//$("html").css("height", $("html").height());
			}

			$(".mail").removeClass("selected");
			$mail.addClass("selected")

			mail.getThread(params, function(response) {
				if (response.error) {
					//alert("Error: " + response.error);
					showErrorMessage(response.error + ", please try again later!");
					logError("error in getThread: " + response.error);
					callback();
				} else {
					var markAsReadSetting = Settings.read("showfull_read");
					var zoomChanged = false;
					
					$("#fullEmailActionButtons").find(".emailZoom").val(100);
					
					if (markAsReadSetting || $mail.hasClass("read")) {
						$("#fullEmailActionButtons").find(".markAsRead").hide();
						$("#fullEmailActionButtons").find(".markAsUnread").show();
					} else {
						$("#fullEmailActionButtons").find(".markAsRead").show();
						$("#fullEmailActionButtons").find(".markAsUnread").hide();
					}

					$("#fullEmailActionButtons").find(".markAsUnread").off("click").on("click", {mail:mail, $mail:$mail}, function(event) {						
						markAsUnread(event.data.$mail, event.data.mail);
						hideFullEmail();
						sendGA(['_trackEvent', "emailView", "markAsUnread"]);
					});

					$("#fullEmailActionButtons").find(".markAsRead").off("click").on("click", {mail:mail, $mail:$mail}, function(event) {
						markAsRead(event.data.$mail);
						hideFullEmail();
						sendGA(['_trackEvent', "emailView", "markAsRead"]);
					});

					$("#fullEmailActionButtons").find(".listenToEmail").off("click").on("click", {mail:mail, $mail:$mail}, function(event) {
						if ($(this).find("img").attr("src").indexOf("play") != -1) {
							bg.ChromeTTS.queue(event.data.mail.getLastMessageText(), {}, function() {
								$("#fullEmailActionButtons").find(".listenToEmail img").attr("src", "/images/play.png");
							});
							$(this).find("img").attr("src", "/images/stop.png");
						} else {
							bg.ChromeTTS.stop();
							$(this).find("img").attr("src", "/images/play.png");
						}
						sendGA(['_trackEvent', "emailView", "listenToEmail"]);
					});

					$("#fullEmailActionButtons").find(".emailZoom").off("change").on("change", {mail:mail, $mail:$mail}, function(event) {
						
						if (!zoomChanged) {
							$fullEmailSenderAreas.find(".open, .reply").find("div").addClass("opacityPatch");
						}
						
						var $messageContents = $fullEmailContent.find(".messageContent");
						
					    initFixedArea();
						
					    $messageContents.addClass("zoomed");
					    $messageContents.css("zoom", $(this).val() + "%");
							
			    	  	zoomChanged = true;
					})

					$("#fullEmailActionButtons").find(".delete").off("click").on("click", {mail:mail, $mail:$mail}, function(event) {
						event.data.mail.deleteEmail();
						hideFullEmail();
						hideMail(event.data.$mail, "delete");
						sendGA(['_trackEvent', "emailView", "delete"]);
					});		

					$("#fullEmailActionButtons").find(".archive").off("click").on("click", {mail:mail, $mail:$mail}, function(event) {
						event.data.mail.archive();
						hideFullEmail();
						hideMail(event.data.$mail, "archive");
						sendGA(['_trackEvent', "emailView", "archive"]);
					});		

					$("#fullEmailActionButtons").find(".spam").off("click").on("click", {mail:mail, $mail:$mail}, function(event) {
						event.data.mail.markAsSpam();
						hideFullEmail();
						hideMail(event.data.$mail, "spam");
						sendGA(['_trackEvent', "emailView", "spam"]);
					});		
					
					$("#fullEmailActionButtons").find(".moveLabel, .labels").off("click").on("click", {mail:mail, $mail:$mail}, function(event) {
						var $buttonClicked = $(this);
						$(this).blur();
						
						var $labelsDropDownWrapper = $(".labelsDropDownWrapper");
						if ($labelsDropDownWrapper.is(":visible")) {
							$labelsDropDownWrapper.slideUp();
							return;
						}
						var $labelsDropDown = $labelsDropDownWrapper.find(".labelsDropDown");
						
						$labelsDropDownWrapper.find(".labelsSearch").off("keyup").on("keyup", function(event) {
							$visibleLabels = $labelsDropDown.find("div:visible");
							console.log("visible here top ", $visibleLabels)
							if (event.keyCode == 40) { // down arrow
								var $previousSelected = $visibleLabels.filter(".selected");
								if ($visibleLabels.length == 1) {
									return;
								} else {
									$previousSelected.removeClass("selected");
									if (previousSelectedLabelIndex >= ($visibleLabels.length-1)) { // at end so loop back up
										$visibleLabels.first().addClass("selected");								
										previousSelectedLabelIndex = 0;
									} else { // select next one
										previousSelectedLabelIndex++;
										$visibleLabels.eq(previousSelectedLabelIndex).addClass("selected");
									}
								}
							} else if (event.keyCode == 38) { // up arrow							
								
								var $previousSelected = $visibleLabels.filter(".selected");
								if ($visibleLabels.length == 1) {
									return;
								} else {
									$previousSelected.removeClass("selected");
									if (previousSelectedLabelIndex <= 0) { // at end so loop back bottom
										$visibleLabels.last().addClass("selected");								
										previousSelectedLabelIndex = ($visibleLabels.length-1);
									} else { // select next one
										previousSelectedLabelIndex--;
										$visibleLabels.eq(previousSelectedLabelIndex).addClass("selected");
									}
								}
								
							} else if (event.keyCode == 13) { // up arrow
								$visibleLabels.filter(".selected").click();
							} else {				
								previousSelectedLabelIndex = 0;
								var searchText = $(this).val().toLowerCase();
								$labelsDropDown.find("div").each(function() {
									$(this).removeClass("selected");
									if ($(this).text().toLowerCase().indexOf(searchText) != -1) {									
										$(this).show();
									} else {
										$(this).hide();
									}
								});
								$labelsDropDown.find("div:visible").first().addClass("selected");
							}
						});
						
						$(".statusMessageWrapper").show();
						event.data.mail.account.getLabels(false, function(params) {
							$(".statusMessageWrapper").hide();
							
							$labelsDropDown.empty();
							
							if (params.labels) {
								$.each(params.labels, function(i, label) {
									var $item = $("<div/>");
									$item.text(label)
									$item.hover(function() {
										$labelsDropDown.find("div").removeClass("selected");
										$(this).addClass("selected");
									});
									
									var $option = $("<option/>");
									$option.attr("value", label);
									
									$item.click({mail:mail, $mail:$mail}, function(event) {
										$(".labelsDropDownWrapper").hide();
										if ($buttonClicked.hasClass("moveLabel")) {
											event.data.mail.moveLabel($(this).text());
											hideFullEmail();
										} else {
											var labelSelected = $(this).text();
											event.data.mail.applyLabel(label, function(params) {
												if (params.error) {
													showErrorMessage(params.error + " please try again later!");
												} else {
													showMessage("The conversation has been added to \"" + labelSelected + "\"");
												}
											});
										}
									});
									
									$labelsDropDown.append($item);
								});
								var top = $buttonClicked.position().top;
								var left = $buttonClicked.position().left;
								top += $buttonClicked.height() + 11;
								$labelsDropDownWrapper.css("top", top);
								$labelsDropDownWrapper.css("left", left);
								$labelsDropDownWrapper.slideDown();
							} else {
								showErrorMessage("Sorry, problem fetching labels, try again later! Error: " + params.error);
								logError("error fetching labels: " + params.error);
							}
							$labelsDropDownWrapper.find(".labelsSearch").focus();
						});
						
						
						sendGA(['_trackEvent', "emailView", "labels"]);
					});		

					$("#fullEmailContent").off("click")
						.on("click", ".fullEmailSenderArea .star", {mail:mail, $mail:$mail}, function(event) {
							$(this).addClass("clicked");
							//rotate($(this));
							event.data.mail.star();							
							sendGA(['_trackEvent', "emailView", "star"]);
							return false;
						})
						.on("click", ".fullEmailSenderArea .open", {mail:mail, $mail:$mail}, function(event) {
							var openParams = {};
							if (event.ctrlKey || event.which == 2) {
								openParams.openInNewTab = true;
							}
							event.data.mail.open(openParams);
							sendGA(['_trackEvent', "emailView", "open"]);
							setTimeout(function() {
								window.close();
							}, 100);
							return false;
						})
						.on("click", ".fullEmailSenderArea .reply", {mail:mail, $mail:$mail}, function(event) {
							event.data.mail.reply();
							sendGA(['_trackEvent', "emailView", "reply"]);
							setTimeout(function() {
								window.close();
							}, 100);
							return false;
						})
						.on("click", ".fullEmailSenderArea", {mail:mail, $mail:$mail}, function(event) {
							var $message = $(this).closest(".message");
							$message.toggleClass("collapsed");
							sendGA(['_trackEvent', "emailView", "threadExpand"]);
							return false;
						})
						.on("click", ".fullEmailShowToCC", {mail:mail, $mail:$mail}, function(event) {
							var message = $(this).closest(".message").data("message");
							
							var $fullEmailToCC = $(this).parent().find(".fullEmailToCC");							
							var fullDetails = $fullEmailToCC.data("fullDetails");							
							$fullEmailToCC.html(fullDetails).addClass("showDetails");							
					   		$(this).hide();
					   		sendGA(['_trackEvent', "emailView", "toCC"]);
							return false;
						})
					;
					
					$("#fullEmailSubject")
						.html(mail.title)
						.attr("title", mail.title)
					;

					var $fullEmailBody = $("<div class='fullEmailBody'/>");
					
					console.log("response", response);
					
					if (mail.messages && mail.messages.last()) {
						$.each(response.mail.messages, function(index, message) {

							console.log("message", message);

							var $message = $("<div class='message'/>");
							$message.data("message", message);
							
							// patch for error "Code generation from strings disallowed for this context"
							// the error would occur if I use jQuery's .append but not!!! if I initially set the content with $()
							var $messageContent = $("<div class='messageContent'>" + message.content + "</div>");
							
							fixRelativeLinks($messageContent);
							
							if (Settings.read("accountAddingMethod") != "autoDetect") {
								if (Settings.read("alwaysDisplayExternalContent")) {
									// put back the imghidden to img (note: we had to manually change these when retreving the message to avoid fetching the images)
									var filteredHTML = $messageContent.html();
									if (filteredHTML.indexOf("<imghidden") != -1) {
										showImages($messageContent);
									}
								} else {
									var externalContentHidden = false;
		
									if (!params.forceDisplayImages) {
										$messageContent.find("img, imghidden, input[src]").each(function() {
											var src = $(this).attr("src");
											if (src && !src.match("https?://mail.google.com/")) {
												$(this).removeAttr("src");
												externalContentHidden = true;
											}
										});
		
										$messageContent.find("*[background]").each(function() {
											$(this).removeAttr("background");
											externalContentHidden = true;
										});
										
										$messageContent.find("*[style*='background:'], *[style*='background-image:']").each(function() {
											var style = $(this).attr("style");
											style = style.replace(/background/ig, "backgroundDISABLED");
											$(this).attr("style", style);
											externalContentHidden = true;
										});
									} else if (params.forceDisplayImages && Settings.read("accountAddingMethod") == "oauth") {
										showImages($messageContent);
									}
									
									if (externalContentHidden) {
										$("#fullEmailSubject").addClass("displayImages");
										$("#fullEmailDisplayImagesWrapper").show();
										
										$("#fullEmailDisplayImagesLink, #fullEmailAlwaysDisplayImagesLink").off("click").on("click", {mail:mail, $mail:$mail}, function(event) {
											
											// in autodetect - img is always converted to imghidden (refer to patch 101) so we must refetch the thread
											if (Settings.read("accountAddingMethod") == "autoDetect") {
												event.data.mail.messages = null;
											}
											
											showFullEmail({$mail:event.data.$mail, forceDisplayImages:true});
											
											if ($(this).attr("id") == "fullEmailAlwaysDisplayImagesLink") {
												Settings.store("alwaysDisplayExternalContent", true);
											}
											$("#fullEmailSubject").removeClass("displayImages");
											$("#fullEmailDisplayImagesWrapper").hide();
										});
									} else {
										$("#fullEmailSubject").removeClass("displayImages");
										$("#fullEmailDisplayImagesWrapper").hide();
									}
								}
							}
							
							$messageContent.find(".gmail_extra, blockquote[type='cite']").each(function(index, gmailExtra) {
								var $trimmedContent = $(this);
								$trimmedContent.hide();
								var $elipsis = $("<div class='showTrimmedContent' title='Show trimmed content'>...</div>");
								$elipsis.click(function() {
									$trimmedContent.toggle();
								});
								$trimmedContent.before($elipsis);
							});

							var $threadHeader = $("#mailTemplate").clone();							
							$threadHeader.removeAttr("id");
							
							$threadHeader.find(".author")
								.text( message.from.name )
								.attr("title", message.from.email )
							;
							
							var textContent = message.textContent;
							if (textContent) {
								if (inNotificationWindow) {
									textContent = textContent.summarize(35);
								} else {
									textContent = textContent.summarize(60);
								}
								$threadHeader.find(".summary").html( textContent );
							}
							
							var dateStr = message.dateStr;						
							if (message.date) {
								dateStr = message.date.displayDate(true);
								$threadHeader.find(".date").data("data", dateStr);
							}
							$threadHeader.find(".date").html( dateStr );
							
							var toCCArray = [];
							var toFullDetailsArray = [];
							var ccFullDetailsArray = [];
							
							if (message.to) {
								$.each(message.to, function(index, to) {
									toCCArray.push(pretifyRecipientDisplay(to, mail.account.getAddress()));
									toFullDetailsArray.push(fullRecipientDisplay(to));
								});
							}
							if (message.cc) {
								$.each(message.cc, function(index, cc) {
									toCCArray.push(pretifyRecipientDisplay(cc, mail.account.getAddress()));
									ccFullDetailsArray.push(fullRecipientDisplay(cc));
								});
							}

							var toCCHTML = getMessage("to") + " " + toCCArray.join(", ");
							var toCCFullDetailsHTML = getMessage("to") + ": " + toFullDetailsArray.join(", ");
							
							if (message.cc && message.cc.length) {
								toCCFullDetailsHTML += "<br>cc: " + ccFullDetailsArray.join(", ");
							}
							
							if (message.bcc && message.bcc.length) {
								toCCHTML += ", bcc: " + pretifyRecipientDisplay(message.bcc.first(), mail.account.getAddress());
								toCCFullDetailsHTML += "<br>bcc: " + fullRecipientDisplay(message.bcc.first());
							}
	
							$threadHeader.find(".fullEmailToCC")
								.html(toCCHTML)
								.data("fullDetails", toCCFullDetailsHTML)
							;

							if (Settings.read("showContactPhoto")) {
								var $imageNode = $threadHeader.find(".contactPhoto");
								if (photosDisplayed < MAX_PHOTOS_TO_SHOW) {
									// function required to keep imageNode in scope
									
									// must clone from object so as to not modify it when appending mail ...
									var contactPhotoParams = $.extend({}, message.from);
									contactPhotoParams.mail = mail;
									
									setContactPhoto(contactPhotoParams, $imageNode);								
									photosDisplayed++;
								}
							}

							// only collapse if not the last thread (leave the last one expanded)
							if (index < response.mail.messages.length-1) {
								
								// it's an email from this user, so ignore/collapse it
								if (message.from.email == mail.account.getAddress()) {
									$message.addClass("collapsed");
								} else {
								   if (message.date) {
									   var lastCheckedEmail = localStorage["lastCheckedEmail"];
									   if (lastCheckedEmail) {
										   lastCheckedEmail = new Date(lastCheckedEmail);
										   console.log(" diff ours: " + message.date.diffInHours() + " parse/lastch: " + message.date.diffInSeconds(lastCheckedEmail))
										   console.log(" diff ours: " + message.date.diffInHours() + " parse/lastch: " + message.date.toString() + " " + lastCheckedEmail.toString())
										   
										   // more than 24 hours collapse it before last "supposedly" user checked emails
										   if (message.date.diffInHours() <= -24 || message.date.diffInSeconds(lastCheckedEmail) < 0) {
											   console.log("collapsed")
											   $message.addClass("collapsed");
										   }
									   } else {
										   // never last checked, might be first install or something so collapse all
										   $message.addClass("collapsed");
									   }
								   } else {
									   // can't parse the dtes so let's only collapse last
									   $message.addClass("collapsed");
								   }
								}
							}
							
							$threadHeader.show();
							
							// generate header
							var $fullEmailSenderArea = $("<div class='fullEmailSenderArea'/>");
							$fullEmailSenderArea.append($threadHeader);
	
							// generate message
							$message.append($fullEmailSenderArea);
							$message.append($messageContent);
							
							$fullEmailBody.append($message);
						});
					} else {
						// happens sometimes if a single message from the thread was deleted (ie. using "Delete this message" from dropdown on the right of message in Gmail)
						$fullEmailBody.html("Problem retreiving message!");
					}
					
					console.log("fullemailbody", $fullEmailBody);
					
					var $fullEmailContent = $("#fullEmailContent");
					$fullEmailContent
						.empty()
						.scrollTop(0)
						.scrollLeft(0)
						.append($fullEmailBody)
					;
					
					var $fullEmailSenderAreas = $fullEmailContent.find(".fullEmailSenderArea");
					
					var $replyArea = $("<div class='composeWrapper'><div class='sentMessage'>Sent</div><textarea class='composeInput' dir='auto' tabindex=0></textarea><div class='clickHereToReply'>Click here to <span class='composeAreaReply'>Reply</span><span class='replyToAllText'>, <span class='replyToAllLink'>Reply to all</span></span></div><div class='composeRightWrapper'><div class='button sendAndArchive'><div>" + "Send + Archive" + "</div></div><div class='button send' title='Send (Ctrl-Enter)'><div>" + getMessage("send") + "</div></div></div></div>");
					
					if (Settings.read("showSendAndArchiveButton")) {
						$replyArea.find(".composeRightWrapper").addClass("showSendAndArchive");
					}
					
					if (mail.messages && mail.messages.last()) {
						var totalRecipients = 0;
						if (mail.messages.last().to) {
							totalRecipients += mail.messages.last().to.length;
						}
						if (mail.messages.last().cc) {
							totalRecipients += mail.messages.last().cc.length;
						}
						
						if (totalRecipients >= 2) {
							console.log("show reply all")
							$replyArea.find(".replyToAllText").show();
						}
					}
					
					// reply link
					$replyArea.find(".composeAreaReply").off("click").on("click", function() {
						setFocusToComposeInput();
					});
					
					// reply All link
					$replyArea.find(".replyToAllLink").off("click").on("click", function() {
						console.log("replyall");
						var $composeWrapper = $(this).closest(".composeWrapper");
						$composeWrapper.data("replyAll", true);
						setFocusToComposeInput();
					});
					
					$replyArea.find(".composeInput")
						.off("click").on("click", function() {
							console.log("composeinput clicked")
							$replyArea.addClass("clicked");
						})
						.off("keydown").on("keydown", function(e) {
							console.log("keydown: ", e);
							if (e.ctrlKey && e.keyCode == 13) {
								var $button;
								if (Settings.read("showSendAndArchiveButton")) {
									$button = $(".sendAndArchive");
								} else {
									$button = $(".send");
								}
								$button
									.focus()
									.click()
								;
								return false;
							} else {
								return true;
							}
						})						
					;
					
					$replyArea.find(".send, .sendAndArchive").off("click").on("click", {mail:mail}, function(e) {
						var $sendingButton = $(this); 
						$sendingButton.addClass("sendingButton");
						var sendAndArchive = $sendingButton.hasClass("sendAndArchive");
						
						var message = $(".composeInput").val();
						
						var $composeWrapper = $(this).closest(".composeWrapper");
						$composeWrapper.addClass("sending");
						$(this).find("div").text("Sending...");
						
						e.data.mail.postReply(message, $composeWrapper.data("replyAll"), function(response) {
							console.log("reply callback", response);
							if (response.error) {
								showErrorMessage(response.error);
								$replyArea.closest(".composeWrapper")
									.removeClass("sending")
								;
								$sendingButton.removeClass("sendingButton");
								$replyArea.find(".send").find("div").text("Send");
							} else {

								localStorage.removeItem("lastCompose");
								
								if (sendAndArchive) {
									e.data.mail.archive();
								}
								
								$replyArea.closest(".composeWrapper")
									.removeClass("sending")
									.addClass("sendingComplete")
								;
								$sendingButton.removeClass("sendingButton");
								
								setTimeout(function() {
									if (Settings.read("replyingMarksAsRead")) {
										markAsRead($mail);
									}
									hideFullEmail();
								}, 1000);
							}
						});
					});
					
					$fullEmailContent.append($replyArea);
					
					$replyArea.find(".composeInput")
						.autoResize({animateCallback:function() {
							$(this).get(0).scrollIntoView();
						}})
						.off("blur").on("blur", {mail:mail}, function(e) {
							var $composeWrapper = $(this).closest(".composeWrapper");
							var replyAll = $composeWrapper.data("replyAll");
							localStorage.lastCompose = JSON.stringify({mailId:e.data.mail.id, replyAll:replyAll, message:$(this).val()});									
						})
					;
					
					var lastCompose = localStorage.lastCompose;
					if (lastCompose) {
						try {
							lastCompose = JSON.parse(lastCompose);
						} catch (e) {
							logError("could not parse lastcompose: " + e);
						}
						if (lastCompose) {
							if (lastCompose.mailId == mail.id && lastCompose.message) {
								if (lastCompose.replyAll) {
									$replyArea.find(".replyToAllLink").click();
								} else {
									$replyArea.find(".composeAreaReply").click();									
								}
								$replyArea.find(".composeInput").val( lastCompose.message );
							}
						}
					}					
					
					$fullEmailContent.scroll(function() {
						console.log("scroll calle");
					    var y = $(this).scrollTop();
					    if (typeof fixedAreaTop != "undefined" && y >= (fixedAreaTop-$(this).offset().top)) { //$(this).offset().top
					    	initFixedArea();
					    } else {
					    	var $messageContent = $(this).find(".messageContent");
							if (!$messageContent.hasClass("zoomed")) {
						      $fixedArea.removeClass('fixed');
						      
								scrollingWidth = $(".fullEmailBody .message").last().width();
								viewableWidth = $("html").width()

						      if (false) { //inNotificationWindow
						      	$fixedArea.css("right", scrollingWidth-viewableWidth+fixedRightMargin);
						      } else {
						    	  if (scrollingWidth > viewableWidth) {
						    		  	$fixedArea.css("right", scrollingWidth-viewableWidth+fixedRightMargin);
						    	  } else {
						    			$fixedArea.css("right", "0");
						    	  }
						      }
							}
					    }
					});
					
					if (!inNotificationWindow) {
						setTimeout(function() {
							var $contentPossiblyContainingScrollbars;
							if (Settings.read("accountAddingMethod") == "autoDetect") {
								$contentPossiblyContainingScrollbars = $fullEmailContent.find(".messageContent > div");
							} else {
								$contentPossiblyContainingScrollbars = $fullEmailContent.find(".messageContent");
							}
							if ($contentPossiblyContainingScrollbars.hasHorizontalScrollbar()) { //$fullEmailContent.hasHorizontalScrollbar()
								// patch: for some reason .stop() would remove my vertical scrollbars in my #inboxes putting overflow-y:hidden 
								//$("#inboxes").stop();
								$("#inboxes").animate({
								    width: 0
								}, animationDuration, ["linear"], function() {
									initialInboxesWidth = $("#body").width();
									$("#fullEmailContent").css("width", initialInboxesWidth-0-6);
								});
							}
						}, animationDuration + 100)
					}
					
					if (markAsReadSetting) {
						if (!$mail.hasClass("read")) {
							updateUnreadCount($mail, -1); // must do this before remove 'read' class
							$mail.addClass("read");
						}					
					}
					
					interceptClicks($(".fullEmailBody .messageContent a"), mail);
					
					$fullEmail.slideDown(animationDuration, function() {

						$fixedArea = $fullEmailContent.find(".emailDetailsTopRight").last();
						$fixedArea.removeClass('fixed');
						if ($fixedArea.offset()) {
							fixedAreaTop = $fixedArea.offset().top;
						}

						if (true) { //inNotificationWindow)
							setTimeout(function() {
								console.log("timeout 100 set scorllingwiwdth")
								scrollingWidth = $(".fullEmailBody .message").last().width();
								viewableWidth = $("html").width()
								console.log(scrollingWidth + " " + viewableWidth);
								if (scrollingWidth > viewableWidth) {
									$fixedArea.css("right", scrollingWidth-viewableWidth+fixedRightMargin);
								}		
							}, 100);
						}
						var $firstUncollapsedThread = $fullEmailContent.find(".message:not(.collapsed)").first();
						var targetOffset = $firstUncollapsedThread.position().top;
						if (inNotificationWindow) {
							targetOffset -= 33;
						} else {
							targetOffset -= 93;
						}
						
						if (targetOffset > 0) {
							console.log('scrolltop')
							$fullEmailContent.animate({scrollTop: targetOffset}, 700);
						}
						
						if (markAsReadSetting) {
							mail.markAsRead();
						}
					});
					
					// patch: even though we call this scrollTop at the top - it seems that because the inner content is not append until later so the scroll position must be set after appending content
					$fullEmailContent
						.scrollTop(0)
						.scrollLeft(0)
					;
					
					$(".statusMessageWrapper").hide();
					callback();
				}
			});
		}

	}, 0);
	
}

function hideMail(o, action, stayOpen) {
	
	bg.updateNotificationTray();
	
	updateUnreadCount(o, -1);
	
	if (totalUnreadCount == 0 || inNotificationWindow || (!Settings.read("rememeberReadEmails") || (Settings.read("rememeberReadEmails") && Settings.read("emailsMarkedAsRead") == "hide")) || action == "delete" || action == "archive" || action == "spam") {	
	   	var $inbox = $(o).closest(".inbox");
	   	var $mail = $(o).closest(".mail");
	   	var unreadCount = $inbox.find(".unreadCount").text();
	
	   	// save selected mail index before hiding any mails in the list
	   	var $allMail = $(".mail:visible");
	   	var selectedIndex = $allMail.index($allMail.filter(".selected"));
	   	
	   	var windowClosePatch;
	   	// patch for hanging issue with popup window not closing: it happens when window.close is called while the popup window is resizing (usually resizing caused hiding emails with or without jquery animation)
	   	if (navigator.platform.toLowerCase().indexOf("mac") != -1 || navigator.platform.toLowerCase().indexOf("linux") != -1 || navigator.platform.toLowerCase().indexOf("unix") != -1) {
	   		windowClosePatch = true;
	   		$.fx.off = true;
	   	}
	   	
		$mail.animate({
		    opacity: 0,
		    height: 0
		}, 200, ["swing"], function() {
			$(this).hide();
			
			// if no more emails in label group remove labelheader
			var $labelGroup = $(o).closest(".labelGroup");
			if ($labelGroup.find(".mail").filter(":visible").length == 0) {
				$labelGroup.slideUp();
			}
			
			// if we just hid the selected mail, then select next one
			if ($mail.hasClass("selected")) {
				
				// not the last one
				console.log((selectedIndex+1) + " " + $allMail.length);
				console.log($allMail);
				if (selectedIndex+1 < $allMail.length) {
					$allMail.eq(selectedIndex+1).addClass("selected");
				} else {
					// we just hid the last one so let's re-select the last one in this new list					
					$(".mail:visible").last().addClass("selected"); // had to use .mail:visible vs $allMail (because it wasn't working) 
				}
			}
			
		   	if (totalUnreadCount == 0) {
				if (!stayOpen) { 
					if (window) {
					  	initPopup(0);

					  	// see if showall emails link is visible AND in display hide read emails
					  	if ($("#showAllEmails:visible").text() == getMessage("hideReadEmails")) {
					  		// don't close window because we are showing all hidden mails and might be perform multiple actions on other emails like inbox management etc.
					  	} else {
					  		if (windowClosePatch) {
					  			setTimeout(function() {
					  				window.close();
					  			}, 150);
					  		} else {
					  			window.close();
					  		}
					  	}
				  	}
			  	}
		   	} else if (unreadCount == 0) {
				$inbox.find('.collapseArrow')
					.addClass("collapsed")
					.addClass('hidden')
				;		  
		   	}
		});
	} else if (action == "markAsRead") {
		o.addClass("read");
	}
}

function displayAccounts() {
	unreadCount = 0;
	photosDisplayed = 0;
	
	emailCount = 0;
	firstReadEmailPosition = -1;
	lastUnreadEmailPosition = -1;
	showReadEmails = true;

	$('#content').empty();

	var onlyCountUnreadEmails = Settings.read("rememeberReadEmails") && Settings.read("emailsMarkedAsRead") == "show" && !inNotificationWindow;
	
	// count unread FIRST to use the number in rendering after...
	totalVisibleMails = 0;
	$.each(accounts, function (i, account) {
		unreadCount += account.getUnreadCount();

		var emails = account.getMail();
		
		// if setting and in popup window than only show and count unread emails
		if (onlyCountUnreadEmails) {
			for (var a=0; a<emails.length; a++) {
				if (inNotificationWindow) {
					if (emails[a].lastAction != "markAsRead") {
						totalVisibleMails++;
					}
				} else {
					if (emails[a].lastAction == "markAsRead") {
						if (firstReadEmailPosition == -1) {
							firstReadEmailPosition = emailCount;
						}
					} else {
						totalVisibleMails++;
						lastUnreadEmailPosition = emailCount;
					}
				}
				emailCount++;
			}
		} else {
			if (Settings.read("rememeberReadEmails") && Settings.read("emailsMarkedAsRead") == "hide") {
				totalVisibleMails += account.getUnreadCount();
			} else {
				totalVisibleMails += emails.length;
			}
		}
	});
	
	if (onlyCountUnreadEmails) {
		// if read emails are listed before unread emails and we can't display all the emails in the visible popup without scrolling then hide the read emails
		var MAX_VISIBLE_EMAILS_BEFORE_SCROLLING = 6;
		console.log(emailCount + " " + firstReadEmailPosition + " " + lastUnreadEmailPosition);
		
		if (emailCount > MAX_VISIBLE_EMAILS_BEFORE_SCROLLING && firstReadEmailPosition != -1 && firstReadEmailPosition < lastUnreadEmailPosition) {
			showReadEmails = false;
		} else if (!inNotificationWindow) {
			totalVisibleMails = emailCount;
		}
	}
	
	$.each(accounts, function (i, account) {
		if (inNotificationWindow && account.getUnreadCount() == 0) {
			// don't display this account
			//$account.find(".inboxLabelAreaWrapper").hide();
		} else {
			// legacy: detecting the existance of the method so on extension update there are no issues with chrome extensions not reloading etc.
			if (account.hasBeenIdentified) {
				// if last account has not been identified ie. called https://mail.google.com/mail/u/1 ...
				if (i == (accounts.length-1) && !account.hasBeenIdentified()) {
					// do not show account
				} else {
					renderAccount(account);
				}
			} else {					
				renderAccount(account);
			}
		}
	});
	
	if (totalVisibleMails >= 2) {
		$("html").addClass("compact");
	}
	if (totalVisibleMails >= 3) {
		$("html").addClass("veryCompact");
	}
	if (totalVisibleMails >= 4) {
		$("html").addClass("extremelyCompact");
	}
	
	// arriving from preview button in notification
	if (!emailPreviewed) {
		emailPreviewed = true;
		var previewMailId = getUrlValue(location.href, "previewMailId");
		if (previewMailId) {
			
			temporailyDisableTransitions();
			
			$(".mail:visible").each(function(index, mailNode) {
				var $mail = $(mailNode);
				var mail = $mail.data("data");
				if (mail.id == previewMailId) {
					showFullEmail({$mail:$mail, previewFromNotification:true});
					return false;
				} else {
					return true;
				}			
			});
		}
	}
	
	updateBadge(unreadCount);
}

function setContactPhoto(params, imageNode) {
	// contact photo
	getContactPhoto(params, function(cbParams) {
		if (cbParams.contact && !cbParams.error) {
			imageNode.on("error", function() {
				imageNode.attr("src", "images/noPhoto.png");
			});
			
			// used timeout because it was slowing the popup window from appearing
			setTimeout(function() {
				imageNode.attr("src", cbParams.generatedURL);
			}, 10);
		} else {
			var name, email;			
			if (params.name) {
				name = params.name;
			} else if (params.mail) {
				name = params.mail.authorName;
			}
			
			if (name == "Twitter") {
				imageNode.attr("src", "images/logos/twitter.png");
				imageNode.css("background", "none");
			} else if (name == "Facebook") {
				imageNode.attr("src", "images/logos/facebook.png");
				imageNode.css("background", "none");
			}
		}
	});
}

function setInboxLabelArea($inbox, unreadCount) {
	var $unreadCountNode = $inbox.find(".unreadCount");
	$unreadCountNode.data("data", unreadCount);
	if (unreadCount >= 1) {
		$unreadCountNode.text("(" + unreadCount + ")");
		if (unreadCount >= 2) {
			$inbox.find(".markAllAsRead").addClass("inline-block");
		} else {
			$inbox.find(".markAllAsRead").hide();
		}
	} else {
		$unreadCountNode.text("");
		$inbox.find(".markAllAsRead").hide();
	}
	$inbox.find(".inboxLabelArea").toggleClass("hasUnread", unreadCount != 0);	
}

function updateUnreadCount(o, offset) {
	
	if (o.hasClass("read") && offset == -1) {
		// alrady read so don't do anything
		return;
	}
	if (!o.hasClass("read") && offset == 1) {
		// alrady unread so don't do anything
		return;
	}
	
	var $inbox = $(o).closest(".inbox");
	
	$unreadCountNode = $inbox.find(".unreadCount");
	
	var unreadCount = $unreadCountNode.data("data");
	unreadCount += offset;
	
	setInboxLabelArea($inbox, unreadCount);

	totalUnreadCount += offset;
	
	updateBadge(totalUnreadCount);
}

function markAsRead(o, mail) {
	if (!mail) {
		mail = o.data("data");
	}
	var dfd = mail.markAsRead();
	hideMail(o, "markAsRead");
	return dfd;
}

function markAsUnread(o, mail) {
	mail.markAsUnread();
	updateUnreadCount(o, +1); // must do this before remove 'read' class
	o.removeClass("read");
}

function cleanEmail(email) {
	return email.replace("<", "").replace(">", "");
}

function searchContacts(searchTerm) {
	var $contacts = $("#contacts");
	var $contactsTable = $("<table/>");

	$("#contacts table").remove();
  	$.each(contacts, function(a, contact) {
	   if (!searchTerm || contact.formattedTitle.toLowerCase().indexOf(searchTerm) != -1 || contact.formattedPhoneNumbers.toLowerCase().indexOf(searchTerm) != -1 || contact.formattedEmails.toLowerCase().indexOf(searchTerm) != -1 || contact.formattedPostalAddresses.toLowerCase().indexOf(searchTerm) != -1) {
			var $tr
			$tr = $("<tr/>");
			if (Settings.read("showContactPhoto")) {
				$tr.append($("<td class='contactPhotoWrapper'/>").append($("<img class='contactPhoto' src='images/noPhoto.png'/>")));
			}
			$tr.append($("<td class='title'/>").append(contact.formattedTitle));
			$tr.append($("<td/>").append(contact.formattedEmails));
			$tr.append($("<td class='phoneNumber'/>").append(contact.formattedPhoneNumbers));
			$tr.append($("<td class='postalAddress'/>").append(contact.formattedPostalAddresses));
			$tr.data("data", contact);
			$contactsTable.append($tr);
	   }
  	});
  	$contacts.append( $contactsTable );
  	loadContactPhotos()
}

function loadContacts(getContactsParams, callback) {
	if (!callback) {
		callback = function() {};
	}

	if (Settings.read("showContactPhoto")) {
		bg.oAuthForContacts.ensureTokenForEmail(getContactsParams.account.getAddress(), function(cbParams) {
			if (!cbParams.error) {
				console.log("ensureTokenForEmail for showing photos");
				$("#contactsMessage").show();
			} else {
				logError("error loadcontacts: " + cbParams.error);
			}
		});
	}

	if (getContactsParams.forceUpdate) {
		$(".statusMessageWrapper").show();
	}

	getContacts(getContactsParams, function(params) {
		if (params && params.contacts) {
			
			$(".statusMessageWrapper").show();
			setTimeout(function() {
				$("#inboxes").hide();
				
				params.contacts.sort(function (a, b) {
					if (a.title.$t.toLowerCase() > b.title.$t.toLowerCase())
						return 1;
					if (a.title.$t.toLowerCase() < b.title.$t.toLowerCase())
						return -1;
					return 0;
				});
	
				contacts = [];
				$.each(params.contacts, function(i, contact) {
					if (contact.title.$t) {
						var phoneNumbers = "";
						if (contact.gd$phoneNumber) {
							$.each(contact.gd$phoneNumber, function(a, phoneNumber) {
								var prefix = "";
								if (phoneNumber.label) {
									prefix = phoneNumber.label;
								} else {
									if (phoneNumber.rel.indexOf("#mobile") != -1) {
										prefix = getMessage("contactsMobile");
									} else if (phoneNumber.rel.indexOf("#home") != -1) {
										prefix = getMessage("contactsHome");
									} else if (phoneNumber.rel.indexOf("#work") != -1) {
										prefix = getMessage("contactsWork");
									} else {
										prefix = getMessage("contactsOther");
									}
								}
								phoneNumbers += "<span class='contactDetailsRel'>" + prefix + ":</span> " + phoneNumber.$t + "<br>";
							});
						}
						var emails = "";
						if (contact.gd$email) {
							$.each(contact.gd$email, function(a, email) {
								emails += "<a target='_blank' href='mailto:" + email.address + "'>" + email.address + "</a>" + "<br>";
							});
						}
						var postalAddresses = "";
						if (contact.gd$postalAddress) {
							$.each(contact.gd$postalAddress, function(a, postalAddress) {
								postalAddresses += "<a target='_blank' href=\"http://maps.google.com?q=" + encodeURIComponent(postalAddress.$t) + "\">" + postalAddress.$t + "</a>" + "<br>";
							});
						}
						
						var contactObj = contact;
						contactObj.formattedTitle = cleanEmail(contact.title.$t);
						contactObj.formattedPhoneNumbers = phoneNumbers;
						contactObj.formattedEmails = emails;
						contactObj.formattedPostalAddresses = postalAddresses;
						contacts.push( contactObj );
					}
				});
				$("#contactsHeader").show();
				$("#contacts").removeClass("hideImportant");
				$("#contacts").data("data", getContactsParams.account);

				stretchWindow();
				
				searchContacts();
				$(".statusMessageWrapper").hide();
				$("#contactsSearch").focus();
				callback();
			}, 50);
		} else {
			openContactsPage(getContactsParams.account);
			callback();
		}
	});
}

function openContactsPage(account) {
	chrome.tabs.create({url:"https://www.google.com/contacts/u/" + account.id + "/"});
	window.close();
}

function generateContactPhotoURLThread($tr, contactsAccount) {
	//console.log("contact data", $tr.data("data"))
   generateContactPhotoURL($tr.data("data"), contactsAccount, function(cbParams) {
	   var $contactPhoto = $tr.find(".contactPhoto");
	   $contactPhoto.on("error", function() {
		   $contactPhoto.attr("src", "images/noPhoto.png");
		});
	   $contactPhoto.on("load", function() {
		   $contactPhoto.fadeIn();
		});
		
		// used timeout because it was slowing the popup window from appearing
		setTimeout(function() {
			$contactPhoto.attr("src", cbParams.generatedURL);
		}, 10);	   
   });
}

function loadContactPhotos() {
	if (Settings.read("showContactPhoto")) {	
		contactsScrollHeight = $("#contacts").height();
		var contactsAccount = $("#contacts").data("data");
		var photosDisplayed = 0;
		  $("#contacts tr").each(function(i, tr) {
		   var $tr = $(tr);
		   if (isVisibleInScrollArea($tr, contactsScrollHeight)) {
			   //$tr.find(".contactPhoto").show();
			   if (photosDisplayed < MAX_PHOTOS_TO_SHOW) {
			   		generateContactPhotoURLThread($tr, contactsAccount);
			   		photosDisplayed++;
			   }		   	
		   }
		  });
	}
}

function renderAccount(account) {
	var emails = account.getMail();
	
	//account.getNewAt();

	// Render account
	if (emails) {
		//account.unreadCount = emails.length;
	}

	$account = $("#accountTemplate").clone();
	$account
		.removeAttr("id")
		.data("data", account)
	;
	
	if (accounts.length >= 2) { 
		//$account.addClass("indicator i" + (account.id % 4));
	}

	// must put the '.find's separaterly because you .find().find is aggregate
	var inboxForStr = "<span title='" + account.getAddress() + "'>" + account.getEmailDisplayName() + "</span>";
	
	if (account.error) {
		
		var orTryText = "";
		if (Settings.read("accountAddingMethod") == "autoDetect") {		
			orTryText = "sign out and in!";
		} else {
			orTryText = "<a class='accountOptions'>remove/add account</a> in options!";
		}
		
		inboxForStr += " <span class='accountErrorWrapper'>(<span class='accountError'>" + account.error + "</span> - <a class='refreshAccount' href='javascript:;'>Refresh</a> or " + orTryText + ")</span>";
		$account.find(".inboxActions").hide();
	}
	
	$account.find(".inboxFor").html(inboxForStr);
	
	$account.find(".inboxLabelArea").click({account:account}, function(event) {
		var openParams = {};
		if (event.ctrlKey || event.which == 2) {
			openParams.openInNewTab = true;
		}
		event.data.account.openInbox(openParams);
		sendGA(['_trackEvent', "inboxLabelArea", "click"]);		
	});

	$account.find(".compose").click({account:account}, function(event) {
		sendGA(['_trackEvent', "inboxLabelArea", "compose"]);
		
		var composeObj = event.data.account.generateComposeObject();
		openTabOrPopup(composeObj);
		
		return false;
	});
	$account.find(".markAllAsRead").click(function(event) {
		sendGA(['_trackEvent', "inboxLabelArea", "markAllAsRead"]);
		
		var $emailsToMarkAsRead = $(this).closest(".account").find(".mail:visible");
		// only marks max 10 as unread so if more than 10 let's refresh the list, and user can choose to mark as read again
		if ($emailsToMarkAsRead.length > MAX_EMAILS_TO_ACTION) {
			showErrorMessage(getMessage("tooManyUnread", [MAX_EMAILS_TO_ACTION]));
		} else {
			var deferreds = new Array();
			
			$emailsToMarkAsRead.each(function() {				 
				 var deferred = markAsRead($(this));
				 deferreds.push(deferred);
			});		

		   //$("#statusMessage").text( getMessage("markAllAsRead") + "..." );
		   //$(".statusMessageWrapper").show();
		   $.when.apply($, deferreds).always(function() {
			   //$("#statusMessage").text( getMessage("loading") );
		   });

		}
		
		return false;
	});
	$account.find(".sendPageLink").click({account:account}, function(event) {
		chrome.tabs.getSelected(null, function (tab) {
			sendGA(['_trackEvent', "inboxLabelArea", "sendPageLink"]);
	
			var subject = encodeURIComponent(unescape(tab.title));
			var body = encodeURIComponent(unescape(tab.url));
		    // removed next line because created problem loading compose window with russian text ie. "Как мы создали бизнес: Вячеслав Климов о создании «Новой Почты» - AIN.UA"
		    //subject = subject.replace('%AB', '%2D'); // Special case: escape for %AB
		    //var urlToOpen = event.data.account.getMailUrl() + "?view=cm&fs=1&tf=1" + "&su=" + subject + "&body=" + body;
		    
			var composeObj = event.data.account.generateComposeObject({subject:subject, body:body});
			openTabOrPopup(composeObj);

		    //openTabOrPopup({url:urlToOpen, account:event.data.account});
		    
	      window.close();
		});
		return false;
	});
	$account.find(".contactsLink").click({account:account}, function(event) {
		sendGA(['_trackEvent', "inboxLabelArea", "contactsLink"]);
		loadContacts({account:account});		
		return false;
	});
	$account.find(".searchLink").click({account:account}, function(event) {
		sendGA(['_trackEvent', "inboxLabelArea", "searchLink"]);
		var $account = $(this).closest(".account");
		$account.find(".inboxActions").fadeOut();
		$account.find(".searchWrapper").fadeIn();
		$account.find(".searchInput").focus();
		return false;
	});
	$account.find(".searchInput")
		.click({account:account}, function() {
			return false;
		})
		.keypress(function(e) {
			// enter pressed
		    if (e.which == 13) {
		    	var $account = $(this).closest(".account");
		    	$account.find(".search").click();
		    }
		})
	;
	$account.find(".search").click({account:account}, function(event) {
		var $account = $(this).closest(".account");
		var searchStr = $account.find(".searchInput").val();
		event.data.account.openSearch(searchStr);
		return false;
	})
	$account.find(".cancelSearch").click({account:account}, function() {
		$(".searchWrapper").fadeOut();
		$(".inboxActions").fadeIn();
		return false;
	})

	setInboxLabelArea($account.find(".inbox"), account.getUnreadCount());

	$account.fadeIn(500).appendTo("#content");

	var inboxNode = $account.find(".inbox");
	var $emailsNode = $account.find(".emails");	
	var previousLabel = "FIRST_LABEL";
	var $labelGroup;
	var $labelGroupWithMostRecentEmail;
	var mostRecentEmailDate = new Date(1);
	
	if (!inNotificationWindow && Settings.read("collapseEmailAccounts")) {
		$emailsNode.hide();
		$account.find(".collapseArrow").addClass("collapsed");
	}

	if (emails) {
		for (var a=emails.length-1; a>=0; a--) {
			var mail = emails[a];
			
			if (inNotificationWindow && mail.lastAction == "markAsRead") {
				continue;
			}
			
			$mail = $("#mailTemplate").clone();
			$mail
				.removeAttr("id")
				.data("data", mail)
			;
			
			if (mail.lastAction == "markAsRead") {
				$mail.addClass("read");
			}
			
			// add analytics here instead of leaving it to common.js because the .clicks below return falses
			$mail.find(".button, .icon").click(function() {
				id = $(this).attr("class").split(" ")[1];
				// category, action
				sendGA(['_trackEvent', "inbox", id]);
			});
			
			$mail.find(".delete").click({account:account, mail:mail, $mail:$mail}, function(event) {
				event.data.mail.deleteEmail();
				hideMail(event.data.$mail, "delete");
				return false;
			});		
			$mail.find(".archive").click({account:account, mail:mail, $mail:$mail}, function(event) {
				event.data.mail.archive();
				hideMail(event.data.$mail, "archive");
				return false;
			});		
			$mail.find(".spam").click({account:account, mail:mail, $mail:$mail}, function(event) {
				event.data.mail.markAsSpam();
				hideMail(event.data.$mail, "spam");
				return false;
			});		
			$mail.find(".markAsRead").click({account:account, mail:mail, $mail:$mail}, function(event) {
				markAsRead(event.data.$mail); //event.data.mail
				return false;
			});
			$mail.find(".markAsUnread").click({account:account, mail:mail, $mail:$mail}, function(event) {
				markAsUnread(event.data.$mail, event.data.mail);
				return false;
			});
			
			var selectorsToOpenEmail = ".open";
			if (!Settings.read("emailPreview")) {
				selectorsToOpenEmail += ", .emailDetails";
			}
			
			$mail.find(selectorsToOpenEmail).click({account:account, mail:mail}, function(event) {
				var openParams = {};
				if (event.ctrlKey || event.which == 2) {
					openParams.openInNewTab = true;
				}
				event.data.mail.open(openParams);
				setTimeout(function() {
					window.close();
				}, 100);
				return false;
			});
			
			$mail.find(".reply").click({account:account, mail:mail}, function(event) {
				event.data.mail.reply();
				setTimeout(function() {
					window.close();
				}, 100);
				return false;
			});
			
			$mail.find(".star").click({mail:mail}, function(event) {
				$(this).addClass("clicked");
				//rotate($(this));
				event.data.mail.star();
				return false;
			});
			
			var shortVersion = inNotificationWindow;
			$mail.find(".author").replaceWith( mail.generateAuthorsNode(shortVersion) );
			
			$mail.find(".subject").html(mail.shortTitle); //.attr("title", mail.title)			
			$mail.find(".date")
				.html( mail.issued.displayDate(true))
				.data( "data", mail.issued )
			;			
			
			if (Settings.read("linesInSummary") != 0) {
				var maxSummaryLetters;
				var LETTERS_PER_LINE = 90;
				var MAX_EMAILS_FOR_SHOWING_SCROLLBARS = 3;
				
				/*
				if (Settings.read("linesInSummary") == "auto") {
					var EMAIL_HEADER_IN_LETTERS = 240; // must included the header taking up space when calculating approx words
					maxSummaryLetters = (2000-(EMAIL_HEADER_IN_LETTERS*unreadCount)) / unreadCount;
					maxSummaryLetters = Math.max(LETTERS_PER_LINE, maxSummaryLetters); // minimum 90 letters
				} else {
					maxSummaryLetters = Settings.read("linesInSummary") * LETTERS_PER_LINE;
				}
				*/

				var EOM_Message = " <span class='eom' title=\"" + getMessage("EOMToolTip") + "\">[" + getMessage("EOM") + "]</span>"
				if (mail.message && mail.message.length && Settings.read("linesInSummary") == "auto" || Settings.read("linesInSummary") == "autoAndImages") {
					maxSummaryLetters = LETTERS_PER_LINE * 2;
					var $summary = $mail.find(".summary");
					if (mail.getLastMessageText().length < maxSummaryLetters || totalVisibleMails > MAX_EMAILS_FOR_SHOWING_SCROLLBARS) {
						var summary = mail.getLastMessageText({maxSummaryLetters:maxSummaryLetters, EOM_Message:EOM_Message});
						$summary.html( summary );
					} else {
						$summary.addClass("scrollbars");
						
						try {
							$threadNode = $("<div>" + mail.messages.last().content + "</div>");
						} catch (e) {
							var error = "Error parsing mail.content: " + e;
							logError(error);
							$threadNode = $("<div/>");
							$threadNode.text(error);
						}						
						
						if (Settings.read("linesInSummary") == "autoAndImages") {
							fixRelativeLinks($threadNode);
							if (Settings.read("accountAddingMethod") != "autoDetect") {
								showImages($threadNode);
							}
						}
						
						$threadNode.find("table").first().attr("cellpadding", 0);
						$summary.append( $threadNode );
						
						interceptClicks($summary.find("a"), mail);
					}
				} else {
					if (inNotificationWindow) {
						if (totalVisibleMails == 1) {
							maxSummaryLetters = 170;
						} else {
							maxSummaryLetters = 98;
						}
					} else {
						maxSummaryLetters = Settings.read("linesInSummary") * LETTERS_PER_LINE;
					}
					$mail.find(".summary").html( mail.getLastMessageText({maxSummaryLetters:maxSummaryLetters, EOM_Message:EOM_Message}) );
				}
			}
			
			if (Settings.read("emailPreview")) {
				$mail.find(".emailDetails").click({account:account, mail:mail, $mail:$mail}, function(event) {
					
					showFullEmail({$mail:event.data.$mail});
					
					sendGA(['_trackEvent', "inbox", "expand"]);
				});
			}

			$mail.hover(function() {
				$(this).removeClass("hideScrollbars");
			}, function() {
				$(this).addClass("hideScrollbars");
			});
			
			if (Settings.read("showContactPhoto")) {      
				$mail.find(".contactPhoto").css("display", "block");
			}

			if (previousLabel == "FIRST_LABEL" || previousLabel != mail.labels.first()) {
				$labelGroup = $("<div class='labelGroup'><div class='labelHeader'></div><div class='labelEmails'></div></div");
				
				var $labelHeader = $labelGroup.find(".labelHeader");
				$labelHeader.text( mail.formattedLabel + "" );
				$labelHeader.attr("title", getMessage("openLabel"));
				if (!Settings.read("groupByLabels")) {
					$labelHeader.hide();
				}
				$labelHeader.click({account:account, label:mail.labels.first()}, function(event) {
					event.data.account.openLabel(event.data.label);
					window.close();
				});
				
				$emailsNode.prepend( $labelGroup );				
				// original: $mail.fadeIn(500).prependTo($emailsNode);
			}
			$labelEmails = $labelGroup.find(".labelEmails");
			
			if (showReadEmails || (!showReadEmails && mail.lastAction != "markAsRead")) {
				console.log(showReadEmails + " " + mail);
				if (Settings.read("rememeberReadEmails") && Settings.read("emailsMarkedAsRead") == "hide" && mail.lastAction == "markAsRead") {
					// don't show
				} else {
					$mail.show();
				}					
			}
			$mail.prependTo($labelEmails);
			
			if (Settings.read("linesInSummary") == "auto" || Settings.read("linesInSummary") == "autoAndImages") {
				var maxHeightPerMessage;
				if (inNotificationWindow) {
					var $firstSummary = $labelEmails.find(".summary").first();
					maxHeightPerMessage = 155 - $firstSummary.offset().top;
				} else {
					maxHeightPerMessage = 300;
				}
				$labelEmails.find(".summary.scrollbars").css("max-height", maxHeightPerMessage/totalVisibleMails + "px")
			}
			
			if (mail.issued > mostRecentEmailDate) {
				mostRecentEmailDate = mail.issued;
				$labelGroupWithMostRecentEmail = $labelGroup;
			}
			
			previousLabel = mail.labels.first();			
		}
		
		// hide labels if no visible emails
		$(".labelGroup").each(function() {
			if ($(this).find(".mail").filter(":visible").length == 0) {
				// exception if this option is on than don't hide them
				if (!Settings.read("collapseEmailAccounts")) {
					$(this).hide();
				}
			}
		});
		
		// place grouplabel with most recent email at the top
		if (inNotificationWindow && mostRecentEmailDate.diffInMinutes() >= -1) {
			$emailsNode.prepend($labelGroupWithMostRecentEmail);
		}

		if (emails.length == 0) {
			inboxNode.find(".collapseArrow").addClass("hidden");
		}

		if (Settings.read("showContactPhoto")) {
			bg.oAuthForContacts.ensureTokenForEmail(account.getAddress(), function(cbParams) {
				if (!cbParams.error) {
					$(".mail").each(function() {
						var mail = $(this).data("data");
						if (mail) {
							var $imageNode = $(this).find(".contactPhoto");
							
							if (photosDisplayed < MAX_PHOTOS_TO_SHOW) {
								// function required to keep imageNode in scope
								setContactPhoto({mail:mail}, $imageNode);								
								photosDisplayed++;
							}
						}
					});
				} else {
					logError("error showcontactphoto: " + cbParams.error);
				}
			});
		}

		inboxNode.find(".collapseArrow").click(function () {
			inboxNode.find(".collapseArrow").toggleClass("collapsed");
			inboxNode.find('.emails').slideToggle('fast');			
			sendGA(['_trackEvent', "inboxFold", "click"]);
		});
	}
	
	if (account.getSetting("useColors")) {
		var $nodesToColorize = $account.find(".inboxLabelAreaWrapper, .labelHeader");

		var colorStart = account.getSetting("colorStart", "colorStart" + (account.id+1));
		var colorEnd = account.getSetting("colorEnd", "colorEnd" + (account.id+1));
		
		setAccountGradient($nodesToColorize, colorStart, colorEnd);
		$account.find(".mail, .emailDetailsTopRight, html.notif #inboxes .mail .star").css("background-color", colorStart);
	}
	
	if (Settings.read("linesInSummary") == "auto" || Settings.read("linesInSummary") == "autoAndImages") {
		setTimeout(function() {
			$account.find(".summary.scrollbars").each(function() {
				var $summary = $(this);
				if ($(this).hasVerticalScrollbar() && $summary.height() >= 30) {
					//console.log($summary.text() + " height: " + $summary.height())
					$(this).siblings(".downArrow").fadeIn();
					$(this).siblings(".upArrow, .downArrow")
						.on("click", {summary:$(this)}, function(event) {
							//event.data.summary.get(0).scrollTop += 50 * scrollingDirection;
							if ($(this).hasClass("upArrow")) {
								event.data.summary.get(0).scrollTop = 0;
							} else {
								event.data.summary.get(0).scrollTop = event.data.summary.prop("scrollHeight");
							}
							event.preventDefault();
							event.stopPropagation();	
						})
						.hover(function() {
							var scrollingSpeed;
							if ($summary.height() < 80) {
								scrollingSpeed = 20;
							} else {
								scrollingSpeed = 9;
							}
							
							scrollingDirection = $(this).hasClass("upArrow") ? -1 : 1;
							scrollingMailInterval = setInterval(function() {
								$summary.get(0).scrollTop += 1 * scrollingDirection;
							}, scrollingSpeed); // 9 = regular
						}, function() {
							clearInterval(scrollingMailInterval);
						});
					;
					$summary.scroll(function() {
						//$("#title").text(this.scrollTop + "_" + $(this).prop("scrollHeight") + "_" + $(this).height())
						if (this.scrollTop == 0) {
							$(this).siblings(".upArrow").hide();
							$(this).siblings(".downArrow").show();
						} else if (this.scrollTop >= parseInt($(this).prop("scrollHeight")) - $(this).height()) {
							$(this).siblings(".upArrow").show();
							$(this).siblings(".downArrow").hide();
						} else {
							$(this).siblings(".upArrow").fadeIn();
							$(this).siblings(".downArrow").fadeIn();
						}
					});
				}
			});
		}, 50)
	}
}

function plusoneCallback() {
	sendGA(['_trackEvent', "plusOne", "click"]);
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	if (message.name == "addNewNotifications") {
		if (!mouseInPopup) {
			location.reload(true);
		}
	} else if (message.name == "markAsReadFirstEmail") {
		var $mail = $(".mail:visible").first();
		$mail.find(".markAsRead").click();
	} else if (message.name == "openFirstEmail") {
		var $mail = $(".mail:visible").first();
		$mail.find(".open").click();
	}
})

// This function is automatically called by the player once it loads
function onYouTubePlayerReady(playerId) {
	  console.log("here");
	ytplayer = document.getElementById("ytPlayer");
	ytplayer.addEventListener("onStateChange", function(state) {
		console.log("playerstate: " + state)
	});
	//ytplayer.addEventListener("onError", "onPlayerError");
	//Load an initial video into the player
	ytplayer.cueVideoById("ObkVpBWxm68");
}

function refresh() {
	
	// patch bug: on a mac after refreshing the accounts would disappear
	if (navigator.platform.toLowerCase().indexOf("xxmac") != -1 || navigator.platform.toLowerCase().indexOf("linux") != -1 || navigator.platform.toLowerCase().indexOf("unix") != -1) {
		location.reload();
	} else {
	    if ($("#contacts").is(":visible")) {
	   		loadContacts({account:$("#contacts").data("data"), forceUpdate:true}, function() {
	   			//clearInterval(rotationInterval);
	   		});
		} else {
			$("#refresh img").addClass("rotate");
		   $(".statusMessageWrapper").show();
		   
		   var accountsWithErrors = 0;
		   if (accounts) {
			   $.each(accounts, function(index, account) {
				   if (account.error) {
					   accountsWithErrors++;
				   }
			   });			   
		   }
		   
		   if (accounts && accounts.length >= 1 && !accountsWithErrors) {
			   getAllEmails(accounts, function() {
				   $(".statusMessageWrapper").hide();
				   bg.mailUpdate();
				   totalUnreadCount = bg.unreadCount;
				   displayAccounts();
				   $("#refresh img").removeClass("rotate");
			   });
		   } else {
			   bg.pollAccounts(function() {
				   bg.mailUpdate();
				   location.reload(true);
			   });
		   }
		}
	    sendGA(['_trackEvent', "refresh", "click"]);
	}
}

initShowTransitions();

$(document).ready(function () {

	if (Settings.read("zoom") != "auto") {
		$("html").css("zoom", Settings.read("zoom"));
	}
	
	if (location.href.indexOf("externalPopupWindow") != -1) {
		$("html").addClass("externalPopupWindow");
	}
	
	$("#logo").fadeIn("fast");
	
	if (Settings.read("hideByJason")) {
		$("#by").hide();
		$("#jasonsavard").hide();
	}
	
	var installDate = Settings.read("installDate");
	if (installDate) {
		try {
			installDate = new Date(installDate);
		} catch (e) {
			logError("could not parse installdate");
		}
	}
	
	// show write about me ...
	if (!localStorage.clickedShare && installDate && installDate.diffInDays() <= -3 && installDate.diffInDays() > -10) { // between 3 and 10 days
		$("#by").hide();
		$("#jasonsavard").hide();
		$("#shareBlurb").show();
		
		$("#share").click(function() {
			localStorage.clickedShare = true;

			// For message: like it, write about it
			chrome.tabs.create({url:"http://jasonsavard.com/wiki/Spread_the_word_about_my_extension"});
			window.close();
			
		});	
	} else if (shouldShowReducedDonationMsg()) { // show reduced donation blurb
		$("#logo, #title, #by, #jasonsavard").hide();
		$("#eligibleForReducedDonation").removeClass("hide");
		
		$("#eligibleForReducedDonation").click(function() {
			localStorage.reducedDonationAdClicked = true;
			createTab("donate.html?ref=reducedDonationFromPopup");
			//window.close();
		});
	}
	
	if (inNotificationWindow) {
		$("html").addClass("notif");
		
		var accountsWithUnreadMail = 0;
		$.each(accounts, function(i, account) {
			if (account.getUnreadCount()) {
				accountsWithUnreadMail++;
			}
		});
		
		if (!Settings.read("showEmailAccount") && accountsWithUnreadMail == 1) {
			$(".inbox.rounded").removeClass("rounded");
			$("html").addClass("hideInbox");
		}
		
		if (!Settings.read("showActionButtonsOnHover")) {
			$("html").addClass("alwaysShowActionButtons")
		}
		
	} else {
		// opening reglar popup so close notification window if open
		if (bg.notification) {
			bg.notification.cancel();
		}
	}

	if (!Settings.read("showOptionsButton")) {
		$("#options").hide();
	}
	
	var markAsReadStr = getMessage("readLinkTitleShort");
	if (markAsReadStr) {
		//$("html.notif .markAsRead div").text(markAsReadStr);
		$("#fullEmail .markAsRead div, html.notif .markAsRead div").text(markAsReadStr);
	}
	var markAsUnreadStr = getMessage("unreadLinkTitleShort");
	if (markAsUnreadStr) {
		//$("html.notif .markAsUnread div").text(markAsUnreadStr);
		$("#fullEmail .markAsUnread div, html.notif .markAsUnread div").text(markAsUnreadStr);
	}
	
   bg.stopAnimateLoop();
   
   initButtons();
   showHideButtons();
   
   var delayBeforeDisplaying;
   // patch for mac: popup window was distorted
   if (navigator.platform && (navigator.platform.toLowerCase().indexOf("mac") != -1 || navigator.platform.toLowerCase().indexOf("linux") != -1 || navigator.platform.toLowerCase().indexOf("unix") != -1)) {
	   delayBeforeDisplaying = localStorage["delayBeforeDisplaying"];
	   if (!delayBeforeDisplaying) {
		   delayBeforeDisplaying = 500;
	   }
   } else {
	   delayBeforeDisplaying = 0;
   }
   
	$(window).resize(function() {
		$("#contacts").width( $("#body").width() );
		if (location.href.indexOf("externalPopupWindow") != -1) {
			
			// user navigated away from the initially state of opening the popup window to preview an email, so let's remove the preview mail id
			if (backToInboxClicked) {
				var reloadUrl = setUrlParam(location.href, "previewMailId", "");
				location.href = reloadUrl;
				//location.reload(true);
			} else {
				location.reload(true);
			}
			
			//$("#inboxes").css("max-height", "auto !important");
			//$("#fullEmailContent").css("max-height", "auto");
		}
	});
	
	if (Settings.read("voiceNotification")) {
	   if (isMutedByDuration()) {
		   $("#muteMenu").addClass("muted");
	   }
	} else {
		$("#muteMenu").hide();
	}

   setTimeout(function() {

	   displayAccounts();
	   
	   //if (!accounts || accounts.length == 0) {
	   if (!accounts || accounts.length == 0 || $(".account:visible").length == 0) {
		   $("#signIn").show();
	   }
	   
	   $(window).unload(function() {
		   if (mouseHasEnteredPopupAtleastOnce) {
			   localStorage["lastCheckedEmail"] = now().toString();
		   }
	   });
	   
	   setCloseTimeout();
	   
		$('body').hover(function () {
			clearTimeout(closeTimeout);
			mouseInPopup = true;
			if (!mouseHasEnteredPopupAtleastOnce) {
				console.log("stop any speaking")
				bg.ChromeTTS.stop();
			}
			mouseHasEnteredPopupAtleastOnce = true;
		}, function () {
			setCloseTimeout();
			mouseInPopup = false;
		});
		
		// patch: if the window has focus disable simulated tooltips because window's tooltips work again
		$("html").mousedown(function(event) {
			if (simulateToolTips) {
				simulateToolTips.disable();
			}
			
			// middle click
			if (inNotificationWindow && event.which == 2) {
				console.log(event)
				if (event.target.tagName != "A") {
					window.open("popup.html?externalPopupWindow=true", "", "width=860,height=565,location=no");
					window.close();
				}
			}
		});

	   $("#refresh, .refreshAccount").click(function() {
		   refresh();
		   return false;
	   });
	   
	   $(".accountOptions").click(function() {
		   chrome.tabs.create({ url: "options.html#2" });
		   window.close();
		   return false;
	   });

	   $("#close").click(function() {
		   sendGA(['_trackEvent', "close", "click"]);
		   window.close();
	   });

	   $(".backToInbox").click(function() {
		   backToInboxClicked = true;
		   hideFullEmail();
		   sendGA(['_trackEvent', "backToInbox", "click"]);
	   });

	   $("#contactsSearch").attr("placeholder", getMessage("search"));
	   
	   $("#contactsSearch").on("search", function() {
			$(this).keyup();		   
	   });	   

	   $("#contactsSearch").click(function() {
		 	//$("body").prepend('click' + $(this).val()) 
	   });	   

	   $("#contactsSearch").keyup(function() {
		   clearTimeout(searchTimeout);
		   var searchTerm = $(this).val().toLowerCase();
		   if (searchTerm.length >= 0) {
			   searchTimeout = setTimeout(function() {
				   //$(".statusMessageWrapper").show();
				   // searching array is much faster than searching dom
				   setTimeout(function() {
					   /*
					   $("#contacts tr").each(function(a, row) {
						   if ($(row).text().toLowerCase().indexOf(searchTerm) != -1) {
							   $(this).show();
						   } else {
							   $(this).hide();
						   }
					   });
					   */
					   
					   searchContacts(searchTerm);
					   
					   //$(".statusMessageWrapper").hide();
				   }, 50);
			   }, 100);
		   } else {
			   $("#contacts tr").show();
		   }
	   });
	   
	   $("#contactsHeader .open").click(function() {
		   openContactsPage($("#contacts").data("data")); 
	   });
	   
	   var contactsScrollTimeout;
	   
	   $("#contacts").scroll(function() {
		   clearTimeout(contactsScrollTimeout);
		   if ($("#contacts").is(":visible")) {
			   contactsScrollTimeout = setTimeout(function() {
				   loadContactPhotos();
			   }, 350);
		   }
	   });
	   
	   if (inNotificationWindow) {
			simulateToolTips = SimulateToolTips();
	   }
	   
	   // remove it after a little whilte, just irritating
	   setTimeout(function() {
		   $(".emailDetails").removeAttr("title");
	   }, 2000)
	   
	   setInterval(function() {
		   $(".date").each(function(i, element) {
			   var date = $(this).data("data");
			   if (date && date.displayDate) {
			   		$(this).html( date.displayDate(true) );
			   }
		   });
	   }, ONE_MINUTE);

	   if (Settings.read("rememeberReadEmails") && !inNotificationWindow && $("#inboxes .mail").length) {
		   //Settings.read("emailsMarkedAsRead") == "show" &&  && !showReadEmails
		   
		   // if no unread emails, then set the link to hide read mails
		   if (Settings.read("emailsMarkedAsRead") == "show" && totalVisibleMails == $("#inboxes .mail").length) {
			   $("#showAllEmails").text( getMessage("hideReadEmails") );
		   }
		   
		   var showLink = true;
		   if (Settings.read("emailsMarkedAsRead") == "hide" && $("#inboxes .mail.read").length == 0) {
			   showLink = false;
		   }
		   
		   if (showLink) {
			   $("#showAllEmails")
		  		.css("display", "inline-block")
		  		.animate({opacity: 1}, 100)
		  		.click(function() {
		  			if ($(this).text() == getMessage("showAllEmails")) {
		  				$(this).text( getMessage("hideReadEmails") );
		  				$(".labelGroup").show();
		  				$(".mail.read").animate({opacity: 'show', height: 'show'}, 400);
		  			} else {
		  				$(this).text( getMessage("showAllEmails") );
		  				$(".mail.read").animate({opacity: 'hide', height: 'hide'}, 400, function() {
		  					// hide labels if no visible emails
		  					$(".labelGroup").each(function() {
		  						if ($(this).find(".mail").filter(":visible").length == 0) {
		  							$(this).slideUp("fast");
		  						}
		  					});
		  				});
		  			}					   			
		  		})
			   ;
		   }
	   }
	   
	   /*
	   // slowly hide read messages
	   if (Settings.read("emailsMarkedAsRead") == "show") {
		   if (!inNotificationWindow) {
			   setTimeout(function() {
				   var popupHeight = $("#scrollArea").height();
				   $(".mail:not(.read)").each(function() {
					   if ($(this).offset().top > popupHeight) {
						   //$(".mail.read").animate({opacity: 'hide', height: 'hide'}, 400);
						   //$(".mail.read").hide();
						   $(".mail.read").fadeOut(300);
						   setTimeout(function() {
							   $("#showAllEmails")
						   		.css("display", "inline-block")
						   		.animate({opacity: 1}, 500)
						   		.click(function() {
						   			if ($(this).text() == getMessage("showAllEmails")) {
						   				$(this).text( getMessage("hideReadEmails") );
						   				$(".mail.read").animate({opacity: 'show', height: 'show'}, 400);
						   			} else {
						   				$(this).text( getMessage("showAllEmails") );
						   				$(".mail.read").animate({opacity: 'hide', height: 'hide'}, 400);
						   			}					   			
						   		})
							   ;
						   }, 500)
						   return false;
					   } else {
						   return true;
					   }
				   });
			   }, 20);
		   }
	   }
	   */
	   
   }, delayBeforeDisplaying);
   
	$("body").keydown(function(e) {
		
		// if focus is in these elements then don't process these globals keys 
		if ($(e.target).hasClass("searchInput") || $(e.target).hasClass("composeInput") || $(e.target).hasClass("labelsSearch") || $(e.target).hasClass("contactsSearch")) {
			console.log("Do not process this global key!")
			return;
		}
		
		// find selected mail first
		var $allMail = $(".mail:visible");
		console.log($allMail);
		
		var selectedIndex = $allMail.index($allMail.filter(".selected"));
		
		var hasSelectedMail;
		// none selected, so choose first item
		if (selectedIndex == -1) {
			hasSelectedMail = false;
			selectedIndex = 0;
		} else {
			hasSelectedMail = true;
		}
		
		$selectedMail = $allMail.eq(selectedIndex);
		
		console.log("key:", e)
		if (keydown(e, 'j') || keydown(e, 40)) { // down arrow
			console.log("here: " + selectedIndex)
			if (hasSelectedMail) {
				console.log("next visible: " + selectedIndex)
				if (selectedIndex+1 < $allMail.length) {
					$nextMail = $allMail.eq(selectedIndex+1);
					$nextMail.addClass("selected");
					$selectedMail.removeClass("selected");
				} else {
					$allMail.first().addClass("selected");
					$selectedMail.removeClass("selected");
				}
			} else {
				// make sure we have mail or this will triggering the action will recursieve/loop forever
				if ($allMail.length) {
					$selectedMail.addClass("selected");
					
					// re-execute the keydown to select the 2nd one (since we select the 1st one the 1st time)
					$("body").trigger(e);
				}
			}
		} else if (keydown(e, 'k') || keydown(e, 38)) { // up arrow
			if (hasSelectedMail) {
				if (selectedIndex-1 >= 0) {
					console.log("found previous");
					$prevMail = $allMail.eq(selectedIndex-1);
					$prevMail.addClass("selected");
					$selectedMail.removeClass("selected");
				} else {
					$allMail.last().addClass("selected");
					$selectedMail.removeClass("selected");
					
					//console.log("beggin of account");
					//$prevMail = $selectedMail.closest(".account").prev(":visible").find(".mail:visible:last");
					//$prevMail.addClass("selected");
					//$selectedMail.removeClass("selected");
				}
			} else {
				$(".mail:visible:last").addClass("selected");
			}
		}

		// c = compose
		if (keydown(e, 'c')) {
			$(".account:visible:first .compose").click();
		}

		// o,enter = open
		if (keydown(e, 'o') || e.which == 13) {
			if ($selectedMail.length) { // found unread email so open the email
				if (e.which == 13) {
					
					// enter toggles between preview mode
					if ($("#fullEmail").is(":visible")) {
						$(".backToInbox").click();
					} else {
						$selectedMail.find(".emailDetails").click();						
					}
					
				} else {
					$selectedMail.find(".open").click();
				}
			} else { // no unread email so open the inbox instead
				$(".account:visible:first .inboxActions .open").click();
			}
		}

		// # = delete
		if (keydown(e, 51, {shift:true})) {
			if ($("#fullEmail").is(":visible")) {
				$("#fullEmailActionButtons .delete").click();
			} else {
				$selectedMail.find(".delete").click();
			}
		}

		// e = archive
		if (keydown(e, 'e')) {
			if ($("#fullEmail").is(":visible")) {
				$("#fullEmailActionButtons .archive").click();
			} else {
				$selectedMail.find(".archive").click();
			}
		}

		// ! = spam
		if (keydown(e, 49, {shift:true})) {
			if ($("#fullEmail").is(":visible")) {
				$("#fullEmailActionButtons .spam").click();
			} else {
				$selectedMail.find(".spam").click();
			}
		}

		// s = star
		if (keydown(e, 's')) {
			if ($("#fullEmail").is(":visible")) {
				$("#fullEmail").find(".star").click();
			} else {
				$selectedMail.find(".star").click();
			}
		}

		// r = reply (if setting set for this)
		if (Settings.read("keyboardException_R") == "reply" && keydown(e, 'r')) {
			if ($selectedMail.length) {
				if ($("#fullEmail").is(":visible")) {
					setFocusToComposeInput(true);
				} else {
					showFullEmail({$mail:$selectedMail}, function() {
						setFocusToComposeInput(true);
					});
				}
				return false;
			}
		}

		// a = reply to All
		if (keydown(e, 'a')) {
			if ($selectedMail.length) {
				if ($("#fullEmail").is(":visible")) {
					$(".replyToAllLink").click();
				} else {
					showFullEmail({$mail:$selectedMail}, function() {
						$(".replyToAllLink").click();
					});
				}
				return false;
			}
		}

		/*
		// ar = mark All as Read
		if (keydown(lastKeyPressedEvent, 'a') && keydown(e, 'r')) {
			 $(".account:visible .markAllAsRead").click();
	    }
	    */

		// Shift + i OR r = mark as Read
		if (keydown(e, 'i', {shift:true}) || (Settings.read("keyboardException_R") == "markAsRead" && keydown(e, 'r'))) {
			if ($("#fullEmail").is(":visible")) {
				$("#fullEmailActionButtons .markAsRead").click();
			} else {
				$selectedMail.find(".markAsRead").click();
			}
		}

		// x = easter egg
		if (keydown(e, 'x')) {
			$("#scrollAreaWrapper").fadeOut();
			$easterEggVideo = $("<iframe id='easterEggVideo' width='100%' height='420' frameborder=0 src='http://apps.jasonsavard.com/easterEgg.php?width=600&height=400&email=" + escape(bg.email) + "'></iframe>");
			$("body").append($easterEggVideo);
		}
		
		// z = easter egg
		if (keydown(e, 'z')) {
			var $jason = $("<img src='http://apps.jasonsavard.com/images/jason.png'/>");
			$jason.css({position:"absolute", "z-index":1000, width:"100%", height:"1px"});
			$("body").append($jason);
			var phrases = new Array(
					"I can't give you a brain, but I can give you a diploma!",
					"Happiness never comes if you fail to appreciate that you already have it",
					"Keep smiling",
					"I love Jason",
					"Have a wonderful day",
					"Google rocks",
					"Please recycle",
					"You look great today");
			var phraseIndex = Math.floor(Math.random() * phrases.length);
			var phrase = phrases[phraseIndex];
			$jason.animate({
				"height": "+500"
			}, 500, function() {
				// complete animation
				//rotate($jason);
			});			
			bg.ChromeTTS.queue(phrase, {}, function() {
				$jason.slideUp(500);
			});
		}

		lastKeyPressedEvent = e; 
	});
	
	if (pref("donationClicked")) {
		$("#optionsMenu li[val='extraFeatures']").hide();
	}


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
			if (value == "muteNow") {
				var farOffDate = new Date();
				farOffDate.setYear(2999);
				localStorage.muteVoiceEndTime = farOffDate;
				$("#muteMenu").addClass("muted");
				$("#optionsMenu").hide();
			} else if (value == "unmute") {
				localStorage.removeItem("muteVoiceEndTime");
				$("#muteMenu").removeClass("muted");
				$("#optionsMenu").hide();
			} else if (value == "mute60") {
				var dateOffset = new Date();
				dateOffset.setMinutes(dateOffset.getMinutes() + parseInt(60));
				localStorage.muteVoiceEndTime = dateOffset;
				$("#muteMenu").addClass("muted");
				$("#optionsMenu").hide();
			} else if (value == "muteToday") {
				var tom = tomorrow();
				tom.setHours(7);
				tom.setMinutes(0);
				localStorage.muteVoiceEndTime = tom;
				$("#muteMenu").addClass("muted");
				$("#optionsMenu").hide();
			} else if (value == "extraFeatures") {
				chrome.tabs.create({url:"donate.html?ref=popup"});
			} else if (value == "optionsPage") {
				chrome.tabs.create({url:"options.html?ref=popup"});
			} else if (value == "changelog") {
				chrome.tabs.create({url:"http://jasonsavard.com/wiki/Checker_Plus_for_Gmail_changelog?ref=GmailCheckerOptionsMenu"});
			} else if (value == "discoverMyApps") {
				chrome.tabs.create({url:"http://jasonsavard.com?ref=GmailCheckerOptionsMenu"});
			} else if (value == "aboutMe") {
				chrome.tabs.create({url:"http://jasonsavard.com/bio?ref=GmailCheckerOptionsMenu"});
			} else if (value == "help") {
				chrome.tabs.create({url:"http://jasonsavard.com/wiki/Checker_Plus_for_Gmail?ref=GmailCheckerOptionsMenu"});
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