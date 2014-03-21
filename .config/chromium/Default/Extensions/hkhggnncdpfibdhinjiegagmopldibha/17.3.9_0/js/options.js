var hiddenLabel = " [" + getMessage("excluded") + "]";
var lastFocusDate = now();

function showOptionsSection(optionsSection) {
	$.when( $(".optionsSection").fadeOut("fast") ).done(function() {
		$("#" + optionsSection + "Section").animate({opacity: 'show', height: 'show'}, 200);
	});
	
	$('#menu div').each(function(index) {
		$(this).removeClass('active');
		
		if ($(this).attr("optionsSection") == optionsSection) {
			$(this).addClass('active');
			location.href = location.href.split("#")[0] + "#" + optionsSection;
		}
	});
}

function maybeShowWidgetMenu() {
	if (!$("#ANTPWidgetMenu").is(":visible")) {
		if (bg.pokerListenerLastPokeTime.diffInDays() > -5) { // less than 5 minutes ago
			$("#ANTPWidgetMenu").show();
		}
	}
}

function testNotification(params) {
	var cal = bg.primaryCalendar;
	
	var reminderTimes = [];
	reminderTimes.push({shown:false, time:today()})
	var notificationEvent = {test:true, allDay:false, title:getMessage("testEvent"), summary:getMessage("testEvent"), description:getMessage("testDescription"), startTime:today(), reminderTimes:reminderTimes, calendar:cal};
	var notification = {time:today(), reminderTime:today(), event:notificationEvent};
	bg.notificationsQueue.push(notification);
	bg.playNotificationSound(notification);
	bg.showNotifications(params);
}

function updatePage() {			
	try {
		$("#calendarHelper").attr("href", "https://www.google.com/calendar/embedhelper?src=" + encodeURIComponent(bg.email) + "&ctz=" + bg.storage.calendarSettings.timeZone);
	} catch (e) {
		console.error("probably not loaded background", e);
	}
}

function isCustomizedView() {
	return localStorage["calendarType"] == "customized";
}

function loadVoices() {
	var $voiceSelect = $("#voice");
	$voiceSelect.empty();
	
	if (chrome.tts) {
		chrome.tts.getVoices(function(voices) {
			for (var i=0; i<voices.length; i++) {
				var voiceLabel;
				var voiceValue;
				if (voices[i].voiceName == "native") { // || !voices[i].extensionId) {
					voiceLabel = getMessage("native");
					voiceValue = "native";
				} else {
					voiceLabel = voices[i].voiceName;
					voiceValue = voices[i].voiceName;
					if (voices[i].extensionId) {
						voiceValue += "___" + voices[i].extensionId;
					}
				}

				if (voices[i].lang) {
					//voiceLabel += " (" + voices[i].lang + ")";
				}
				var $option = $("<option value='" + voiceValue + "'>" + voiceLabel + "</option>");
				$voiceSelect.append($option);
	      	}
			
			$option = $("<option value='--' disabled>--</option>");
			$voiceSelect.append( $option );
			$option = $("<option value='addSpeechEngine' style='color:gray'>" + getMessage("addSpeechEngines") + "...</option>");
			$voiceSelect.append( $option );
			
			var voiceIndexMatched = getDefaultVoice(voices, true);
			if (voiceIndexMatched != -1) {
				$voiceSelect.prop("selectedIndex", voiceIndexMatched);
				// trigger change to save pref
				if ($voiceSelect.val() != pref("voice", "native")) {
					$voiceSelect.change();
				}
			}
			//$voiceSelect.val( pref("voice", "native") );
	    });
	}
}

