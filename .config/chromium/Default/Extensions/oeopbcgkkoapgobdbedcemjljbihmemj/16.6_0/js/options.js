var Settings;
var ignoreOptionChangeInPage = false;
var lastFocusDate = now();
var initializingMiniColors = false;
var monitorLabelsEnabled;
var ADDING_METHOD_OAUTH_PERMISSIONS = {origins: ["*://*.jasonsavard.com/*"]};

var langs =
	[['Afrikaans',       ['af-ZA']],
	 ['Bahasa Indonesia',['id-ID']],
	 ['Bahasa Melayu',   ['ms-MY']],
	 ['Català',          ['ca-ES']],
	 ['Čeština',         ['cs-CZ']],
	 ['Deutsch',         ['de-DE']],
	 ['English',         ['en-AU', 'Australia'],
	                     ['en-CA', 'Canada'],
	                     ['en-IN', 'India'],
	                     ['en-NZ', 'New Zealand'],
	                     ['en-ZA', 'South Africa'],
	                     ['en-GB', 'United Kingdom'],
	                     ['en-US', 'United States']],
	 ['Español',         ['es-AR', 'Argentina'],
	                     ['es-BO', 'Bolivia'],
	                     ['es-CL', 'Chile'],
	                     ['es-CO', 'Colombia'],
	                     ['es-CR', 'Costa Rica'],
	                     ['es-EC', 'Ecuador'],
	                     ['es-SV', 'El Salvador'],
	                     ['es-ES', 'España'],
	                     ['es-US', 'Estados Unidos'],
	                     ['es-GT', 'Guatemala'],
	                     ['es-HN', 'Honduras'],
	                     ['es-MX', 'México'],
	                     ['es-NI', 'Nicaragua'],
	                     ['es-PA', 'Panamá'],
	                     ['es-PY', 'Paraguay'],
	                     ['es-PE', 'Perú'],
	                     ['es-PR', 'Puerto Rico'],
	                     ['es-DO', 'República Dominicana'],
	                     ['es-UY', 'Uruguay'],
	                     ['es-VE', 'Venezuela']],
	 ['Euskara',         ['eu-ES']],
	 ['Français',        ['fr-FR']],
	 ['Galego',          ['gl-ES']],
	 ['Hrvatski',        ['hr_HR']],
	 ['IsiZulu',         ['zu-ZA']],
	 ['Íslenska',        ['is-IS']],
	 ['Italiano',        ['it-IT', 'Italia'],
	                     ['it-CH', 'Svizzera']],
	 ['Magyar',          ['hu-HU']],
	 ['Nederlands',      ['nl-NL']],
	 ['Norsk bokmål',    ['nb-NO']],
	 ['Polski',          ['pl-PL']],
	 ['Português',       ['pt-BR', 'Brasil'],
	                     ['pt-PT', 'Portugal']],
	 ['Română',          ['ro-RO']],
	 ['Slovenčina',      ['sk-SK']],
	 ['Suomi',           ['fi-FI']],
	 ['Svenska',         ['sv-SE']],
	 ['Türkçe',          ['tr-TR']],
	 ['български',       ['bg-BG']],
	 ['Pусский',         ['ru-RU']],
	 ['Српски',          ['sr-RS']],
	 ['한국어',            ['ko-KR']],
	 ['中文',             ['cmn-Hans-CN', '普通话 (中国大陆)'],
	                     ['cmn-Hans-HK', '普通话 (香港)'],
	                     ['cmn-Hant-TW', '中文 (台灣)'],
	                     ['yue-Hant-HK', '粵語 (香港)']],
	 ['日本語',           ['ja-JP']],
	 ['Lingua latīna',   ['la']]];

if (bg.getSettings) {
	Settings = bg.getSettings();
}

function pollAndLoad(pollAccountsParams, selectLastAccount) {
	$("#loading").show();
	bg.pollAccounts(pollAccountsParams, function() {
		loadAccountsOptions(selectLastAccount);
		$("#loading").hide();
	});
}

function setColors() {
	setAccountGradient($("#colorEmail"), $("#colorStart").val(), $(
			"#colorEnd").val());
	$("#colorEmailMessageArea").css("background-color",
			$("#colorStart").val());
}

function showContent(contentId) {

	loadAccountsOptions();

	$.when( $(".tabContent").fadeOut("fast") ).done(function() {
		$(".tabContent").eq(contentId).animate({opacity: 'show', height: 'show', xxwidth: 'show'}, 200);
	});
	
	$('ul.menu > li > a').each(function(index) {
		$(this).removeClass('active');
		if (index == contentId) {
			$(this).addClass('active');
			location.href = location.href.split("#")[0]	+ "#" + contentId;
		}
	});
}

function generateEmailDropDownItemToDisplay(account) {
	var ignoreMessage = "";
	var errorMessage = "";
	if (account.getSetting("ignore", "ignoreFromDefaultSettingsBUTDONTMATCHTHIS")) {
		ignoreMessage = " [" + getMessage("ignored") + "]";
	}
	if (account.error) {
		errorMessage = " (" + account.error + " - try removing/adding!)";
	}
	return account.getAddress() + ignoreMessage + errorMessage;
}

function generateCustomOption(name) {
	return "<option value='custom_" + name + "'>" + name + "</option>";
}

