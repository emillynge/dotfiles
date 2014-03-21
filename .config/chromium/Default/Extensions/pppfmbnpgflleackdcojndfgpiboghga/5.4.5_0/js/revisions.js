function receiveMessage(e) {
	console.log("receivemessage", e);
	if (event.origin.indexOf(chrome.runtime.id) != -1) {
		var file = e.data.file;
	
		$(document).ready(function() {
			
			$("title").text(file.title + " - revisions");
			
			$("#fileTitle")
				.text(file.title)
				.click(function() {
					chrome.tabs.create({url:file.alternateLink});
					window.close();
					return false;
				})
			;
			
			initOAuth();
			compareRevisions(file.id, function(response) {
				var diffNode = buildView(response.lastRevision, response.currentRevision, 1);
				var $diffNode = $(diffNode);
				$diffNode.find("td").each(function() {
					
					// replace * with bullets
					$(this).text( $(this).text().replace(/^\*/, "•") );
				});
				
				$("#diffArea")
					.empty()
					.append(diffNode)
				;
				
				// scroll to first change
				var $firstChange = $(".insert, .delete").first();
				if ($firstChange.length) {
					$firstChange.get(0).scrollIntoView();
				}
				// then scroll back just a bit higher to see previous lines (to give user context)
				$("body").scrollTop( $("body").scrollTop()- 20 );
				
				$("#loading").hide();
			});
		});
	}
}

window.addEventListener("message", receiveMessage, false);

/*
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
	console.log("message", message);
	var file = message.file;
	
	$(document).ready(function() {
		$("#fileTitle")
			.text(file.title)
			.click(function() {
				chrome.tabs.create({url:file.alternateLink});
				window.close();
				return false;
			})
		;		
	});
	
	sendResponse();
});
*/