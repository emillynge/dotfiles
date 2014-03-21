var licenseType = "singleUser";
var licenseSelected;
var minimumDonation = 1; // but being set overwritten when donate buttons are clicked
var currencySymbol = "$";
var currencyCode;

var donateButtonClicked = null;
var extensionName = getMessage("nameNoTM");
var multipleCurrencyFlag;

if (!extensionName) {
	try {
		extensionName = chrome.runtime.getManifest().name;
	} catch (e) {
		console.error("Manifest has not been loaded yet: " + e);
	}
	
	var prefix = "__MSG_";
	// look for key name to message file
	if (extensionName && extensionName.match(prefix)) {
		var keyName = extensionName.replace(prefix, "").replace("__", "");
		extensionName = getMessage(keyName);
	}
}

function getMessageFromCurrencySelection(key) {
	var idx = document.getElementById("multipleCurrency").selectedIndex;
	var suffix = idx == 0 ? "" : idx+1;
	return getMessage(key + suffix);
}

function initCurrency() {
	$("#multipleCurrency").find("option").each(function (idx) {
		// TWD is not supported for alertPay so disable it (dont' remove it because the selector uses it's order in the list)
		if (donateButtonClicked == "alertPay" && window.navigator.language.match(/tw/i) && $(this).attr("value") == "TWD") {
			$(this).attr("disabled", "true");
			if (idx==0) {
				$("#multipleCurrency").get(0).selectedIndex=1;
			}
		} else {
			$(this).removeAttr("disabled");
		}
	});
	
	function initCodesAndMinimums(donateButtonClicked) {
		var messageReducedPrefix;
		var messagePrefix;
		
		if (licenseType == "multipleUsers") {
			currencyCode = "USD"; // hard coded to USD for multipe user license
	} else {
			if (donateButtonClicked == "paypal") {
				messagePrefix = "minimumDonation";
				messageReducedPrefix = "minimumDonationPaypalReduced";
			} else if (donateButtonClicked == "googleCheckout") {
				messagePrefix = "minimumDonationForGoogleCheckout";			
				messageReducedPrefix = "minimumDonationGoogleCheckoutReduced";
			} else if (donateButtonClicked == "coinbase") {
				messagePrefix = "minimumDonationCoinbase";
				messageReducedPrefix = "minimumDonationCoinbaseReduced";
	}
	
			if ($("#multipleCurrency").val() == "BTC") {
				currencyCode = "BTC";
				currencySymbol = "BTC";
				
				if (isEligibleForReducedDonation()) {
					minimumDonation = parseFloat(getMessage("minimumDonationBitcoinReduced"));
				} else {
					minimumDonation = parseFloat(getMessage("minimumDonationBitcoin"));
				}
			} else {
				currencyCode = getMessageFromCurrencySelection("currencyCode");
		currencySymbol = getMessageFromCurrencySelection("currencySymbol");
				
		if (isEligibleForReducedDonation()) {
					minimumDonation = parseFloat(getMessageFromCurrencySelection(messageReducedPrefix));
		} else {			
					minimumDonation = parseFloat(getMessageFromCurrencySelection(messagePrefix));
				}
			}
		}

		// General
		$("#currencyCode").text(currencyCode);
		$("#currencySymbol").text(currencySymbol);				
		if (multipleCurrencyFlag) {
			$("#singleCurrencyWrapper").hide();
			$("#multipleCurrencyWrapper").show();
		}
		}
		
	initCodesAndMinimums(donateButtonClicked);
}