function generateSoundOptions(account, labelValue) {
	var str = "";
	if (account) {
		str = "<option value=''>" + getMessage("none") + "</option>";
		str += "<option disabled style='color:gray'>" + "--" + "</option>";
	}
	str +=
		"<option value='bug.ogg'>" + "Bug" + "</option>" +
		"<option value='cash.ogg'>" + "Cash" + nbsp(21) + "(for orders, receipts, PayPal)" + "</option>" +
		"<option value='chime.ogg'>" + getMessage("chime") + "</option>" +
		"<option value='ding.ogg'>" + getMessage("ding") + "</option>" +
		"<option value='electronicdrops.ogg'>" + "Electronic drops" + "</option>" +
		"<option value='fallingbeep.ogg'>" + "Falling beep" + "</option>" +
		"<option value='kiss.ogg'>" + "Kiss" + nbsp(22) + "(for spouse)" + "</option>" +
		"<option value='ohno.ogg'>" + "Oh no" + nbsp(19) + "(for mom)" + "</option>" +
		"<option value='ohshit.ogg'>" + "Oh shit" + nbsp(18) + "(for work emails)" + "</option>" +
		"<option value='pianohappy.ogg'>" + "Piano Happy" + "</option>" +
		"<option value='scary.ogg'>" + "Scary" + nbsp(20) + "(for boss)" + "</option>" +
		"<option value='tech.ogg'>" + "Tech" + nbsp(21) + "(for blogs)" + "</option>" +
		"<option value='ultranova.ogg'>" + "Ultranova" + "</option>" +
		"<option value='whoppii.ogg'>" + "Whoppii" + "</option>" +
		"<option value='yeahaha.ogg'>" + "Yeahaha" + "</option>" +
		"<option value='youvegotmail.ogg'>" + "You've got mail" + nbsp(6) + "(from your developer :)" + "</option>" +
		"<option disabled style='color:gray'>" + "--" + "</option>";
	
	var sounds = Settings.read("customSounds");
	if (sounds) {
		$.each(sounds, function(index, sound) {
			str += generateCustomOption(sound.name);
		});
	}
	
	str += "<option value='custom' style='color:blue'>" + "More..." + "</option>";
	
	var $select = $("<select class='sound'>" + str + "</select>");

	var defaultValue = Settings.read("sn_audio");
	
	if (account) {
		var settingValue = getSettingForLabel(account.getSetting("sounds"), labelValue, defaultValue);
		$select.val(settingValue);
	} else {
		$select.val(defaultValue);
	}
	
	$select
		.off("focus").on("focus", function() {
			console.log("select focus: " + $(this).val());
			$(this).data("previousValue", $(this).val());
		})
		.off("change").on("change", function() {
			console.log("select changed", $(this))
			if ($(this).val() == "custom") {
				var sounds = Settings.read("customSounds");
				if (sounds && sounds.length) {
					$("#deleteAllCustomSoundsWrapper").show();
				}
				
				$("#donationRequiredSoundUploader").toggleClass("hide", !account || pref("donationClicked"));
				
				$("#soundUploader")
					.data("account", account)
					.data("select", $select)
					.fadeIn()
				;
			} else {
				bg.playNotificationSound($(this).val());
				if (account) {
					if (donationClicked("soundForLabel")) {
						saveEmailSettings();
					} else {
						// restore previous value
						var previousValue = $select.data("previousValue");
						console.log("restore: " + previousValue);
						$select.val( previousValue );
					}
				} else {
					Settings.store("sn_audio", $(this).val());
				}
			}
			$(this).blur();
		})
	;
	
	return $select;
}

function generateVoiceOptions(account, labelValue) {
	var str = "";
	if (account) {
		str = "<option value=''>" + getMessage("none") + "</option>";
		str += "<option disabled style='color:gray'>" + "--" + "</option>";
	}
	str +=
		"<option value='message'>" + getMessage("email_message") + "</option>" +
		"<option disabled style='color:gray'>" + "--" + "</option>" +
		"<option value='subject'>" + getMessage("email_subject") + "</option>" +
		"<option value='subject|message'>" + getMessage("email_subject") + ", " + getMessage("email_message") + "</option>" +
		"<option disabled style='color:gray'>" + "--" + "</option>" +
		"<option value='from'>" + getMessage("email_from") + "</option>" +
		"<option value='from|subject'>" + getMessage("email_from") + ", " + getMessage("email_subject") + "</option>" +
		"<option value='from|subject|message'>" + getMessage("email_from") + ", " + getMessage("email_subject") + ", " + getMessage("email_message") + "</option>";
		
	var $select = $("<select class='voice'>" + str + "</select>");

	// hardcoded: don't use Settings.js because we can't set it there or will screw up the legacy code concering hearvoice 
	var defaultValue = Settings.read("voiceHear");
	
	if (account) {
		var settingValue = getSettingForLabel(account.getSetting("voices"), labelValue, defaultValue);
		$select.val(settingValue);
	} else {
		$select.val(defaultValue);
	}
	
	$select
		.off("focus").on("focus", function() {
			console.log("select focus: " + $(this).val());
			$(this).data("previousValue", $(this).val());
		})
		.off("change").on("change", function() {
			console.log("select changed", $(this))
			if (account) {
				saveEmailSettings();
			} else {
				Settings.store("voiceHear", $(this).val());
			}
			$(this).blur();
		})
	;
	
	return $select;
}

function getSettingForLabel(settings, labelValue, defaultObj) {
	if (!settings) {
		settings = {};
	}

	var value;
	if (typeof settings[labelValue] == "undefined") {
		value = defaultObj;
	} else {
		value = settings[labelValue];
	}
	return value;
}

// desc: stores labelvalue in monitorlabelline node
function generateMonitorLabelOptions(account, title, labelValue) {
	var $soundOptions = generateSoundOptions(account, labelValue);
	var $voiceOptions = generateVoiceOptions(account, labelValue);
	
	var uniqueId = "enabled_" + String(Math.floor(Math.random() * 10000));
	
	var msgToolTipStr = "";
	if (!pref("donationClicked")) {
		msgToolTipStr = " msgToolTip='differentSoundsToolTip' ";
	}
	
	var $monitorLabelLine = $("<div class='monitorLabelLine'><input id='" + uniqueId + "' class='enabled' type='checkbox'/> <label for='" + uniqueId + "' class='label'></label> <span class='soundOptionsWrapper' mustDonate='true' " + msgToolTipStr + "></span> <span style='opacity:1'><input class='notification' type='checkbox'/></span> <span class='voiceOptionsWrapper'></span></div>");
	$monitorLabelLine.data("labelValue", labelValue);
	$monitorLabelLine.find(".label")
		.text(title)
		.attr("title", title)
	;
	$monitorLabelLine.find(".soundOptionsWrapper").append($soundOptions);
	$monitorLabelLine.find(".voiceOptionsWrapper").append($voiceOptions);
	
	if (monitorLabelsEnabled.indexOf(labelValue) != -1) {		
		$monitorLabelLine.find(".enabled").get(0).checked = true;
	} else {
		$monitorLabelLine.addClass("disabledLine");
	}
	
	// sound notifications are handled inside generateSoundOptions()
	// voice notifications are handled inside generateVoiceOptions()

	// desktop notifications
	var settingValue = getSettingForLabel(account.getSetting("notifications"), labelValue, Settings.read("desktopNotification"));	
	$monitorLabelLine.find(".notification").get(0).checked = settingValue;
	$monitorLabelLine.find(".notification").change(function() {
		saveEmailSettings();
	});

	/*
	// voice notifications
	var settingValue = getSettingForLabel(account.getSetting("voices"), labelValue, Settings.read("voiceNotification"));	
	$monitorLabelLine.find(".voice").get(0).checked = settingValue;
	$monitorLabelLine.find(".voice").change(function() {
		saveEmailSettings();
	});
	*/
	
	return $monitorLabelLine;
}

function getEnabledLabels() {
	var values = [];
	
	// loop through lines to pull data and then see if checkbox inside line is checked
	$(".monitorLabelLine").each(function() {
		var labelValue = $(this).data("labelValue");
		if ($(this).find(".enabled:checked").length) {
			values.push(labelValue);
		}
	});
	return values;
}

