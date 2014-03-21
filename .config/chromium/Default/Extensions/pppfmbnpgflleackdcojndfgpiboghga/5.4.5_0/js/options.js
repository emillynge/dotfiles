var storageResponse;
var storageManager;
var storage;

$(document).ready(function() {
	getStorageItems(function(response) {
		storageResponse = response;
		storageManager = response.storageManager;
		storage = response.storage;

		initOptions(storageManager, storage);
		
		/*
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
						alert("error removing permission");
						$("#runInBackground").get(0).checked = true;
					}
				});
			}
		});
		*/

		$("#desktopNotifications").change(function() {
			if (this.checked) {
				
				initOAuth();
				oAuthForDevices.send({userEmail:"default", url: "changes", data:{maxResults:1}}, function(result) {
					if (result.data) {
						//console.log(result);
						storage.largestChangeId = result.data.largestChangeId;
						storageManager.set("largestChangeId", storage.largestChangeId);
					} else {
						console.error("error: ", result);
						alert("Error: " + result.error);
					}
				});
				
			}
		});
		
		$("#revokePermissions").click(function() {
			localStorage.removeItem("tokenResponses");
			alert("Done")
		});
		
		$("#title").click(function() {
			processChanges(storageManager, storage);
		})
		
		$("#excludeFolders, #maxItemsToDisplay").change(function() {
			initOAuth();
			fetchFiles(storageResponse, function(files) {
				
			});
		});
	
	});
	
});