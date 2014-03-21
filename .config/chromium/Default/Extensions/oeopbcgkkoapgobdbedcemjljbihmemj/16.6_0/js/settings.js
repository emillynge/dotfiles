/// <reference path="DB.js" />

var Settings = function() {

   var cache = {};
   var storeId = "settings";

   Settings.defaults = {
      "animateButtonIcon": true,
      "soundNotification": true,
      "voiceNotification": true,
      "voiceNotificationOnlyIfIdle": true,
      "hearSubject": true,
      "hearMessage": true,
      "desktopNotification": true,
      "poll": 30000,
      "dn_timeout": 15000,
      "sn_audio": "chime.ogg",
      "check_label": "",
      "open_label": "",
      "icon_set": "default",
      "preview_setting": 2,
      "check_gmail_off": false,
      "hide_count": false,
      "showfull_read": true,
      "conversationView": true,
      "openComposeReplyAction": "popupWindow",
      "popupLeft": "100",
      "popupTop": "100",
      "popupWidth": "640",
      "popupHeight": "580",
      "archive_read": true,
      "voice": "native",
      "showStar": true,
      "showArchive": true,
      "showSpam": true,
      "showDelete": true,
      "showReply": false,
      "showOpen": true,
      "showMarkAsRead": true,
      "showMarkAsUnread": true,
      "buttons": "original",
      "muteVoiceStart": 23,
      "muteVoiceEnd": 7,
      "groupByLabels": true,
      "showOptionsButton": true,
      "showLeftColumnWhenPreviewingEmail": true,
      "notificationSoundVolume": 100,
      "voiceSoundVolume": 100,
      "pitch": 1.0,
      "rate": 1.0,
      "spokenWordsLimit": "summary",
      "notificationWindowType": "rich",
      "replyingMarksAsRead": true,
      "fetchContactsInterval": 48,
      "colorStart1": "#E1EDEC",
      "colorEnd1": "#00B88D",
      "colorStart2": "#E8E1D3",
      "colorEnd2": "#B87500",
      "voiceInputDialect": navigator.language,
      "buttonFilter": "",
      "hue-rotate": 0,
      "grayscale": 0,
      "sepia": 0,
      "brightness": 0,
      "contrast": 100,
      "invert": 0,
      "saturate": 100,
      "linesInSummary": "2",
      "emailPreview": true,
      "alwaysDisplayExternalContent": false,
      "showActionButtonsOnHover": true,      
      "emailsMarkedAsRead": "hide",
      "readViaGmailPage": "show",
      "keyboardException_R": "reply",
      "showTransitions": true,
      "notificationDisplayName": "firstNameOnly",
      "accountAddingMethod": "autoDetect",
      "voiceNotificationOnlyIfIdle": true,
      "voiceNotificationOnlyIfIdleInterval": 15,
      "showNotificationDuration": 15,
      "notificationBehaviour": "removeFromTray",
      "notificationClickAnywhere": "open",
      "zoom": "auto",
      "notificationButton1": "markAsRead",
      "notificationButton2": "delete",
      "notificationDisplay": "from|subject|message"
   };
   
   function loadFromDB(callback) {
      wrappedDB.readAllObjects(storeId,
	      function (setting) {
	         cache[setting.key] = setting.value;
	      }, callback
	  );
   }

   Settings.read = function (key) {
      if (cache[key] != null) {
         return cache[key];
      }

      if (this.defaults[key] != null) {
         return this.defaults[key];
      }

      return null;
   };

   Settings.store = function (key, value) {
      cache[key] = value;
      return wrappedDB.putObject(storeId, key, value);
   };

   Settings.load = function (callback) {
	   var DBNAME = "MCP_DB";
	   wrappedDB.open(DBNAME, storeId, function () {
		   loadFromDB(callback);			   
	   });
   };
}

Settings();