function loadAccountsOptions(selectLastAccount) {
	console.log("accounts length: " + bg.accounts.length);

	var $monitorLabels = $("#monitorLabels");
	var $openLabelSelect = $("#open_label");

	// only do this if accounts detected or oauth because or we leave the signInToYourAccount message in the dropdown
	if (bg.accounts.length || Settings.read("accountAddingMethod") == "oauth") {
		$("#emails").empty();
		$monitorLabels.empty();
		$openLabelSelect.empty();
		$("#alias").val("");
	}
	
	var allAccounts = bg.accounts.concat(bg.ignoredAccounts);
	
	$.each(allAccounts, function(i, account) {
		var $option = $("<option " + ((i==0)?" selected " : "") + "> " + generateEmailDropDownItemToDisplay(account) + "</option>");
		$option.data("data", account);

		$("#emails").append($option);
	});

	$("#monitorLabelsWrapper").toggleClass("disabledSound", !Settings.read("soundNotification"));
	$("#monitorLabelsWrapper").toggleClass("disabledNotification", !Settings.read("desktopNotification"));
	$("#monitorLabelsWrapper").toggleClass("disabledVoice", !Settings.read("voiceNotification"));
	
	$("#emails").off("change").on("change", function(event) {
		
		var $selectedOptions = $("option:selected", this);
		
		if ($selectedOptions.length >= 2) {
			niceAlert("Please configure one email at the time!");
			$selectedOptions.removeAttr("selected");
			$("option:first", this).attr("selected", "true");
			$("#emails").change();
			return false;
		}
		
		var account = $selectedOptions.data("data");
		if (account) {
			$monitorLabels.empty();
			$openLabelSelect.empty();
			
			monitorLabelsEnabled = account.getMonitorLabels();
			
			var $option;

			// open labels
			$option = $("<option value=''>" + getMessage("inbox") + "</option>");
			$openLabelSelect.append($option);
			//$option = $("<option value='mbox'>" + getMessage("priorityInbox") + "</option>");
			//$openLabelSelect.append($option);
			$option = $("<option value='search/l:unread'>" + getMessage("unreadMail") + "</option>");
			$openLabelSelect.append($option);
			$option = $("<option value='all'>" + getMessage("allMail") + "</option>");
			$openLabelSelect.append($option);
			$option = $("<option value='--' disabled>" + "--" + "</option>");
			$openLabelSelect.append($option);

			// monitor labels
			$option = generateMonitorLabelOptions(account, getMessage("inbox"), "");
			$monitorLabels.append($option);
			$option = generateMonitorLabelOptions(account, getMessage("importantMail"), "important");
			$monitorLabels.append($option);
			$option = generateMonitorLabelOptions(account, getMessage("importantMail") + " in " + getMessage("inbox"), "^iim");
			$monitorLabels.append($option);
			$option = generateMonitorLabelOptions(account, getMessage("allMail"), "unread");
			$monitorLabels.append($option);

			$monitorLabels.append($("<div style='margin-top:5px'><div style='display:inline-block;width:60px;text-align:center'><a target='_blank' href='http://jasonsavard.com/wiki/Monitor_only_the_Primary_category_tab'>" + getMessage("read") + "</a></div>" + getMessage("primarySocialPromotionsEtc") + "</div>"));

			$monitorLabels.append($("<div>&nbsp;</div>"));

			$("#loading").show();
			account.getLabels(false, function(params) {
				if (params.labels) {
					$.each(params.labels, function(i, label) {
						
						$option = generateMonitorLabelOptions(account, label, label);
						$monitorLabels.append($option);

						var $openLabelSelectInsideLoop = $("#open_label");
						$optionInsideLoop = $("<option value='" + label + "'>" + label + "</option>");
						$openLabelSelectInsideLoop.append($optionInsideLoop);
					});
				} else if (params.error) {
					$monitorLabels.append("<div style='color:red'>" + params.error + "</div>");
				}

				$openLabelSelect.val(account.getOpenLabel());
				
				$("#loading").hide();
			});

			// load color stuff
			$("#colorEmail").text(account.getAddress() + " (1)");

			var colorStart = account.getSetting("colorStart", "colorStart" + (account.id + 1));
			var colorEnd = account.getSetting("colorEnd", "colorEnd" + (account.id + 1));

			// defaults not set for these so put white to gray...
			if (!colorStart) {
				colorStart = "#fff";
				colorEnd = "#ccc";
			}

			// wrap this with initializingMiniColors = true so that miniColor events are not executed, because calling .miniColors executes the change event
			initializingMiniColors = true;
			$("#colorStart").val(colorStart);
			$("#colorStart").miniColors('value', colorStart);

			$("#colorEnd").val(colorEnd);
			$("#colorEnd").miniColors('value', colorEnd);
			initializingMiniColors = false;

			$("#useColors").get(0).checked = account.getSetting("useColors");
			
			$("#ignoreThisAccount").get(0).checked = account.getSetting("ignore");
			
			if (pref("donationClicked") && account.getSetting("alias")) {
				$("#alias").val(account.getSetting("alias"));
			} else {
				$("#alias").val(account.getAddress());
			}
		}
		
		return true;
	});

	$monitorLabels.off("change").on("change", ".enabled", function() {
		
		$(this).closest(".monitorLabelLine").toggleClass("disabledLine", !this.checked);
		
		var values = getEnabledLabels();
		
		var inbox = values.indexOf("") != -1;
		var important = values.indexOf("important") != -1;
		var importantInInbox = values.indexOf("^iim") != -1;
		var allMail = values.indexOf("unread") != -1
		
		// warn if selecting more than more than one of the major labels
		var warning = false;
		if (inbox && (important || importantInInbox)) {
			warning = true;
		} else if (inbox && allMail) {
			warning = true;
		} else if ((important || importantInInbox) && allMail) {
			warning = true;
		} else if (important && importantInInbox) {
			warning = true;
		} else if (inbox && importantInInbox) {
			warning = true;
		}
		
		if (warning) {
			$("#duplicateLabelWarning").slideDown();
		} else {
			$("#duplicateLabelWarning").slideUp();
		}
		
		if (values.length > 5) {
			$("#tooManyLabelsWarning").slideDown();
		} else {
			$("#tooManyLabelsWarning").slideUp();
		}
		
		if (allMail && values.length >= 2) {
			$("#allMailAndMoreWarning").slideDown();
		} else {
			$("#allMailAndMoreWarning").slideUp();
		}
		
		saveEmailSettings();
		bg.pollAccounts({
			showNotification : true
		});
	});

	$("#open_label, #ignoreThisAccount").off("change").on("change", function() {
		saveEmailSettings();
		
		if ($(this).attr("id") == "ignoreThisAccount") {
			var account = $("#emails option:selected").data("data");
			$("#emails option:selected").text(generateEmailDropDownItemToDisplay(account));
			bg.pollAccounts({
				showNotification : true
			});
		}
	});

	if (selectLastAccount) {
		var total = $("#emails").get(0).length;
		$("#emails").get(0).selectedIndex = (total-1);
	}
	$("#emails").change();

}