function initPaymentDetails(buttonClicked) {
	donateButtonClicked = buttonClicked;
	if (licenseType == "singleUser") {
		$('#donateAmountDiv').slideUp("fast", function() {
			
			// If atleast 2 then we have multiple currencies
			multipleCurrencyFlag = getMessage("currencyCode2");
			
			$("#multipleCurrency").empty();
			var multipleCurrencyNode = $("#multipleCurrency").get(0);
			for (var a=1; a<10; a++) {
				var suffix = a==1 ? "" : a + "";
				var currencyCode2 = getMessage("currencyCode" + suffix);
				if (currencyCode2) {
					var currencySymbol2 = getMessage("currencySymbol" + suffix);
					multipleCurrency.add(new Option(currencyCode2 + " " + currencySymbol2, currencyCode2), null);
				}
			}
			
			if (donateButtonClicked == "coinbase") {
				multipleCurrencyFlag = true;
				multipleCurrency.add(new Option("BTC", "BTC"), null);
			}
			
			initCurrency();
		}).slideDown();
		$("#amount").focus();
	} else {
		initCurrency();
		licenseSelected = $("#licenseOptions input:checked").data("data"); 
		var price = licenseSelected.price;
		initPaymentProcessor(price);
	}
}

function setPayPayInlineParam(params) {
	var didNotExist = false;
	var $inputNode = $("#paypapInlineForm input[name='" + params.name + "']");			
	if (!$inputNode.exists()) {
		didNotExist = true;
		$inputNode = $("<input type='hidden' name='" + params.name + "'/>");
	}
	$inputNode.val(params.value);
	if (didNotExist) {
		$("#paypapInlineForm").append($inputNode);
	}
}

// response from php so just set this and quit and wait for parent to read the localstorage
if (location.href.match(/paypalInline=fail|paypalInline=success/)) {
	localStorage["paypalInlineResponse"] = location.href;
	
	$(document).ready(function() {
		$("body").empty();
	});
	chrome.tabs.getCurrent(function(tab) {
		chrome.tabs.remove(tab.id);
	});
	window.close();
	
	return;
}

// reset paypal response
localStorage["paypalInlineResponse"] = "";

