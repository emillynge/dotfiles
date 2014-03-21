// Copyright 2014 Jason Savard

function MailAccount(accountParams) {
	
	this.id = accountParams.accountNumber;
	this.status;
	
	var requestTimeout = 10000;

	// Check global settings
	var pollInterval = Settings.read("poll");

	// Always use SSL, things become messy otherwise
	var MAIL_DOMAIN = "https://mail.google.com";
	var MAIL_PATH = "/mail/";
	var MAIL_DOMAIN_AND_PATH = MAIL_DOMAIN + MAIL_PATH;
   
	var mailArray = new Array();
	var newestMailArray = new Array();
	var lastTotalEmailsFromPreviousFeed;
	var lastEmailFromPreviousFeed;
	var unreadCount = -1;
	var mailTitle;
	var mailAddress = accountParams.mailAddress;
	var gmailAt = null;
	var errorLives = 3;
	var isStopped = false;
	var requestTimer;

	var labels = null;

	// Without this/that, no internal calls to onUpdate or onError can be made...
	var that = this;
	
   	function filterEmailBody(subject, body) {
	   if (body) {
		   
		   // remove line breaks because regex cannot match content before lines especially with start of line operator ^
		   body = body.replace(/\r\n/g, " ");
		   body = body.replace(/^facebook([a-z])/i, "$1"); // $1 is a regex variable indicating matching everything, remove facebook string because when doing htmlToText ... we get a string like: facebookWilliam da Silva commented on your status.William wrote:
		   
		   var regexs = new Array();
		   
		   regexs.push(/ on [a-z]{3}, [a-z]{3} \d+/i);	// On Wed, Dec 28, 2011 at 12:36 AM, Jason <jaso
		   regexs.push(/ on [a-z]{3} \d+\/\d+\/\d+/i);	// On Wed 15/02/12  8:23 AM , Wade Konowalchuk
		   regexs.push(/ \w* [a-z]{3} \d+ \d+ /i); 		// Fri May 04 2012 15:54:46
		   regexs.push(/ on \d+[\/|-]\d+[\/|-]\d+/i);	// on 2011/12/28 Jason <apps@...
		   regexs.push(/ on \w*, \w* \d+(st)?, \d+, \w* wrote/i);	// On Thursday, October 31, 2013, Jason wrote:
		   regexs.push(/ \d+[\/|-]\d+[\/|-]\d+/i);		// 2011/12/28 Jason <apps@...
		   regexs.push(/ ?original message/i);
		   regexs.push(/ ?sent from: /i);
		   regexs.push(/ ?Envoyé de mon i/);
		   regexs.push(/ ?cc: /i);
		   regexs.push(/ date: /i); // removed the '?' because the word up'date' would stop the filter
		   regexs.push(/ ?from: /i); //great From: Jason
		   regexs.push(/ ?Reply to this email to comment on this status./i); // facebook ending
		   regexs.push(/ subject: re: /i); // facebook ending
		   // DONT use because passing subject string with unintential regex syntax screwed it up like ] and [ etc.
		   //regexs.push( new RegExp(" subject: re: " + subject, "i") );	// I can play afterall, any room left ? Subject: Re: Saturday's game Nov 2nd at 2pm From: wade@
		   
		   if (Settings.read("hideSentFrom")) {
			   //regexs.push(/^(.*) ?sent from \w* ?\w* ?$/i); // remove "Sent from Blackberry" or "Sent from my iPhone"
			   regexs.push(/ ?Sent (wirelessly )?from my /); // remove "Sent from my Blackberry" or "Sent from my iPhone"
			   regexs.push(/ ?Sent on the ?\w* \w* network/); // remove "Sent on the TELUS Mobility network with BlackBerry"
		   }
		   
		   for (var a=0; a<regexs.length; a++) {			   
			   /*
			   // max this internal loop to 10: just in case it goes on forever
			   // by the way we re-passing the same regex several times until all occurences of ie from" are gone... "Hello1 from: Hello2 from:"
			   for (var b=0; b<10; b++) {
				   var matches = body.match(regexs[a]);
				   if (matches && matches.length >= 2) {
					   body = matches[1];
				   } else {
					   break;
				   }
			   }
			   */
			   
			   // regex.search = faster ...
			   var searchIndex = body.search(regexs[a]);
			   if (searchIndex != -1) {
				   body = body.substring(0, searchIndex);
			   }
		   }
		   
		   body = $.trim(body);
		   
		   // remove repeated subject line from beginning of the body (ie. emails from facebook tend to do that etc. like William da Silva commented on your status.
		   if (body.indexOf(subject) == 0) {
			   body = body.substring(subject.length);
		   }
		   
		   return body;
	   }
   	}
   
   function groupConversations(emails, emailsInFeed) {
	   console.log("group conversations");
	   // start from old to newest
	   for (var a=emails.length-1; a>=0; a--) {
		   var mail = emails[a];
		   if (!mail.conversationParent) {
			   // check for conversations with this subject
			   for (var b=a-1; b>=0; b--) {
				   var conversation = emails[b];
				   if (mail.title == conversation.title) {
					   console.log("found same subject: " + mail.title);
					   
					   // check if i should avoid grouping conversation if they are not group by gmail itself
					   var foundInEmailsFeed = false;
					   $.each(emailsInFeed, function(i, emailInFeed) {
						   if (emailInFeed.id == mail.id) {
							   foundInEmailsFeed = true;
							   return false;
						   }
					   });
					   
					   console.log("foundInEmailsFeed: " + foundInEmailsFeed);
					   if (!foundInEmailsFeed) {
						   // make sure not already added to conversations
						   var alreadyAdded = false;
						   for (var c=0; c<mail.conversations.length; c++) {
							   if (mail.conversations[c].id == conversation.id) {
								   alreadyAdded = true;
								   break;
							   }
						   }
						   if (!alreadyAdded) {
							   
							   mail.conversations.push(conversation);
							   conversation.conversationParent = mail;
							   
							   /*
							   // same sender, so group it
							   var addConversationToMain = false;
							   console.log(mail.authorMail + " " + conversation.authorMail);
							   if (mail.authorMail == conversation.authorMail) {
								   console.log("same sender")
								   addConversationToMain = true;
							   } else {
								   // see if this sender is in the main conversations to/ccs
								   if (mail.contributors) {
									   mail.contributors.each(function(i, contributor) {
										   console.log("main contribs mail: " + $(contributor).find("email").text() + " conv contrib: " + conversation.authorMail);
										   if ($(contributor).find("email").text() == conversation.authorMail) {
											   console.log("senderFoundInMainConversation");
											   addConversationToMain = true;
											   return false;
										   }
									   });
								   }
							   }

							   if (addConversationToMain) {
								   mail.conversations.push(conversation);
								   conversation.conversationParent = mail;
							   }
							   //emails.splice(b, 1);
							   //b--;
							   */
						   }
					   }
				   }
			   }
		   }
	   }
   }
   
   function addParsedFeed(params, parsedFeed, feedUnreadCount, callback) {
	   // add the parsed feeds and continue for more						   
	   var feedInfo = {label:params.monitorLabels[params.monitorLabelsIndex], parsedFeed:parsedFeed, feedUnreadCount:feedUnreadCount};
	   
	   params.feedsArrayInfo.push(feedInfo);
	   params.monitorLabelsIndex++;
	   
	   getFeed(params, callback);
   }
   
   function fetchFeed(params, callback) {
	   var labelParam = params.monitorLabels[params.monitorLabelsIndex];
	   if (labelParam) {
		   //labelParam = escape(labelParam);
		   // apparently iPads add these labels with slashes (ie. they are not actually nested labels just labels with slashes in them)
		   // so ignore them and don't replace the slashes
		   //if (labelParam.indexOf("INBOX/") == -1) {
			   labelParam = labelParam.replace(/\//g, "-"); // slashes must had to replaced with - to work (yeah that's gmail wants it)
		   //}
		   labelParam = encodeURIComponent(labelParam);
	   } else {
		   labelParam = "";
	   }
	   
	   var labelPath = "feed/atom/" + labelParam;
	   if (Settings.read("accountAddingMethod") == "autoDetect") {
		   var url = that.getMailUrl() + labelPath + "?timestamp=" + Date.now();
		   $.ajax({
			   type: "GET",
			   dataType: "text",
			   url: url,
			   timeout: requestTimeout,
			   complete: function(jqXHR, textStatus) {
				   callback({jqXHR:jqXHR, textStatus:textStatus});
			   }
		   });
	   } else {
		   // refer to onBeforeSendHeaders.addListenter (background.js) about method=oauth
		   var url = MAIL_DOMAIN_AND_PATH + labelPath + "?method=oauth&timestamp=" + Date.now();
		   //var tokenResponse = oAuthForEmails.findTokenResponseByIndex(that.id);
		   oAuthForEmails.send({userEmail:mailAddress, url:url}, function(params) {
			   callback(params);
		   });
	   }
	   
   }
   
   function getFeed(params, callback) {
	   
	   // finished with feeds so exit/callback
	   if (params.monitorLabelsIndex >= params.monitorLabels.length) {
		   callback(params);
	   } else {
		   
		   fetchFeed(params, function(fetchFeedResponse) {
			   
			   // test flag
			   var TEST_FAIL = false;
			   if (TEST_FAIL && that.id == 0) {				   
				   textStatus = "jasontimeout";
			   } else {
				   TEST_FAIL = false;
			   }
			   
			   if (fetchFeedResponse.textStatus == "success") {
				   that.error = null;
				   
				   var parser = new DOMParser();
				   parsedFeed = $(parser.parseFromString(fetchFeedResponse.jqXHR.responseText, "text/xml"));
				   
				   var titleNode = parsedFeed.find('title');
				   if (titleNode.length >= 1) {			   
					   mailTitle = $(titleNode[0]).text().replace("Gmail - ", "");
					   
					   // patch because <title> tag could contain a label with a '@' that is not an email address ie. Gmail - Label '@test@' for blah@gmail.com
					   var emails = mailTitle.match(/([\S]+@[\S]+)/ig);
					   if (emails) {
						   mailAddress = emails.last();
					   } else {
						   logError("could not pull email from feed title: " + $(titleNode[0]).text());
					   }
					   
					   var ignoreEmailFound = false;
					   var ignoreEmailsStr = Settings.read("ignoreEmails");
					   if (ignoreEmailsStr) {
						   var ignoreEmailsArray = ignoreEmailsStr.split(",");
						   $.each(ignoreEmailsArray, function(i, ignoreEmail) {
							   if (mailAddress == $.trim(ignoreEmail.toLowerCase())) {
								   ignoreEmailFound = true;
								   return false;
							   }
						   });
					   }
					   
					   if (ignoreEmailFound || (Settings.read("check_gmail_off") && mailAddress && mailAddress.indexOf("@gmail") != -1)) {
						   callback({ignored:true});
						   return;
					   }
					   
					   // in oauth mode if detected account is not in in added list then ignore it
					   if (Settings.read("accountAddingMethod") == "oauth") {
						   if (!oAuthForEmails.findTokenResponse({userEmail:mailAddress})) {
							   callback({ignored:true});
							   return;
						   }					   
					   }
					   
				   } else {
					   mailAddress = "Cookie problem, try signing out and in or restart browser!";
				   }
				   
				   // If previousMonitorLabel not matching current then we are probably fetching this feed for the first time and so now we have the email address, we must now check if the user selected a different label to monitor for this email address, if so stop this one and call the feed again
				   //console.log("params: ", params.monitorLabels)
				   //console.log("getmonitors: ", that.getMonitorLabels())
				   if (params.monitorLabels.toString() != that.getMonitorLabels().toString()) {
					   // this is a safety flag so that they we don't endless recursively call getEmails()
					   if (params.fetchFeedAgainSinceMonitorLabelIsDifferent) {
						   that.error = "JError: recursive error with label";
						   callback({error:that.error, jqXHR:fetchFeedResponse.jqXHR});
					   } else {					   
						   // update monitor labels and send it again
						   console.log("call again since fetchFeedAgainSinceMonitorLabelIsDifferent");
						   params.monitorLabels = that.getMonitorLabels();
						   params.fetchFeedAgainSinceMonitorLabelIsDifferent = true;
						   getFeed(params, callback);
					   }
				   } else {
					   
					   var feedUnreadCount = Number(parsedFeed.find('fullcount').text());
					   // TESTING
					   //alert('remove test')
					   //feedUnreadCount = 0;
					   if (feedUnreadCount) {
						   addParsedFeed(params, parsedFeed, feedUnreadCount, callback);
					   } else {							   
						   // patch: because fullcount is 'sometimes' 0 for some user accounts for labels: important or allmail (https://github.com/aceat64/MailCheckerMinus/issues/15 or banko.adam@gmail.com)
						   feedUnreadCount = Number(parsedFeed.find('entry').length);
						   
						   // TESTING
						   //alert('remove test2')
						   //feedUnreadCount = 20;
						   // 20 is the limit to the feed so there might be more unread emails, let's use the basic view to fetch the real total (we can only do this for allmail/unread label because even the basic view only says 1-20 of "about"??? blahblah
						   if (feedUnreadCount >= 20 && params.monitorLabels[params.monitorLabelsIndex] == "unread") {
							   
							   if (true) { // Settings.read("accountAddingMethod") == "autoDetect"
								   console.log("use the basic view to fetch the real total...")
								   $.ajax({
									   type: "GET",
									   timeout: requestTimeout,
									   url: that.getMailUrl() + "h/?s=q&q=label%3Aunread", // append 'unread' to only fetch unreads of this label of course
									   complete: function(jqXHR, textStatus) {
										   if (textStatus == "success") {
											   try {
												   // patch: must place wrapper div element because jQuery would generate error when trying to parse the response into the $() contructor ... Uncaught Error: Syntax error, unrecognized expression: <html...
												   var $responseText = $("<div>" + jqXHR.responseText + "</div>");
												   var realTotal = $responseText.find("table tr:first-child td b:nth-child(3)").first().text();
												   if (realTotal && $.isNumeric(realTotal)) {
													   feedUnreadCount = Number(realTotal);
												   }
											   } catch (e) {
												   logError("Could not parse basic view html to get real unread count: " + e);
											   }
										   }
										   addParsedFeed(params, parsedFeed, feedUnreadCount, callback);
									   }
								   });
							   } else {
								   // commented this because getunreadcount is returning messages - but not grouped messages by thread id
								   /*
								   oAuthForEmails.sendImapRequest(mailAddress, {command:"getUnreadCount"}, function(jqXHR, textStatus) {
									   console.log("oAuthForEmails.sendImapRequest: ", textStatus);
									   if (textStatus == "success") {
										   var data;
										   try {
											   data = JSON.parse(jqXHR.responseText);
										   } catch (e) {
											   data = {}
											   data.error = "Problem parsing feed: " + e + " response: " + jqXHR.responseText;
										   }
										   if (data.error) {
											   console.error(data, jqXHR);
										   } else {
											   console.log("getUnreadCount success:", data);
											   feedUnreadCount = data.response.unreadCount;
										   }										   
									   }
									   addParsedFeed(params, parsedFeed, feedUnreadCount, callback);
								   });
								   */
							   }
						   } else {
							   addParsedFeed(params, parsedFeed, feedUnreadCount, callback);
						   }
					   }
				   }

			   } else {
				   // jqXHR.status = 401 = unauthorized, 0=timeout
				   // jqXHR.statusText = unauthorized, timeout
				   // textStatus (param) "success", "notmodified", "error", "timeout", "abort", or "parsererror"
				   
				   if (errorLives > 0) {		   
					   errorLives--;
				   }
				   
				   console.warn("getFeed error: " + fetchFeedResponse.textStatus + " errorlives: " + errorLives);

				   if (errorLives == 0) {
					   
				   }
				   

				   if (TEST_FAIL) {
					   setTimeout(function() {
						   that.error = "timeout";
						   callback({error: that.error, jqXHR:fetchFeedResponse.jqXHR});
					   }, 4000);
				   } else {
					   
					   if (fetchFeedResponse.jqXHR) {
						   that.error = fetchFeedResponse.jqXHR.statusText;
					   } else {
						   that.error = fetchFeedResponse.textStatus;
					   }
					   callback({error:that.error, jqXHR:fetchFeedResponse.jqXHR});
				   }
			   }
		   });
	   }
   }
   
   function findThreadByMail(threads, mail) {
	   for (var a=0; a<threads.length; a++) {
		   for (var b=0; b<threads[a].messages.length; b++) {
			   if (threads[a].messages[b]["X-GM-MSGID"] == mail.id) {
				   return threads[a];
			   }
		   }
	   }
   }
   
   // convert imap_rfc822_parse_adrlist to my name,email object
   function parseImapAddresses(addresses) {
	   var newAddresses = [];
	   if (addresses) {
		   $.each(addresses, function(index, address) {
			   var name;
			   if (address.personal) {
				   name = address.personal;
				   name = name.replace(/\"/g, "");
				   name = name.replace(/\'/g, "");
			   }
			   newAddresses.push({name:name, email:address.mailbox+"@"+address.host});
		   });
	   }
	   return newAddresses;
   }
   
   this.setAccountId = function(id) {
	   that.id = id;
   }
   
   this.fetchThreads = function(mailArray, callback) {
	   if (Settings.read("accountAddingMethod") == "autoDetect") { // via gmail interface
		   // accounts count will be 0 when you start the extension or pollAccounts (that's ok because initMailAccount sets accounts to 0) once the interval calls this function then the accounts should be 1 or + 
		   var maxGetThreads;
		   if (accounts.length) {
			   // do this to prevent locked accounts (note it used be 20 and no averaging so 20 for each account, i'm such an idiot
			   maxGetThreads = 5 / accounts.length; // because this method will be called for each accounts let's average the number of threads per account
		   } else {
			   maxGetThreads = 1;
		   }
		   var getThreadsCount = 0;
		   var deferreds = new Array();
		   
		   $.each(mailArray, function(i, email) {
			   // lots of peeps in the thread so this might be a reply to a conversation (but which was already 'read' by user before so this check does not know the thread's past or initial email etc.) (and thus the summary in the Gmail's feed will not match what this sender wrote, but rather it matches summary of the first email in this thread
			   if (true) { //email.contributors.length || Settings.read("spokenWordsLimit") == "paragraph" || Settings.read("spokenWordsLimit") == "wholeEmail") { 
				   //console.log("has contributors: " + email.contributors.length + " or spokenwordslimit high");
				   if (getThreadsCount < maxGetThreads) {
					   var deferred = email.getThread();
					   deferreds.push(deferred);
					   getThreadsCount++;
				   } else {
					   console.warn("MAX fetch last conversations reached, ignoring now.");						   
				   }
			   }
		   });
		   
		   if (deferreds.length) {
			   console.log("deferreds: ", deferreds);
		   }
		   
		   $.when.apply($, deferreds).always(function() {
			   console.log("fetchfeeds end");
			   callback();
		   });
	   } else { // via oauth IMAP
		   var messageIds = [];
		   $.each(mailArray, function(index, mail) {
			   messageIds.push(mail.id);
		   });
		   console.log("messageIds:", messageIds);
		   oAuthForEmails.sendImapRequest(mailAddress, {command:"fetchEmails", messageIds:messageIds}, function(jqXHR, textStatus) {
			   console.log("oAuthForEmails.sendImapRequest: ", textStatus);
			   if (textStatus == "success") {
				   var data;
				   try {
					   data = JSON.parse(jqXHR.responseText);
				   } catch (e) {
					   data = {}
					   data.error = "Problem parsing feed: " + e + " response: " + jqXHR.responseText;
				   }
				   if (data.error) {
					   var error = "Error: " + data.error;
					   if (data.errorWithAuthentification) {
						   error += "<br><br>Access may have been revoked or denied due to several reasons. Try refreshing or you may need to Add this Account again to re-authorize.";
					   }
					   logError(error, jqXHR);
					   callback({error:error});
				   } else {
					   console.log("success:", data);
					   
					   // update mailarray with messages[]
					   $.each(mailArray, function(index, mail) {
						   
						   data.threads.sort(function(a, b) {
							   var date1 = new Date(a.messages.last()["date"]);					
							   var date2 = new Date(b.messages.last()["date"]);
							   if (date1.getTime() == date2.getTime()) {
								   return 0;
							   } else {
								   return date1.getTime() > date2.getTime() ? -1 : 1;
							   }
						   });
						   
						   console.log("mail", mail);
						   var thread = findThreadByMail(data.threads, mail);
						   
						   if (thread) {
							   var firstMessage = thread.messages.first();
							   
							   var message;
							   if (thread.messages.length == 1) {
								   // single email
								   message = firstMessage;
							   } else {
								   // conversation email
								   message = thread.messages.last();
							   }
							   
							   mail.threadId = message["X-GM-THRID"];
								
							   var addressObj = parseAddresses(message["from"]).first();
							   var authorName = addressObj.name;
							   var authorNameUnsafeForHtml = authorName;
							   // Data checks
							   if (authorName == null || authorName.length < 1) {
								   authorName = "(unknown sender)";
							   }
								
							   var authorMail = addressObj.email;
							   mail.authorMail = Encoder.XSSEncode(authorMail, true);
							   mail.authorName = Encoder.XSSEncode(authorName, true);
							   mail.authorNameUnsafeForHtml = authorNameUnsafeForHtml;

							   /*
							   console.log("message:", message);
							   var formattedLabel = message.searchLabel;
							   if (formattedLabel == "inbox") {
								   formattedLabel = getMessage("inbox");
								   labelSortIndex = 0;
							   } else if (formattedLabel == "important") {
								   formattedLabel = getMessage("importantMail");
								   labelSortIndex = 1;
							   } else if (formattedLabel == "unread") {
								   formattedLabel = getMessage("allMail");
								   labelSortIndex = 2;
							   } else {
								   if (formattedLabel.length) {
									   labelSortIndex = formattedLabel.toLowerCase().charCodeAt(0);
								   } else {
									   // empty label, weird let's just put it after the common gmail labels
									   labelSortIndex = 3;
								   }
							   }
							   
							   var labels = message["X-GM-LABELS"];
							   if (labels) {
									labels = labels.slice(0);
									if (message["searchLabel"] != "INBOX") {
										//labels.push(message["searchLabel"]);
									}
									
									for (var a=0; a<labels.length; a++) {
										if (labels[a].startsWith("\\\\")) { //"\\\\Important"
											labels.splice(a, 1);
										}
									}
							   }
							   
							   mail.labels = labels;
							   mail.labelSortIndex = labelSortIndex
							   mail.formattedLabel = formattedLabel;
							   */
							   
							   mail.messages = [];
							   $.each(thread.messages, function(index, imapMessage) {
								   var message = {}
								   
								   var date = new Date(imapMessage.date);
								   if (imapMessage.date && date.isValid()) {
									   // good do nothing 
								   } else {
									   // default to current date not good but eh
									   date = new Date();
								   }

								   // used for the in-reply-to header later
								   message["message-id"] = imapMessage["message-id"];
								   message.date = date;
								   message.from = parseAddresses(imapMessage.from).first();

								   message.to = parseImapAddresses(imapMessage.to);
								   message.cc = parseImapAddresses(imapMessage.cc);
								   message.bcc = parseImapAddresses(imapMessage.bcc);
								   
								   message.content = decodeUTF8(imapMessage.formattedBody);

								   // just remove img altogether
								   if (message.content) {
									   message.content = message.content.replace(/<img /g, "<imghidden ");
									   message.content = message.content.replace(/\/img>/g, "/imghidden>");
								   }

								   //message.textContent = decodeUTF8(imapMessage.summary);
								   // patch becaue text in other language create URI malformed issue
								   message.textContent = imapMessage.summary;
								   
								   message.textContent = filterEmailBody(mail.title, message.textContent);
								   message.textContent = Encoder.XSSEncode(message.textContent, true);

								   message.hasAttachments = imapMessage.hasAttachments;
								   
								   mail.messages.push(message);
							   });
						   } else {
							   // happens sometimes if a single message from the thread was deleted (ie. using "Delete this message" from dropdown on the right of message in Gmail)
							   var error = "could not findThreadByMail: " + mail.title + " _ " + mail.id;
							   logError(error)
						   }
						   
					   });
					   
					   console.log("callback oAuthForEmails.sendImapRequest");
					   callback({});
				   }
			   } else {
				   logError(textStatus, jqXHR);
				   callback({error:textStatus});
			   }
		   });
	   }
	   
   }

   // Retreives inbox count and populates mail array
   this.getEmails = function(getEmailParams, callback) {
	   var dfd = new $.Deferred();
	   
	   if (!getEmailParams) {
		   getEmailParams = {};
	   }
	   
	   if (!callback) {
		   callback = function() {};
	   }
	   
	   if (Settings.read("accountAddingMethod") == "autoDetect" || Settings.read("accountAddingMethod") == "oauth") {
		   // recursively fetch all feeds
		   getFeed({monitorLabels:that.getMonitorLabels(), monitorLabelsIndex:0, feedsArrayInfo:[]}, function(cbParams) {
			   if (cbParams.ignored) {
				   callback(cbParams);
				   dfd.resolve("success");
			   } else if (cbParams.error) {
				   callback(cbParams);
				   dfd.reject(cbParams.error);
			   } else {
	
				   if (getEmailParams.restorePreviousMails) {
					   for (var a=0; a<getEmailParams.previousAccounts.length; a++) {
						   if (getEmailParams.previousAccounts[a].getAddress() == mailAddress) {
							   console.log("restoring previous mails: " + mailAddress);
							   mailArray = getEmailParams.previousAccounts[a].getMail();
							   break;
						   }
					   }
				   }
				   
				   unreadCount = 0;
				   
				   var emailsInFeed = new Array();
				   newestMailArray = new Array();
	
				   if (cbParams.feedsArrayInfo) {
					   $.each(cbParams.feedsArrayInfo, function(i, feedInfo) {
						   
						   unreadCount += feedInfo.feedUnreadCount;
						   
						   // Parse xml data for each mail entry
						   feedInfo.parsedFeed.find('entry').each(function () {
							   
							   var $entry = $(this);
							   
							   var title = $entry.find('title').text();
							   var shortTitle = title;
							   
							   var summary = $entry.find('summary').text();
							   summary = filterEmailBody(title, summary);
							   
							   var issued = Date.parse($entry.find('issued').text());
							   
							   var id = $entry.find('id').text().split(":")[2]; // ex. fetch the last number for the messageid... tag:gmail.google.com,2004:1436934733284861101
							   
							   var link = $entry.find('link').attr('href');
							   var frontendMessageId = link.replace(/.*message_id=(\d\w*).*/, "$1");
							   
							   var authorName = $entry.find('author').find('name').text();
							   var authorNameUnsafeForHtml = authorName;
							   var authorMail = $entry.find('author').find('email').text();
							   var contributors = $entry.find("contributor");
		
							   // Data checks
							   if (authorName == null || authorName.length < 1)
								   authorName = "(unknown sender)";
		
							   var MAX_SHORT_TITLE = 55;
							   if (title == null || title.length < 1) {
								   //shortTitle = title = "(No subject)";
							   } else {
								   shortTitle = title; //.summarize(MAX_SHORT_TITLE);
							   }
		
							   // Encode content to prevent XSS attacks
							   title = Encoder.XSSEncode(title, true);
							   shortTitle = Encoder.XSSEncode(shortTitle, true);
							   summary = Encoder.XSSEncode(summary, true);
							   authorMail = Encoder.XSSEncode(authorMail, true);							   
							   authorName = Encoder.XSSEncode(authorName, true);
							   
							   var formattedLabel = feedInfo.label;
							   if (!formattedLabel) {
								   formattedLabel = getMessage("inbox");
								   labelSortIndex = 0;
							   } else if (formattedLabel == "important" || formattedLabel == "^iim") {
								   formattedLabel = getMessage("importantMail");
								   labelSortIndex = 1;
							   } else if (formattedLabel == "unread") {
								   formattedLabel = getMessage("allMail");
								   labelSortIndex = 2;
							   } else {
								   if (formattedLabel.length) {
									   labelSortIndex = formattedLabel.toLowerCase().charCodeAt(0);
								   } else {
									   // empty label, weird let's just put it after the common gmail labels
									   labelSortIndex = 3;
								   }
							   }
							   
							   // Construct a new mail object
							   var mailObject = {
								   account: that,
								   "id": id,
								   "frontendMessageId": frontendMessageId,
								   "title": title,
								   "shortTitle": shortTitle,
								   "summary": summary,
								   "link": link,
								   "issued": issued,
								   "authorName": authorName,
								   "authorNameUnsafeForHtml": authorNameUnsafeForHtml,
								   "authorMail": authorMail,
								   labels: [feedInfo.label], // initialize array and make first item in array the default label
								   labelSortIndex: labelSortIndex,
								   formattedLabel: formattedLabel,
								   contributors: contributors,
								   getShortName: function() {
									   return mailObject.authorName.split(" ")[0];
								   },
								   open: function(params) {
									   if (!params) {
										   params = {};
									   }
									   params.mail = mailObject;
									   
									   if (params.openInNewTab) {
										   var newURL = generateMailURLWithLabel(mailObject.account.getMailUrl(), params)
										   createTab(newURL);
									   } else {
										   findOrOpenGmailTab(params);
									   }
								   },
								   markAsRead: function(callback) {
									   return executeMailAction({mail:mailObject, action:"markAsRead",
										   postActionCallback:function() {
											   mailObject.lastAction = "markAsRead";
										   },
										   callback:callback
									   });
								   },
								   markAsUnread: function(callback) {
									   return executeMailAction({mail:mailObject, action:"markAsUnread",
										   postActionCallback:function() {
											   mailObject.lastAction = "markAsUnread";
										   },
										   callback:callback
									   });
								   },
								   deleteEmail: function(callback) {
									   return executeMailAction({mail:mailObject, action:"deleteEmail",
										   postActionCallback:function() {
											   mailObject.removeFromArray();
										   },
										   callback:callback
									   });
								   },
								   archive: function(callback) {
									   if (Settings.read("archive_read")) {
										   mailObject.markAsRead(function() {
											   return executeMailAction({mail:mailObject, action:"archive",
												   postActionCallback:function() {
													   mailObject.removeFromArray();
												   },
												   callback:callback
											   });									   
										   })
									   } else {
										   return executeMailAction({mail:mailObject, action:"archive",
											   postActionCallback:function() {
												   mailObject.removeFromArray();
											   },
											   callback:callback
										   });									   
									   }
								   },
								   markAsSpam: function(callback) {
									   return executeMailAction({mail:mailObject, action:"markAsSpam",
										   postActionCallback:function() {
											   mailObject.removeFromArray();
										   },
										   callback:callback
									   });
								   },
								   moveLabel: function(newLabel, callback) {
									   if (mailObject.labels.length) {
										   
										   var emailMightBeInInbox = false;
										   
										   // find "possibly" inbox label: archive it first and then label it										   
										   $.each(mailObject.labels, function(index, label) {
											   if (label == "" || label == "important" || label == "^iim" || label == "unread") { // possibly inbox email
												   emailMightBeInInbox = true;
												   mailObject.archive(function() {
													   return mailObject.applyLabel(newLabel, function() {
														   if (callback) {
															   callback();
														   }
													   });
												   });
												   return false;
											   }
										   });
										   
										   // if only 1 label (and not possibly in inbox) then remove it and apply new label
										   if (mailObject.labels.length == 1 && !emailMightBeInInbox) {
											   mailObject.removeLabel(mailObject.labels.first(), function() {
												   return mailObject.applyLabel(newLabel, function() {
													   if (callback) {
														   callback();
													   }
												   });
											   });
										   }
									   } else {
										   logError("no labels for email");
									   }
								   },
								   applyLabel: function(label, callback) {
									   return executeMailAction({mail:mailObject, action:"applyLabel", label:label,
										   postActionCallback:function() {
											   // nothing
										   },
										   callback:callback
									   });									   
								   },
								   removeLabel: function(label, callback) {
									   return executeMailAction({mail:mailObject, action:"removeLabel", label:label,
										   postActionCallback:function() {
											   // nothing
										   },
										   callback:callback
									   });									   
								   },
								   star: function(callback) {
									   return executeMailAction({mail:mailObject, action:"star",
										   postActionCallback:function() {
											   // nothing
										   },
										   callback:callback
									   });
								   },
								   postReply: function(message, replyAllFlag, callback) {
									   return executeMailAction({mail:mailObject, action:"reply", message:message, replyAllFlag:replyAllFlag,
										   postActionCallback:function() {
											   // nothing
										   },
										   callback:callback
									   });
								   },
								   reply: function(callback) {
									   var to = encodeURIComponent(mailObject.authorMail); // Escape sender email
									   var subject = Encoder.htmlDecode(mailObject.title); // Escape subject string
									   subject = (subject.search(/^Re: /i) > -1) ? subject : "Re: " + subject; // Add 'Re: ' if not already there
									   subject = encodeURIComponent(subject);
									   var threadbody = "\r\n\r\n" + mailObject.issued.toString() + " <" + mailObject.authorMail + ">:\r\n" + Encoder.htmlDecode(mailObject.getLastMessageText());
									   threadbody = encodeURIComponent(threadbody);
									   
									   // summarize body because or else we get a 414 or 413 too long url parameters etc.
									   var replyURL = mailObject.account.getMailUrl() + "?view=cm&tf=1&to=" + to + "&su=" + subject + "&body=" + threadbody.summarize(700);
									   if (Settings.read("replyingMarksAsRead")) {
										   mailObject.markAsRead(function() {
											   
										   });
									   }
									   
									   openTabOrPopup({url:replyURL, name:'Compose new message', account:mailObject.account});
								   },
								   getThread: function(params, callback) {
									   if (!params) {
										   params = {};
									   }
									   params.mail = mailObject;
									   
									   // already fetched thread/messages
									   if (params.mail.messages) {
										   var dfd = new $.Deferred();
										   callback(params);
										   dfd.resolve("success");
										   return dfd.promise();
									   } else {
										   // refresh thread - return promise()
										   return fetchThread(params, function(response) {
											   if (callback) {
												   callback(response);
											   }
										   });
									   }
								   },
								   // params... {maxSummaryLetters:170, htmlToText:true, EOM_Message:" [" + getMessage("EOM") + "]"}
								   getLastMessageText: function(params) { // optional maxletters
									    if (!params) {
										   params = {};
									    }
									   	var lastMessageText;
									   	// if we are getting the summary from whole message than we can use the EOM, else if we use the brief summary from the atom feed we don't know for sure if it's cut off etc.
										if (mailObject.messages && mailObject.messages.length) {
											lastMessageText = mailObject.messages.last().textContent;
											if (lastMessageText) {
												if (params.htmlToText) {
													lastMessageText = lastMessageText.htmlToText();
												}
												if (params.maxSummaryLetters) {
													lastMessageText = lastMessageText.summarize(params.maxSummaryLetters, Settings.read("showEOM") ? params.EOM_Message : null);
												}
											}
										}
										
										// can happen when could not parse body from print page
										if (!lastMessageText) {
											lastMessageText = mailObject.summary;
											
											if (lastMessageText) {
												if (params.htmlToText) {
													lastMessageText = lastMessageText.htmlToText();
												}												
												if (lastMessageText && params.maxSummaryLetters) {
													// seems like ... doesn't always exist in atom feed? so cant be sure there more text
													lastMessageText = lastMessageText.summarize(params.maxSummaryLetters);
													/*
													var elipsisIndex = lastMessageText.lastIndexOf("...");
													if (elipsisIndex != -1 && elipsisIndex == lastMessageText.length-3) { 
														// we already have an ellipsis
														lastMessageText = lastMessageText.summarize(params.maxSummaryLetters);
													} else {
														lastMessageText = lastMessageText.summarize(params.maxSummaryLetters, EOM_Message);
													}
													*/
												}
											}
										}
										return lastMessageText;
								   },
								   removeFromArray: function() {
									   for (var a=0; a<mailArray.length; a++) {
										   if (mailObject.id == mailArray[a].id) {
											   mailArray.splice(a, 1);
											   break;
										   }
									   }
								   },
								   generateAuthorsNode: function(shortVersion) {
									   var $node;
									   
									   var useMessages = Settings.read("accountAddingMethod") == "autoDetect" && mailObject.messages && mailObject.messages.length;
									   
									   if (mailObject.contributors.length >= 1) {
										   // the feed does not put the original author as first contributor if they have replied in the thread (ie. last author) so make sure they're first if so
										   var name = "someone";
										   var nextContributorIndex = 0;
										   if (useMessages) {
											   if (mailObject.messages.first().from.email == mailObject.contributors.last().find("email").text()) {
												   console.log("last contr is valid original author: " + mailObject.messages.first().from.email);
												   name = mailObject.contributors.last().find("name").text().split(" ")[0];
												   nextContributorIndex = 0;
											   } else {
												   name = mailObject.messages.first().from.name.split(" ")[0];
												   nextContributorIndex = 1;
											   }
										   } else {
											   if (mailObject.contributors.length) {
												   name = mailObject.contributors.first().find("name").text().split(" ")[0];
											   }
										   }
										   var html = "<span>" + name + "</span>";
		
										   var unreadAuthor = "<span class='unread'>" + mailObject.getShortName() + "</span>";
										   if (useMessages) {
											   unreadAuthor += " (" + (mailObject.messages.length) + ")";
										   }
										   // if more conversations than contributors (happens when several exchanges are done from the original author)
										   if (useMessages && mailObject.messages.length > mailObject.contributors.length+1) {
											   html += " .. " + unreadAuthor;
										   } else {
											   if (!useMessages || shortVersion) {
												   if (mailObject.contributors.length == 2) {
													   html += ", ";
												   } else {
													   html += " .. ";
												   }
												   html += unreadAuthor;
											   } else {
												   if (mailObject.contributors.length == 2) {						
													   html += ", <span>" + mailObject.contributors.eq(nextContributorIndex).find("name").text().split(" ")[0] + "</span>";
												   } else if (mailObject.contributors.length >= 3) {
													   //html += " .. " + unreadAuthor;
													   html += " .. <span>" + mailObject.contributors.first().find("name").text().split(" ")[0] + "</span>";
												   }
			
												   html += ", " + unreadAuthor;
											   }
										   }
		
										   $node = $(html);
									   } else {
										   $node = $("<span/>");					   
										   $node
										   		.html( mailObject.authorName )
										   		.addClass("unread")
										   		.attr("title", mailObject.authorMail)
										   ;
									   }
									   return $node;
								   }
							   };
							   
							   // check if this email appeared in previous label fetches (ie. it was labeled with multiple labels) if so then avoid adding this email again
							   var emailAlreadyFoundInADifferentLabelFetch = false;
							   for (var a=0; a<i; a++) {						   
								   for (var b=0; b<cbParams.feedsArrayInfo[a].emailsInFeed.length; b++) {
									   if (cbParams.feedsArrayInfo[a].emailsInFeed[b].id == mailObject.id) {
										   emailAlreadyFoundInADifferentLabelFetch = true;
										   cbParams.feedsArrayInfo[a].emailsInFeed[b].labels.push( feedInfo.label );
										   break;
									   }
								   }						   
							   }
							   
							   if (emailAlreadyFoundInADifferentLabelFetch) {
								   unreadCount--;
							   } else {
								   emailsInFeed.push(mailObject);
								   
								   var isNewMail = true;
								   $.each(mailArray, function (i, oldMail) {
									   if (oldMail.id == mailObject.id) {
										   //console.log("old mail");
										   isNewMail = false; // This mail is not new
										   return false;
									   }			   
								   });
								   
								   if (isNewMail) {
									   console.log("isNewMail");
									   newestMailArray.push(mailObject);
								   }
							   }
						   });
						   
						   feedInfo.emailsInFeed = emailsInFeed;
						   
					   });
				   }
	
				   
				   // remove emails that have disappeared from the feed (user could have done any number of actions on the emails via the gmail.com etc.
				   for (var a=0; a<mailArray.length; a++) {
					   var emailStillInFeed = false; 
					   for (var b=0; b<emailsInFeed.length; b++) {
						   if (mailArray[a].id == emailsInFeed[b].id) {
							   emailStillInFeed = true;
							   break;
						   }
					   }
					   if (emailStillInFeed) {
						   // might have been marked as unread in Gmail page so make sure to reset this flag or it will appear as read in popup 
						   mailArray[a].lastAction = "";
					   } else {
						   if (Settings.read("rememeberReadEmails")) {
							   /*
							   if (Settings.read("emailsMarkedAsRead") == "hide") {
								   console.log("removing: " + mailArray[a].title);
								   mailArray.splice(a, 1);
								   a--;
							   } else {
							   */
							   		// assume deleted
								   if (Settings.read("readViaGmailPage") == "hide") {
									   if (mailArray[a].lastAction != "markAsRead") {
										   console.log("removing: " + mailArray[a].title);
										   mailArray.splice(a, 1);
										   a--;
									   }
								   } else {
									   mailArray[a].lastAction = "markAsRead";
								   }
							   /*
							    }
							    */
						   } else {
							   console.log("removing: " + mailArray[a].title);
							   mailArray.splice(a, 1);
							   a--;
						   }
					   }
				   }
	
				   mailArray = mailArray.concat(newestMailArray);
				   mailArray.sort(function (a, b) {
					   if (!Settings.read("groupByLabels") || a.labels.first() == b.labels.first()) {
						   if (a.issued > b.issued)
							   return -1;
						   if (a.issued < b.issued)
							   return 1;
						   return 0;
					   } else {
						   if (Settings.read("groupByLabels")) {
							   if (a.labelSortIndex < b.labelSortIndex) {
								   return -1;
							   } else if (a.labelSortIndex > b.labelSortIndex) {
								   return 1;
							   } else {
								   return 0;
							   }
						   } else {
							   return 0;
						   }
					   }
				   });
				   
				   var MAX_EMAILS_TO_SHOW = 20;
				   for (var a=mailArray.length-1; a>=0 && mailArray.length > MAX_EMAILS_TO_SHOW; a--) {
					   if (mailArray[a]) {
						   if (mailArray[a].lastAction == "markAsRead") {
							   console.log("removing: " + mailArray[a].title);
							   mailArray.splice(a, 1);
							   a++;
						   }
					   } else {
						   break;
					   }
				   }

				   cbParams.mailAccount = that;
			   	   cbParams.newestMailArray = newestMailArray;

				   if (newestMailArray.length) {
					   that.fetchThreads(newestMailArray, function() {
						   callback(cbParams);
						   dfd.resolve("success");
					   });
				   } else {
					   callback(cbParams);
					   dfd.resolve("success");
				   }
				   
			   }
			   
		   });
	   } else { // oauth + IMAP
		   /*
		   if (true) {
			   console.log("man add:", mailAddress, tokenResponse);
			   oAuthForEmails.sendImapRequest(tokenResponse.userEmail, {command:"fetchEmails", labels:["inbox", "Apps"]}, function(jqXHR, textStatus) {
				   if (textStatus == "success") {
					   var data;
					   try {
						   data = JSON.parse(jqXHR.responseText);
					   } catch (e) {
						   data = {}
						   data.error = "Problem parsing feed: " + e + " response: " + jqXHR.responseText;
					   }
					   if (data.error) {
						   var error = "Error: " + data.error;
						   if (data.errorWithAuthentification) {
							   error += "<br><br>Access may have been revoked or denied due to several reasons. Try refreshing or you may need to Add this Account again to re-authorize.";
						   }
						   console.error(error, jqXHR);
						   callback({error:error});
						   dfd.reject(error);
					   } else {
						   console.log("success:", data);
						   
						   unreadCount = data.threads.length;
						   
						   var emailsInFeed = new Array();
						   newestMailArray = new Array();
						   
						   data.threads.sort(function(a, b) {
							   var date1 = new Date(a["messages"].last()["date"]);					
							   var date2 = new Date(b["messages"].last()["date"]);
							   if (date1.getTime() == date2.getTime()) {
								   return 0;
							   } else {
								   return date1.getTime() > date2.getTime() ? -1 : 1;
							   }
						   });

						   $.each(data.threads, function(index, thread) {
						   
						   		// do blah blah stuff here to init mailboject etc...

							   // check if this email appeared in previous label fetches (ie. it was labeled with multiple labels) if so then avoid adding this email again
							   var emailAlreadyFoundInADifferentLabelFetch = false;
							   for (var a=0; a<emailsInFeed.length; a++) {
								   if (emailsInFeed[a].threadId == mailObject.threadId) {
									   emailAlreadyFoundInADifferentLabelFetch = true;
									   //cbParams.feedsArrayInfo[a].emailsInFeed[b].labels.push( feedInfo.label );
									   break;
								   }
							   }
							   
							   
						   });
						   
						   callback({});
						   dfd.resolve("success");
					   }
				   } else {
					   //alert("error: " + textStatus);
					   callback({error:error});
					   dfd.reject(error);
				   }
			   });
		   } else {
			   var error = "no tokenrespnseemails";
			   callback({error:error});
			   dfd.reject(error);
		   }
		   */
	   }

	   return dfd.promise();
   }

   /*
   function cleanSummary(summary) {
		// facebook timeline stuff...
		if (summary) {
			try {
				summary = decodeUTF8(summary);
			} catch (e) {
				summary = "";
			}

			summary = summary.replace(/\r\n/g, " ");
			summary = $.trim(summary);

			summary = filterEmailBody(null, summary);
			summary = summary.replace("========================================", "");

			summary = summary.summarize(180);
			
			return summary;
		} else {
			return;
		}
   }
   */
   
   function executeMailAction(params) {
	   return postAction(params, function(postActionCBParams) {
		   console.log("in executeMailAction", postActionCBParams);
		   if (postActionCBParams.error) {
			   logError("error executing postaction: " + postActionCBParams.error);
		   } else {
			   that.getEmails();
			   if (params.postActionCallback) {
				   params.postActionCallback();
			   }
		   }
		   if (params.callback) {
			   params.callback(postActionCBParams);
		   }
	   });
   }

   function postAction(params, callback) {
	   var dfd = new $.Deferred();
	   
	   if (!callback) {
		   callback = function() {};
	   }
	   
	   if (Settings.read("accountAddingMethod") == "autoDetect") {
		   if (gmailAt == null) {
			   getAt(function() {
				   if (gmailAt) {
					   return postAction(params, callback);
				   } else {
					   var error = "could not get AT";
					   logError(error);
					   callback({error:error});
					   dfd.reject(error);
				   }
			   });
		   } else {
			   var ACT_PARAM_NAME = "act=";
			   var actionParams;
			   if (params.action == "markAsRead") {
				   actionParams = ACT_PARAM_NAME + "rd";
			   } else if (params.action == "markAsUnread") {
				   actionParams = ACT_PARAM_NAME + "ur";
			   } else if (params.action == "deleteEmail") {
				   actionParams = ACT_PARAM_NAME + "tr";
			   } else if (params.action == "archive") {
				   actionParams = ACT_PARAM_NAME + "arch";
			   } else if (params.action == "markAsSpam") {
				   actionParams = ACT_PARAM_NAME + "sp";
			   } else if (params.action == "applyLabel") {
				   actionParams = ACT_PARAM_NAME + "ac_" + encodeURIComponent(params.label);
			   } else if (params.action == "removeLabel") {
				   actionParams = ACT_PARAM_NAME + "rc_" + encodeURIComponent(params.label);
			   } else if (params.action == "star") {
				   if (params.mail.labels.first()) {
					   actionParams = "tact=st&nvp_tbu_go=Go&s=a";
				   } else if (params.mail.labels.first() == "") { //inbox usually
					   actionParams = ACT_PARAM_NAME + "st";
				   }
			   } else if (params.action == "reply") {
				   var replyAllQueryStr = params.replyAllFlag ? "a" : "o";
				   actionParams = "v=b&qrt=n&fv=cv&cs=qfnq&rm=" + params.mail.frontendMessageId + "&th=" + params.mail.frontendMessageId + "&qrr=" + replyAllQueryStr + "&body=" + encodeURIComponent(params.message) + "&nvp_bu_send=Send&haot=qt&redir=?v=c";
				   //actionParams = "v=b&qrt=n&fv=cv&cpt=c&pv=tl&cs=c&rm=" + params.mail.frontendMessageId + "&th=" + params.mail.frontendMessageId + "&qrr=" + replyAllQueryStr + "&body=" + encodeURIComponent(params.message) + "&nvp_bu_send=Send&haot=qt&redir=?v=c";
			   } else {
				   var error = "action not found: " + params.action;
				   logError(error);
				   callback({error:error});
				   dfd.reject(error);
				   return;
			   }
			   
			   var postURL = that.getMailUrl().replace("http:", "https:");
			   postURL += "h/" + Math.ceil(1000000 * Math.random()) + "/";
			   var postParams = "t=" + params.mail.frontendMessageId + "&at=" + gmailAt + "&" + actionParams;

			   var postXHR = new XMLHttpRequest();
			   postXHR.onreadystatechange = function () {
				   //console.log("in postaction: " + postURL + ": " + this.readyState + " __ " + this.status);
				   if (this.readyState == 4 && this.status == 200) {
					   callback({});
					   dfd.resolve("success");
				   } else if (this.readyState == 4 && this.status == 401) {
					   callback({error:"Unauthorized"});
					   dfd.reject("Unauthorized");
				   }
			   }
			   postXHR.onerror = function (error) {
				   callback({error:error});
				   dfd.reject(error);
			   }

			   postXHR.open("POST", postURL, true);
			   postXHR.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
			   postXHR.send(postParams);
		   }		   
	   } else { // oauth submit
		   var data = {threadId:params.mail.threadId};
		   
		   // fill data object details...
		   if (params.action == "markAsRead") {
			   data.command = "markAsRead";
		   } else if (params.action == "markAsUnread") {
			   data.command = "markAsUnread";
		   } else if (params.action == "deleteEmail") {
			   data.command = "deleteByThreadId";
		   } else if (params.action == "archive") {
			   data.command = "archiveByThreadId";
		   } else if (params.action == "markAsSpam") {
			   data.command = "spamByThreadId";
		   } else if (params.action == "applyLabel") {
			   data.command = "applyLabel";
			   data.label = params.label;
		   } else if (params.action == "removeLabel") {
			   data.command = "removeLabel";
			   data.label = params.label;
		   } else if (params.action == "star") {
			   data.command = "starByThreadId";
		   } else if (params.action == "reply") {
			   //var replyAllQueryStr = params.replyAllFlag ? "a" : "o";
			   data.command = "sendEmail";
			   
			   var inReplyTo;
			   var quotedContent;
			   if (params.mail.messages) {
				   var lastMessage = params.mail.messages.last();
				   
				   data.tos = [lastMessage.from];
				   
				   if (params.replyAllFlag) {
					   data.tos = data.tos.concat(lastMessage.to);
					   data.ccs = lastMessage.cc;
				   }
				   
				   // used to group replies by converstion in Gmail etc.
				   inReplyTo = lastMessage["message-id"];
				   quotedContent = lastMessage.content;
			   } else {
				   var toObj = {};
				   toObj.email = params.mail.authorMail;
				   toObj.name = params.mail.authorName;
				   data.tos = [toObj];
				   
				   quotedContent = params.mail.summary;
			   }
			   
			   if (inReplyTo) {
				   data.inReplyTo = inReplyTo;
			   }				   
			   data.subject = params.mail.title;
			   data.message = params.message + "<blockquote type='cite' style='border-left:1px solid #ccc;margin-top:20px;margin-bottom:10px;margin-left:50px;padding-left:9px'>" + quotedContent + "</blockquote>";
		   } else {
			   var error = "action not found: " + params.action;
			   logError(error);
			   callback({error:error});
			   dfd.reject(error);
			   return;
		   }
		   
		   oAuthForEmails.sendImapRequest(mailAddress, data, function(jqXHR, textStatus) {
			   console.log("oAuthForEmails.sendImapRequest: ", textStatus);
			   if (textStatus == "success") {
				   var data;
				   try {
					   data = JSON.parse(jqXHR.responseText);
				   } catch (e) {
					   data = {}
					   data.error = "Problem parsing feed: " + e + " response: " + jqXHR.responseText;
				   }
				   if (data.error) {
					   var error = "Error: " + data.error;
					   if (data.errorWithAuthentification) {
						   error += "Access may have been revoked or denied due to several reasons. Try refreshing or you may need to Add this Account again to re-authorize.";
					   }
					   logError(error, jqXHR);
					   callback(data); // use data because it holds the .error and errorWithAuthentification etc.
					   dfd.reject(error);
				   } else {
					   console.log("success:", data);
					   callback({});
					   dfd.resolve("success");
				   }
			   } else {
				   logError(textStatus, jqXHR);
				   callback({error:textStatus});
				   dfd.reject(textStatus);
			   }
		   });
	   }
	   
	   return dfd.promise(); 
   }

   // Opens the basic HTML version of Gmail and fetches the Gmail_AT value needed for POST's
   function getAt(callback) {
	   var url = that.getMailUrl() + "h/" + Math.ceil(1000000 * Math.random()) + "/?ui=html&zy=c";
	   var gat_xhr = new XMLHttpRequest();
	   gat_xhr.onreadystatechange = function () {
		   if (this.readyState == 4 && this.status == 200 && this.responseText) {
			   var matches = this.responseText.match(/\at=([^"]+)/);
			   if (matches != null && matches.length > 0) {
				   gmailAt = matches[1];
				   console.log("get at: " + gmailAt);
				   if (callback != null) {
					   callback();
				   }
			   }
		   } else if (this.readyState == 4 && this.status == 401) {

		   }
	   }
	   gat_xhr.onerror = function (error) {
		   logError("get gmail_at error: " + error);
	   }
	   gat_xhr.open("GET", url, true);
	   gat_xhr.send(null);
   }

   // Opens the inbox
   this.openInbox = function (params) {
	   if (!params) {
		   params = {};
	   }
	   params.label = that.getOpenLabel();
	   	
	   if (params.openInNewTab) {
		   var newURL = generateMailURLWithLabel(that.getMailUrl(), params);
		   createTab(newURL);
	   } else {
		   findOrOpenGmailTab(params);
	   }
   }
   
   this.openLabel = function(label) {
	   findOrOpenGmailTab({label:label});
   }
   
   this.openSearch = function(searchStr, params) {
	   if (!params) {
		   params = {};
	   }
	   params.label = "search";
	   params.searchStr = searchStr;
	   findOrOpenGmailTab(params);
   }

   // ie. https://mail.google.com/mail/u/0/?shva=1#inbox/136dbea54659a55c
   function generateMailURLWithLabel(mailURLPrefix, params) {
	   console.log(mailURLPrefix, params)
	   var labelToUse;
	   if (params.label != undefined) {
		   labelToUse = params.label;
	   } else {
		   labelToUse = params.mail.labels.first();
	   }
	   
	   if (labelToUse == "") {
		   labelToUse = "inbox"
	   } else if (labelToUse == "important" || labelToUse == "^iim") {
		   labelToUse = "inbox"; // mbox changed to inbox
	   } else if (labelToUse == "mbox") { // leave this there so that the else statement does not get called (ps. mbox was changed by google to imp)
		   labelToUse = "inbox"; // mbox was changed to inbox
	   } else if (labelToUse == "unread") {
		   labelToUse = "all";
	   } else if (labelToUse == "all") { // leave this because or else #label/all (apparently fetches all mail + spam)
		   labelToUse = "all";
	   } else if (labelToUse == "search/l:unread") {
		   labelToUse = "search/l:unread";
	   } else if (labelToUse == "search") {
		   var searchStrFormatted = encodeURIComponent(params.searchStr);
		   searchStrFormatted = searchStrFormatted.replace(/%20/g, "+");
		   labelToUse = "search/" + searchStrFormatted;
	   } else {
		   labelToUse = "label/" + labelToUse;
	   }
	   
	   var newURL = mailURLPrefix + "#" + labelToUse;
	   if (params.mail) {
		   newURL += "/" + params.mail.frontendMessageId;
	   }
	   return newURL;
   }
   
   function loadMailInGmailTab(params, callback) {
	   // focus window
	   chrome.windows.update(params.tab.windowId, {focused:true}, function() {
		   // focus/update tab
		   var newURL = generateMailURLWithLabel(params.tab.url.split("#")[0], params);
		   
		   // if same url then don't pass url parameter or else chrome will reload the tab
		   if (params.tab.url == newURL) {
			   chrome.tabs.update(params.tab.id, {active:true}, callback);
		   } else {
			   chrome.tabs.update(params.tab.id, {active:true, url:newURL}, callback);

			   // patch for issue when your newly composing an email, it seems if you navigate away Gmail with change the url back #compose after this initial change, so we have to change it twice with a delay
			   if (params.tab.url.endsWith("#compose")) {
				   setTimeout(function() {
					   chrome.tabs.update(params.tab.id, {active:true, url:newURL}, callback);
				   }, 3000);
			   }
		   }
	   });
   }
   
   function findOrOpenGmailTab(params) {
	   // get all gmail windows
	   chrome.tabs.query({url:MAIL_DOMAIN_AND_PATH + "*"}, function(tabs) {
		   
		   var MULTIACCOUNT_PATH = "/mail(/ca)?/u/";
		   var defaultMailURLTab;
		   var exactMailURLTab;
		   $.each(tabs, function(index, tab) {
			   // apparently a launching Gmail in Chrome application shortcut is windowType = "popup" ???		   
			   if (!tab.url.match(MULTIACCOUNT_PATH)) {
				   // no account # appended so could be the default url /mail/ (ie. NOT /mail/u/0/ etc..
				   defaultMailURLTab = tab;
			   } else if (tab.url.match(MULTIACCOUNT_PATH + that.id)) {
				   exactMailURLTab = tab;
				   return false;
			   }
		   });
		   
		   // if 1st account then look for default url just /mail/ and not /mail/u/0/
		   if (that.getMailUrl().indexOf("/mail/u/0") != -1 && defaultMailURLTab) {
			   params.tab = defaultMailURLTab;
			   loadMailInGmailTab(params);
		   } else if (exactMailURLTab) {
			   params.tab = exactMailURLTab;
			   loadMailInGmailTab(params);
		   } else {
			   var newURL = generateMailURLWithLabel(that.getMailUrl(), params)
			   if (params.noMatchingTabFunction) {
				   params.noMatchingTabFunction(newURL);
			   } else {
				   createTab(newURL);
			   }
		   }
		   
	   });
	   
	   if (params.mail) {
		   params.mail.markAsRead(function() {
			   that.getEmails();
		   });
	   }
	   
   }

   // Fetches content of thread
   function fetchThread(params, callback) {
	   var dfd = new $.Deferred();
	   
	   if (Settings.read("accountAddingMethod") == "autoDetect") { // via gmail interface
		   var mail = params.mail;
		   
		   if (!callback) {
			   callback = function() {};
		   }

		   console.log("fetchthread: " + mail.title);
		   
		   var url = that.getMailUrl().replace('http:', 'https:') + "h/" + Math.ceil(1000000 * Math.random()) + "/?v=pt&th=" + mail.frontendMessageId;
		   
		   $.ajax({
			   type: "GET",
			   timeout: requestTimeout,
			   url: url,
			   complete: function(jqXHR, textStatus) {

				   if (textStatus == "success") {

					   mail.messages = [];

					   // patch 101 to not load any images because apparently $("<img src='abc.gif'");  will load the image even if not displayed
					   var responseText = jqXHR.responseText;
					   
					   /*
					   if (!params.forceDisplayImages) {
						   // just remove img altogether
						   if (responseText) {
							   responseText = responseText.replace(/<img /g, "<imghidden ");
							   responseText = responseText.replace(/\/img>/g, "/imghidden>");
						   }
					   }
					   */
					   
					   // need to add wrapper so that this jquery call workes "> table" ???
					   // patch for error "Code generation from strings disallowed for this context"
					   // the error would occur if I use jQuery's .append but not!!! if I initially set the content with $()
					   var $responseWrapper = $("<div id='$responseWrapper'>" + responseText + "</div>");

					   // before google changed print page layout
					   var $tables = $responseWrapper.find("> table");
					   if ($tables.length) {
						   $tables = $tables.splice(0, 1);
					   } else {
						   // new layout
						   $tables = $responseWrapper.find(".maincontent .message");
					   }
					   
					   if ($tables.length && $tables.each) {
						   $tables.each(function(i) {
							   
							   var message = {};
							   message.to = [];
							   message.cc = [];
							   message.bcc = [];
							   
							   var $messageNode = $(this);
							   
							   // get from via by parsing this string:  John Poon <blah@hotmail.com>
							   var from = $messageNode.find("tr:eq(0)").find("td").first().text();
							   message.from = parseAddresses(from).first();
							   
							   // get date from first line ex. Chloe De Smet Allègre via LinkedIn <member@linkedin.com>	 Sun, Jan 8, 2012 at 12:14 PM
							   mail.dateStr = $.trim( $messageNode.find("tr:first").find("td").last().text() );
							   //date = "Thu, Mar 8, 2012 at 12:58 AM";
							   mail.date = parseGoogleDate(mail.dateStr);

							   // get to/CC
							   var $toCCHTML = $messageNode.find("tr:eq(1)").find("td");

							   var divs = $toCCHTML.find("div");							   
							   divs.each(function(i) {

								   // if 2 divs the first line is usually the reply-to line so ignore it
								   if (i == 0 && divs.length >= 2 && divs.eq(1).text().toLowerCase().indexOf("cc:") == -1) {
									   return true;
								   }
								   // remove to:, cc: etc...
								   var emails = $(this).text();
								   emails = emails.replace(/.*:/, "");
								   
								   if ($(this).text().toLowerCase().indexOf("bcc:") != -1) {
									   message.bcc = parseAddresses(emails);
								   } else if ($(this).text().toLowerCase().indexOf("to:") != -1) {
									   message.to = parseAddresses(emails);
								   } else if ($(this).text().toLowerCase().indexOf("cc:") != -1) {
									   message.cc = parseAddresses(emails);
								   } else {
									   // could not detect to or cc, could be in another language like chinese "收件者："
									   message.to = parseAddresses(emails);
								   }

							   });

							   var $gmailPrintContent = $messageNode.find("> tbody > tr:last-child table td");
							   message.content = $gmailPrintContent.html();
							   
							   //message.textContent = htmlToText(message.content);
							   message.textContent = convertGmailPrintHtmlToText($gmailPrintContent);
							   
							   // cut the summary to lines before the [Quoted text hidden] (in any language)
							   var quotedTextHiddenArray = new Array("Quoted text hidden", "Texte des messages précédents masqué");
							   for (var a=0; a<quotedTextHiddenArray.length; a++) {
								   var idx = message.textContent.indexOf("[" + quotedTextHiddenArray[a] + "]");
								   if (idx != -1) {
									   message.textContent = message.textContent.substring(0, idx);
									   break;
								   }
							   }
							   
							   message.textContent = filterEmailBody(mail.title, message.textContent);
							   message.textContent = Encoder.XSSEncode(message.textContent, true);
							   
							   mail.messages.push(message);
						   });
					   } else {
						   var message = {};
						   console.warn("Could not parse body from print page: ", $responseWrapper);
						   message.from = {name:mail.authorName, email:mail.authorMail}; 
						   message.content = $responseWrapper.html();
						   // message.content = "<div>" + $responseWrapper.html() + "</div>";
						   
						   // remove script tags to bypass content_security_policy
						   message.content = message.content.replaceAll("<script", "<div style='display:none'");
						   message.content = message.content.replaceAll("</script>", "</div>");
						   
						   message.textContent = convertGmailPrintHtmlToText($responseWrapper);
						   message.textContent = Encoder.XSSEncode(mail.textContent, true);
						   mail.messages.push(message);
					   }
					   
					   callback({mail:mail});
					   dfd.resolve("success");			   

				   } else {
					   var error = jqXHR.statusText;
					   callback({error:error});
					   dfd.reject(error);
				   }
			   }
		   });
	   } else { // imap fetch body
		   // must pass array to fetchthreads but it will only have one mail
		   var mailArray = [params.mail];
		   params.mail.account.fetchThreads(mailArray, function(response) {
			   if (response.error) {
				   var error = response.error;
				   callback({error:error});
				   dfd.reject(error);
			   } else {				   
				   callback({mail:mailArray.first()});
				   dfd.resolve("success");
			   }
		   });
	   }

	   return dfd.promise();
   }
   
   this.getSetting = function(attributeName, settingsName) {
	   
	   // if no settingsname passed just use attribute
	   if (!settingsName) {
		   settingsName = attributeName;
	   }
	   
	   var emailSettings = Settings.read("emailSettings");
	   if (emailSettings) {
		   var accountEmailSettings = emailSettings[that.getAddress()];
		   if (accountEmailSettings) {
			   if (accountEmailSettings[attributeName] != undefined) {
				   return accountEmailSettings[attributeName];
			   } else {
				   return Settings.read(settingsName);
			   }
		   } else {
			   return Settings.read(settingsName);
		   }
	   } else {
		   return Settings.read(settingsName);
	   }
   }
   
   this.getMonitorLabels = function() {	   
	   var monitorLabels = that.getSetting("monitorLabel", "check_label");
	   // legacy code to convert string to an array with that string
	   if (!$.isArray(monitorLabels)) {
			monitorLabels = new Array(monitorLabels);
	   }
	   return monitorLabels;
   }

   this.getOpenLabel = function() {
	   var openLabel = that.getSetting("openLabel", "open_label");
	   
		// LEGACY code
		// in the options drop down i used to put # before the labels  ie. #inbox or #all, now just put inbox or all 
		if (openLabel && openLabel.indexOf("#") == 0) {
			if (openLabel == "#inbox") {
				return "";
			} else if (openLabel.indexOf("#label/") == 0) {
				return openLabel.substring(7);
			} else {				
				return openLabel.substring(1);
			}
		} else {
			if (openLabel) {
				return openLabel
			} else {				
				return "";
			}
		}

  }

   // Retrieves unread count
   this.getUnreadCount = function () {
	   if (unreadCount <= 0) {
		   return 0;
	   } else {
		   return unreadCount;
	   }
   }
   
   this.getEmailDisplayName = function() {
	   var alias = that.getSetting("alias");
	   if (alias) {
		   return alias;
	   } else {
		   return that.getAddress();
	   }
   }

   this.getMailUrl = function () {
		var mailUrl = MAIL_DOMAIN;

		if (accountParams.domain != null) {
			// This is a GAFYD account
			mailUrl += "/a/" + accountParams.domain + "/";
		} else if (that.id != null) {
			// This is a Google account with multiple sessions activated
			mailUrl += MAIL_PATH + "u/" + that.id + "/";			
		} else {
			// Standard one-session Gmail account
			mailUrl += MAIL_PATH;
		}
	   
		return mailUrl;
   }

   // Returns the email address for the current account
   this.getAddress = function () {
	   if (mailAddress) {
		   return mailAddress;
	   } else {
		   return that.getMailUrl();
	   }
   }
   
   this.hasBeenIdentified = function() {
	   return mailAddress;
   }

   // Returns the mail array
   this.getMail = function () {
	   return mailArray;
   }

   // Returns the newest mail
   this.getNewestMail = function () {
	   return newestMailArray.first();
   }

   // Returns the newest mail
   this.getAllNewestMail = function () {
	   return newestMailArray;
   }

   this.getNewAt = function () {
      getAt();
   }
   
   this.generateComposeObject = function(params) {
	   params = initUndefinedObject(params);
	   params.url = that.getMailUrl() + "?view=cm&fs=1&tf=1";
	   params.account = that;
	   if (params.to) {
		   params.url += "&to=" + params.to;
	   }
	   if (params.subject) {
		   params.url += "&su=" + params.subject;
	   }
	   if (params.body) {
		   params.url += "&body=" + params.body;
	   }
	   return params;
   }
   
   function fetchLabelsFromHtmlSource(callback) {
	   $.ajax({
		   type: "GET",
		   dataType: "text",
		   url: that.getMailUrl(),
		   timeout: 7000,
		   complete: function(jqXHR, textStatus) {
			   var foundLabels = false;
			   
			   if (textStatus == "success") {
				   var data = jqXHR.responseText;
				   if (data) {
					   var labelStartStr = '["ua",';
					   var startIndex = data.indexOf(labelStartStr);
					   if (startIndex != -1) {
						   startIndex += labelStartStr.length;
						   try {
							   var endIndex = data.indexOf(']\n]', startIndex) + 3;
							   var length = endIndex - startIndex;
							   var labelsRawStr = data.substr(startIndex, length);
							   //console.log("data: ", data);
							   //console.log("data2: ", data.substr(startIndex));
							   var labelsRawObj = JSON.parse(labelsRawStr);
							   
							   labels = [];
							   for (var a=labelsRawObj.length-1; a>=0; a--) {
								   var labelName = labelsRawObj[a][0];
								   if (labelName.indexOf("^") != 0) {
									   labels.push(labelName);							   
								   }
							   }
							   
							   labels.caseInsensitiveSort();
							   foundLabels = true;
						   } catch (e) {
							   logError("An error occured while parsing labels: ", e, jqXHR);
						   }
					   } else {
						   logError("did not find label search str: " + labelStartStr);
					   }
				   }
			   } else {
				   logError("An error occured while fetching globals: " + textStatus, jqXHR);				   
			   }
			   
			   if (foundLabels) {
				   callback({labels:labels});
			   } else {
				   console.warn("trying alternative fetch for labels");
				   $.ajax({
					   type: "GET",
					   dataType: "text",
					   url: that.getMailUrl() + "h/",
					   timeout: 7000,
					   complete: function(jqXHR, textStatus) {
						   if (textStatus == "success") {
							   var data = jqXHR.responseText;
							   if (data) {
								   var startIndex = data.indexOf("<select name=tact>");
								   if (startIndex != -1) {
									   try {
										   var endIndex = data.indexOf("</select>", startIndex);
										   var html = data.substring(startIndex, endIndex);
										   labels = [];
										   $(html).find("option").each(function() {
											   var label = $(this).attr("value");
											   if (label.indexOf("ac_") == 0) {
												   labels.push(label.substring(3));
											   }
										   });
										   
										   labels.caseInsensitiveSort();
										   foundLabels = true;
									   } catch (e) {
										   logError("error parsing html2", e);
									   }
								   }
							   }
						   } else {
							   logError("An error occured while fetching globals2: " + textStatus);
						   }
						   
						   if (foundLabels) {
							   callback({labels:labels});
						   } else {
							   callback({error:"Problem loading labels, try again later!"});
						   }
					   }
				   });
			   }
		   }
	   });
   }
   
   function fetchLabels(forceRefresh, callback) {
	   if (Settings.read("accountAddingMethod") == "autoDetect") {
		   fetchLabelsFromHtmlSource(callback);
	   } else {
		   oAuthForEmails.sendImapRequest(mailAddress, {command:"fetchLabels"}, function(jqXHR, textStatus) {
			   console.log("oAuthForEmails.sendImapRequest: ", textStatus);
			   if (textStatus == "success") {
				   var data;
				   try {
					   data = JSON.parse(jqXHR.responseText);
				   } catch (e) {
					   data = {}
					   data.error = "Problem parsing feed: " + e + " response: " + jqXHR.responseText;
				   }
				   if (data.error) {
					   var error = "Error: " + data.error;
					   if (data.errorWithAuthentification) {
						   error += "Access may have been revoked or denied due to several reasons. Try refreshing or you may need to Add this Account again to re-authorize.";
					   }
					   logError(error, jqXHR);
					   callback(data);
				   } else {
					   console.log("success:", data);
					   labels = data.response;
					   callback({labels:labels});
				   }
			   } else {
				   logError(error, jqXHR);
				   callback({error:textStatus});
			   }
		   });
	   }
   }

   this.getLabels = function(forceRefresh, callback) {
	   if (!callback) {
		   callback = function() {};
	   }
	   
	   if (labels && !forceRefresh) {
		   callback({labels:labels});
	   } else {
		   fetchLabels(forceRefresh, callback);
 	   }
   }
}