function saveEmailSettings() {
	var emailSettings = Settings.read("emailSettings");
	if (!emailSettings) {
		emailSettings = {};
	}

	var account = $("#emails option:selected").data("data");
	
	var emailSettingsForAccount = emailSettings[account.getAddress()];
	
	// restore last set sounds so as to not re-init array and erase previous sounds
	var sounds;
	var voices;
	var notifications;
	
	if (emailSettingsForAccount) {
		sounds = emailSettingsForAccount.sounds;
		voices = emailSettingsForAccount.voices;
		notifications = emailSettingsForAccount.notifications;
	}
	if (!sounds) {
		sounds = {};
	}
	if (!voices) {
		voices = {};
	}
	if (!notifications) {
		notifications = {};
	}
		
	$(".monitorLabelLine").each(function() {
		var labelValue = $(this).data("labelValue");
		var soundValue = $(this).find(".sound").val();
		var voiceValue = $(this).find(".voice").val();
		var notificationValue = $(this).find(".notification").get(0).checked;
		if ($(this).find(".enabled:checked").length) {
			sounds[labelValue] = soundValue;
			voices[labelValue] = voiceValue;
			notifications[labelValue] = notificationValue;
		}
	});
	
	emailSettings[account.getAddress()] = {
		monitorLabel : getEnabledLabels(),
		openLabel : $("#open_label").val(),
		useColors : $("#useColors").get(0).checked,
		colorStart : $("#colorStart").val(),
		colorEnd : $("#colorEnd").val(),
		ignore : $("#ignoreThisAccount").get(0).checked,
		sounds : sounds,
		voices : voices,
		notifications : notifications,
		alias : $("#alias").val()
	};
	
	Settings.store("emailSettings", emailSettings);
}

function requestUserPermission() {
	try {
		var checkboxUserPermission = document
				.getElementById('desktopNotification');
		if (checkboxUserPermission.checked) {
			if (checkUserPermission())
				return;

			if (typeof webkitNotifications != "undefined") {
				webkitNotifications
						.requestPermission(function() {
							var permissionGranted = checkUserPermission();
							checkboxUserPermission.checked = permissionGranted;
						});
			}
		}
	} catch (e) {
		checkboxUserPermission.checked = false;
	}
}

function checkUserPermission() {
	try {
		return (webkitNotifications.checkPermission() == 0);
	} catch (e) {
		return false;
	}
}

function toggleCheckBox(checkboxId, checked) {
	if (checked) {
		document.getElementById(checkboxId).checked = !checked;
	}
}