setInterval(function() {
	if (location.href.match(/paypalInline=fail|paypalInline=success/) || localStorage["paypalInlineResponse"]) {
		
		var success = location.href.match("success") || (localStorage["paypalInlineResponse"] && localStorage["paypalInlineResponse"].match("success"));
		
		// reset so we don't loop back here with the interval
		history.replaceState({}, 'After paypayInline', location.href.replace(/#.*/, "#paypayInline=acknowledged"));
		localStorage["paypalInlineResponse"] = "";
		
		if (dg && dg.isOpen()) {
			dg.closeFlow();
		}
		
		if (success) {
			showSuccessfulPayment();
			
			if (currencyCode == "USD") {
				var amount = getAmountNumberOnly();
				// must be an integer for GA to send it
				amount = Math.round(amount);
				sendGA(['_trackEvent', "paypal", "success", "amount", amount]);
			} else {
				sendGA(['_trackEvent', "paypal", "success"]);
			}
		} else {
			$("#paymentFailure").text(getMessage("failureWithPayPalPurchase")).slideDown("slow").delay(6000).slideUp("slow");
			sendGA(['_trackEvent', "paypal", "cancel?"]);
		}
	}
}, 500);

function getAmountNumberOnly() {
	var amount = $("#amount").val();
	amount = amount.replace(",", ".");
	amount = amount.replace("$", "");
	amount = $.trim(amount);
	return amount;
}

function showSuccessfulPayment() {		
	bg.Controller.processFeatures();

	$("#thankYouVideo").attr("src", "http://www.youtube.com/embed/b_v-42FxDuY?rel=0&autoplay=1&showinfo=0&theme=light");
	$("#extraFeatures").slideUp("slow");
	$("#paymentOptions").slideUp("slow", function() {
		$("#paymentComplete").slideDown();
	});
}

function showPaymentMethods(licenseType) {
	window.licenseType = licenseType;
	$("#choosePaymentWrapper").slideUp("fast", function() {
		$("#choosePaymentWrapper").slideDown();
	});
}

function initPaymentProcessor(price) {
	if (donateButtonClicked == "paypal") {
		sendGA(['_trackEvent', "paypal", 'start']);
		
		$("#paypapInlineForm").attr("action", bg.Controller.FULLPATH_TO_PAYMENT_FOLDERS + "paypalInline/setExpressCheckout.php");
		setPayPayInlineParam({name:"name",value:extensionName});
		setPayPayInlineParam({name:"price",value:price});
		setPayPayInlineParam({name:"currencyCode",value:currencyCode});
		setPayPayInlineParam({name:"email",value:bg.email}); // Used only in case of errors to find who get the error
		
		var paramsToPassToSuccess = "&googleEmail=" + encodeURIComponent(bg.email) + "&itemID=" + encodeURIComponent(bg.itemID);
		if (licenseType == "multipleUsers") {
			paramsToPassToSuccess += "&license=" + encodeURIComponent(licenseSelected.number);
		}
		
		setPayPayInlineParam({name:"successURL",value:bg.Controller.FULLPATH_TO_PAYMENT_FOLDERS + "paypalInline/success.php?referer=" + encodeURIComponent(location.href) + paramsToPassToSuccess});
		setPayPayInlineParam({name:"cancelURL",value:bg.Controller.FULLPATH_TO_PAYMENT_FOLDERS + "paypalInline/fail.php?referer=" + encodeURIComponent(location.href)});		
		
		$("#submitBtn").click();
		
		// Patch to avoid empty white space, hide frame initially
		var $paypalFrame = $("iframe[name=PPDGFrame]");
		$paypalFrame.hide();
		setTimeout(function() {
			$paypalFrame.fadeIn();
		}, 800);
	} else if (donateButtonClicked == "googleCheckout") {
		sendGA(['_trackEvent', "inAppPayment", 'start']);
		
		var licenseParamValue = "";
		if (licenseType == "multipleUsers") {
			licenseParamValue = licenseSelected.number;
		}

		var dataToGenerateJWT = {name:extensionName, itemID:bg.itemID, currencyCode:currencyCode, price:price, email:bg.email, license:licenseParamValue};
		$.ajax({
			type: "GET",
			url: bg.Controller.FULLPATH_TO_PAYMENT_FOLDERS + "googleCheckoutInline/generateJWTJSON.php",
			data: dataToGenerateJWT,
			dataType: "jsonp",
			jsonp: "jsoncallback",
			timeout: 5000,
			success: function(data, textStatus, jqXHR) {
				
				if (typeof google == "undefined") {
					niceAlert("Please wait a few seconds for Google Wallet to load and then click here again!");
					return;
				}

				google.payments.inapp.buy({
					'jwt'     : data.token,
					'success' : function(result) {
						showSuccessfulPayment();
						sendGA(['_trackEvent', "inAppPayment", "success", "daysElapsedSinceFirstInstalled", daysElapsedSinceFirstInstalled()]);
					},
					'failure' : function(result) {
						logError("failure", result);
						if (result && result.response) {
							if (result.response.errorType == "PURCHASE_CANCELED") {
								$("#paymentFailure").html(getMessage("canceledInAppPurchase") + "<a href='http://jasonsavard.com/contact'>jasonsavard.com/contact</a>").slideDown("slow").delay(9000).slideUp("slow");
								sendGA(['_trackEvent', "inAppPayment", 'cancel?']);													
							} else {
								/*
									MERCHANT_ERROR - purchase request contains errors such as a badly formatted JWT
									PURCHASE_CANCELED - buyer canceled purchase or declined payment
									POSTBACK_ERROR - failure to acknowledge postback notification
									INTERNAL_SERVER_ERROR - internal Google error
								*/
								$("#paymentFailure").text(getMessage("failureWithInAppPurchase")).slideDown("slow").delay(3000).slideUp("slow");
								sendGA(['_trackEvent', "inAppPayment", 'failure']);
								bg.Controller.email({subject:"Payment error", replyTo:bg.email, message:"request:<br>" + JSON.stringify(dataToGenerateJWT) + "<br><br>response:<br>" + JSON.stringify(result)});
							}								
						} else {
							$("#paymentFailure").text(getMessage("failureWithInAppPurchase")).slideDown("slow").delay(3000).slideUp("slow");
							sendGA(['_trackEvent', "inAppPayment", 'failure']);
							bg.Controller.email({subject:"Payment error", replyTo:bg.email, message:"request:<br>" + JSON.stringify(dataToGenerateJWT) + "<br><br>response:<br>" + JSON.stringify(result)});
						}
					}
				});
			},
			error: function(jqXHR, textStatus, errorThrown) {
				niceAlert("Temporary problem with this payment method, please try again later or try PayPal instead or contact the developer");
				sendGA(['_trackEvent', "inAppPayment", 'error with generateJWT']);
				bg.Controller.email({subject:"Payment error", replyTo:bg.email, message:"generateJWT request:<br>" + JSON.stringify(dataToGenerateJWT) + "<br><br>response:<br>" + textStatus});
			}
		});
	} else if (donateButtonClicked == "coinbase") {
		sendGA(['_trackEvent', "coinbase", 'start']);
		
		var licenseParamValue = "";
		if (licenseType == "multipleUsers") {
			licenseParamValue = licenseSelected.number;
		}

		var borderRadius = "border-radius:10px;";
		var $coinbaseWrapper = $("<div id='coinbaseWrapper' style='" + borderRadius + "-webkit-transition:top 800ms ease-in-out;left: 32%;top: 182px;text-align:center;position:fixed;background:white;width: 500px; height: 160px;box-shadow:2px 2px 193px rgba(0,0,0,1);'><img id='loadingCoinbase' src='/images/ajax-loader.gif' style='height:20px;margin-top:56px'/></span><img id='closeCoinbase' src='images/closeBig.png' style='cursor:pointer;top: -16px;right: -16px;position: absolute;'/></div>");
		$coinbaseWrapper.find("#closeCoinbase").click(function() {
			$coinbaseWrapper.remove();
		});
		$("body").append($coinbaseWrapper);
		
		bg.Controller.ajax({data:"action=createCoinbaseButton&name=" + extensionName + "&price=" + price + "&currency=" + currencyCode}, function(params) {
			if (params.error) {
				niceAlert("Temporary problem with this payment method, please try again later or try PayPal instead or contact the developer");
				sendGA(['_trackEvent', "coinbase", 'error with createCoinbaseButton']);
				bg.Controller.email({subject:"Payment error", message:"error:<br>" + params.error + "<br>errorthrown: " + params.errorThrown});
			} else {
				var code = params.data.button.code;

				var customParam = {itemID:bg.itemID, email:bg.email, license:licenseParamValue};
				var url = "https://coinbase.com/inline_payments/" + code + "?c=" + encodeURIComponent( JSON.stringify(customParam) );
				
				var $coinbaseIframe = $("<iframe src='" + url + "' style='" + borderRadius + "width: 500px; height: 160px; border: none;overflow: hidden;' scrolling='no' allowtransparency='true' frameborder='0'></iframe>");
				$coinbaseWrapper.find("#loadingCoinbase").hide();
				$coinbaseWrapper.append($coinbaseIframe);
			}			
		});
	} else {
		niceAlert('invalid payment process')
	}
}

function showAmountError(msg) {
	$("#amountError").html(msg).slideDown().delay(2000).slideUp();
}

function initLicenseFlow(email) {
	bg.email = email;
	$("#licenseDomain").text("@" + bg.email.split("@")[1]);
	//var licenses = [{number:"5", price:"0.02"}, {number:"10", price:"20"}, {number:"20", price:"40"}, {number:"unlimited", price:"0.03"}];
	var licenses = [{number:"5", price:"20"}, {number:"10", price:"30"}, {number:"20", price:"50"}, {number:"100", price:"100"}, {number:"unlimited", price:"500"}];
	$("#licenseOptions").empty();
	$.each(licenses, function(index, license) {
		var li = $("<li><input id='licenseOption" + index + "' type='radio' name='licenseOption'/>&nbsp;<label for='licenseOption" + index + "'>" + license.number + " users for USD $" + license.price + "</label></li>");
		li.find("input").data("data", license);
		$("#licenseOptions").append(li);
	});						
	$("#multipleUserLicenseWrapper").slideDown();
}

$(document).ready(function() {
	
	initToolTips();
	
	$("title").text(extensionName);
	
	var action = getUrlValue(location.href, "action");
	
	if (action) {
		setTimeout(function() {
			$("#extraFeaturesDetails").slideDown(2000);
		}, 800);
		setTimeout(function() {
			$("#paymentOptions").fadeIn(3500);
		}, 3000);
	} else {
		$("#extraFeaturesLegend").text(getMessage("extraFeatures"));
		$("#extraFeaturesDetails").show();
		$("#paymentOptions").show();
	}

	$("#paymentMethods a").click(function() {
		$("#paymentMethods").find("a").removeClass("selected");
		$(this).addClass("selected");
		$("#paymentFailure").hide();
	});

	// If multiple currencies load them
	$("#multipleCurrency").change(function() {
		$("#amount")
			.val("")
			.focus()
		;
		initCurrency();
	});
	
	$("#donateButton").click(function() {
		initPaymentDetails("paypal");
	});
	
	$("#donateButtonGoogleCheckout").click(function() {
		initPaymentDetails("googleCheckout");
	});

	$("#coinbaseButton").click(function() {
		initPaymentDetails("coinbase");
	});

	$("#submitDonationAmount").click(function() {				
		sendGA(['_trackEvent', "donationAmount", 'submitted', $("#amount").val()]);
		
		var amount = getAmountNumberOnly();
		
		if (amount == "") {
			showAmountError(getMessage("enterAnAmount"));
			$("#amount").focus();
		} else if (parseFloat(amount) < minimumDonation) {
			var minAmountFormatted = minimumDonation; //minimumDonation.toFixed(2).replace("\.00", "");
			showAmountError(getMessage("minimumAmount", currencySymbol + " " + minAmountFormatted));
			$("#amount").val(minAmountFormatted).focus();
		} else {
			initPaymentProcessor(amount);
		}
	});
	$('#amount').keypress(function(event) {
		  if (event.keyCode == '13') {
			  $("#submitDonationAmount").click();
		  }
	});
	$("#moreFeatures").click(function() {
		$(this).hide();
		$(".moreFeatures").slideDown();
	});
	// Show non-english users message to help me translate
	if (!pref("lang", window.navigator.language).match(/en/i)) {
		$("#helpMeTranslate").show();
	}
	
	$("#reasonsToDonateLink").click(function() {
		//$(this).hide();
		$("#reasonsToDonate").slideToggle();
		$("#me").fadeTo(2000, 1.0);
	});			
	
	$(".alreadyDonated").click(function() {
		var $alreadyDonated = $(this);
		if (bg.email) {
			$("#verifying").show();			
			verifyPayment(bg.accounts, function(response) {
				$("#verifying").hide();
				if (response && response.unlocked) {
					showSuccessfulPayment();
				} else if (response && response.error) {
					niceAlert("Problem contacting the server, please try again later or contact the developer!");
				} else {
					$("#noPaymentEmail").text(bg.email);
					$("#noPaymentFound").slideDown();
				}
			});
		} else {
			niceAlert(getMessage("mustSignInToPay"));
			$("#verifying").hide();
		}
	});
	
	$("#contributeToContinue").click(function() {
		$.when( $("#header, #extraFeatures, #option1, #option2 legend").animate({opacity: 'hide', height: 'hide'}, 700) ).done(function() {
			setTimeout(function() {
		if (bg.email) {
			
			// reinit email address in case it was substiiutted from multipe signin
			bg.email = bg.accounts.first().getAddress();
			
			showPaymentMethods("singleUser");
		} else {
			niceAlert(getMessage("mustSignInToPay"));
		}
			}, 100)
		});
		$("#multipleUserLicenseWrapper").slideUp();
	});
	
	$("#multipleUserLicense").click(function() {
		if (bg.email) {
			$('#donateAmountDiv').hide();
			$("#choosePaymentWrapper").slideUp();
			
			var emailDomainsSignedIn = 0;
			var lastEmailDomainFound;
			var $emailDomains = $("#emailDomains").empty();
			$emailDomains.append( $("<option>Select the domain to assign this license to...</option>") );
			$.each(bg.accounts, function(i, account) {
				if (isDomainEmail(account.getAddress())) {
					lastEmailDomainFound = account;
					$emailDomains.append( $("<option value='" + account.getAddress() + "'>Users who sign into their Gmail with a @" + account.getAddress().split("@")[1] + "</option>") );
					emailDomainsSignedIn++;
				}
			});
			
			if (emailDomainsSignedIn == 0) {
				// none found...						
				$("#licenseOnlyValidFor").hide();
				$("#signInAsUserOfOrg").show();
				$("#licenseOptions").hide();
				
				$("#exampleEmail").html("<span style='color:gray'>" + bg.email.split("@")[0] + "</span><b>@mycompany.com</b>");						
			} else if (emailDomainsSignedIn == 1) {
				initLicenseFlow(lastEmailDomainFound.getAddress());
			} else {
				// user is signed into 2 more email domains so give him an option to choose one...
				$("#licenseOnlyValidFor").hide();
				$emailDomains.slideDown();
			}
			$("#multipleUserLicenseWrapper").slideDown();
		} else {
			niceAlert(getMessage("mustSignInToPay"));
			return
		}
	});
	
	$("#emailDomains").change(function() {
		$(this).slideUp();
		initLicenseFlow( $(this).val() );
	});
	
	$("#multipleUserLicenseWrapper").on("click", "#licenseOptions input", function() {
		$("#multipleUserLicenseWrapper").slideUp();
		showPaymentMethods("multipleUsers");
	});
	
	$("#closeWindow").click(function() {
		getActiveTab(function(currentTab) {
			window.close();
			chrome.tabs.remove(currentTab.id);
		});
	});
	
	$(".signOutAndSignIn").click(function() {
		location.href = "https://mail.google.com/mail/?logout"; //%3Fcontinue%3D" + encodeURIComponent(location.href);
		// &il=true&zx=1ecpu2nnl1qyn
	});
	
	$("#reviews").click(function() {
		$(this).attr("href", "https://chrome.google.com/webstore/detail/" + getExtensionIDFromURL(location.href) + "/reviews");
	});

	$("#closeReasonsToDonate").click(function() {
		$('#reasonsToDonate').slideUp();
	});

	// load these things at the end
	
	$.getScript("https://www.paypalobjects.com/js/external/dg.js", function(data, textStatus, jqxhr) {
		dg = new PAYPAL.apps.DGFlow({trigger:"submitBtn"});
	});		

	// prevent jumping due to anchor # and because we can't javascript:; or else content security errors appear
	$("a[href='#']").on("click", function(e) {
		e.preventDefault()
	});

	$(window).on('message', function(messageEvent) {
		//console.log("message", e);
		var origin = messageEvent.originalEvent.origin;
		var data = messageEvent.originalEvent.data;
		
		if (origin == 'https://coinbase.com') {
			console.log(origin, data);
			try {
			    var eventType = data.split('|')[0];     // "coinbase_payment_complete"
			    var eventId   = data.split('|')[1];     // ID for this payment type

			    if (eventType == 'coinbase_payment_complete') {
			    	setTimeout(function() {
			    		$("#coinbaseWrapper").css("top", "550");
			    		showSuccessfulPayment();			    		
			    	}, 500);
			    	sendGA(['_trackEvent', "coinbase", "success", "daysElapsedSinceFirstInstalled", daysElapsedSinceFirstInstalled()]);
			    } else {
			        // Do something else, or ignore
			    }
			} catch (e) {
				bg.Controller.email({subject:"Payment error", message:"error:<br>" + JSON.stringify(e) + "<br><br>message event:<br>" + JSON.stringify(messageEvent)});
			}
	    }
	});

});