$(document).ready(function() {
	try {
		$("title, #title").text(chrome.runtime.getManifest().name);
	} catch (e) {
		console.error("error getting manifest: " + e);
	}

	initToolTips();
	initPrefAttributes();
	initOptions();

	if (bg.email == atob("amFzb25zYXZhcmRAZ21haWwuY29t")) {
		$("#testMode").change(function() {
			bg.setTestSettings();
		});
		$("#exportLocalStorage").click(function() {
			downloadObject(localStorage);
		})
		$("#importLocalStorage").click(function() {
			var localStorageText = $("#localStorageText").val();
			if (localStorageText) {
				var localStorageImportObj = JSON.parse(localStorageText);
				localStorage.clear();
				for (item in localStorageImportObj) {
					localStorage.setItem(item, localStorageImportObj[item]);
				}
				niceAlert("Done. Reload the extension to use these new settings!");
			} else {
				niceAlert("Must enter localStorage JSON string!")
			}
		})

		$("#testSection").show();
	}
	
	
	$(window).focus(function(event) {
		// patch: focus was called twice?? so check that atleast 2 seconds has gone by
		if ((now() - lastFocusDate) > 2000) {
			lastFocusDate = now();
			
			// reload voices
			loadVoices();
		}
	});
	
	$("#voice").change(function() {
		if ($(this).val().indexOf("Multilingual TTS Engine") != -1) {
			$("#pitch, #rate").attr("disabled", "true");
		} else {
			$("#pitch, #rate").removeAttr("disabled");
		}
		
		if ($(this).val() == "addSpeechEngine") {
			chrome.tabs.create({url: "http://jasonsavard.com/wiki/Speech_engines"});
			return false;
		}
		return true;
	});
	
	loadVoices();
	// seems we have to call chrome.tts.getVoices twice at a certain 
	if (navigator.userAgent.toLowerCase().indexOf("linux") != -1) {
		setTimeout(function() {
			loadVoices();
		}, seconds(1));
	}
	
	$("#playVoice").click(function() {
		bg.ChromeTTS.queue($("#voiceTestText").val());
	});
	
	$("#highlightDateAndTimes").change(function() {
		chrome.tabs.query({url:"https://mail.google.com/*"}, function(tabs) {
			console.log(tabs);
			if (tabs && tabs.length) {
				$("#highlightDateAndTimesWarning").slideDown();
			}
		});
	});

	$("#showConsoleMessagesOptions").toggle(pref("console_messages"));
	$("#showConsoleMessages").get(0).checked = pref("console_messages")
	$("#showConsoleMessages").change(function() {
		if (this.checked) {
			localStorage.console_messages = true
			$("#showConsoleMessagesOptions").slideDown();
		} else {
			localStorage.removeItem("console_messages");
			$("#showConsoleMessagesOptions").slideUp();
		}
		initConsole();
	});
	$("#24hourMode, #showDaysLeftInBadge, #showHoursLeftInBadge, #showMinutesLeftInBadge, #maxDaysAhead, #showEventTimeOnBadge, #showDayOnBadge, #showDayOnBadgeOptions input, #excludeRecurringEventsButtonIcon, #excludeHiddenCalendarsFromButton, #showButtonTooltip").change(function() {
		setTimeout(function() {
			bg.checkEvents({ignoreNotifications:true});
		}, 200);
	});		
	$("#showTimeSpecificEventsBeforeAllDay, #eventColors").change(function() {
		bg.pollServer({source:"showTimeSpecificEventsBeforeAllDay"});
	});		
	$("#offlineMode").change(function() {
		if (!this.checked) {
			bg.clearEventTraces();
		}
		bg.pollServer({source:"offlineMode"});
	});		
	$("#popupGoogleCalendarWebsite").change(function() {
		bg.initPopup();
	});
	
	$("#showContextMenuItem").change(function() {
		if (this.checked) {
			bg.addChangeContextMenuItems();
		} else {
			chrome.contextMenus.removeAll();
		}
	});

	//$("#customizedCalendar").val(localStorage["customizedCalendar"]);
	if (isCustomizedView()) {
		$("#customizeCalendar").attr("checked", true);
		$("#customizedCalendarWrapper").show();
	}
	
	$("#ssl").click(function() {
		niceAlert("Google Apps users might have login problems when this is turned off!");
	});
	
	$("#donate").click(function() {
		location.href = "donate.html?fromOptions=true";
	});
	
	function highlightCalendarHelper() {
		$("#customizedCalendarWrapper").show();
		//$("#customizedCalendarWrapper td").toggleSlide();
		$("#customizedCalendarWrapper td").css("border-color", "orange").animate({
			borderTopWidth: "+=5",
			borderBottomWidth: "+=5"
		  }, "slow", function() {
			$(this).animate({
				borderTopWidth: "-=5",
				borderBottomWidth: "-=5"
			}, "slow", function() {
				//compete do nothing
			});
		  });
	}

	var contentID = location.href.split("#")[1];

	if (document.location.href.match("install=true")) {
		$("#donate").hide();
		showOptionsSection("notifications");
		
		if (navigator.vendor && navigator.vendor.indexOf("Opera") != -1) {
			if (!window.webkitNotifications) {
				niceAlert("Desktop notifications are not yet supported in this browser!");				
			}
			if (window.chrome && !window.chrome.tts) {
				niceAlert("Voice notifications are not yet supported in this browser!");
			}
			niceAlert("You are not using the stable channel of Chrome! <a target='_blank' style='color:blue' href='http://jasonsavard.com/wiki/Unstable_channel_of_Chrome'>More info</a><br><br>Bugs might occur, you can use this extension, however, for obvious reasons, these bugs and reviews will be ignored unless you can replicate them on stable channel of Chrome.");
		}

		// check for sync data
		bg.syncOptions.fetch(function(response) {
			if (response.items && !response.error) {
				niceAlert("Would you like to use your previous extension options? <div style='margin-top:4px;font-size:12px;color:gray'>(If you had previous issues you should do this later)</div>", {cancelButton:true}, function(action) {
					if (action == "ok") {
						bg.syncOptions.load(response.items, function(response) {
							niceAlert("<span style='font-weight:bold;color:green'>Options restored!</span>", {okButtonLabel:"Restart Extension"}, function() {
								chrome.runtime.reload();
							});
						});
					}
				});
			}
		});
		
	} else if (location.href.match("calendarView=customized")) {
		showOptionsSection("general");
		$("html, body").animate({ scrollTop: $(document).height() }, "slow");
		highlightCalendarHelper()
	} else if (contentID) {
		// detect if this options windows was opened by the configure button via the ANTP window ie. options.html#%7B%22id%22%3A%22pafgehkjhhdiomdpkkjhpiipcnmmigcp%22%7D which decodes to options.html#{"id":"pafgehkjhhdiomdpkkjhpiipcnmmigcp"}
		var id;
		try {
			id = JSON.parse( decodeURIComponent(window.location.hash).substring(1) ).id
		} catch (e) {
			// do nothing
		}
		
		if (id) {			
			showOptionsSection("widget");
		} else {
			showOptionsSection(contentID);	
		}
	} else {
		showOptionsSection("notifications");
	}
	
	$(".notificationsTabLink").click(function() {
		showOptionsSection("notifications");
	});

	updatePage();

	$(".excludeCalendarsCheckboxView, #excludeCalendarFrom2").click(function() {
		if (isCustomizedView()) {
			highlightCalendarHelper();
			niceAlert("Inside the Calendar Helper tool, you can choose which calendars to see");
		} else {
			niceAlert("In the popup calendar, select the 'Customize' view");
		}
		return false;
	});

	$("#customizeCalendar").click(function() {
		niceAlert(getMessage("customizeCalendarTitle"));
		return false;
	});

	$("#excludeCalendarsCheckboxChecking").click(function() {
		$("#hideCalendars").empty();

		$.each(bg.getArrayOfCalendars(), function(index, calendar) {
			
			var $option = $("<option/>");
			
			var title = getCalendarName(calendar);
			if (isInArray(calendar.id, bg.excludedCalendars)) {
				title += hiddenLabel;
				$option.addClass("hiddenCalendar");
			}

			$option
				.attr("value", calendar.id)
				.text(title)
			;
			
			$("#hideCalendars").append($option);
		});
		
		if (bg.getArrayOfCalendars && bg.getArrayOfCalendars().length >= 1) {
			$('#excludeCalendarsWrapper').slideToggle();
		} else {
			niceAlert("You must grant access or sign in to your Google Calendar first and then try clicking here again!");
		}
		return false;
	});

	var locale = pref("lang", window.navigator.language);
	var lang = locale;
	if (locale) {
		if (locale.indexOf("en") != -1) {
			locale = "en";
			lang = locale;
		} else if (locale.indexOf("zh") != -1) {
			// zh_CN was not working last with facebook so default to zh_TW
			locale = "zh_TW";
		} else {
			locale = locale + "_" + locale.toUpperCase();
		}
	} else {
		locale = "en";
	}

	$("#quickAddMoreInfo").click(function() {
		chrome.tabs.create({url:"http://www.google.com/support/calendar/bin/answer.py?hl=" + lang + "&answer=36604"});
	});
	
	$("#badgeIcons *[pref=badgeIcon]").change(function() {
		bg.updateBadge({forceRefresh:true});
	});

	$("#colorPicker").css("background-color", pref("backgroundOfNotification", "")).click(function() {
		$("#colorGrid").slideToggle();
	});
	//$("#colorGrid").css("left", $(document).width() / 2);
	$(".color").click(function() {
		var color = $(this).css("background-color");
		$("#colorPicker").css("background-color", color);
		$("#colorGrid").slideToggle();
		localStorage["backgroundOfNotification"] = color;
	});

	$("#fbLike").attr("src", "http://www.facebook.com/plugins/like.php?show_faces=false&layout=standard&width=450&action=recommend&colorscheme=light&height=40&ref=options&locale=" + locale + "&href=https%3A%2F%2Fchrome.google.com%2Fextensions%2Fdetail%2Fhkhggnncdpfibdhinjiegagmopldibha");

	if (pref("donationClicked")) {
		$(".donationFeature").removeClass("donationFeature");
	} else {
		$("*[mustDonate]").each(function(i, element) {
			$(this).addClass("donationFeature");
		});
	}
	
	chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
		if (message.command == "featuresProcessed") {
			$(".donationFeature").removeClass("donationFeature");
		} else if (message.command == "grantPermissionToCalendars") {
			
			if ($("#emailsGrantedPermissionToContacts").html().indexOf(message.email) == -1) {
				$("#emailsGrantedPermissionToContacts").append("&nbsp;" + message.email);
			}
			
			$("#accessNotGrantedWarning").slideUp();
			$("#oauthNotGranted").slideUp();
			$("#oauthOptions").slideDown();
			
		}
	});

	$("#removeShareLinks").click(function(event) {
		if (pref("shareLinkClicked") || pref("donationClicked")) {
			// were good
		}  else {
			// stop them
			alert(getMessage("mustClickShareLinks"));
			// force localstorage to false since click hooks in the common might change this value
			localStorage["removeShareLinks"] = false;
			event.preventDefault();
		}
	});

	var $notificationFontSizeSmallestSelect = $("#notificationFontSizeSmallest");
	var $notificationFontSizeSelect = $("#notificationFontSize");
	for (var a=14; a<33; a++) {
		var $smallestOption = $("<option value='" + a + "'>" + a + "</option>");
		var $largestOption = $smallestOption.clone();
		$notificationFontSizeSmallestSelect.append( $smallestOption );
		$notificationFontSizeSelect.append( $largestOption );
	}
	
	$("#notificationFontSizeSmallest").change(function() {
		if ($(this).val() > $("#notificationFontSize").val()) {
			$("#notificationFontSize").val($(this).val()).change();
		}
	});

	$("#notificationFontSize").change(function() {
		if ($(this).val() < $("#notificationFontSizeSmallest").val()) {
			$("#notificationFontSizeSmallest").val($(this).val()).change();
		}
	});
	
	$("#closePopupsAfterAWhileInterval").change(function() {
		$("#closePopupsAfterAWhile").attr("checked", true).change();
	});
	
	var $repeatSoundIntervalSelect = $("#repeatSoundInterval");
	for (var a=1; a<=60; a++) {
		var $option = $("<option value='" + a + "'>" + a + "</option>");
		if (pref("repeatSoundInterval") == a) {
			$option.attr("selected", "");
		}
		$repeatSoundIntervalSelect.append( $option );
	}

	var $repeatSoundStopAfterSelect = $("#repeatSoundStopAfter");
	for (var a=1; a<=10; a++) {
		var $option = $("<option value='" + a + "'>" + a + "</option>");
		if (pref("repeatSoundStopAfter") == a) {
			$option.attr("selected", "");
		}
		$repeatSoundStopAfterSelect.append( $option );  
	}
	var $foreverOption = $("<option value='999'>" + getMessage("forever") + "</option>");
	$repeatSoundStopAfterSelect.append( $foreverOption );

	$("#repeatSoundInterval, #repeatSoundStopAfter").change(function() {
		if (pref("donationClicked")) {
			$("#repeatSound").attr("checked", true);
		}
		$("#repeatSound").change();
	});
	
	$("#fetchCalendarSettings").click(function() {
		bg.fetchCalendarSettings({bypassCache:true, email:bg.email}, function(response) {
			if (response.error) {
				alert("problem: " + response.error)
			} else {
				alert("Done");
			}
		});
	});
	
	$("#clearCache").click(function() {
		bg.clearEventTraces();
		bg.clearEventsShown();
		bg.clearSnoozers();

		bg.storage = {};
		bg.storage.calendarSettings = {};
		bg.excludedCalendars = new Array("p#weather@group.v.calendar.google.com");
		bg.storageManager.clear();
		
		bg.pollServer({source:"clearCache"});
		alert("Cache cleared!  Previously snoozed events will be forgotten and you will have to re-exclude your excluded calendars again!");
	});
	
	$("#showCalendarData").click(function() {
		for (var a=bg.calendars.length-1; a>=0; a--) {
			var calendar = bg.calendars[a];
			$("#showCalendarData").after($("<a target='_blank' href='" + calendar.url + "'>" + calendar.title + "</a>"));
			$("#showCalendarData").after("<br/>");
		};
		$("#showCalendarData").after("<br/><br/>Click a calendar...");
	});

	if (navigator.language.indexOf("en") == -1) {
		$("#lang").find("option[value='en-GB']").remove();
	}

	var navLang = pref("lang", window.navigator.language);
	if ($("#lang").find("option[value='" + navLang + "']").exists()) {
		$("#lang").val(navLang);
	} else if ($("#lang").find("option[value='" + navLang.substring(0, 2) + "']").exists()) {
		$("#lang").val(navLang.substring(0, 2));
	} else {
		$("#lang").val("en");
	}

	$("#lang").change(function() {			
		loadLocaleMessages($(this).val(), function() {
			bg.checkEvents({ignoreNotifications:true});
			window.location.reload(true);
		});
	});
	
	$('#sn_audio_enc').val(pref("sn_audio_raw"));

	$('#sn_audio').change(function () {
		if (this.value == "custom") {
			$('#sn_audio_src').show();
		} else {
			$('#sn_audio_src').hide();
		}
	});

	$('#sn_audio').val(pref("sn_audio", "ding.ogg"));

	if (pref("sn_audio") != "custom") {
		$('#sn_audio_src').hide();
	}

	$("#runInBackground").click(function() {
		if (this.checked) {
			$("#backgroundAppsWarning").slideDown();
		} else {			
			$("#backgroundAppsWarning").slideUp();
		}
	});
	
	$("#playNotificationSound").click(function() {
		bg.playNotificationSoundFile();
	});
	
	$("#moreIcons").click(function() {
		$(this).hide();
		$('#moreIconsWrapper').slideDown();
	});
	
	$("#excludeCalendar").click(function() {
		
		var $selectedCalendars = $("#hideCalendars option:selected");
		if ($selectedCalendars.length >= 1) {
			
			$selectedCalendars.each(function(index, selectedCalendar) {
				if (selectedCalendar.text.indexOf(hiddenLabel) != -1) {
					removeFromArray(selectedCalendar.value, bg.excludedCalendars);
					selectedCalendar.text = selectedCalendar.text.replace(hiddenLabel, "");
					$(selectedCalendar).removeClass("hiddenCalendar");
				} else {
					addToArray(selectedCalendar.value, bg.excludedCalendars);
					selectedCalendar.text += hiddenLabel;
					$(selectedCalendar).addClass("hiddenCalendar");
				}
			});
			
			localStorage.excludedCalendars = JSON.stringify(bg.excludedCalendars);
		} else {
			niceAlert(getMessage("selectCalendar"));
		}
		
	});
	
	$("#sn_audio_src").change(function() {
	   var file = this.files[0];
	   var fileReader = new FileReader();

	   fileReader.onloadend = function () {
		   try {
			   localStorage["temp"] = this.result;
		   } catch(e) {
			   niceAlert("The file you have chosen is too large, please select a shorter sound alert.");
			   return;
		   } finally {		   
			   localStorage["temp"] = null;
			   delete localStorage["temp"];
		   }		
		   
	      $('#sn_audio_enc').val(this.result);
		   
		   try {
		      localStorage["sn_audio_raw"] = document.getElementById("sn_audio_enc").value;
		   } catch (e) {
		      console.error(e);
			   niceAlert("Could not save notification sound in storage. Please select a smaller audio file!");   
		   }
		   
	   }

	   fileReader.onabort = fileReader.onerror = function () {
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

	   fileReader.readAsDataURL(file);	
	});

    $("#headerLogo").dblclick(function() {
    	if (localStorage.donationClicked) {
    		localStorage.removeItem("donationClicked");
    	} else {
    		localStorage.donationClicked = "true";
    	}
    	location.reload(true);
    });
	
    $("#menu div").click(function() {
    	showOptionsSection($(this).attr("optionsSection"));
    });

    // init widget color picker
    $("#widgetColor.color-picker").miniColors({
		letterCase: 'uppercase',
		change: function(hex, rgb) {
			localStorage.widgetBackgroundColor = $("#widgetColor").val();
		}
    });
    
	$("#widgetColor").val(localStorage.widgetBackgroundColor);
	$("#widgetColor").miniColors('value', localStorage.widgetBackgroundColor);
	
	if (!bg.email) {
		$("#accessNotGrantedWarning").hide();
		$("#oauthNotGranted").show();
	} else if (!bg.oAuthForDevices.findTokenResponse({userEmail:bg.email})) {	
		// only show warning if we did not arrive from popup warning already
		if (getUrlValue(location.href, "accessNotGranted")) {
			$("#accessNotGrantedWarning").hide();
		} else {
			if (location.hash == "#accounts") {
				$("#accessNotGrantedWarning").hide();
			} else {
				$("#accessNotGrantedWarning").show();
			}
		}
		
		//if (bg.signedInEmails.length >= 2) {
			$("#defaultAccountEmail").text(bg.email);
			$("#defaultAccount").show();
		//}
		
		$("#oauthNotGranted").show();			
	} else {
		$("#accessNotGrantedWarning").hide();
		$("#oauthNotGranted").hide();
	}

	var userEmails = bg.oAuthForDevices.getUserEmails();
	
	if (userEmails.length) {
		$.each(userEmails, function(index, userEmail) {
			$("#emailsGrantedPermissionToContacts").append(userEmail + "&nbsp;");
		});
		$("#oauthOptions").show();
	} else {
		$("#oauthOptions").hide();
	}
	
	$("#eventColorsWrapper").show();

	$("#grantAccessButton, #grantAccessAgain").click(function() {
		bg.oAuthForDevices.openPermissionWindow();
	});
	
	$("#revokeAccess").click(function() {
		localStorage.removeItem("tokenResponses");
		bg.oAuthForDevices.removeAllTokenResponses();
		bg.tokenResponses = [];
		bg.logout();
		$("#emailsGrantedPermissionToContacts").empty();
		$("#oauthNotGranted").show();
		$("#oauthOptions").hide();
		niceAlert("Done!");
	});

	$("input[name='signedOutOfGoogleCalendarAction']").change(function() {
		if ($(this).val() == "signOut") {
			bg.pollServer({source:"signedOutOfGoogleCalendarActionToggled"});
		}
	});
	
	var notificationWindowType = pref("notificationWindowType", "rich");
	if (notificationWindowType == "text") {
		$("#richNotificationOptions").hide();
	} else if (notificationWindowType == "rich") {
		$("#richNotificationOptions").show();
	}
	
	$("input[name='notificationWindowType']").change(function() {
		if ($(this).val() == "text") {
			$("#richNotificationOptions").slideUp();
		} else if ($(this).val() == "rich") {
			$("#richNotificationOptions").slideDown();
		}
	});
	
	$("#testOutTextNotification").click(function() {
		testNotification({testType:"text"});
	});

	$("#testOutRichNotification").click(function() {
		testNotification({testType:"rich"});
	});

	$("#pendingNotificationsInterval").change(function() {
		bg.ForgottenReminder.stop();
	});

	$("#testPendingNotifications").click(function() {
		niceAlert("Click OK to see the toolbar button animate :)", function() {
			bg.ForgottenReminder.execute({test:true});
		});
	});
	
	$("#accountsSectionLink").click(function() {
		showOptionsSection("accounts");
	});
	
	$(".snoozeOption").each(function(index, option) {
		$(option).text(getMessage("snooze") + " " + $(option).text());
	});

	$("#saveSyncOptions").click(function() {
		bg.syncOptions.save("manually saved", function(response) {
			if (response.error) {
				niceAlert("Error: " + response.error);
			} else {
				niceAlert("Done.<br><br><span style='color:gray;font-size:13px'>Make sure you are signed into Chrome for the sync to complete <a style='white-space:nowrap' target='_blank' href='https://support.google.com/chrome/answer/185277'>More info</a></span>");
			}
		});
		return false;
	});

	$("#loadSyncOptions").click(function() {
		bg.syncOptions.fetchAndLoad(function(response) {
			if (response.error) {
				niceAlert("Error: " + response.error);
			} else if (response.items) {
				niceAlert("Click OK to restart the extension", function() {
					chrome.runtime.reload();
				});
			} else {
				niceAlert("Could not find any synced data!<br><br>Make sure you sign in to Chrome on your other computer AND this one <a target='_blank' href='https://support.google.com/chrome/answer/185277'>More info</a>");
			}
		});
		return false;
	});
	
	maybeShowWidgetMenu();
	setInterval(function() {
		maybeShowWidgetMenu();
	}, 2000)
	
});