function loadVoices() {
	var $voiceSelect = $("#voice");
	$voiceSelect.empty();

	if (chrome.tts) {
		chrome.tts.getVoices(function(voices) {
			for ( var i = 0; i < voices.length; i++) {
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
			$voiceSelect.append($option);
			$option = $("<option value='addSpeechEngine' style='color:gray'>" + getMessage("addSpeechEngines") + "...</option>");
			$voiceSelect.append($option);

			var voiceIndexMatched = getDefaultVoice(voices, true);
			if (voiceIndexMatched != -1) {
				$voiceSelect.prop("selectedIndex", voiceIndexMatched);
				// trigger change to save pref
				//$voiceSelect.change();
				if ($voiceSelect.val() != Settings.read("voice")) {
					$voiceSelect.change();
				}
			}
			//$voiceSelect.val(Settings.read("voice"));
		});
	}
}

function maybeShowWidgetMenu() {
	if (!$("#ANTPWidgetMenu").is(":visible")) {
		if (bg.pokerListenerLastPokeTime && bg.pokerListenerLastPokeTime.diffInDays() > -5) { // less than 5 minutes ago
			$("html").addClass("antp");
		}
	}
}

function initShortPollingIntervalWarning() {
	$("#poll_15000").text( $("#poll_15000").text() + " (Not recommended - account locking might happen)");
}

function updateVoiceInputCountry() {
	for (var i = voiceInputDialect.options.length - 1; i >= 0; i--) {
		voiceInputDialect.remove(i);
	}
	var list = langs[voiceInputLanguage.selectedIndex];
	for (var i = 1; i < list.length; i++) {
		voiceInputDialect.options.add(new Option(list[i][1], list[i][0]));
	}
	voiceInputDialect.style.visibility = list[1].length == 1 ? 'hidden' : 'visible';
}

function onVoiceInputChange() {
	Settings.store("voiceInputDialect", voiceInputDialect.value);
}
	
function saveSoundFile(files) {
	var file = files[0];
	console.log(files);
	var fileReader = new FileReader();

	fileReader.onloadend = function() {
		
		var customSounds = Settings.read("customSounds");
		if (!customSounds) {
			customSounds = [];
		}
		
		var soundFilename = file.name.split(".")[0];
		
		// look for same filenames if so change the name to make it unique
		$.each(customSounds, function(index, customSound) {
			if (customSound.name == soundFilename) {
				soundFilename += "_" + String(Math.floor(Math.random() * 1000));
			}
		});
		customSounds.push({name:soundFilename, data:this.result});
		
		var resetChanges = false;
		try {
			Settings.store("customSounds", customSounds);

			// get select node which spawned this sounduploader
			var $select = $("#soundUploader").data("select");
			
			if (!$("#soundUploader").data("account") || donationClicked("customSoundForLabel")) {
				$(".sound").each(function() {
					// this .add(with 2nd paramter) doesn't work in chrome...
					//this.add(new Option(soundFilename, "custom_" + soundFilename), 1);
					$(this).find("option").last().before($(generateCustomOption(soundFilename)));
				});
				
				$select.val("custom_" + soundFilename);
				$select.change();
			} else {
				resetChanges = true;
				
				bg.playNotificationSound("custom_" + soundFilename);
				
				// wait for sound to custom sound to play and then remove it
				setTimeout(function() {
					customSounds.pop();
					Settings.store("customSounds", customSounds);					
				}, 2000);
			}
			
			$("#soundUploader").fadeOut();
		} catch (e) {
			resetChanges = true;
			var error = "Error saving file: " + e + " Try a smaller file or another one or click the 'Not working' link.";
			niceAlert(error);
			logError(error);
		}
		
		// restore previous value
		if (resetChanges) {
			var previousValue = $select.data("previousValue");
			console.log("restore: " + previousValue);
			$select.val( previousValue );
		}

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

	fileReader.readAsDataURL(file);
}

function initShowNotificationDurations(notificationBehaviourParam) {
	var notificationBehaviourValue;
	if (notificationBehaviourParam) {
		notificationBehaviourValue = notificationBehaviourParam;
	} else {
		notificationBehaviourValue = Settings.read("notificationBehaviour");
	}
	
	var neverCloseText = "To never close, select Text Notification above";
	if (notificationBehaviourValue == "stayInTray") {
		
		// if previous setting was from the "remove from system tray" options than convert it the limited choices of 7 and 25 in the "stay in system tray" options
		var showNotificationDuration = Settings.read("showNotificationDuration");
		if (showNotificationDuration != 7 && showNotificationDuration != 25) {
			Settings.store("showNotificationDuration", 7);
		}
		
		$("#showNotificationDuration")
			.empty()
			.append($("<option value='7'>" + getMessage("Xseconds", [7]) + "</option>"))
			.append($("<option value='25'>" + getMessage("Xseconds", [25]) + "</option>"))
			.append($("<option disabled>" + neverCloseText + "</option>"))
			.val(Settings.read("showNotificationDuration"))
		;
	} else {
		$("#showNotificationDuration")
			.empty()
			.append($("<option value='3'>" + getMessage("Xseconds", [3]) + "</option>"))
			.append($("<option value='5'>" + getMessage("Xseconds", [5]) + "</option>"))
			.append($("<option value='7'>" + getMessage("Xseconds", [7]) + "</option>"))
			.append($("<option value='10'>" + getMessage("Xseconds", [10]) + "</option>"))
			.append($("<option value='15'>" + getMessage("Xseconds", [15]) + "</option>"))
			.append($("<option value='25'>" + getMessage("Xseconds", [25]) + "</option>"))
			.append($("<option disabled>" + neverCloseText + "</option>"))
			.val(Settings.read("showNotificationDuration"))
		;
	}
}

function resetCustomSounds() {
	var found = false;
	var emailSettings = Settings.read("emailSettings");
	
	if (emailSettings) {	
		try {
			for (email in emailSettings) {									
				for (label in emailSettings[email].sounds) {
					if (emailSettings[email].sounds[label].indexOf("custom_") != -1) {
						found = true;
						emailSettings[email].sounds[label] = Settings.read("sn_audio");
					}
				}
			}								
		} catch (e) {
			logError("error with hasCustomSounds: " + e);
		}
	}
	
	if (found) {
		Settings.store("emailSettings", emailSettings);
	}
	
	return found;
}

$(document).ready(function() {
	
	$(document).ajaxStart(function() {
		console.log("ajaxstart")
		$("#loading").show();
	}).ajaxStop(function() {
		console.log("ajaxstop")
		$("#loading").hide();
	});
	
	if (!bg.loadedSettings) {
		$("body").empty().append( getMessage("loadingSettings") + "..." );
		setInterval(function() {
			if (bg.loadedSettings) {
				location.reload();
			}
		}, 500);
		return;
	}
	
	initShowNotificationDurations();
	
	$("#notificationBehaviour").change(function() {
		initShowNotificationDurations($(this).val());
	});
	
	var $soundOptions = generateSoundOptions();
	$(".defaultSoundOptionWrapper").append($soundOptions);

	var $voiceOptions = generateVoiceOptions();
	$(".defaultVoiceOptionWrapper").append($voiceOptions);

	if (getUrlValue(location.href, "install")) {
		$("#welcome").slideDown();
		$("#optionsWrapper").hide();
		
		$("#continueToOptions").click(function() {
			$("#welcome").slideUp();
			$("#optionsWrapper").fadeIn("slow");
			return false;
		});
		
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
			console.log("fetch response", response);
			if (response.items && !response.error) {
				niceAlert("Would you like to use your previous extension options? <div style='margin-top:4px;font-size:12px;color:gray'>(If you had previous issues you should do this later)</div>", {cancelButton:true}, function(action) {
					if (action == "ok") {
						bg.syncOptions.load(response.items, function(response) {
							
							// see if user had any custom sounds...
							var hasCustomSoundsWarning = "";
							var hasCustomSounds = resetCustomSounds();
							if (hasCustomSounds) {
								hasCustomSoundsWarning = "<div style='margin-top:7px;font-style:italic'>Note: You will to have manually re-upload your custom sounds because they were to big to sync!</div>";
							}
							
							niceAlert("<span style='font-weight:bold;color:green'>Options restored!</span>" + hasCustomSoundsWarning, {okButtonLabel:"Restart Extension"}, function() {
								chrome.runtime.reload();
							});
						});
					}
				});
			}
		});

	}
	
	$("#deleteAllCustomSoundsWrapper").click(function() {
		Settings.store("customSounds");
		location.reload();
	});
	
	$("#closeSoundUploader").click(function() {
		
		// restore previous select to dropdown since we canceled
		var $select = $("#soundUploader").data("select");
		var previousValue = $select.data("previousValue");
		console.log("restore: " + previousValue);
		$select.val( previousValue );

		$("#soundUploader").fadeOut();
	});

	// must load this before initPrefs to initial default times
    // load mute voice times
    var muteDate = now();
    muteDate.setHours(1);
    muteDate.setMinutes(0);
    for (var a=1; a<=24; a++) {
    	muteDate.setHours(a);
    	var $option = $("<option value='" + a + "'></option>").append( muteDate.format("h tt") );
    	var $option2 = $option.clone();
    	$("#muteVoiceStart").append( $option );
    	$("#muteVoiceEnd").append( $option2 );
    }
    
	if (!('webkitSpeechRecognition' in window)) {
		$("#voiceInput").attr("disabled", true);
		$("#upgradeBrowser").show();
	}
	
	$("#voiceInput").click(function() {
		if (this.checked) {
			chrome.tabs.query({url:"https://mail.google.com/*"}, function(tabs) {
				$.each(tabs, function(index, tab) {
					insertSpeechRecognition(tab.id);
				});
			});
		} else {
			// wait for pref to be saved then reload tabs
			setTimeout(function() {
				chrome.tabs.query({url:"https://mail.google.com/*"}, function(tabs) {
					$.each(tabs, function(index, tab) {
						chrome.tabs.reload(tab.id);
					});
				});
			}, 500);
		}
	});
	
	initToolTips();
	// (statment partially true now, i realized i just forgot to cancel .click and .change events :) but if i dynmaically create input prefs i must call this after to init the defaults (old statemment:must place this at BOTTTOM because we might want to cancel .changes
	initPrefAttributes();
	
	$(window).focus(function(event) {
		// patch: focus was called twice?? so check that atleast 2 seconds has gone by
		if ((now().getTime() - lastFocusDate.getTime()) > 2000) {
			lastFocusDate = now();
			
			// reload voices
			console.log("focus: " + now())
			loadVoices();
		}
	});
	
	
	if (Settings.read("emailsMarkedAsRead") == "show") {
		$("#showMarkAsReadEmailsOptions").show();
	}
	
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
	
	if (navigator.platform.toLowerCase().indexOf("mac") != -1) {
		$("#multipleSelectionInfo").text(getMessage("multipleSelectionMac"));
	} else {
		$("#multipleSelectionInfo").text(getMessage("multipleSelectionWindows"));
	}
	
	$("#hide_count").change(function() {
		bg.updateBadge(bg.unreadCount);
	});
	
	if (navigator.language.indexOf("en") == -1) {
		$("#languages").find("option[value='en-GB']").remove();
	}
	
	$("#languages").change(function() {
		loadLocaleMessages($(this).val(), function() {			
			initMessages();
			initShortPollingIntervalWarning();
			//window.location.href = setUrlParam(window.location.href, "languageChange", "true");
		});
	});
	
	$("#icon_selection").on("change", "input[name='icon_set']", function() {
		bg.iconSet = Settings.read("icon_set");
		bg.updateBadge(bg.unreadCount);	
	});
	
	$("input[name='preview_setting']").change(function() {
		initPopup(bg.unreadCount);
		if ($(this).val() == "0" || $(this).val() == "1") {
			$("#twoTabsWarning").slideDown();
		} else {
			$("#twoTabsWarning").slideUp();
		}
	});
	
	chrome.permissions.contains({
		permissions: ['background']
	}, function(result) {
		$("#runInBackground").get(0).checked = result;
	});
	
	$("#runInBackground").click(function() {
		if (this.checked) {
			chrome.permissions.request({
				permissions: ['background']
			}, function(granted) {
				if (granted) {
					$("#backgroundAppsWarning").slideDown();
				} else {
					$("#runInBackground").get(0).checked = false;
				}
			});
		} else {			
			chrome.permissions.remove({
				permissions: ['background']
			}, function(removed) {
				if (removed) {
					// The permissions have been removed.
					$("#backgroundAppsWarning").slideUp();
				} else {
					// The permissions have not been removed (e.g., you tried to remove
					// required permissions).
					niceAlert("error removing permission");
					$("#runInBackground").get(0).checked = true;
				}
			});
		}
	});
	
	chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
		if (message.command == "grantPermissionToContacts") {
			Settings.store("showContactPhoto", true);
			if ($("#emailsGrantedPermissionToContacts").html().indexOf(message.contactDataItem.userEmail) == -1) {
				$("#emailsGrantedPermissionToContacts").append("&nbsp;" + message.contactDataItem.userEmail);
			}
			
			// if not already checked, meaning granting access to 2nd or more account
			if (!$("#showContactPhoto").prop("checked")) {
				$("#showContactPhoto").prop("checked", true);
				ignoreOptionChangeInPage = true;
				$("#showContactPhoto").change();
				ignoreOptionChangeInPage = false;
			}
		} else if (message.command == "grantPermissionToEmails") {
			if (message.result.error) {
				// do nothing error should have been reported in background
				$("#loading").hide();
			} else {
				pollAndLoad({showNotification:true}, true);
			}
		}
	});

	var navLang = pref("language", window.navigator.language);
	if ($("#languages").find("option[value='" + navLang + "']").exists()) {
		$("#languages").val(navLang);
	} else if ($("#languages").find("option[value='" + navLang.substring(0, 2) + "']").exists()) {
		$("#languages").val(navLang.substring(0, 2));
	} else {
		$("#languages").val("en");
	}

	var userEmails = bg.oAuthForContacts.getUserEmails();
	$.each(userEmails, function(index, userEmail) {
		$("#emailsGrantedPermissionToContacts").append(userEmail + "&nbsp;");
	});

	$("#showContactPhoto").change(function(event) {
		if (!ignoreOptionChangeInPage) {
			if (this.checked) {
				this.checked = false;
				
				// must reset it to false because it gets saved as true from initprefse etc..
				Settings.store("showContactPhoto");
				
				bg.oAuthForContacts.openPermissionWindow();
				event.stopImmediatePropagation()
				//$(this).change();
				/*
				   oauth2.login(req, function(token) {
					   alert("Got an OAuth token:\n" + token + "\n"
							   + "Token expires in " + oauth2.expiresIn(req) + " ms\n");
					   localStorage["token"] = token;
				   }, function(error) {
					   alert("Error:\n" + error);
				   });
				 */
			} else {
				//$(this).change();
				//$("#showContactPhotoOptions").slideUp();
			}
		}
	});
	
	$("#grantAccessAgain").click(function() {
		bg.oAuthForContacts.openPermissionWindow();
	});
	
	$("#poll").change(function() {
		bg.restartCheckEmailTimer();
	});
	
	$("#pollNow").click(function() {
		pollAndLoad({showNotification:true});
		return false;
	});
	
	if (Settings.read("buttons") == "custom") {
		$(".filters").show();
	}
	
	$(".themeWrapper input").click(function() {
		var theme = $(this).attr("themeID");
		initButtons( theme );
		
		if (Settings.read("buttons") == "custom") {
			$(".filters").slideDown();
		} else {					
			$(".filters").slideUp();
		}
	});
	
	$(".themeWrapper").hover(function() {
		var theme = $(this).attr("themeID");
		initButtons( theme );
		
		if (theme == "custom") {
			$(".filters").slideDown();
		} else {
			//$(".filters").slideUp();
		}
	}, function() {
		initButtons();

		if (Settings.read("buttons") == "custom") {
			$(".filters").slideDown();
		} else {					
			$(".filters").slideUp();
		}
	});

	var contentID = location.href.split("#")[1];
	if (contentID != null) {
		showContent(contentID);
	}

	initOptions();	
	initShortPollingIntervalWarning();
	initButtons();
	
	
	$("input[name='buttons']").change(function() {
		initButtons();
	});


	if (pref("donationClicked")) {
		$(".donationFeature").removeClass("donationFeature");
		$(".previewTheme").hide();
	} else {
		$("*[mustDonate]").each(function(i, element) {
			$(this).next().addClass("donationFeature");
		});
	}

    $("#headerLogo").dblclick(function() {
    	if (Settings.read("donationClicked")) {
    		Settings.store("donationClicked");
    	} else {
    		Settings.store("donationClicked", true)
    	}
    	location.reload(true);
    });
    
    var saveColorTimeout;
    // enable color picker
    $("#colorStart.color-picker, #colorEnd.color-picker").miniColors({
		letterCase: 'uppercase',
		change: function(hex, rgb) {
			setColors();
			
			if (!initializingMiniColors) {
				saveColorTimeout = setTimeout(function() {
					clearTimeout(saveColorTimeout);
					
					// changing the colors so let's assume they want to use these colors, so check that box
					if (pref("donationClicked")) {
						$("#useColors").get(0).checked = true;
					}
					
					saveEmailSettings();
				}, 800);
			}
		}
	});
    
	setColors();
    
    $("#useColors").change(function() {
    	if (pref("donationClicked")) {
    		saveEmailSettings();
    	}
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
    
	chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
		if (message.command == "featuresProcessed") {
			$(".donationFeature").removeClass("donationFeature");
		}
	});
	
	// Filters...
	var $rainbow = $("#rainbow");
	for (var a=0; a<360; a+=3) {
		var $color = $("<div style='display:inline-block;width:1px;height:15px'/>");
		$color.css({"background-color":"rgb(76,165,237)", "-webkit-filter":"hue-rotate(" + a + "deg)"}); //76,165,237
		$rainbow.append( $color );
	}
	

	(function() {
		var styling = Settings.read("buttonFilter");
		var $images = $('.button div:empty');
		var $text = $('.button div:not(:empty)');
		var saveFilterTimeout;

		addOrReplace = function() {
			var regex = new RegExp(this.id, 'i'), search, incrementType;

			if (this.id === 'hue-rotate') {
				incrementType = 'deg';
			} else if (this.id === 'blur') {
				incrementType = 'px';
			} else {
				incrementType = '%';
			}

			if (this.id === 'drop-shadow') {
				if (this.value == 0) {
					newStr = "";
				} else {
					newStr = this.id + "(" + this.value + "px " + this.value + "px 1px #444)"; //1px 0px 1px black
				}							
			} else {
				newStr = this.id + "(" + this.value + incrementType + ")";
			}
			if (regex.test(styling)) {
				search = new RegExp(this.id + ".*?\\)", 'i');
				styling = styling.replace(search, newStr);
			} else {
				styling += " " + newStr;
			}

			// for text styling don't put any drop-shadows, so remove it here
			console.log(styling)
			console.log("after")
			var textStyling = styling.replace(/drop-shadow.*?\)/, "");
			console.log(textStyling)
	
			// "just in case" spacing case cleanup
			styling = styling.replace(/\s\s/, ' ');

			// Apply the CSS
			$images.css('-webkit-filter', styling);					
			$text.css('-webkit-filter', textStyling);

			saveFilterTimeout = setTimeout(function() {
				clearTimeout(saveFilterTimeout);
				Settings.store("buttonFilter", styling);
			}, 800);
		};

		// When range is adjusted
		$('.filter').change(addOrReplace);

	})();
	
	// patch: for color slider to work with the new icons i changed the default minimum brightness to 65 (it's also reflected in slider min/max)
	if (Settings.read("brightness") != null && Settings.read("brightness") < 65) {
		// this will force it to save the minimum to brightness setting and will also change the buttonFilter setting
		$("#brightness").change();
	}
	
	$("#playNotificationSound").click(function() {
		bg.playNotificationSound();
	});
	
	$("#soundBrowse").change(function() {
		saveSoundFile(this.files);
	});
	
	var dropZone = document.getElementById('soundUploaderDropZone');
	dropZone.addEventListener('dragover', function(e) {
		$(dropZone).addClass("dragover");
		console.log("dragover");
		e.stopPropagation();
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
		return false;
	}, false);
	dropZone.addEventListener('drop', function(e) {
		console.log("drop");
		e.stopPropagation();
	    e.preventDefault();
	    var files = e.dataTransfer.files;
	    saveSoundFile(files);
	    return false;
	}, false);
	
	$("#soundUploaderDropZone").mouseleave(function() {
		console.log("mouseleave");
		$(this).removeClass("dragover");
	});
	
	$("#mainMenu a").click(function() {
		var contentID = $(this).attr("contentID");
		showContent(contentID);
	});
	
	$("#testOutPopupWindow").click(function() {
		openTabOrPopup({url:"https://mail.google.com?view=cm&fs=1&tf=1", name:"test", testingOnly:true});
	});

	maybeShowWidgetMenu();
	setInterval(function() {
		maybeShowWidgetMenu();
	}, 2000)
	
	// init prefs
	$("input[localStorage]").each(function(index) {
		var lsKey = $(this).attr("localStorage");
		$(this).attr("checked", toBool(localStorage[lsKey]));
		$(this).change(function(event) {
			localStorage[lsKey] = this.checked;
		});
	});
	$("select[localStorage]").each(function(index) {
		var lsKey = $(this).attr("localStorage");
		var defaultValue = $(this).attr("default");
		$(this).val(pref(lsKey, defaultValue, localStorage));
		$(this).change(function(event) {
			localStorage[lsKey] = $(this).val();
		});
	});
	
	// prevent jumping due to anchor # and because we can't javascript:; or else content security errors appear
	$("a[href='#']").on("click", function(e) {
		//e.stopPropagation()
		//e.stopImmediatePropagation();
		// use preventDefault instead of return false because preventDefault will "cancel any default action that the browser may have for THIS event" and does not stop the analytics sendGA code from running after
		e.preventDefault()
		//return false;
	});
	
	if (Settings.read("ignoreEmails")) {
		$("#ignoreTheseAccountsWrapper").show();
	}
	
	$("#testOutTextNotification").click(function() {
		showNotificationTest({testType:"text", requirementText:getMessage("notificationTryItOutInstructions")});
	});

	$("#testOutRichNotification").click(function(e) {
		console.log(e);
		$("#loading").show();
		showNotificationTest({testType:"rich", requirementText:getMessage("notificationTryItOutInstructions"), showAll:e.ctrlKey}, function() {
			$("#loading").hide();
		});
	});
	
	$("#alias")
		.click(function() {
			if (donationClicked("alias")) {
				// do nothing but required to popup donation page if clicked
			}
		})
		.blur(function() {
			saveEmailSettings();
		})
		.keydown(function(e) {
			if (e.keyCode == 13) {
				saveEmailSettings();
				return false;
			}
		})
	;
	
	// init languages
	var voiceInputDialectPref = Settings.read("voiceInputDialect", navigator.language);
	var voiceInputLanguageIndex;
	var voiceInputDialectIndex;
	for (var i = 0; i < langs.length; i++) {
		voiceInputLanguage.options[i] = new Option(langs[i][0], i);
		//console.log("lang: " + langs[i][0]);
		for (var a=1; a<langs[i].length; a++) {
			//console.log("dial: " + langs[i][a][0]);
			if (langs[i][a][0] == voiceInputDialectPref) {
				voiceInputLanguageIndex = i; 
				voiceInputDialectIndex = a-1;
				break;
			}
		}
	}	
	
	//console.log(voiceInputLanguageIndex + "_" + voiceInputDialectIndex)
	voiceInputLanguage.selectedIndex = voiceInputLanguageIndex;
	updateVoiceInputCountry();
	voiceInputDialect.selectedIndex = voiceInputDialectIndex;
	
	$("#voiceInputLanguage").change(function() {
		updateVoiceInputCountry();
		if (voiceInputLanguage.options[voiceInputLanguage.selectedIndex].text == "English") {
			voiceInputDialect.selectedIndex = 6;
		}
		onVoiceInputChange();
	});
	
	$("#voiceInputDialect").change(function() {
		onVoiceInputChange();
	});
	
	$("#refreshLabels").click(function() {
		var account = $("#emails option:selected").data("data");
		$("#loading").show();
		account.getLabels(true, function() {
			location.reload();
		});
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
				niceAlert("Done!", {okButtonLabel:"Restart Extension"}, function() {
					chrome.runtime.reload();
				});
			} else {
				niceAlert("Could not find any synced data!<br><br>Make sure you sign in to Chrome on your other computer AND this one <a target='_blank' href='https://support.google.com/chrome/answer/185277'>More info</a>");
			}
		});
		return false;
	});
	
	$("#exportLocalStorage").click(function() {
		downloadObject(localStorage, "localStorage.json");
	})
	$("#importLocalStorage").click(function() {
		var localStorageText = $("#jsonString").val();
		if (localStorageText) {
			var localStorageImportObj = JSON.parse(localStorageText);
			localStorage.clear();
			for (item in localStorageImportObj) {
				localStorage.setItem(item, localStorageImportObj[item]);
			}
			niceAlert("Done. Reload the extension to use these new settings!");
		} else {
			niceAlert("Must enter JSON string!")
		}
	})
	
	$("#importIndexedDB").click(function() {
		var jsonString = $("#jsonString").val();
		if (jsonString) {
			var jsonObject = JSON.parse(jsonString);
			
			bg.syncOptions.importIndexedDB(jsonObject, function(response) {
				if (response.error) {
					niceAlert(response.error);
				} else {
					niceAlert("Done. Reload the extension to use these new settings!");
				}
			});
			
		} else {
			niceAlert("Must enter JSON string!")
		}			
	});
	
	$("#exportIndexedDB").click(function() {
		bg.syncOptions.exportIndexedDB({exportAll:true}, function(response) {
			if (response.error) {
				niceAlert(response.error);
			} else {
				downloadObject(response.data, "indexedDB.json");
			}
		});
	})
	
	if (bg.email == atob("amFzb25zYXZhcmRAZ21haWwuY29t")) {
		
		if (Settings.read("accountAddingMethod") == "oauth") {
			$("#autoDetectionClassicMessage").hide();
			$("#accountAddingWrapper").show();
		}

		$("#testSection").show();
	}
	
	$("#emailsSettings legend").dblclick(function() {
		$("#autoDetectionClassicMessage").slideUp();
		$("#accountAddingWrapper").slideDown();
	});
	
	if (Settings.read("accountAddingMethod") == "autoDetect") {
		$("#autoDetectionClassicMessage").show();
		$("#addingAccountsButtons").hide();
		$("#ignoreThisAccountLabel").show();
		$("#alwaysDisplayExternalContentWrapper").hide();
	} else {
		$("#autoDetectionClassicMessage").hide();
		chrome.permissions.contains(ADDING_METHOD_OAUTH_PERMISSIONS, function(result) {
			if (result) {
				$("#addingAccountsButtons").show();
			} else {
				$("#addingMethodOauthExtraPermissionsWarning").show();
			}
		});
		
		$("#signInToYourAccount").remove();
		$("#ignoreThisAccountLabel").hide();
	}
	
	$("input[name='accountAddingMethod']").change(function() {
		if ($(this).val() == "autoDetect") {
			$("#addingMethodOauthExtraPermissionsWarning").slideUp();
			$("#addingAccountsButtons").slideUp();
			$("#ignoreThisAccountLabel").fadeIn();
			$("#alwaysDisplayExternalContentWrapper").hide();

			pollAndLoad({showNotification:false});
		} else {
			chrome.permissions.contains(ADDING_METHOD_OAUTH_PERMISSIONS, function(result) {
				if (result) {
					// already has permissions so hide warning
					$("#addingAccountsButtons").slideDown();
					$("#ignoreThisAccountLabel").fadeOut();
					$("#alwaysDisplayExternalContentWrapper").show();
					pollAndLoad({showNotification:false});
				} else {
					// The extension doesn't have the permissions - show warning
					$("#addingMethodOauthExtraPermissionsWarning").slideDown();
				}
			});
		}
	});
	
	$("#grantPermissionsForAddingMethodOauth").click(function() {
		chrome.permissions.request(ADDING_METHOD_OAUTH_PERMISSIONS, function(granted) {
			if (granted) {
				$("#addingMethodOauthExtraPermissionsWarning").slideUp();
				$("#addingAccountsButtons").slideDown();
			} else {
				niceAlert("Denied. Click the extra permissions link on the left for more info on these permissions")
			}
		});
		return false;
	});
	
	$("#addAccount").click(function() {
		
		var emailPermissionWindow = bg.oAuthForEmails.openPermissionWindow();
		
		// detect when window is closed to remove loading message
		var pollTimer = setInterval(function() {
		    if (emailPermissionWindow.closed !== false) { // !== is required for compatibility with Opera
		        clearInterval(pollTimer);
		        $("#loading").hide();
		    }
		}, 4000);
		
		$("#loading").show();
		return false;
	});

	$("#removeAccount").click(function() {
		if ($("#emails").get(0).selectedIndex == -1) {
			niceAlert("You must select and account first!");
		} else {
			var account = $("#emails option:selected").data("data");
			bg.oAuthForEmails.removeTokenResponse({userEmail:account.getAddress()});
			pollAndLoad({showNotification:false});
		}
		
		// IMPORTANT or else page is reloaded...
		return false;
	});
	
	$("#maxUnauthorizedAccount").change(function() {
		pollAndLoad({showNotification:true});
	});
	
	// load notification display details...
	var notificationDisplayStr =
		"<option value='newEmail'>\"" + getMessage("newEmail") + "\"</option>" +
		"<option value='from'>" + getMessage("email_from") + "</option>" +
		"<option value='from|subject'>" + getMessage("email_from") + ", " + getMessage("email_subject") + "</option>" +
		"<option value='from|subject|message'>" + getMessage("email_from") + ", " + getMessage("email_subject") + ", " + getMessage("email_message") + "</option>";

	var $select = $("<select>" + notificationDisplayStr + "</select>");
	$select.val(Settings.read("notificationDisplay"));	
	$select.off("change").on("change", function() {
		Settings.store("notificationDisplay", $(this).val());
	});
	
	$("#notificationDisplay").replaceWith($select);

});